// routes/orders.js
// Handles placing orders, viewing order history, and updating order status

const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const auth    = require('../middleware/auth');
const v       = require('../utils/validate');
const realtime = require('../realtime');

const MAX_QTY_PER_ITEM = 100;
const MAX_CART_LINES   = 20;

// Throws a 400-style error that the handlers turn into a JSON response
class OrderError extends Error {}

// Locks the listing row for the rest of the transaction and checks it can be bought
async function lockAndCheckListing(conn, buyer_id, listing_id, quantity) {
  const [rows] = await conn.query(
    `SELECT l.listing_id, l.seller_id, l.selling_price, l.quantity_available,
            l.listing_status, i.item_name, s.is_banned AS seller_banned
     FROM Listing l
     JOIN Item    i ON l.item_id   = i.item_id
     JOIN Student s ON l.seller_id = s.student_id
     WHERE l.listing_id = ?
     FOR UPDATE OF l`,
    [listing_id]
  );
  const listing = rows[0];
  if (!listing || listing.listing_status !== 'Active' || listing.seller_banned) {
    throw new OrderError(`Listing #${listing_id} is no longer available.`);
  }
  if (Number(listing.seller_id) === Number(buyer_id)) {
    throw new OrderError(`You can't buy your own listing (${listing.item_name}).`);
  }
  if (Number(listing.quantity_available) < quantity) {
    throw new OrderError(
      `Only ${listing.quantity_available} left of ${listing.item_name}. Update your cart and try again.`
    );
  }
  return listing;
}

// ── POST /api/orders ─────────────────────────────────────────
// Places a single order using the database function place_order(),
// which returns (order_id, message); order_id is -1 when it refused.
router.post('/', auth, async (req, res) => {
  const { listing_id, quantity } = req.body;
  const buyer_id = req.user.student_id;

  if (!v.isIntInRange(listing_id, 1, 2147483647) || !v.isIntInRange(quantity, 1, MAX_QTY_PER_ITEM)) {
    return res.status(400).json({ message: `listing_id and a quantity between 1 and ${MAX_QTY_PER_ITEM} are required.` });
  }

  try {
    const [own] = await db.query('SELECT seller_id FROM Listing WHERE listing_id = ?', [listing_id]);
    if (own.length > 0 && Number(own[0].seller_id) === Number(buyer_id)) {
      return res.status(400).json({ message: "You can't buy your own listing." });
    }

    const [[result]] = await db.query(
      'SELECT order_id, message FROM place_order(?, ?, ?)',
      [buyer_id, listing_id, quantity]
    );

    if (result.order_id == null || Number(result.order_id) === -1) {
      return res.status(400).json({ message: result.message || 'Order could not be placed.' });
    }

    realtime.notifyOrderParties(result.order_id);
    res.status(201).json({
      message  : result.message,
      order_id : result.order_id,
    });
  } catch (err) {
    if (err.sqlState === '45000') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Error placing order.', error: err.message });
  }
});

// ── POST /api/orders/checkout ────────────────────────────────
// Places every item in the cart in ONE transaction: either all orders are
// created or none are (no half-placed carts). One Order row per listing, so
// each seller confirms / chats about their own item as before.
// Body: { items: [{ listing_id, quantity }, ...] }
router.post('/checkout', auth, async (req, res) => {
  const buyer_id = req.user.student_id;
  const { items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Your cart is empty.' });
  }
  if (items.length > MAX_CART_LINES) {
    return res.status(400).json({ message: `A cart can have at most ${MAX_CART_LINES} different items.` });
  }

  // Validate and merge duplicate lines for the same listing
  const qtyByListing = new Map();
  for (const item of items) {
    if (!item || !v.isIntInRange(item.listing_id, 1, 2147483647) || !v.isIntInRange(item.quantity, 1, MAX_QTY_PER_ITEM)) {
      return res.status(400).json({ message: `Each cart item needs a listing and a quantity between 1 and ${MAX_QTY_PER_ITEM}.` });
    }
    const id = Number(item.listing_id);
    qtyByListing.set(id, (qtyByListing.get(id) || 0) + Number(item.quantity));
  }
  // Lock rows in a fixed order so two concurrent checkouts can't deadlock
  const lines = [...qtyByListing.entries()].sort((a, b) => a[0] - b[0]);

  let conn;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    const orderIds = [];
    for (const [listing_id, quantity] of lines) {
      const listing = await lockAndCheckListing(conn, buyer_id, listing_id, quantity);
      const price = Number(listing.selling_price);

      const [orderResult] = await conn.query(
        `INSERT INTO "Order" (buyer_id, order_status, total_amount) VALUES (?, 'Placed', ?)`,
        [buyer_id, (price * quantity).toFixed(2)]
      );
      // trg_deduct_stock_on_order deducts stock (and re-checks it) on this insert
      await conn.query(
        `INSERT INTO Order_Item (order_id, listing_id, quantity, price_at_purchase)
         VALUES (?, ?, ?, ?)`,
        [orderResult.insertId, listing_id, quantity, price]
      );
      orderIds.push(orderResult.insertId);
    }

    await conn.commit();
    orderIds.forEach(id => realtime.notifyOrderParties(id));
    res.status(201).json({
      message  : orderIds.length === 1 ? 'Order placed successfully!' : `${orderIds.length} orders placed successfully!`,
      order_ids: orderIds,
    });
  } catch (err) {
    if (conn) await conn.rollback().catch(() => {});
    if (err instanceof OrderError || err.sqlState === '45000') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Error placing order. No orders were placed.', error: err.message });
  } finally {
    if (conn) conn.release();
  }
});

