const { api, db, resetDb, login, adminLogin, bearer, STUDENTS } = require('./helpers/testkit');

beforeAll(resetDb);
afterAll(() => db.end());

test('categories endpoint lists every category from the database', async () => {
  const res = await api().get('/api/listings/categories').set(bearer(await login('aarav'))).expect(200);
  expect(res.body.map(c => c.category_name)).toEqual([
    'Snacks & Food', 'Noodles & Instant Food', 'Beverages', 'Chocolates & Sweets',
    'Stationery & Books', 'Personal Care', 'Electronics & Accessories',
  ]);
});

test('every category has items to sell, and seed items are filed correctly', async () => {
  const items = (await api().get('/api/listings/items').set(bearer(await login('aarav'))).expect(200)).body;
  const byName = Object.fromEntries(items.map(i => [i.item_name, i.category_name]));
  expect(byName['Amul Kool Milk']).toBe('Beverages');
  expect(byName['Maggi Noodles 2-min']).toBe('Noodles & Instant Food');
  expect(new Set(items.map(i => i.category_name)).size).toBe(7);
  expect(items.length).toBeGreaterThan(40);
});

test('listings come back with their category and no broken /photos paths', async () => {
  const listings = (await api().get('/api/listings').set(bearer(await login('aarav'))).expect(200)).body;
  const amul = listings.find(l => l.item_name === 'Amul Kool Milk');
  expect(amul).toMatchObject({ category_name: 'Beverages', item_id: 4 });
  expect(listings.some(l => String(l.photo_url).startsWith('/photos/'))).toBe(false);
});

test('login returns the hostel name for the header', async () => {
  const res = await api().post('/api/auth/login').send({ email: STUDENTS.aarav.email, password: 'password123' }).expect(200);
  expect(res.body.student.hostel_name).toBe('Kailash Hostel');
});

describe('admin revenue report', () => {
  test('only delivered orders count as revenue; placed/confirmed are pending', async () => {
    const report = (await api().get('/api/admin/report').set(bearer(await adminLogin())).expect(200)).body;
    const row = (id) => report.find(r => r.student_id === id);
    // Seed: order 1 (Aarav's Lays, Delivered, 22), order 3 (Sneha's milk, Confirmed, 30),
    // order 4 (Karan's Kurkure x2, Placed, 40)
    expect(row(STUDENTS.aarav.id)).toMatchObject({ total_revenue: '22.00', pending_revenue: '0.00' });
    expect(row(STUDENTS.sneha.id)).toMatchObject({ total_revenue: '0.00', pending_revenue: '30.00' });
    expect(row(STUDENTS.karan.id)).toMatchObject({ total_revenue: '0.00', pending_revenue: '40.00' });
  });

  test('banned students stay on the report, flagged', async () => {
    const admin = await adminLogin();
    await api().patch(`/api/admin/students/${STUDENTS.karan.id}/ban`).set(bearer(admin)).expect(200);
    const report = (await api().get('/api/admin/report').set(bearer(admin))).body;
    expect(report.find(r => r.student_id === STUDENTS.karan.id)).toMatchObject({ is_banned: 1 });
    await api().patch(`/api/admin/students/${STUDENTS.karan.id}/unban`).set(bearer(admin)).expect(200);
  });
});

test('"delivered" notification links to order history, "cancelled" to the seller history', async () => {
  const sneha = await login('sneha');
  await api().patch('/api/orders/3/deliver').set(bearer(sneha)).expect(200);
  const priyaN = (await api().get('/api/notifications').set(bearer(await login('priya')))).body.notifications;
  expect(priyaN.find(n => n.type === 'order_delivered').link).toBe('/orders?tab=history');

  const aarav = await login('aarav');
  await api().patch('/api/orders/2/cancel').set(bearer(aarav)).expect(200);
  const priyaSellerN = (await api().get('/api/notifications').set(bearer(await login('priya')))).body.notifications;
  expect(priyaSellerN.find(n => n.type === 'order_cancelled').link).toBe('/seller?tab=history');
});

test('unread chat counts are broken down per chat', async () => {
  // Seed order 2: Aarav (buyer) <-> Priya (seller); confirm so chat opens
  await resetDb();
  await api().patch('/api/orders/2/confirm').set(bearer(await login('priya'))).expect(200);
  await api().post('/api/messages/2').set(bearer(await login('priya'))).send({ message_text: 'one' }).expect(201);
  await api().post('/api/messages/2').set(bearer(await login('priya'))).send({ message_text: 'two' }).expect(201);

  const aarav = await login('aarav');
  const unread = (await api().get('/api/messages/unread').set(bearer(aarav)).expect(200)).body;
  // seed message "Come to room 204" from Priya is also unread
  expect(unread.unread_count).toBe(3);
  expect(unread.chats).toEqual([expect.objectContaining({ order_id: 2, unread_count: 3, from_name: 'Priya Mehta', item_name: 'Maggi Noodles 2-min' })]);

  await api().get('/api/messages/2').set(bearer(aarav)).expect(200);   // opening the chat reads it
  expect((await api().get('/api/messages/unread').set(bearer(aarav))).body).toEqual({ unread_count: 0, chats: [] });
});
