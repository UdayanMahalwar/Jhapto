// routes/messages.js
// Handles in-app chat between buyer and seller for an order

const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const auth    = require('../middleware/auth');
const notify  = require('../utils/notify');
const realtime = require('../realtime');
const v = require('../utils/validate');

router.param('order_id', v.intParam);   // ids must be numbers

// ── GET /api/messages/unread ─────────────────────────────
// Unread chat messages for the logged-in student: total + one entry per chat
router.get('/unread', auth, async (req, res) => {
  const student_id = req.user.student_id;
  try {
    const [chats] = await db.query(
      `SELECT m.order_id, COUNT(*) AS unread_count,
              MAX(sender.name) AS from_name, MAX(i.item_name) AS item_name
       FROM Message m
       JOIN "Order"    o      ON m.order_id    = o.order_id
       JOIN Order_Item oi     ON o.order_id    = oi.order_id
       JOIN Listing    l      ON oi.listing_id = l.listing_id
       JOIN Item       i      ON l.item_id     = i.item_id
       JOIN Student    sender ON m.sender_id   = sender.student_id
       WHERE m.receiver_id = ?
         AND m.is_read = FALSE
         AND o.order_status IN ('Placed', 'Confirmed')
       GROUP BY m.order_id
       ORDER BY MAX(m.sent_at) DESC`,
      [student_id]
    );
    const normalized = chats.map(c => ({ ...c, unread_count: Number(c.unread_count) }));
    res.json({
      unread_count: normalized.reduce((sum, c) => sum + c.unread_count, 0),
      chats: normalized,
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching unread count.', error: err.message });
  }
});

// ── PATCH /api/messages/:order_id/read ───────────────────
// Mark messages as read for this order
router.patch('/:order_id/read', auth, async (req, res) => {
  const order_id = req.params.order_id;
  const student_id = req.user.student_id;
  try {
    const [result] = await db.query(
      `UPDATE Message SET is_read = TRUE
       WHERE order_id = ? AND receiver_id = ? AND is_read = FALSE`,
      [order_id, student_id]
    );
    // the reader's unread badge (in every open tab) should drop right away
    if (result.affectedRows > 0) realtime.emitToUser(student_id, 'notifications:changed');
    res.json({ message: 'Messages marked as read.' });
  } catch (err) {
    res.status(500).json({ message: 'Error marking messages as read.', error: err.message });
  }
});

// ── GET /api/messages/:order_id ──────────────────────────────
// Fetch all messages for an order (only buyer or seller can view)
router.get('/:order_id', auth, async (req, res) => {
  const order_id  = req.params.order_id;
  const student_id = req.user.student_id;

  try {
    // Verify the requester is the buyer or seller of this order
    const [orderRows] = await db.query(
      `SELECT o.buyer_id, l.seller_id, o.order_status, oi.quantity, i.item_name,
              buyer.name AS buyer_name, seller.name AS seller_name
       FROM "Order" o
       JOIN Order_Item oi     ON o.order_id    = oi.order_id
       JOIN Listing    l      ON oi.listing_id = l.listing_id
       JOIN Item       i      ON l.item_id     = i.item_id
       JOIN Student    buyer  ON o.buyer_id    = buyer.student_id
       JOIN Student    seller ON l.seller_id   = seller.student_id
       WHERE o.order_id = ? LIMIT 1`,
      [order_id]
    );

    if (orderRows.length === 0) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    const { buyer_id, seller_id, order_status, quantity, item_name, buyer_name, seller_name } = orderRows[0];
    if (student_id !== buyer_id && student_id !== seller_id) {
      return res.status(403).json({ message: 'Not authorised to view these messages.' });
    }

    // Mark messages as read since the user is viewing the chat
    const [readResult] = await db.query(
      `UPDATE Message SET is_read = TRUE
       WHERE order_id = ? AND receiver_id = ? AND is_read = FALSE`,
      [order_id, student_id]
    );
    if (readResult.affectedRows > 0) realtime.emitToUser(student_id, 'notifications:changed');

    const [messages] = await db.query(
      `SELECT m.message_id, m.sender_id, s.name AS sender_name,
              m.message_text, m.sent_at
       FROM Message m
       JOIN Student s ON m.sender_id = s.student_id
       WHERE m.order_id = ?
       ORDER BY m.sent_at ASC`,
      [order_id]
    );

    const iAmBuyer = student_id === buyer_id;
    res.json({
      order_status,
      messages,
      order: { item_name, quantity, role: iAmBuyer ? 'buyer' : 'seller', other_name: iAmBuyer ? seller_name : buyer_name },
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching messages.', error: err.message });
  }
});

// ── POST /api/messages/:order_id ─────────────────────────────
// Send a message in an order chat
router.post('/:order_id', auth, async (req, res) => {
  const order_id   = req.params.order_id;
  const sender_id  = req.user.student_id;
  const { message_text } = req.body;

  if (typeof message_text !== 'string' || message_text.trim() === '') {
    return res.status(400).json({ message: 'Message cannot be empty.' });
  }
  if (message_text.trim().length > 1000) {
    return res.status(400).json({ message: 'Message can be at most 1000 characters.' });
  }

  try {
    // Find the buyer and seller to determine the receiver
    const [orderRows] = await db.query(
      `SELECT o.buyer_id, l.seller_id, o.order_status
       FROM "Order" o
       JOIN Order_Item oi ON o.order_id    = oi.order_id
       JOIN Listing    l  ON oi.listing_id = l.listing_id
       WHERE o.order_id = ? LIMIT 1`,
      [order_id]
    );

    if (orderRows.length === 0) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    const { buyer_id, seller_id, order_status } = orderRows[0];

    if (order_status === 'Placed') {
      return res.status(403).json({ message: 'Chat is locked until the seller confirms this order.' });
    }

    if (sender_id !== buyer_id && sender_id !== seller_id) {
      return res.status(403).json({ message: 'Not authorised to send messages here.' });
    }

    // Receiver is whoever is NOT the sender
    const receiver_id = Number(sender_id) === Number(buyer_id) ? seller_id : buyer_id;

    const [result] = await db.query(
      `INSERT INTO Message (order_id, sender_id, receiver_id, message_text)
       VALUES (?, ?, ?, ?)`,
      [order_id, sender_id, receiver_id, message_text.trim()]
    );

    const message = {
      message_id  : result.insertId,
      order_id    : Number(order_id),
      sender_id   : Number(sender_id),
      sender_name : req.user.name,
      message_text: message_text.trim(),
      sent_at     : new Date().toISOString(),
    };
    // Live delivery to whoever has this chat open, and a badge update for the receiver
    realtime.emitToOrder(order_id, 'message:new', message);
    realtime.emitToUser(receiver_id, 'notifications:changed');
    const preview = message.message_text.length > 120 ? `${message.message_text.slice(0, 117)}…` : message.message_text;
    notify.inBackground(notify.pushOnly(receiver_id, {
      title: `${req.user.name} · Order #${order_id}`, body: preview, link: `/chat/${order_id}`,
    }));

    res.status(201).json({ message: 'Message sent!', data: message });
  } catch (err) {
    res.status(500).json({ message: 'Error sending message.', error: err.message });
  }
});

module.exports = router;
