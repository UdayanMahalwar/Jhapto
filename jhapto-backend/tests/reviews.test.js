const { api, db, sql, resetDb, login, bearer, STUDENTS } = require('./helpers/testkit');

beforeAll(resetDb);
afterAll(() => db.end());

// Karan buys Sneha's listing 4, Sneha confirms and delivers
async function deliveredOrder() {
  const buyer = await login('karan');
  const seller = await login('sneha');
  const id = (await api().post('/api/orders/checkout').set(bearer(buyer))
    .send({ items: [{ listing_id: 4, quantity: 1 }] }).expect(201)).body.order_ids[0];
  return { id, buyer, seller };
}

test('cannot review before delivery; only the buyer can review; once per order', async () => {
  const { id, buyer, seller } = await deliveredOrder();
  const early = await api().post('/api/reviews').set(bearer(buyer)).send({ order_id: id, rating: 5 });
  expect(early.status).toBe(400);
  expect(early.body.message).toMatch(/after it is delivered/);

  await api().patch(`/api/orders/${id}/confirm`).set(bearer(seller)).expect(200);
  await api().patch(`/api/orders/${id}/deliver`).set(bearer(seller)).expect(200);

  expect((await api().post('/api/reviews').set(bearer(seller)).send({ order_id: id, rating: 1 })).status).toBe(400);
  expect((await api().post('/api/reviews').set(bearer(buyer)).send({ order_id: id, rating: 6 })).status).toBe(400);
  await api().post('/api/reviews').set(bearer(buyer)).send({ order_id: id, rating: 4, comment: 'Cold and quick' }).expect(201);
  expect((await api().post('/api/reviews').set(bearer(buyer)).send({ order_id: id, rating: 2 })).status).toBe(409);

  const mine = (await api().get('/api/orders/my?status=Delivered').set(bearer(buyer))).body.find(o => o.order_id === id);
  expect(mine).toMatchObject({ my_rating: 4, my_review: 'Cold and quick' });
});

test('the DB trigger rejects reviews that bypass the API checks', async () => {
  // Order 2 (seed) is still "Placed"
  await expect(sql('INSERT INTO Review (order_id, reviewer_id, seller_id, rating) VALUES (2, 1, 0, 5)'))
    .rejects.toThrow(/only after it is delivered/);
  await expect(sql('INSERT INTO Review (order_id, reviewer_id, seller_id, rating) VALUES (1, 3, 0, 9)'))
    .rejects.toThrow(/chk_review_rating/);
});

test('the seller average is recomputed by trigger', async () => {
  // Seed order 3: Priya bought Sneha's listing 4, Confirmed
  await api().patch('/api/orders/3/deliver').set(bearer(await login('sneha'))).expect(200);
  await api().post('/api/reviews').set(bearer(await login('priya'))).send({ order_id: 3, rating: 2 }).expect(201);

  const summary = (await api().get(`/api/reviews/seller/${STUDENTS.sneha.id}`).set(bearer(await login('aarav'))).expect(200)).body;
  expect(summary.seller).toMatchObject({ avg_rating: '3.00', rating_count: 2 });
  expect(summary.reviews).toHaveLength(2);
  expect(summary.reviews[0].reviewer_name).not.toMatch(/ /);   // first names only

  const listing = (await api().get('/api/listings').set(bearer(await login('aarav')))).body.find(l => l.seller_id === STUDENTS.sneha.id);
  expect(listing).toMatchObject({ seller_rating: '3.00', seller_rating_count: 2 });
});

describe('notifications (created by triggers)', () => {
  test('order lifecycle notifies the right people', async () => {
    await resetDb();
    const { id, buyer, seller } = await deliveredOrder();
    let sellerN = (await api().get('/api/notifications').set(bearer(seller))).body;
    expect(sellerN.notifications[0]).toMatchObject({ type: 'order_placed', link: '/seller' });

    await api().patch(`/api/orders/${id}/confirm`).set(bearer(seller)).expect(200);
    await api().patch(`/api/orders/${id}/deliver`).set(bearer(seller)).expect(200);
    const buyerN = (await api().get('/api/notifications').set(bearer(buyer))).body;
    expect(buyerN.notifications.map(n => n.type)).toEqual(['order_delivered', 'order_confirmed']);
    expect(buyerN.unread_count).toBe(2);

    await api().post('/api/reviews').set(bearer(buyer)).send({ order_id: id, rating: 5 }).expect(201);
    sellerN = (await api().get('/api/notifications').set(bearer(seller))).body;
    expect(sellerN.notifications[0]).toMatchObject({ type: 'review', message: expect.stringContaining('5/5') });
  });

  test('cancelling notifies the seller', async () => {
    const id = (await api().post('/api/orders/checkout').set(bearer(await login('priya')))
      .send({ items: [{ listing_id: 5, quantity: 1 }] })).body.order_ids[0];
    await api().patch(`/api/orders/${id}/cancel`).set(bearer(await login('priya'))).expect(200);
    const n = (await api().get('/api/notifications').set(bearer(await login('karan')))).body.notifications;
    expect(n[0]).toMatchObject({ type: 'order_cancelled' });
  });

  test('mark one / all as read; cannot touch other users\' notifications', async () => {
    const buyer = await login('karan');
    const { notifications } = (await api().get('/api/notifications').set(bearer(buyer))).body;
    const someoneElse = await login('aarav');
    await api().patch(`/api/notifications/${notifications[0].notification_id}/read`).set(bearer(someoneElse)).expect(200);
    const [row] = await sql('SELECT is_read FROM Notification WHERE notification_id = ?', [notifications[0].notification_id]);
    expect(row.is_read).toBe(false);

    await api().patch('/api/notifications/read-all').set(bearer(buyer)).expect(200);
    expect((await api().get('/api/notifications').set(bearer(buyer))).body.unread_count).toBe(0);
  });
});
