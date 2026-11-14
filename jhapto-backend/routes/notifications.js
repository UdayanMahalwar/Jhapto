// routes/notifications.js
// In-app notifications. Rows are created by DB triggers
// (trg_notify_new_order, trg_notify_order_status, trg_review_after_insert).

const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const auth    = require('../middleware/auth');
const v       = require('../utils/validate');

router.param('id', v.intParam);   // ids must be numbers

// ── GET /api/notifications ───────────────────────────────────
// Latest 30 notifications + unread count
router.get('/', auth, async (req, res) => {
  const student_id = req.user.student_id;
  try {
    const [notifications] = await db.query(
      `SELECT notification_id, type, message, link, is_read, created_at
       FROM Notification
       WHERE student_id = ?
       ORDER BY created_at DESC, notification_id DESC
       LIMIT 30`,
      [student_id]
    );
    const [[{ unread_count }]] = await db.query(
      'SELECT COUNT(*) AS unread_count FROM Notification WHERE student_id = ? AND is_read = FALSE',
      [student_id]
    );
    res.json({ unread_count: Number(unread_count), notifications });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching notifications.', error: err.message });
  }
});

// ── PATCH /api/notifications/read-all ────────────────────────
router.patch('/read-all', auth, async (req, res) => {
  try {
    await db.query(
      'UPDATE Notification SET is_read = TRUE WHERE student_id = ? AND is_read = FALSE',
      [req.user.student_id]
    );
    res.json({ message: 'All notifications marked as read.' });
  } catch (err) {
    res.status(500).json({ message: 'Error updating notifications.', error: err.message });
  }
});

// ── PATCH /api/notifications/:id/read ────────────────────────
router.patch('/:id/read', auth, async (req, res) => {
  if (!v.isIntInRange(req.params.id, 1, 2147483647)) {
    return res.status(400).json({ message: 'Invalid notification.' });
  }
  try {
    await db.query(
      'UPDATE Notification SET is_read = TRUE WHERE notification_id = ? AND student_id = ?',
      [req.params.id, req.user.student_id]
    );
    res.json({ message: 'Notification marked as read.' });
  } catch (err) {
    res.status(500).json({ message: 'Error updating notification.', error: err.message });
  }
});

module.exports = router;
