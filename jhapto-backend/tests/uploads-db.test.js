// Same upload behaviour with UPLOAD_STORAGE=db (images stored in the Upload table),
// which is how the free Render deployment runs.
process.env.UPLOAD_STORAGE = 'db';

const { api, db, sql, resetDb, login, bearer } = require('./helpers/testkit');

beforeAll(resetDb);
afterAll(async () => {
  delete process.env.UPLOAD_STORAGE;
  await db.end();
});

const PNG = Buffer.from(
  '89504e470d0a1a0a0000000d4948445200000001000000010806000000' +
  '1f15c4890000000d49444154789c63000100000500010d0a2db40000000049454e44ae426082', 'hex');

test('upload is stored in the database and served from it', async () => {
  const res = await api().post('/api/uploads').set(bearer(await login('aarav'))).attach('image', PNG, 'p.png').expect(201);
  const name = res.body.url.replace('/uploads/', '');
  const [row] = await sql('SELECT mime_type, LENGTH(data) AS size, uploaded_by FROM Upload WHERE name = ?', [name]);
  expect(row).toEqual({ mime_type: 'image/png', size: PNG.length, uploaded_by: 1 });

  const served = await api().get(res.body.url).expect(200);
  expect(served.headers['content-type']).toBe('image/png');
  expect(served.headers['x-content-type-options']).toBe('nosniff');
  expect(Buffer.compare(served.body, PNG)).toBe(0);
});

test('unknown or malformed upload names return 404', async () => {
  await api().get('/uploads/00000000000000000000000000000000.png').expect(404);
  await api().get('/uploads/../../etc/passwd').expect(404);
  await api().get('/uploads/not-a-name.png').expect(404);
});

test('a database-stored image can be used as a listing photo', async () => {
  const token = await login('karan');
  const { url } = (await api().post('/api/uploads').set(bearer(token)).attach('image', PNG, 'p.png').expect(201)).body;
  await api().post('/api/listings').set(bearer(token))
    .send({ item_id: 2, mrp: '14', selling_price: '15', quantity_available: '2', room_number: 'K-4', photo_url: url })
    .expect(201);
});

test('non-images are still rejected', async () => {
  const res = await api().post('/api/uploads').set(bearer(await login('aarav')))
    .attach('image', Buffer.from('<script>'), { filename: 'x.png', contentType: 'image/png' });
  expect(res.status).toBe(400);
});