// ── Order list filters ───────────────────────────────────────
// ?status=Delivered,Cancelled  &from=YYYY-MM-DD  &to=YYYY-MM-DD (inclusive)
const ORDER_STATUSES = ['Placed', 'Confirmed', 'Delivered', 'Cancelled'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isDate = (d) => DATE_RE.test(d) && !Number.isNaN(Date.parse(d + 'T00:00:00Z'));

function buildOrderFilters(query) {
  let sql = '';
  const params = [];
  const { status, from, to } = query;

  if (status !== undefined && status !== '') {
    const list = String(status).split(',').map(x => x.trim()).filter(Boolean);
    if (list.length === 0 || list.some(x => !ORDER_STATUSES.includes(x))) {
      return { error: `status must be a comma-separated list of: ${ORDER_STATUSES.join(', ')}` };
    }
    sql += ` AND o.order_status IN (${list.map(() => '?').join(', ')})`;
    params.push(...list);
  }
  if (from !== undefined && from !== '') {
    if (!isDate(String(from))) return { error: 'from must be a date (YYYY-MM-DD).' };
    sql += ' AND o.created_at >= ?';
    params.push(String(from));
  }
  if (to !== undefined && to !== '') {
    if (!isDate(String(to))) return { error: 'to must be a date (YYYY-MM-DD).' };
    if (from && String(from) > String(to)) return { error: 'from date must be before to date.' };
    sql += ' AND o.created_at < (?::date + 1)';
    params.push(String(to));
  }
  return { sql, params };
}

// ── GET /api/orders/my ───────────────────────────────────────
// Returns all orders placed by the logged-in buyer
router.get('/my', auth, async (req, res) => {
  const buyer_id = req.user.student_id;
  const filters = buildOrderFilters(req.query);
  if (filters.error) return res.status(400).json({ message: filters.error });
  try {
    const [rows] = await db.query(
      `SELECT o.order_id, i.item_name, oi.quantity, oi.price_at_purchase,
              o.total_amount, o.order_status, o.created_at,
              seller.name AS seller_name, seller.phone_no AS seller_phone, l.seller_id,
              rv.rating AS my_rating, rv.comment AS my_review
       FROM "Order" o
       JOIN Order_Item oi ON o.order_id    = oi.order_id
       JOIN Listing    l  ON oi.listing_id = l.listing_id
       JOIN Item       i  ON l.item_id     = i.item_id
       JOIN Student    seller ON l.seller_id = seller.student_id
       LEFT JOIN Review rv ON rv.order_id = o.order_id
       WHERE o.buyer_id = ?${filters.sql}
       ORDER BY o.created_at DESC, o.order_id DESC`,
      [buyer_id, ...filters.params]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching orders.', error: err.message });
  }
});

// ── GET /api/orders/selling ──────────────────────────────────
// Returns all orders received by the logged-in student as a seller
router.get('/selling', auth, async (req, res) => {
  const seller_id = req.user.student_id;
  const filters = buildOrderFilters(req.query);
  if (filters.error) return res.status(400).json({ message: filters.error });
  try {
    const [rows] = await db.query(
      `SELECT o.order_id, i.item_name, oi.quantity, oi.price_at_purchase,
              o.total_amount, o.order_status, o.created_at,
              buyer.name AS buyer_name, buyer.phone_no AS buyer_phone, o.buyer_id,
              rv.rating AS buyer_rating, rv.comment AS buyer_review
       FROM "Order" o
       JOIN Order_Item oi ON o.order_id    = oi.order_id
       JOIN Listing    l  ON oi.listing_id = l.listing_id
       JOIN Item       i  ON l.item_id     = i.item_id
       JOIN Student    buyer ON o.buyer_id = buyer.student_id
       LEFT JOIN Review rv ON rv.order_id = o.order_id
       WHERE l.seller_id = ?${filters.sql}
       ORDER BY o.created_at DESC, o.order_id DESC`,
      [seller_id, ...filters.params]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching selling orders.', error: err.message });
  }
});

// ── PATCH /api/orders/:id/cancel ────────────────────────────
// Buyer cancels their order (only allowed if status = Placed)
// Trigger trg_cancel_only_if_placed enforces this in DB
router.patch('/:id/cancel', auth, async (req, res) => {
  const order_id = req.params.id;
  const buyer_id = req.user.student_id;

  try {
    const [rows] = await db.query(
      'SELECT buyer_id, order_status FROM "Order" WHERE order_id = ?', [order_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Order not found.' });
    }
    if (rows[0].buyer_id !== buyer_id) {
      return res.status(403).json({ message: 'You can only cancel your own orders.' });
    }

    await db.query(
      `UPDATE "Order" SET order_status = 'Cancelled' WHERE order_id = ?`, [order_id]
    );

    realtime.emitToOrder(order_id, 'order:status', { order_id: Number(order_id), order_status: 'Cancelled' });
    realtime.notifyOrderParties(order_id);
    res.json({ message: 'Order cancelled successfully.' });
  } catch (err) {
    if (err.sqlState === '45000') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Error cancelling order.', error: err.message });
  }
});

// ── PATCH /api/orders/:id/confirm ───────────────────────────
// Seller confirms an order
router.patch('/:id/confirm', auth, async (req, res) => {
  const order_id  = req.params.id;
  const seller_id = req.user.student_id;

  try {
    // Verify this order belongs to one of the seller's listings
    const [rows] = await db.query(
      `SELECT o.order_id FROM "Order" o
       JOIN Order_Item oi ON o.order_id    = oi.order_id
       JOIN Listing    l  ON oi.listing_id = l.listing_id
       WHERE o.order_id = ? AND l.seller_id = ?`,
      [order_id, seller_id]
    );

    if (rows.length === 0) {
      return res.status(403).json({ message: 'Not authorised to confirm this order.' });
    }

    await db.query(
      `UPDATE "Order" SET order_status = 'Confirmed' WHERE order_id = ?`, [order_id]
    );

    realtime.emitToOrder(order_id, 'order:status', { order_id: Number(order_id), order_status: 'Confirmed' });
    realtime.notifyOrderParties(order_id);
    res.json({ message: 'Order confirmed!' });
  } catch (err) {
    res.status(500).json({ message: 'Error confirming order.', error: err.message });
  }
});

// ── PATCH /api/orders/:id/deliver ───────────────────────────
// Seller marks an order as delivered
router.patch('/:id/deliver', auth, async (req, res) => {
  const order_id  = req.params.id;
  const seller_id = req.user.student_id;

  try {
    const [rows] = await db.query(
      `SELECT o.order_id FROM "Order" o
       JOIN Order_Item oi ON o.order_id    = oi.order_id
       JOIN Listing    l  ON oi.listing_id = l.listing_id
       WHERE o.order_id = ? AND l.seller_id = ?`,
      [order_id, seller_id]
    );

    if (rows.length === 0) {
      return res.status(403).json({ message: 'Not authorised to update this order.' });
    }

    await db.query(
      `UPDATE "Order" SET order_status = 'Delivered' WHERE order_id = ?`, [order_id]
    );

    realtime.emitToOrder(order_id, 'order:status', { order_id: Number(order_id), order_status: 'Delivered' });
    realtime.notifyOrderParties(order_id);
    res.json({ message: 'Order marked as delivered!' });
  } catch (err) {
    res.status(500).json({ message: 'Error updating order.', error: err.message });
  }
});

module.exports = router;
