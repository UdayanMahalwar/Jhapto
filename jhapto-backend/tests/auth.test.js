const { api, db, sql, resetDb, login, adminLogin, bearer, STUDENTS } = require('./helpers/testkit');

beforeAll(resetDb);
afterAll(() => db.end());

describe('registration', () => {
  const valid = { name: 'Test User', email: 'test@tiet.ac.in', phone_no: '9123456780', password: 'secret1', hostel_id: 1, floor_id: 2 };

  test.each([
    [{ email: 'not-an-email' }, /valid email/],
    [{ phone_no: '12345' }, /10-digit/],
    [{ password: '123' }, /at least 6/],
    [{ floor_id: 99 }, /floor does not belong/],
  ])('rejects bad input %o', async (patch, msg) => {
    const res = await api().post('/api/auth/register').send({ ...valid, ...patch });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(msg);
  });

  test('registers, then rejects the same email and phone', async () => {
    expect((await api().post('/api/auth/register').send(valid)).status).toBe(201);
    const again = await api().post('/api/auth/register').send(valid);
    expect(again.status).toBe(409);
  });
});

describe('login', () => {
  test('wrong password and unknown email give the same error', async () => {
    const wrongPw = await api().post('/api/auth/login').send({ email: STUDENTS.aarav.email, password: 'nope' });
    const unknown = await api().post('/api/auth/login').send({ email: 'ghost@tiet.ac.in', password: 'nope' });
    expect(wrongPw.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrongPw.body.message).toBe(unknown.body.message);
  });

  test('returns a token and the student profile', async () => {
    const res = await api().post('/api/auth/login').send({ email: STUDENTS.priya.email, password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.student).toMatchObject({ student_id: 2, floor_number: 1 });
    expect(res.body.student.password_hash).toBeUndefined();
  });

  test('garbage and admin tokens are rejected on student routes', async () => {
    const garbage = await api().get('/api/listings').set(bearer('garbage'));
    expect(garbage.status).toBe(401);
    expect(garbage.body.code).toBe('INVALID_TOKEN');
    const asAdmin = await api().get('/api/listings').set(bearer(await adminLogin()));
    expect(asAdmin.status).toBe(401);
  });
});

describe('bans', () => {
  test('a ban takes effect on the very next request, even with an old token', async () => {
    const token = await login('rohan');
    expect((await api().get('/api/listings/my').set(bearer(token))).status).toBe(200);

    const admin = await adminLogin();
    await api().patch(`/api/admin/students/${STUDENTS.rohan.id}/ban`).set(bearer(admin)).expect(200);

    const res = await api().get('/api/listings/my').set(bearer(token));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ACCOUNT_BANNED');

    await api().patch(`/api/admin/students/${STUDENTS.rohan.id}/unban`).set(bearer(admin)).expect(200);
    expect((await api().get('/api/listings/my').set(bearer(token))).status).toBe(200);
  });
});

describe('profile', () => {
  let token;
  beforeAll(async () => { token = await login('karan'); });

  test('GET /me returns the profile without secrets', async () => {
    const res = await api().get('/api/auth/me').set(bearer(token)).expect(200);
    expect(res.body).toMatchObject({ student_id: 5, email: STUDENTS.karan.email, floor_number: 4 });
    expect(res.body.password_hash).toBeUndefined();
  });

  test('rejects a phone number that belongs to someone else', async () => {
    const res = await api().patch('/api/auth/me').set(bearer(token)).send({ phone_no: '9876543210' });
    expect(res.status).toBe(409);
  });

  test('floor change applies immediately to listing priority, without re-login', async () => {
    await api().patch('/api/auth/me').set(bearer(token)).send({ floor_id: STUDENTS.sneha.floor_id }).expect(200);
    const listings = (await api().get('/api/listings').set(bearer(token)).expect(200)).body;
    const snehas = listings.find(l => l.seller_id === STUDENTS.sneha.id);
    expect(snehas.priority_rank).toBe(0);
  });

  test('password change requires the current password', async () => {
    const wrong = await api().patch('/api/auth/me/password').set(bearer(token))
      .send({ current_password: 'nope', new_password: 'newpass1' });
    expect(wrong.status).toBe(401);

    await api().patch('/api/auth/me/password').set(bearer(token))
      .send({ current_password: 'password123', new_password: 'newpass1' }).expect(200);
    await login('karan', 'newpass1');
    const [row] = await sql('SELECT password_hash FROM Student WHERE student_id = ?', [5]);
    expect(row.password_hash).not.toContain('newpass1');
  });
});
