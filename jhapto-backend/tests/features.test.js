// Google sign-in, report conversations, hostel management, student-created items
// and email / push delivery. Google, Gmail and Firebase are replaced by fakes.

// ── Fakes for the outside services ───────────────────────────
const mockVerifyIdToken = jest.fn();
jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({ verifyIdToken: mockVerifyIdToken })),
}));

const mockSendMail = jest.fn().mockResolvedValue({});
jest.mock('nodemailer', () => ({ createTransport: () => ({ sendMail: mockSendMail }) }));

const mockSendEachForMulticast = jest.fn();
jest.mock('firebase-admin/app', () => ({
  initializeApp: jest.fn(() => ({ name: 'jhapto' })), cert: jest.fn(() => ({})), getApps: () => [],
}));
jest.mock('firebase-admin/messaging', () => ({
  getMessaging: () => ({ sendEachForMulticast: mockSendEachForMulticast }),
}));

process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';

const { api, db, sql, resetDb, login, adminLogin, bearer } = require('./helpers/testkit');
const { deliverPending } = require('../utils/notify');

beforeAll(resetDb);
afterAll(() => db.end());
beforeEach(() => {
  mockVerifyIdToken.mockReset();
  mockSendMail.mockClear();
  mockSendEachForMulticast.mockReset();
});

// What Google would put in an ID token
const googleSays = (payload) => mockVerifyIdToken.mockResolvedValue({
  getPayload: () => ({ sub: 'g-123', email_verified: true, name: 'Ishaan Verma', ...payload }),
});
const thapar = { email: 'iverma_be23@thapar.edu', hd: 'thapar.edu' };

// ── Google sign-in ───────────────────────────────────────────
describe('Sign in with Google', () => {
  test.each([
    ['a personal Gmail account', { email: 'ishaan@gmail.com', hd: undefined }, 403, /Only Thapar accounts/],
    ['a thapar.edu address without the Workspace domain claim', { email: 'x@thapar.edu', hd: undefined }, 403, /Only Thapar accounts/],
    ['another university', { email: 'x@tiet.ac.in', hd: 'tiet.ac.in' }, 403, /Only Thapar accounts/],
    ['an unverified email', { ...thapar, email_verified: false }, 403, /not verified/],
  ])('refuses %s', async (_label, payload, status, msg) => {
    googleSays(payload);
    const res = await api().post('/api/auth/google').send({ credential: 'token' });
    expect(res.status).toBe(status);
    expect(res.body.message).toMatch(msg);
  });

  test('refuses a token Google rejects (forged, expired, wrong app)', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('Wrong recipient'));
    const res = await api().post('/api/auth/google').send({ credential: 'forged' });
    expect(res.status).toBe(401);
    expect(mockVerifyIdToken).toHaveBeenCalledWith({ idToken: 'forged', audience: process.env.GOOGLE_CLIENT_ID });
  });

  test('new Thapar student: profile step, then logged in; next time straight in', async () => {
    googleSays(thapar);
    const first = await api().post('/api/auth/google').send({ credential: 'token' }).expect(200);
    expect(first.body).toMatchObject({ needs_profile: true, email: thapar.email, name: 'Ishaan Verma' });
    expect(first.body.token).toBeUndefined();

    // the sign-up token can't be swapped for another identity, and bad input is checked
    const tampered = await api().post('/api/auth/google/complete')
      .send({ signup_token: `${first.body.signup_token}x`, phone_no: '9000000001', hostel_id: 1, floor_id: 3 });
    expect(tampered.status).toBe(401);
    const badFloor = await api().post('/api/auth/google/complete')
      .send({ signup_token: first.body.signup_token, phone_no: '9000000001', hostel_id: 1, floor_id: 99 });
    expect(badFloor.status).toBe(400);

    const done = await api().post('/api/auth/google/complete')
      .send({ signup_token: first.body.signup_token, phone_no: '9000000001', hostel_id: 1, floor_id: 3 }).expect(201);
    expect(done.body.token).toBeTruthy();
    expect(done.body.student).toMatchObject({ email: thapar.email, floor_number: 3, hostel_name: 'Kailash Hostel' });

    const again = await api().post('/api/auth/google').send({ credential: 'token' }).expect(200);
    expect(again.body.student.email).toBe(thapar.email);

    // no password on this account
    const pw = await api().post('/api/auth/login').send({ email: thapar.email, password: 'anything' });
    expect(pw.status).toBe(401);
    expect(pw.body.message).toMatch(/Google sign-in/);
    const me = await api().get('/api/auth/me').set(bearer(again.body.token)).expect(200);
    expect(me.body).toMatchObject({ has_password: false, google_linked: true, email_notifications: true });
  });

  test('a password account with the same email is linked, not duplicated', async () => {
    await api().post('/api/auth/register').send({
      name: 'Meera', email: 'meera@thapar.edu', phone_no: '9000000002', password: 'secret1', hostel_id: 1, floor_id: 2,
    }).expect(201);
    googleSays({ sub: 'g-meera', email: 'meera@thapar.edu', hd: 'thapar.edu' });
    const res = await api().post('/api/auth/google').send({ credential: 'token' }).expect(200);
    expect(res.body.student.email).toBe('meera@thapar.edu');
    expect((await sql('SELECT google_sub FROM Student WHERE email = ?', ['meera@thapar.edu']))[0].google_sub).toBe('g-meera');
  });

  test('banned students cannot sign in with Google', async () => {
    await sql('UPDATE Student SET is_banned = TRUE WHERE email = ?', ['meera@thapar.edu']);
    googleSays({ sub: 'g-meera', email: 'meera@thapar.edu', hd: 'thapar.edu' });
    expect((await api().post('/api/auth/google').send({ credential: 'token' })).status).toBe(403);
    await sql('UPDATE Student SET is_banned = FALSE WHERE email = ?', ['meera@thapar.edu']);
  });

  test('public config tells the frontend the Google client id', async () => {
    const res = await api().get('/api/config').expect(200);
    expect(res.body).toMatchObject({ googleClientId: process.env.GOOGLE_CLIENT_ID, allowedEmailDomains: ['thapar.edu'] });
  });
});

