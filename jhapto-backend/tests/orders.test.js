const { api, db, sql, resetDb, login, bearer, STUDENTS } = require('./helpers/testkit');

beforeAll(resetDb);
afterAll(() => db.end());

const stock = async (listing_id) =>
  (await sql('SELECT quantity_available FROM Listing WHERE listing_id = ?', [listing_id]))[0].quantity_available;
const orderCount = async () => (await sql('SELECT COUNT(*) AS n FROM "Order"'))[0].n;

describe('POST /orders (stored procedure)', () => {
  test('returns the id of the order it created', async () => {
    const res = await api().post('/api/orders').set(bearer(await login('priya'))).send({ listing_id: 5, quantity: 1 }).expect(201);
    const [row] = await sql('SELECT buyer_id FROM "Order" WHERE order_id = ?', [res.body.order_id]);
    expect(row.buyer_id).toBe(STUDENTS.priya.id);
  });

  test('concurrent orders each get their own correct id', async () => {
    await sql('UPDATE Listing SET quantity_available = 100 WHERE listing_id = 4');
    const tokens = await Promise.all(['aarav', 'priya', 'rohan', 'karan'].map(n => login(n)));
    const results = await Promise.all(Array.from({ length: 20 }, (_, i) =>
      api().post('/api/orders').set(bearer(tokens[i % 4])).send({ listing_id: 4, quantity: 1 })));

    const ids = results.map(r => r.body.order_id);
    expect(results.every(r => r.status === 201)).toBe(true);
    expect(new Set(ids).size).toBe(20);
    for (const [i, r] of results.entries()) {
      const [row] = await sql('SELECT buyer_id FROM "Order" WHERE order_id = ?', [r.body.order_id]);
      expect(row.buyer_id).toBe(STUDENTS[['aarav', 'priya', 'rohan', 'karan'][i % 4]].id);
    }
  });

  test("can't buy your own listing", async () => {
    const res = await api().post('/api/orders').set(bearer(await login('aarav'))).send({ listing_id: 1, quantity: 1 });
    expect(res.status).toBe(400);
  });
});

describe('POST /orders/checkout (transaction)', () => {
  test('one bad line rolls back the whole cart', async () => {
    const before = { orders: await orderCount(), l2: await stock(2), l3: await stock(3) };
    const res = await api().post('/api/orders/checkout').set(bearer(await login('karan')))
      .send({ items: [{ listing_id: 2, quantity: 1 }, { listing_id: 3, quantity: 99 }] });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Only \d+ left/);
    expect(await orderCount()).toBe(before.orders);
    expect(await stock(2)).toBe(before.l2);
    expect(await stock(3)).toBe(before.l3);
  });

  test('places one order per listing, merges duplicate lines, deducts stock', async () => {
    const before = { l2: await stock(2), l3: await stock(3) };
    const res = await api().post('/api/orders/checkout').set(bearer(await login('karan')))
      .send({ items: [{ listing_id: 2, quantity: 1 }, { listing_id: 3, quantity: 1 }, { listing_id: 3, quantity: 1 }] })
      .expect(201);
    expect(res.body.order_ids).toHaveLength(2);
    expect(await stock(2)).toBe(before.l2 - 1);
    expect(await stock(3)).toBe(before.l3 - 2);
  });

  test('buying the last unit marks the listing OutOfStock', async () => {
    const left = await stock(3);
    if (left > 0) {
      await api().post('/api/orders/checkout').set(bearer(await login('karan')))
        .send({ items: [{ listing_id: 3, quantity: left }] }).expect(201);
    }
    const [row] = await sql('SELECT listing_status FROM Listing WHERE listing_id = 3');
    expect(row.listing_status).toBe('OutOfStock');
  });

  test.each([
    [{ items: [] }, /empty/],
    [{ items: [{ listing_id: 'x', quantity: 1 }] }, /quantity between/],
    [{ items: [{ listing_id: 2, quantity: 0 }] }, /quantity between/],
    [{ items: [{ listing_id: 2, quantity: 101 }] }, /quantity between/],
  ])('validates %o', async (body, msg) => {
    const res = await api().post('/api/orders/checkout').set(bearer(await login('karan'))).send(body);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(msg);
  });
});

describe('order status changes', () => {
  test('cancel restores stock; seller cannot cancel; confirmed orders cannot be cancelled', async () => {
    const buyer = await login('priya');
    const before = await stock(5);
    const { body } = await api().post('/api/orders/checkout').set(bearer(buyer))
      .send({ items: [{ listing_id: 5, quantity: 2 }] }).expect(201);
    const id = body.order_ids[0];
    expect(await stock(5)).toBe(before - 2);

    expect((await api().patch(`/api/orders/${id}/cancel`).set(bearer(await login('karan')))).status).toBe(403);
    await api().patch(`/api/orders/${id}/cancel`).set(bearer(buyer)).expect(200);
    expect(await stock(5)).toBe(before);

    const second = (await api().post('/api/orders/checkout').set(bearer(buyer))
      .send({ items: [{ listing_id: 5, quantity: 1 }] })).body.order_ids[0];
    await api().patch(`/api/orders/${second}/confirm`).set(bearer(await login('karan'))).expect(200);
    expect((await api().patch(`/api/orders/${second}/cancel`).set(bearer(buyer))).status).toBe(400);
  });

  test('only the seller can confirm or deliver', async () => {
    const res = await api().patch('/api/orders/2/confirm').set(bearer(await login('aarav')));  // aarav is the buyer of order 2
    expect(res.status).toBe(403);
  });
});

describe('order history filters', () => {
  test('filters by status', async () => {
    const res = await api().get('/api/orders/my?status=Cancelled').set(bearer(await login('priya'))).expect(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body.every(o => o.order_status === 'Cancelled')).toBe(true);
  });

  test('filters by date range (inclusive)', async () => {
    const token = await login('priya');
    const today = (await sql("SELECT to_char(CURRENT_DATE, 'YYYY-MM-DD') AS d"))[0].d;
    const todays = await api().get(`/api/orders/my?from=${today}&to=${today}`).set(bearer(token)).expect(200);
    expect(todays.body.length).toBeGreaterThan(0);
    const future = await api().get('/api/orders/my?from=2099-01-01').set(bearer(token)).expect(200);
    expect(future.body).toEqual([]);
  });

  test.each([
    ['status=Lost', /status must be/],
    ['from=2026-13-45', /from must be a date/],
    ['from=2026-12-01&to=2026-01-01', /before/],
  ])('rejects %s', async (qs, msg) => {
    const res = await api().get(`/api/orders/my?${qs}`).set(bearer(await login('priya')));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(msg);
  });
});
