// routes/reports.js
const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const auth    = require('../middleware/auth');
const v       = require('../utils/validate');
const notify  = require('../utils/notify');

const MESSAGE_MAX = 1000;

// The report if the logged-in student filed it, else undefined
async function ownReport(report_id, student_id) {
  const [rows] = await db.query(
    `SELECT r.report_id, r.order_id, r.reason, r.status, r.created_at, r.reporter_id,
            tgt.name AS reported_name
     FROM Report r JOIN Student tgt ON r.reported_user_id = tgt.student_id
     WHERE r.report_id = ? AND r.reporter_id = ?`,
    [report_id, student_id]
  );
  return rows[0];
}

const REPORT_MESSAGES_SQL =
  `SELECT m.report_message_id, m.sender_role, m.message_text, m.created_at,
          CASE WHEN m.sender_role = 'admin' THEN 'Jhapto admin' ELSE s.name END AS sender_name
   FROM report_message m LEFT JOIN Student s ON m.student_id = s.student_id
   WHERE m.report_id = ?
   ORDER BY m.created_at, m.report_message_id`;

// POST /api/reports
// A buyer or seller reports the other party of one of their orders.
router.post('/', auth, async (req, res) => {
  const reporter_id = req.user.student_id;
  const { order_id, reported_user_id, reason, proof_url } = req.body;

  if (!order_id || !reported_user_id || !reason) {
    return res.status(400).json({ message: 'Missing required fields.' });
  }
  if (!v.isIntInRange(order_id, 1, 2147483647) || !v.isIntInRange(reported_user_id, 1, 2147483647)) {
    return res.status(400).json({ message: 'Invalid order or user.' });
  }
  if (!v.isNonEmptyString(reason, 1000)) {
    return res.status(400).json({ message: 'Reason must be 1–1000 characters.' });
  }
  if (!v.isOptionalImage(proof_url)) {
    return res.status(400).json({ message: 'Proof must be an image uploaded with the photo picker.' });
  }

  try {
    // Only the buyer and seller of this order can report each other
    const [orderRows] = await db.query(
      `SELECT o.buyer_id, l.seller_id
       FROM "Order" o
       JOIN Order_Item oi ON o.order_id    = oi.order_id
       JOIN Listing    l  ON oi.listing_id = l.listing_id
       WHERE o.order_id = ? LIMIT 1`,
      [order_id]
    );
    if (orderRows.length === 0) {
      return res.status(404).json({ message: 'Order not found.' });
    }
    const buyer_id  = Number(orderRows[0].buyer_id);
    const seller_id = Number(orderRows[0].seller_id);
    const me        = Number(reporter_id);
    const otherParty = me === buyer_id ? seller_id : me === seller_id ? buyer_id : null;
    if (otherParty === null) {
      return res.status(403).json({ message: 'You can only report orders you are part of.' });
    }
    if (Number(reported_user_id) !== otherParty) {
      return res.status(400).json({ message: 'You can only report the other person on this order.' });
    }

    const [existing] = await db.query(
      `SELECT report_id FROM Report
       WHERE order_id = ? AND reporter_id = ? AND status = 'Pending'`,
      [order_id, reporter_id]
    );
    if (existing.length > 0) {
      return res.status(409).json({ message: 'You already have a pending report for this order.' });
    }

    const [result] = await db.query(
      `INSERT INTO Report (order_id, reporter_id, reported_user_id, reason, proof_url)
       VALUES (?, ?, ?, ?, ?)`,
      [order_id, reporter_id, reported_user_id, reason.trim(), proof_url || null]
    );
    notify.inBackground(notify.emailAdmins({
      subject: `New report #${result.insertId} on Jhapto`,
      message: `${req.user.name} reported a user on order #${order_id}: "${reason.trim().slice(0, 300)}"`,
      link: '/admin/dashboard',
    }));

    res.status(201).json({
      message: 'Report submitted. You can follow it and talk to the admins under My reports.',
      report_id: result.insertId,
    });
  } catch (err) {
    res.status(500).json({ message: 'Error submitting report.', error: err.message });
  }
});

// ── GET /api/reports/mine ────────────────────────────────────
// Reports the logged-in student filed, newest first
router.get('/mine', auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT r.report_id, r.order_id, r.reason, r.status, r.created_at,
              tgt.name AS reported_name,
              (SELECT COUNT(*) FROM report_message m WHERE m.report_id = r.report_id) AS message_count,
              (SELECT m.sender_role FROM report_message m WHERE m.report_id = r.report_id
               ORDER BY m.created_at DESC, m.report_message_id DESC LIMIT 1) AS last_sender
       FROM Report r JOIN Student tgt ON r.reported_user_id = tgt.student_id
       WHERE r.reporter_id = ?
       ORDER BY r.created_at DESC`,
      [req.user.student_id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching your reports.', error: err.message });
  }
});

// ── GET /api/reports/:id/messages ────────────────────────────
// The report and its conversation with the admins (reporter only)
router.get('/:id/messages', auth, async (req, res) => {
  if (!v.isIntInRange(req.params.id, 1, 2147483647)) return res.status(400).json({ message: 'Invalid report.' });
  try {
    const report = await ownReport(req.params.id, req.user.student_id);
    if (!report) return res.status(404).json({ message: 'Report not found.' });
    const [messages] = await db.query(REPORT_MESSAGES_SQL, [report.report_id]);
    res.json({ report, messages });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching messages.', error: err.message });
  }
});

// ── POST /api/reports/:id/messages ───────────────────────────
// Body: { message_text } — the reporter writes to the admins
router.post('/:id/messages', auth, async (req, res) => {
  const { message_text } = req.body;
  if (!v.isIntInRange(req.params.id, 1, 2147483647)) return res.status(400).json({ message: 'Invalid report.' });
  if (!v.isNonEmptyString(message_text, MESSAGE_MAX)) {
    return res.status(400).json({ message: `Message must be 1–${MESSAGE_MAX} characters.` });
  }
  try {
    const report = await ownReport(req.params.id, req.user.student_id);
    if (!report) return res.status(404).json({ message: 'Report not found.' });
    const [rows] = await db.query(
      `INSERT INTO report_message (report_id, sender_role, student_id, message_text)
       VALUES (?, 'student', ?, ?) RETURNING report_message_id, sender_role, message_text, created_at`,
      [report.report_id, req.user.student_id, message_text.trim()]
    );
    notify.inBackground(notify.emailAdmins({
      subject: `Reply on report #${report.report_id}`,
      message: `${req.user.name} wrote on report #${report.report_id}: "${message_text.trim().slice(0, 300)}"`,
      link: '/admin/dashboard',
    }));
    res.status(201).json({ message: 'Message sent.', data: { ...rows[0], sender_name: req.user.name } });
  } catch (err) {
    res.status(500).json({ message: 'Error sending message.', error: err.message });
  }
});

module.exports = router;