// ── Report conversations ─────────────────────────────────────
describe('report conversation between the reporter and admins', () => {
  let reportId;

  test('reporter and admin talk; outsiders cannot read it; reporter is notified', async () => {
    const rohan = await login('rohan');
    const filed = await api().post('/api/reports').set(bearer(rohan))
      .send({ order_id: 1, reported_user_id: 1, reason: 'Item was expired' }).expect(201);
    reportId = filed.body.report_id;

    await api().post(`/api/reports/${reportId}/messages`).set(bearer(rohan))
      .send({ message_text: 'I have a photo of the date too' }).expect(201);

    // someone else can't see or write in it
    const karan = await login('karan');
    expect((await api().get(`/api/reports/${reportId}/messages`).set(bearer(karan))).status).toBe(404);
    expect((await api().post(`/api/reports/${reportId}/messages`).set(bearer(karan)).send({ message_text: 'hi' })).status).toBe(404);

    const admin = await adminLogin();
    const list = await api().get('/api/admin/reports').set(bearer(admin)).expect(200);
    expect(list.body.find((r) => r.report_id === reportId)).toMatchObject({ message_count: 1, last_sender: 'student' });

    await api().post(`/api/admin/reports/${reportId}/messages`).set(bearer(admin))
      .send({ message_text: 'Thanks, we are looking into it.' }).expect(201);
    await api().patch(`/api/admin/reports/${reportId}`).set(bearer(admin)).send({ status: 'Resolved' }).expect(200);
    // setting the same status again doesn't notify twice
    await api().patch(`/api/admin/reports/${reportId}`).set(bearer(admin)).send({ status: 'Resolved' }).expect(200);

    const thread = await api().get(`/api/reports/${reportId}/messages`).set(bearer(rohan)).expect(200);
    expect(thread.body.report).toMatchObject({ status: 'Resolved', reported_name: 'Aarav Sharma' });
    expect(thread.body.messages.map((m) => [m.sender_role, m.message_text])).toEqual([
      ['student', 'I have a photo of the date too'],
      ['admin', 'Thanks, we are looking into it.'],
    ]);

    const mine = await api().get('/api/reports/mine').set(bearer(rohan)).expect(200);
    expect(mine.body[0]).toMatchObject({ report_id: reportId, status: 'Resolved', message_count: 2, last_sender: 'admin' });

    const notes = await sql(`SELECT message, link FROM Notification WHERE student_id = 3 AND type = 'report_update' ORDER BY notification_id`);
    expect(notes.map((n) => n.link)).toEqual([`/reports/${reportId}`, `/reports/${reportId}`]);
    expect(notes[0].message).toMatch(/Admin replied to your report/);
    expect(notes[1].message).toMatch(/marked Resolved/);
  });

  test('students cannot use the admin endpoints', async () => {
    const res = await api().post(`/api/admin/reports/${reportId}/messages`).set(bearer(await login('rohan')))
      .send({ message_text: 'I am the admin now' });
    expect(res.status).toBe(403);
  });
});

