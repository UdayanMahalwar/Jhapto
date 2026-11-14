// routes/reviews.js
// Buyers rate sellers after an order is delivered.
// trg_review_validate (DB) enforces buyer + Delivered; trg_review_after_insert
// updates the seller's average rating and notifies them.

const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const auth    = require('../middleware/auth');
const v       = require('../utils/validate');
const realtime = require('../realtime');

router.param('id', v.intParam);   // ids must be numbers

// ── POST /api/reviews ────────────────────────────────────────
// Body: { order_id, rating (1-5), comment? }
router.post('/', auth, async (req, res) => {
  const reviewer_id = req.user.student_id;
  const { order_id, rating, comment } = req.body;

  if (!v.isIntInRange(order_id, 1, 2147483647)) {
    return res.status(400).json({ message: 'Invalid order.' });
  }
  if (!v.isIntInRange(rating, 1, 5)) {
    return res.status(400).json({ message: 'Rating must be a whole number from 1 to 5.' });
  }
  if (comment != null && comment !== '' && !v.isNonEmptyString(comment, 500)) {
    return res.status(400).json({ message: 'Comment can be at most 500 characters.' });
  }

  try {
    const [existing] = await db.query('SELECT review_id FROM Review WHERE order_id = ?', [order_id]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'You have already reviewed this order.' });
    }

    // seller_id is filled in by trg_review_validate; 0 is a placeholder
    await db.query(
      `INSERT INTO Review (order_id, reviewer_id, seller_id, rating, comment)
       VALUES (?, ?, 0, ?, ?)`,
      [order_id, reviewer_id, Number(rating), comment ? comment.trim() : null]
    );
    realtime.notifyOrderParties(order_id);
    res.status(201).json({ message: 'Thanks for your review!' });
  } catch (err) {
    if (err.sqlState === '45000') {
      return res.status(400).json({ message: err.message.replace(/^ERROR:\s*/, '') });
    }
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'You have already reviewed this order.' });
    }
    res.status(500).json({ message: 'Error saving review.', error: err.message });
  }
});

// ── GET /api/reviews/seller/:id ──────────────────────────────
// A seller's rating summary and most recent reviews
router.get('/seller/:id', auth, async (req, res) => {
  if (!v.isIntInRange(req.params.id, 1, 2147483647)) {
    return res.status(400).json({ message: 'Invalid seller.' });
  }
  try {
    const [sellerRows] = await db.query(
      'SELECT student_id, name, avg_rating, rating_count FROM Student WHERE student_id = ?',
      [req.params.id]
    );
    if (sellerRows.length === 0) return res.status(404).json({ message: 'Seller not found.' });

    const [reviews] = await db.query(
      `SELECT r.review_id, r.order_id, r.rating, r.comment, r.created_at,
              rv.name AS reviewer_name, i.item_name
       FROM Review r
       JOIN Student    rv ON r.reviewer_id  = rv.student_id
       JOIN Order_Item oi ON r.order_id     = oi.order_id
       JOIN Listing    l  ON oi.listing_id  = l.listing_id
       JOIN Item       i  ON l.item_id      = i.item_id
       WHERE r.seller_id = ?
       ORDER BY r.created_at DESC
       LIMIT 50`,
      [req.params.id]
    );
    // Show reviewers by first name only
    reviews.forEach(r => { r.reviewer_name = String(r.reviewer_name).split(' ')[0]; });

    res.json({ seller: sellerRows[0], reviews });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching reviews.', error: err.message });
  }
});

module.exports = router;
