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
      .send({ selling_price: '28.50', description: 'Chilled', room_number: 'Z-999' }).expect(200);
    // the room can't be edited per listing: it stays the seller's profile room
    expect(await listing(4)).toMatchObject({ selling_price: '28.50', description: 'Chilled', room_number: 'C-315', listing_status: 'Active' });

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

describe('pickup room comes from the seller\'s profile', () => {
  test('a new listing uses the profile room, whatever the request says', async () => {
    const token = await login('karan');
    await api().post('/api/listings').set(bearer(token))
      .send({ item_id: 8, mrp: '100', selling_price: '90', quantity_available: '1', room_number: 'FAKE-1' }).expect(201);
    const [row] = await sql('SELECT room_number FROM Listing WHERE seller_id = 5 AND item_id = 8');
    expect(row.room_number).toBe('D-210');
  });

  test('without a room in the profile, selling is refused with a clear message', async () => {
    await sql('UPDATE Student SET room_number = NULL WHERE student_id = 1');
    const res = await api().post('/api/listings').set(bearer(await login('aarav')))
      .send({ item_id: 9, mrp: '10', selling_price: '10', quantity_available: '1' });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: 'ROOM_REQUIRED' });
    await sql("UPDATE Student SET room_number = 'A-101' WHERE student_id = 1");
  });

  test('moving room updates the seller\'s open listings, and buyers see the new pickup room', async () => {
    const token = await login('karan');
    const res = await api().patch('/api/auth/me').set(bearer(token)).send({ room_number: 'd-305' }).expect(200);
    expect(res.body.profile.room_number).toBe('D-305');
    const rooms = await sql(`SELECT DISTINCT room_number FROM Listing WHERE seller_id = 5 AND listing_status <> 'Removed'`);
    expect(rooms.map((r) => r.room_number)).toEqual(['D-305']);
    const browse = (await api().get('/api/listings').set(bearer(await login('rohan'))).expect(200)).body;
    expect(browse.find((l) => l.seller_id === 5)).toMatchObject({ room_number: 'D-305', seller_hostel: 'Neeram Hall' });
  });
});
