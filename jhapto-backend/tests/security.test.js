// Security regression tests: each one is an attack that must keep failing.
const jwt = require('jsonwebtoken');
const { api, db, sql, resetDb, login, adminLogin, bearer } = require('./helpers/testkit');

beforeAll(resetDb);
afterAll(() => db.end());

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

describe('forged and stale logins', () => {
  test('unsigned (alg=none) and wrong-secret tokens are rejected', async () => {
    const none = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ student_id: 5 })}.`;
    const wrong = jwt.sign({ student_id: 5 }, 'not-the-secret');
    const adminWrong = jwt.sign({ admin_id: 1, is_admin: true }, 'not-the-secret');
    expect((await api().get('/api/auth/me').set(bearer(none))).status).toBe(401);
    expect((await api().get('/api/auth/me').set(bearer(wrong))).status).toBe(401);
    expect((await api().get('/api/admin/students').set(bearer(adminWrong))).status).toBe(401);
  });

  test('a student token cannot pose as an admin, and an admin token is not a student', async () => {
    const studentAsAdmin = jwt.sign({ student_id: 5, is_admin: true }, process.env.JWT_SECRET);
    expect((await api().get('/api/admin/students').set(bearer(studentAsAdmin))).status).toBe(403);
    expect((await api().get('/api/auth/me').set(bearer(await adminLogin()))).status).toBe(401);
  });

  test('a removed admin\'s token stops working', async () => {
    const admin = await adminLogin();
    await api().post('/api/admin/register').set(bearer(admin))
      .send({ name: 'Temp Admin', email: 'temp.admin@thapar.edu', password: 'TempAdmin#2026' }).expect(201);
    const temp = (await api().post('/api/admin/login').send({ email: 'temp.admin@thapar.edu', password: 'TempAdmin#2026' })).body.token;
    await api().get('/api/admin/students').set(bearer(temp)).expect(200);
    await sql("DELETE FROM Admin WHERE email = 'temp.admin@thapar.edu'");
    expect((await api().get('/api/admin/students').set(bearer(temp))).status).toBe(401);
  });

  test('changing the password signs out other devices but keeps this one', async () => {
    const otherDevice = await login('priya');
    await new Promise((r) => setTimeout(r, 1100));   // tokens carry whole-second timestamps
    const thisDevice = await login('priya');
    const res = await api().patch('/api/auth/me/password').set(bearer(thisDevice))
      .send({ current_password: 'password123', new_password: 'NewPassword#1' }).expect(200);
    expect(res.body.token).toBeTruthy();
    expect((await api().get('/api/auth/me').set(bearer(otherDevice))).status).toBe(401);
    await api().get('/api/auth/me').set(bearer(res.body.token)).expect(200);
    // and the new password is what works now
    expect((await api().post('/api/auth/login').send({ email: 'priya@tiet.ac.in', password: 'password123' })).status).toBe(401);
    await api().post('/api/auth/login').send({ email: 'priya@tiet.ac.in', password: 'NewPassword#1' }).expect(200);
  });

  test('new passwords need at least 8 characters', async () => {
    const res = await api().post('/api/auth/register').send({
      name: 'Short Pw', email: 'shortpw@thapar.edu', phone_no: '9000000011', password: 'abc1234', hostel_id: 1, floor_id: 1,
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/at least 8/);
  });
});

describe('malformed and malicious input', () => {
  test.each([
    ['get', "/api/messages/1' OR '1'='1"], ['get', '/api/messages/abc'], ['post', '/api/messages/abc'],
    ['patch', '/api/orders/abc/cancel'], ['patch', '/api/orders/1.5/confirm'], ['patch', '/api/listings/-3'],
    ['delete', '/api/listings/abc'], ['patch', '/api/notifications/abc/read'], ['get', '/api/reports/abc/messages'],
    ['get', '/api/reviews/seller/0x10'],
  ])('%s %s → 400 without database details', async (method, path) => {
    const res = await api()[method](path).set(bearer(await login('karan'))).send({ message_text: 'x', selling_price: '1' });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toMatch(/syntax|integer|relation|column/i);
  });

  test('admin id routes reject junk too', async () => {
    expect((await api().patch('/api/admin/students/abc/ban').set(bearer(await adminLogin()))).status).toBe(400);
  });

  test('server errors never include internal details', async () => {
    const realQuery = db.query;
    db.query = async () => { throw new Error('relation "secret_table" does not exist'); };
    try {
      const res = await api().get('/api/listings/categories').set(bearer(jwt.sign({ student_id: 5 }, process.env.JWT_SECRET)));
      expect(res.status).toBe(500);
      expect(JSON.stringify(res.body)).not.toMatch(/secret_table/);
    } finally {
      db.query = realQuery;
    }
  });
});

describe('browser protections', () => {
  test('other websites cannot call the API from a visitor\'s browser', async () => {
    const evil = await api().get('/api/health').set('Origin', 'https://evil.example');
    expect(evil.headers['access-control-allow-origin']).toBeUndefined();
    const ours = await api().get('/api/health').set('Origin', 'https://jhapto.vercel.app');
    expect(ours.headers['access-control-allow-origin']).toBe('https://jhapto.vercel.app');
  });

  test('API responses carry security headers and are not cached', async () => {
    const res = await api().get('/api/health');
    expect(res.headers).toMatchObject({
      'x-content-type-options': 'nosniff', 'x-frame-options': 'DENY', 'cache-control': 'no-store',
    });
  });
});

describe('abuse limits', () => {
  beforeAll(() => { process.env.RATE_LIMIT_DISABLED = 'false'; });
  afterAll(() => { process.env.RATE_LIMIT_DISABLED = 'true'; });

  test('guessing one account\'s password is blocked even from many IP addresses', async () => {
    // trust proxy is off in tests, so vary the account limiter's view instead: same email, different (ignored) IP headers
    const statuses = [];
    for (let i = 0; i < 12; i++) {
      statuses.push((await api().post('/api/auth/login').set('X-Forwarded-For', `10.1.0.${i}`)
        .send({ email: 'rohan@tiet.ac.in', password: `guess${i}` })).status);
    }
    expect(statuses.slice(10)).toEqual([429, 429]);
    await sql('DELETE FROM rate_limit');
  });

  test('one account cannot flood the API with changes', async () => {
    const token = await login('sneha');
    let blocked = 0;
    for (let i = 0; i < 155 && !blocked; i++) {
      const r = await api().patch('/api/notifications/read-all').set(bearer(token));
      if (r.status === 429) blocked = i + 1;
    }
    expect(blocked).toBeGreaterThan(140);
    // reading is never limited by this
    await api().get('/api/notifications').set(bearer(token)).expect(200);
    await sql('DELETE FROM rate_limit');
  });

  test('a student can add at most 20 new catalogue items a day; reusing items is fine', async () => {
    process.env.RATE_LIMIT_DISABLED = 'true';
    const token = await login('aarav');
    await sql(`INSERT INTO Item (item_name, brand, category_id, created_by)
               SELECT 'Spam item ' || g, NULL, 1, 1 FROM generate_series(1, 20) g`);
    const base = { mrp: '10', selling_price: '10', quantity_available: '1', room_number: 'K-1' };
    const blocked = await api().post('/api/listings').set(bearer(token)).send({ ...base, new_item: { item_name: 'One more thing', category_id: 1 } });
    expect(blocked.status).toBe(400);
    expect(blocked.body.message).toMatch(/at most 20 new items/);
    // an item that already exists can still be listed
    await api().post('/api/listings').set(bearer(token)).send({ ...base, new_item: { item_name: 'spam item 7', category_id: 1 } }).expect(201);
    process.env.RATE_LIMIT_DISABLED = 'false';
  });
});
