// realtime.js
// Socket.IO for live chat and notification pushes.
//
// Rooms:
//   user:<student_id>  – every socket of a logged-in student (notification pushes)
//   order:<order_id>   – joined on request by the order's buyer / seller (chat)
//
// Server → client events:
//   message:new            { message_id, order_id, sender_id, sender_name, message_text, sent_at }
//   order:status           { order_id, order_status }
//   notifications:changed  {}   (client refetches /api/notifications)
//
// Client → server events:
//   chat:join  { order_id }, ack({ ok, message? })
//   chat:leave { order_id }

const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const db = require('./config/db');

let io = null;

// Same query routes/reports.js uses to find an order's two parties
const ORDER_PARTIES_SQL =
  `SELECT o.buyer_id, l.seller_id
   FROM \`Order\` o
   JOIN Order_Item oi ON o.order_id    = oi.order_id
   JOIN Listing    l  ON oi.listing_id = l.listing_id
   WHERE o.order_id = ? LIMIT 1`;

async function authenticate(socket, next) {
  const token = socket.handshake.auth && socket.handshake.auth.token;
  if (!token) return next(new Error('INVALID_TOKEN'));
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return next(new Error('INVALID_TOKEN'));
  }
  if (!decoded.student_id) return next(new Error('INVALID_TOKEN'));
  try {
    const [rows] = await db.query(
      'SELECT is_banned, name, floor_id, hostel_id FROM Student WHERE student_id = ?', [decoded.student_id]
    );
    if (rows.length === 0) return next(new Error('INVALID_TOKEN'));
    if (rows[0].is_banned) return next(new Error('ACCOUNT_BANNED'));
  } catch {
    return next(new Error('SERVER_ERROR'));
  }
  socket.data.student_id = Number(decoded.student_id);
  next();
}

function init(httpServer) {
  io = new Server(httpServer, {
    // Same-origin only (the frontend is served by this server)
    cors: { origin: false },
    maxHttpBufferSize: 16 * 1024,   // clients only send tiny control messages
  });

  io.use(authenticate);

  io.on('connection', (socket) => {
    const me = socket.data.student_id;
    socket.join(`user:${me}`);

    socket.on('chat:join', async (payload, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      const order_id = Number(payload && payload.order_id);
      if (!Number.isInteger(order_id) || order_id < 1) return reply({ ok: false, message: 'Invalid order.' });
      try {
        const [rows] = await db.query(ORDER_PARTIES_SQL, [order_id]);
        if (rows.length === 0) return reply({ ok: false, message: 'Order not found.' });
        if (me !== Number(rows[0].buyer_id) && me !== Number(rows[0].seller_id)) {
          return reply({ ok: false, message: 'Not authorised for this chat.' });
        }
        socket.join(`order:${order_id}`);
        reply({ ok: true });
      } catch {
        reply({ ok: false, message: 'Server error.' });
      }
    });

    socket.on('chat:leave', (payload) => {
      const order_id = Number(payload && payload.order_id);
      if (Number.isInteger(order_id)) socket.leave(`order:${order_id}`);
    });
  });

  return io;
}

// All emit helpers are no-ops until init() runs (e.g. in API-only tests)
const emitToOrder = (order_id, event, payload) => {
  if (io) io.to(`order:${order_id}`).emit(event, payload);
};

const emitToUser = (student_id, event, payload = {}) => {
  if (io && student_id) io.to(`user:${student_id}`).emit(event, payload);
};

// Tell both parties of an order to refresh notifications (rows are created by DB triggers)
async function notifyOrderParties(order_id) {
  if (!io) return;
  try {
    const [rows] = await db.query(ORDER_PARTIES_SQL, [order_id]);
    if (rows.length === 0) return;
    emitToUser(rows[0].buyer_id, 'notifications:changed');
    emitToUser(rows[0].seller_id, 'notifications:changed');
  } catch {
    // best effort — clients also poll as a fallback
  }
}

// Drop a banned student's live connections immediately
const disconnectUser = (student_id) => {
  if (io) io.in(`user:${student_id}`).disconnectSockets(true);
};

const close = () => new Promise((resolve) => {
  if (!io) return resolve();
  const server = io;
  io = null;
  server.close(() => resolve());
});

module.exports = { init, emitToOrder, emitToUser, notifyOrderParties, disconnectUser, close };
