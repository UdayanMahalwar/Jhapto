// routes/reports.js
const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const auth    = require('../middleware/auth');
const v       = require('../utils/validate');

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

    await db.query(
      `INSERT INTO Report (order_id, reporter_id, reported_user_id, reason, proof_url)
       VALUES (?, ?, ?, ?, ?)`,
      [order_id, reporter_id, reported_user_id, reason.trim(), proof_url || null]
    );

    res.status(201).json({ message: 'Report submitted successfully. Admins will review it.' });
  } catch (err) {
    res.status(500).json({ message: 'Error submitting report.', error: err.message });
  }
});

module.exports = router;