// ── Hostels ──────────────────────────────────────────────────
describe('admins add hostels', () => {
  test('add a hostel with floors, add more floors; it shows up for sign-up', async () => {
    const admin = await adminLogin();
    await api().post('/api/admin/hostels').set(bearer(admin))
      .send({ hostel_name: 'Amritam Hostel', hostel_code: 'ah01', floor_count: 3 }).expect(201);
    const dupe = await api().post('/api/admin/hostels').set(bearer(admin))
      .send({ hostel_name: 'amritam hostel', hostel_code: 'AH02', floor_count: 3 });
    expect(dupe.status).toBe(409);
    expect((await api().post('/api/admin/hostels').set(bearer(admin))
      .send({ hostel_name: 'X', hostel_code: 'bad code!', floor_count: 3 })).status).toBe(400);

    const hostels = await api().get('/api/admin/hostels').set(bearer(admin)).expect(200);
    const amritam = hostels.body.find((h) => h.hostel_name === 'Amritam Hostel');
    expect(amritam).toMatchObject({ hostel_code: 'AH01', floors: [1, 2, 3], student_count: 0 });

    await api().post(`/api/admin/hostels/${amritam.hostel_id}/floors`).set(bearer(admin)).send({ floor_count: 2 }).expect(201);

    const pub = await api().get('/api/auth/hostels').expect(200);   // no login needed
    const listed = pub.body.find((h) => h.hostel_name === 'Amritam Hostel');
    expect(listed.floors.map((f) => f.floor_number)).toEqual([1, 2, 3, 4, 5]);

    // and students can register into it
    await api().post('/api/auth/register').send({
      name: 'New Resident', email: 'resident@thapar.edu', phone_no: '9000000003', password: 'secret1',
      hostel_id: listed.hostel_id, floor_id: listed.floors[4].floor_id,
    }).expect(201);
  });

  test('students cannot add hostels', async () => {
    const res = await api().post('/api/admin/hostels').set(bearer(await login('karan')))
      .send({ hostel_name: 'Fake', hostel_code: 'FK01', floor_count: 2 });
    expect(res.status).toBe(403);
  });
});

