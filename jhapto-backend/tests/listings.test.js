const { api, db, sql, resetDb, login, bearer } = require('./helpers/testkit');

beforeAll(resetDb);
afterAll(() => db.end());

const listing = async (id) => (await sql('SELECT * FROM Listing WHERE listing_id = ?', [id]))[0];

describe('creating listings', () => {
  const base = { item_id: 3, mrp: '50', selling_price: '55', quantity_available: '2', room_number: 'K-101' };

  test.each([
    [{ mrp: '-5' }, /positive amounts/],
    [{ quantity_available: '2.5' }, /whole number/],
    [{ selling_price: '100' }, /1.5x MRP/],
    [{ photo_url: 'data:image/png;base64,iVBORw0KGgo=' }, /photo picker/],
    [{ photo_url: 'javascript:alert(1)' }, /photo picker/],
    [{ photo_url: '/uploads/00000000000000000000000000000000.png' }, /photo picker/],   // file doesn't exist
    [{ item_id: 9999 }, /Choose an item/],
  ])('rejects %o', async (patch, msg) => {
    const res = await api().post('/api/listings').set(bearer(await login('karan'))).send({ ...base, ...patch });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(msg);
  });

  test('one Active listing per item per seller (DB trigger)', async () => {
    const token = await login('karan');
    await api().post('/api/listings').set(bearer(token)).send(base).expect(201);
    const dup = await api().post('/api/listings').set(bearer(token)).send(base);
    expect(dup.status).toBe(400);
    expect(dup.body.message).toMatch(/already have an Active listing/);
  });
});

describe('editing listings', () => {
  test('only the owner can edit', async () => {
    const res = await api().patch('/api/listings/4').set(bearer(await login('karan'))).send({ selling_price: '25' });
    expect(res.status).toBe(403);
  });

  test('price rule still applies on edit', async () => {
    const res = await api().patch('/api/listings/4').set(bearer(await login('sneha'))).send({ selling_price: '100' });
    expect(res.status).toBe(400);
  });

  test('updates fields; 0 stock → OutOfStock; restock → Active', async () => {
    const token = await login('sneha');
    await api().patch('/api/listings/4').set(bearer(token))
      .send({ selling_price: '28.50', description: 'Chilled', room_number: 'K-315' }).expect(200);
    expect(await listing(4)).toMatchObject({ selling_price: '28.50', description: 'Chilled', room_number: 'K-315', listing_status: 'Active' });

    const out = await api().patch('/api/listings/4').set(bearer(token)).send({ quantity_available: 0 }).expect(200);
    expect(out.body.listing_status).toBe('OutOfStock');
    const back = await api().patch('/api/listings/4').set(bearer(token)).send({ quantity_available: 6 }).expect(200);
    expect(back.body.listing_status).toBe('Active');
    expect((await listing(4)).quantity_available).toBe(6);
  });

  test('restocking is refused if another Active listing for the item exists', async () => {
    const token = await login('sneha');
    await api().patch('/api/listings/4').set(bearer(token)).send({ quantity_available: 0 }).expect(200);
    await api().post('/api/listings').set(bearer(token))
      .send({ item_id: 4, mrp: '30', selling_price: '30', quantity_available: '1', room_number: 'K-1' }).expect(201);
    const res = await api().patch('/api/listings/4').set(bearer(token)).send({ quantity_available: 3 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/another Active listing/);
  });

  test('removed listings cannot be edited', async () => {
    const token = await login('priya');
    await api().delete('/api/listings/2').set(bearer(token)).expect(200);
    expect((await api().patch('/api/listings/2').set(bearer(token)).send({ quantity_available: 1 })).status).toBe(400);
  });
});
