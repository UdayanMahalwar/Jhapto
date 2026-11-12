const { api, db, resetDb } = require('./helpers/testkit');

beforeAll(async () => {
  await resetDb();
  process.env.RATE_LIMIT_DISABLED = 'false';
});
afterAll(async () => {
  process.env.RATE_LIMIT_DISABLED = 'true';
  await db.end();
});

test('failed logins are throttled after 10 attempts; successful ones do not count', async () => {
  const good = { email: 'aarav@tiet.ac.in', password: 'password123' };
  for (let i = 0; i < 5; i++) await api().post('/api/auth/login').send(good).expect(200);

  const statuses = [];
  for (let i = 0; i < 12; i++) {
    statuses.push((await api().post('/api/auth/login').send({ ...good, password: 'wrong' })).status);
  }
  expect(statuses.slice(0, 10)).toEqual(Array(10).fill(401));
  expect(statuses.slice(10)).toEqual([429, 429]);
});
