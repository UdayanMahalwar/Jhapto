const fs   = require('fs');
const path = require('path');
const { api, db, sql, resetDb, login, bearer } = require('./helpers/testkit');

beforeAll(resetDb);
afterAll(() => db.end());

// Smallest valid PNG (1x1 transparent pixel)
const PNG = Buffer.from(
  '89504e470d0a1a0a0000000d4948445200000001000000010806000000' +
  '1f15c4890000000d49444154789c63000100000500010d0a2db40000000049454e44ae426082', 'hex');

test('requires login', async () => {
  expect((await api().post('/api/uploads').attach('image', PNG, 'a.png')).status).toBe(401);
});

test('stores a real image under a random name and serves it', async () => {
  const res = await api().post('/api/uploads').set(bearer(await login('aarav')))
    .attach('image', PNG, 'photo.png').expect(201);
  expect(res.body.url).toMatch(/^\/uploads\/[0-9a-f]{32}\.png$/);
  expect(fs.existsSync(path.join(process.env.UPLOAD_DIR, path.basename(res.body.url)))).toBe(true);

  const served = await api().get(res.body.url).expect(200);
  expect(served.headers['content-type']).toBe('image/png');
  expect(served.headers['x-content-type-options']).toBe('nosniff');
});

test('rejects non-images even when they claim to be PNGs', async () => {
  const fake = Buffer.from('<script>alert(1)</script>');
  const res = await api().post('/api/uploads').set(bearer(await login('aarav')))
    .attach('image', fake, { filename: 'evil.png', contentType: 'image/png' });
  expect(res.status).toBe(400);
  expect(res.body.message).toMatch(/PNG, JPEG, GIF or WebP/);
});

test('rejects files over 5 MB', async () => {
  const big = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]);
  const res = await api().post('/api/uploads').set(bearer(await login('aarav'))).attach('image', big, 'big.png');
  expect(res.status).toBe(413);
});

test('an uploaded image can be used as a listing photo and as report proof', async () => {
  const token = await login('karan');
  const { url } = (await api().post('/api/uploads').set(bearer(token)).attach('image', PNG, 'p.png').expect(201)).body;

  await api().post('/api/listings').set(bearer(token))
    .send({ item_id: 2, mrp: '14', selling_price: '15', quantity_available: '2', room_number: 'K-4', photo_url: url })
    .expect(201);
  const [row] = await sql('SELECT photo_url FROM Listing WHERE seller_id = 5 AND item_id = 2');
  expect(row.photo_url).toBe(url);

  // Seed order 1: Rohan bought from Aarav
  const rohan = await login('rohan');
  const proof = (await api().post('/api/uploads').set(bearer(rohan)).attach('image', PNG, 'proof.png')).body.url;
  await api().post('/api/reports').set(bearer(rohan)).send({ order_id: 1, reported_user_id: 1, reason: 'x', proof_url: proof }).expect(201);
});