// ── Student-created items ────────────────────────────────────
describe('sellers can list items that are not in the catalogue', () => {
  const listing = { mrp: '40', selling_price: '35', quantity_available: '2', room_number: 'K-12' };

  test('a new item is added once and reused (any capitalisation)', async () => {
    const karan = await login('karan');
    const first = await api().post('/api/listings').set(bearer(karan))
      .send({ ...listing, new_item: { item_name: '  Hide &  Seek Biscuits ', brand: 'Parle', category_id: 4 } }).expect(201);
    const item = (await sql('SELECT * FROM Item WHERE item_id = ?', [first.body.item_id]))[0];
    expect(item).toMatchObject({ item_name: 'Hide & Seek Biscuits', brand: 'Parle', created_by: 5 });

    const second = await api().post('/api/listings').set(bearer(await login('sneha')))
      .send({ ...listing, new_item: { item_name: 'hide & seek biscuits', brand: 'PARLE', category_id: 4 } }).expect(201);
    expect(second.body.item_id).toBe(first.body.item_id);

    // it's searchable and in the item list like any catalogue item
    const items = await api().get('/api/listings/items').set(bearer(karan)).expect(200);
    expect(items.body.filter((i) => i.item_name.toLowerCase() === 'hide & seek biscuits')).toHaveLength(1);
    const browse = await api().get('/api/listings').set(bearer(await login('aarav'))).expect(200);
    expect(browse.body.filter((l) => l.item_name === 'Hide & Seek Biscuits')).toHaveLength(2);
  });

  test.each([
    [{ item_name: 'x', category_id: 1 }, /2–150 characters/],
    [{ item_name: '!!!', category_id: 1 }, /letters or numbers/],
    [{ item_name: 'Good name' }, /category/],
    [{ item_name: 'Good name', category_id: 999 }, /category/],
  ])('rejects new item %o', async (newItem, msg) => {
    const res = await api().post('/api/listings').set(bearer(await login('priya'))).send({ ...listing, new_item: newItem });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(msg);
  });
});

