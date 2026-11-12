const http = require('http');
const { io: connect } = require('socket.io-client');
const realtime = require('../realtime');
const { app, api, db, resetDb, login, adminLogin, bearer, STUDENTS } = require('./helpers/testkit');

let server, url;
const sockets = [];

beforeAll(async () => {
  await resetDb();
  server = http.createServer(app);
  realtime.init(server);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${server.address().port}`;
});

afterEach(() => { sockets.splice(0).forEach(s => s.disconnect()); });

afterAll(async () => {
  await realtime.close();
  await db.end();
});

const open = (token) => new Promise((resolve, reject) => {
  const s = connect(url, { auth: { token }, transports: ['websocket'], reconnection: false, forceNew: true });
  sockets.push(s);
  s.once('connect', () => resolve(s));
  s.once('connect_error', reject);
});
const join = (socket, order_id) => new Promise(resolve => socket.emit('chat:join', { order_id }, resolve));
const next = (socket, event, ms = 3000) => new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error(`no ${event} within ${ms}ms`)), ms);
  socket.once(event, (payload) => { clearTimeout(t); resolve(payload); });
});

test('rejects connections without a valid student token', async () => {
  await expect(open('garbage')).rejects.toThrow('INVALID_TOKEN');
  await expect(open(await adminLogin())).rejects.toThrow('INVALID_TOKEN');
});

test('only the buyer and seller can join an order chat', async () => {
  // Seed order 3: Priya bought from Sneha (Confirmed)
  expect(await join(await open(await login('priya')), 3)).toEqual({ ok: true });
  expect(await join(await open(await login('sneha')), 3)).toEqual({ ok: true });
  expect(await join(await open(await login('karan')), 3)).toMatchObject({ ok: false });
  expect(await join(await open(await login('karan')), 99999)).toMatchObject({ ok: false });
});

test('a sent message arrives live for the other party, and their badge updates', async () => {
  const priya = await login('priya');
  const buyerSocket = await open(priya);
  const sellerSocket = await open(await login('sneha'));
  await join(buyerSocket, 3);
  await join(sellerSocket, 3);

  const incoming = next(buyerSocket, 'message:new');
  const badge = next(buyerSocket, 'notifications:changed');
  await api().post('/api/messages/3').set(bearer(await login('sneha'))).send({ message_text: 'Come to K-315 at 6' }).expect(201);

  expect(await incoming).toMatchObject({ order_id: 3, sender_id: STUDENTS.sneha.id, sender_name: 'Sneha Gupta', message_text: 'Come to K-315 at 6' });
  await badge;
});

test('outsiders do not receive the message', async () => {
  const outsider = await open(await login('karan'));
  await join(outsider, 3);   // refused
  const got = next(outsider, 'message:new', 500).then(() => true, () => false);
  await api().post('/api/messages/3').set(bearer(await login('priya'))).send({ message_text: 'private' }).expect(201);
  expect(await got).toBe(false);
});

test('status changes are pushed to the chat (unlocks it on confirm)', async () => {
  // Seed order 2: Aarav bought from Priya (Placed)
  const buyerSocket = await open(await login('aarav'));
  await join(buyerSocket, 2);
  const status = next(buyerSocket, 'order:status');
  const notif = next(buyerSocket, 'notifications:changed');
  await api().patch('/api/orders/2/confirm').set(bearer(await login('priya'))).expect(200);
  expect(await status).toEqual({ order_id: 2, order_status: 'Confirmed' });
  await notif;
});

test('banning a student drops their live connection', async () => {
  const socket = await open(await login('rohan'));
  const dropped = next(socket, 'disconnect');
  await api().patch(`/api/admin/students/${STUDENTS.rohan.id}/ban`).set(bearer(await adminLogin())).expect(200);
  await dropped;
  await expect(open(await login('rohan').catch(() => 'x'))).rejects.toThrow();
});
