const { api, db, sql, resetDb, login, adminLogin, bearer } = require('./helpers/testkit');

beforeAll(resetDb);
afterAll(() => db.end());

describe('creating admins', () => {
  const newAdmin = { name: 'Second Admin', email: 'admin2@jhapto.com', password: 'secondpass' };

  test('is impossible without logging in', async () => {
    expect((await api().post('/api/admin/register').send(newAdmin)).status).toBe(401);
  });

  test('is impossible with a student token', async () => {
    const res = await api().post('/api/admin/register').set(bearer(await login('aarav'))).send(newAdmin);
    expect(res.status).toBe(403);
  });

  test('works for an admin, and the new admin can log in', async () => {
    const admin = await adminLogin();
    await api().post('/api/admin/register').set(bearer(admin)).send(newAdmin).expect(201);
    await api().post('/api/admin/login').send({ email: newAdmin.email, password: newAdmin.password }).expect(200);
    const list = await api().get('/api/admin/admins').set(bearer(admin)).expect(200);
    expect(list.body.map(a => a.email)).toContain(newAdmin.email);
    expect(list.body[0].password_hash).toBeUndefined();
  });
});

describe('user reports', () => {
  // Seed order 1: Rohan (3) bought Aarav's (1) listing, Delivered
  test('only the parties of an order can report, and only each other', async () => {
    const outsider = await api().post('/api/reports').set(bearer(await login('karan')))
      .send({ order_id: 1, reported_user_id: 1, reason: 'x' });
    expect(outsider.status).toBe(403);

    const wrongTarget = await api().post('/api/reports').set(bearer(await login('rohan')))
      .send({ order_id: 1, reported_user_id: 5, reason: 'x' });
    expect(wrongTarget.status).toBe(400);
  });

  test('base64 proof is rejected (images must be uploaded)', async () => {
    const res = await api().post('/api/reports').set(bearer(await login('rohan')))
      .send({ order_id: 1, reported_user_id: 1, reason: 'x', proof_url: 'data:image/png;base64,iVBORw0KGgo=' });
    expect(res.status).toBe(400);
  });

  test('report → admin sees it → resolve; duplicates blocked while pending', async () => {
    const rohan = await login('rohan');
    await api().post('/api/reports').set(bearer(rohan))
      .send({ order_id: 1, reported_user_id: 1, reason: 'Never handed over the item' }).expect(201);
    expect((await api().post('/api/reports').set(bearer(rohan))
      .send({ order_id: 1, reported_user_id: 1, reason: 'again' })).status).toBe(409);

    const admin = await adminLogin();
    const list = (await api().get('/api/admin/reports').set(bearer(admin)).expect(200)).body;
    expect(list[0]).toMatchObject({ order_id: 1, reporter_id: 3, reported_user_id: 1, status: 'Pending' });

    await api().patch(`/api/admin/reports/${list[0].report_id}`).set(bearer(admin)).send({ status: 'Resolved' }).expect(200);
    expect((await api().patch(`/api/admin/reports/${list[0].report_id}`).set(bearer(admin)).send({ status: 'Deleted' })).status).toBe(400);
    const [row] = await sql('SELECT status FROM Report WHERE report_id = ?', [list[0].report_id]);
    expect(row.status).toBe('Resolved');
  });

  test('students cannot read admin endpoints', async () => {
    expect((await api().get('/api/admin/reports').set(bearer(await login('aarav')))).status).toBe(403);
    expect((await api().get('/api/admin/students').set(bearer(await login('aarav')))).status).toBe(403);
  });
});

test('unknown API routes return JSON 404', async () => {
  const res = await api().get('/api/nope');
  expect(res.status).toBe(404);
  expect(res.body.message).toBe('Not found.');
});

test('malformed JSON returns a JSON 400, not a stack trace', async () => {
  const res = await api().post('/api/auth/login').set('Content-Type', 'application/json').send('{bad json');
  expect(res.status).toBe(400);
  expect(res.body).toEqual({ message: 'Malformed request.' });
});