// ── Email + push delivery ────────────────────────────────────
describe('notifications go out by email and push', () => {
  const saved = {};
  beforeAll(() => {
    for (const k of ['GMAIL_USER', 'GMAIL_APP_PASSWORD', 'FIREBASE_SERVICE_ACCOUNT', 'EMAIL_NOTIFICATIONS', 'PUSH_NOTIFICATIONS']) saved[k] = process.env[k];
    process.env.EMAIL_NOTIFICATIONS = 'on';   // the fakes above stand in for Gmail and Firebase
    process.env.PUSH_NOTIFICATIONS = 'on';
    process.env.GMAIL_USER = 'jhapto.alerts@gmail.com';
    process.env.GMAIL_APP_PASSWORD = 'app-password';
    process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({ project_id: 'jhapto-test' });
  });
  afterAll(() => Object.assign(process.env, saved));

  test('each new notification is emailed and pushed once; opted-out students get push only', async () => {
    // a real Thapar address for Sneha (demo @tiet.ac.in addresses are never emailed)
    await sql("UPDATE Student SET email = 'sneha@thapar.edu' WHERE student_id = 4");
    await deliverPending();               // flush anything earlier tests created
    mockSendMail.mockClear();
    mockSendEachForMulticast.mockReset();

    const sneha = (await api().post('/api/auth/login').send({ email: 'sneha@thapar.edu', password: 'password123' })).body.token;
    await api().post('/api/push/register').set(bearer(sneha)).send({ token: 'device-token-sneha-0001', platform: 'android' }).expect(200);
    await api().post('/api/push/register').set(bearer(sneha)).send({ token: 'device-token-dead-00002', platform: 'web' }).expect(200);
    expect((await api().post('/api/push/register').set(bearer(sneha)).send({ token: 'x', platform: 'android' })).status).toBe(400);
    mockSendEachForMulticast.mockResolvedValue({
      successCount: 1,
      responses: [{ success: true }, { success: false, error: { code: 'messaging/registration-token-not-registered' } }],
    });

    // Karan orders from Sneha → trigger writes a notification for Sneha
    const karan = await login('karan');
    const [{ listing_id }] = await sql(`SELECT listing_id FROM Listing WHERE seller_id = 4 AND listing_status = 'Active' LIMIT 1`);
    await api().post('/api/orders').set(bearer(karan)).send({ listing_id, quantity: 1 }).expect(201);
    await deliverPending();

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const mail = mockSendMail.mock.calls[0][0];
    expect(mail).toMatchObject({ to: 'sneha@thapar.edu', subject: 'New order on Jhapto' });
    expect(mail.text).toMatch(/New order #\d+/);
    expect(mail.html).toMatch(/https:\/\/jhapto\.vercel\.app\/seller/);

    expect(mockSendEachForMulticast).toHaveBeenCalledTimes(1);
    const push = mockSendEachForMulticast.mock.calls[0][0];
    expect(push.tokens.sort()).toEqual(['device-token-dead-00002', 'device-token-sneha-0001']);
    expect(push.data).toEqual({ link: '/seller' });
    // the dead token was cleaned up
    expect((await sql('SELECT token FROM push_token WHERE student_id = 4')).map((t) => t.token)).toEqual(['device-token-sneha-0001']);

    // nothing is sent twice
    await deliverPending();
    expect(mockSendMail).toHaveBeenCalledTimes(1);

    // turning email off keeps push
    await api().patch('/api/auth/me').set(bearer(sneha)).send({ email_notifications: false }).expect(200);
    mockSendEachForMulticast.mockResolvedValue({ successCount: 1, responses: [{ success: true }] });
    await api().post('/api/orders').set(bearer(karan)).send({ listing_id, quantity: 1 }).expect(201);
    await deliverPending();
    expect(mockSendMail).toHaveBeenCalledTimes(1);
    expect(mockSendEachForMulticast).toHaveBeenCalledTimes(2);
  });

  test('demo accounts with non-Thapar emails get push but never email; admin alerts go to ADMIN_ALERT_EMAIL', async () => {
    mockSendMail.mockClear();
    mockSendEachForMulticast.mockReset();
    mockSendEachForMulticast.mockResolvedValue({ successCount: 1, responses: [{ success: true }] });
    await sql(`INSERT INTO push_token (token, student_id, platform) VALUES ('karan-device-token-001', 5, 'android') ON CONFLICT DO NOTHING`);
    await sql(`INSERT INTO Notification (student_id, type, message, link) VALUES (5, 'review', 'Test', '/profile')`);
    await deliverPending();
    expect(mockSendMail).not.toHaveBeenCalled();
    expect(mockSendEachForMulticast).toHaveBeenCalledTimes(1);

    process.env.ADMIN_ALERT_EMAIL = 'team@thapar.edu';
    await api().post('/api/reports').set(bearer(await login('rohan')))
      .send({ order_id: 1, reported_user_id: 1, reason: 'Second report for the admin email test' });
    await new Promise((r) => setTimeout(r, 50));
    expect(mockSendMail.mock.calls.map((c) => c[0].to)).toEqual(['team@thapar.edu']);
    process.env.ADMIN_ALERT_EMAIL = '';
  });

  test('chat messages are pushed to the other person', async () => {
    const [{ order_id }] = await sql(`SELECT order_id FROM "Order" WHERE order_status = 'Confirmed' LIMIT 1`)
      .then(async (rows) => rows.length ? rows : (await sql(`UPDATE "Order" SET order_status = 'Confirmed' WHERE order_id = 1 RETURNING order_id`)));
    const [parties] = await sql(
      `SELECT o.buyer_id, l.seller_id FROM "Order" o JOIN Order_Item oi ON oi.order_id = o.order_id
       JOIN Listing l ON l.listing_id = oi.listing_id WHERE o.order_id = ?`, [order_id]);
    await sql(`INSERT INTO push_token (token, student_id, platform) VALUES ('chat-device-token-0001', ?, 'android')
               ON CONFLICT (token) DO UPDATE SET student_id = EXCLUDED.student_id`, [parties.seller_id]);
    const [buyer] = await sql('SELECT email FROM Student WHERE student_id = ?', [parties.buyer_id]);
    const token = (await api().post('/api/auth/login').send({ email: buyer.email, password: 'password123' })).body.token;

    mockSendEachForMulticast.mockResolvedValue({ successCount: 1, responses: [{ success: true }] });
    await api().post(`/api/messages/${order_id}`).set(bearer(token)).send({ message_text: 'Coming down now' }).expect(201);
    await new Promise((r) => setTimeout(r, 50));
    const push = mockSendEachForMulticast.mock.calls.at(-1)[0];
    expect(push.notification.body).toBe('Coming down now');
    expect(push.data).toEqual({ link: `/chat/${order_id}` });
  });
});
