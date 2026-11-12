// routes/listings.js
// Handles browsing listings (floor-priority) and creating/removing listings

const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const auth    = require('../middleware/auth');
const v       = require('../utils/validate');

// ── GET /api/listings ────────────────────────────────────────
// Returns all active listings, floor-priority sorted
// Uses the MySQL stored procedure sp_floor_priority_listings
router.get('/', auth, async (req, res) => {
  const buyer_floor_id = req.user.floor_id;
  try {
    const [rows] = await db.query(
      'CALL sp_floor_priority_listings(?)', [buyer_floor_id]
    );
    res.json(rows[0]);  // stored procedure returns result in rows[0]
  } catch (err) {
    res.status(500).json({ message: 'Error fetching listings.', error: err.message });
  }
});

// ── GET /api/listings/my ─────────────────────────────────────
// Returns all listings created by the logged-in student
router.get('/my', auth, async (req, res) => {
  const seller_id = req.user.student_id;
  try {
    const [rows] = await db.query(
      `SELECT l.listing_id, i.item_name, i.brand, l.mrp, l.selling_price,
              l.quantity_available, l.description, l.photo_url, l.room_number, l.listing_status, l.created_at
       FROM Listing l
       JOIN Item i ON l.item_id = i.item_id
       WHERE l.seller_id = ?
       ORDER BY l.created_at DESC`,
      [seller_id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching your listings.', error: err.message });
  }
});

// ── POST /api/listings ───────────────────────────────────────
// Creates a new listing (price validation handled by DB trigger)
router.post('/', auth, async (req, res) => {
  const { item_id, mrp, selling_price, quantity_available, description, photo_url, room_number } = req.body;
  const seller_id = req.user.student_id;

  if (!item_id || !mrp || !selling_price || !quantity_available || !room_number) {
    return res.status(400).json({ message: 'item_id, mrp, selling_price, quantity, and room_number are required.' });
  }
  if (!v.isIntInRange(item_id, 1, 2147483647)) {
    return res.status(400).json({ message: 'Choose an item from the list.' });
  }
  if (!v.isPrice(mrp) || !v.isPrice(selling_price)) {
    return res.status(400).json({ message: 'MRP and selling price must be positive amounts (max 2 decimals, up to ₹1,00,000).' });
  }
  if (!v.isIntInRange(quantity_available, 1, 1000)) {
    return res.status(400).json({ message: 'Quantity must be a whole number between 1 and 1000.' });
  }
  if (!v.isNonEmptyString(room_number, 50)) {
    return res.status(400).json({ message: 'Room number must be 1–50 characters.' });
  }
  if (description != null && description !== '' && !v.isNonEmptyString(description, 500)) {
    return res.status(400).json({ message: 'Description can be at most 500 characters.' });
  }
  if (!v.isOptionalImage(photo_url)) {
    return res.status(400).json({ message: 'Photo must be an image uploaded with the photo picker.' });
  }

  try {
    // fn_is_price_valid checks price <= 1.5x MRP
    const [check] = await db.query(
      'SELECT fn_is_price_valid(?, ?) AS valid', [mrp, selling_price]
    );
    if (!check[0].valid) {
      return res.status(400).json({ message: 'Selling price cannot exceed 1.5x MRP.' });
    }

    await db.query(
      `INSERT INTO Listing (seller_id, item_id, mrp, selling_price, quantity_available, description, photo_url, room_number)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [seller_id, item_id, mrp, selling_price, quantity_available,
       description ? description.trim() : null, photo_url || null, room_number.trim()]
    );

    res.status(201).json({ message: 'Listing created successfully!' });
  } catch (err) {
    // Catch trigger errors (e.g. duplicate active listing)
    if (err.sqlState === '45000') {
      return res.status(400).json({ message: err.message });
    }
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ message: 'Choose an item from the list.' });
    }
    res.status(500).json({ message: 'Error creating listing.', error: err.message });
  }
});

// ── PATCH /api/listings/:id ──────────────────────────────────
// Seller edits their own listing. Any subset of:
//   mrp, selling_price, quantity_available, description, room_number, photo_url
// Price rule (<= 1.5x MRP) is also enforced by trg_check_price_update.
// Restocking an OutOfStock listing (quantity > 0) makes it Active again;
// setting quantity to 0 marks it OutOfStock (trg_auto_out_of_stock).
router.patch('/:id', auth, async (req, res) => {
  const seller_id = req.user.student_id;
  const { mrp, selling_price, quantity_available, description, room_number, photo_url } = req.body;

  if (!v.isIntInRange(req.params.id, 1, 2147483647)) {
    return res.status(400).json({ message: 'Invalid listing.' });
  }
  const provided = { mrp, selling_price, quantity_available, description, room_number, photo_url };
  if (Object.values(provided).every(x => x === undefined)) {
    return res.status(400).json({ message: 'Nothing to update.' });
  }
  if (mrp !== undefined && !v.isPrice(mrp)) {
    return res.status(400).json({ message: 'MRP must be a positive amount (max 2 decimals, up to ₹1,00,000).' });
  }
  if (selling_price !== undefined && !v.isPrice(selling_price)) {
    return res.status(400).json({ message: 'Selling price must be a positive amount (max 2 decimals, up to ₹1,00,000).' });
  }
  if (quantity_available !== undefined && !v.isIntInRange(quantity_available, 0, 1000)) {
    return res.status(400).json({ message: 'Quantity must be a whole number between 0 and 1000.' });
  }
  if (room_number !== undefined && !v.isNonEmptyString(room_number, 50)) {
    return res.status(400).json({ message: 'Room number must be 1–50 characters.' });
  }
  if (description !== undefined && description !== null && description !== '' && !v.isNonEmptyString(description, 500)) {
    return res.status(400).json({ message: 'Description can be at most 500 characters.' });
  }
  if (photo_url !== undefined && !v.isOptionalImage(photo_url)) {
    return res.status(400).json({ message: 'Photo must be an image uploaded with the photo picker.' });
  }

  try {
    const [rows] = await db.query(
      `SELECT listing_id, seller_id, item_id, mrp, selling_price, listing_status
       FROM Listing WHERE listing_id = ?`,
      [req.params.id]
    );
    const listing = rows[0];
    if (!listing) return res.status(404).json({ message: 'Listing not found.' });
    if (Number(listing.seller_id) !== Number(seller_id)) {
      return res.status(403).json({ message: 'You can only edit your own listings.' });
    }
    if (listing.listing_status === 'Removed') {
      return res.status(400).json({ message: 'Removed listings cannot be edited. Create a new listing instead.' });
    }

    const newMrp   = mrp !== undefined ? Number(mrp) : Number(listing.mrp);
    const newPrice = selling_price !== undefined ? Number(selling_price) : Number(listing.selling_price);
    const [check] = await db.query('SELECT fn_is_price_valid(?, ?) AS valid', [newMrp, newPrice]);
    if (!check[0].valid) {
      return res.status(400).json({ message: 'Selling price cannot exceed 1.5x MRP.' });
    }

    // Work out the status after the edit
    let newStatus = listing.listing_status;
    if (quantity_available !== undefined) {
      const qty = Number(quantity_available);
      if (qty === 0) newStatus = 'OutOfStock';
      else if (listing.listing_status === 'OutOfStock') newStatus = 'Active';
    }
    if (newStatus === 'Active' && listing.listing_status !== 'Active') {
      // Same rule as trg_one_active_listing: one Active listing per item per seller
      const [dupes] = await db.query(
        `SELECT listing_id FROM Listing
         WHERE seller_id = ? AND item_id = ? AND listing_status = 'Active' AND listing_id <> ?`,
        [seller_id, listing.item_id, listing.listing_id]
      );
      if (dupes.length > 0) {
        return res.status(400).json({ message: 'You already have another Active listing for this item. Edit that one instead.' });
      }
    }

    await db.query(
      `UPDATE Listing
       SET mrp                = ?,
           selling_price      = ?,
           quantity_available = COALESCE(?, quantity_available),
           description        = IF(?, ?, description),
           room_number        = COALESCE(?, room_number),
           photo_url          = IF(?, ?, photo_url),
           listing_status     = ?
       WHERE listing_id = ?`,
      [newMrp, newPrice,
       quantity_available !== undefined ? Number(quantity_available) : null,
       description !== undefined, description ? description.trim() : null,
       room_number !== undefined ? room_number.trim() : null,
       photo_url !== undefined, photo_url || null,
       newStatus,
       listing.listing_id]
    );

    res.json({ message: 'Listing updated.', listing_status: newStatus });
  } catch (err) {
    if (err.sqlState === '45000') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Error updating listing.', error: err.message });
  }
});

// ── DELETE /api/listings/:id ─────────────────────────────────
// Removes a listing (only the seller can remove their own listing)
router.delete('/:id', auth, async (req, res) => {
  const listing_id = req.params.id;
  const seller_id  = req.user.student_id;

  try {
    const [rows] = await db.query(
      'SELECT seller_id FROM Listing WHERE listing_id = ?', [listing_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Listing not found.' });
    }
    if (Number(rows[0].seller_id) !== Number(seller_id)) {
      return res.status(403).json({ message: 'You can only remove your own listings.' });
    }

    await db.query(
      "UPDATE Listing SET listing_status = 'Removed' WHERE listing_id = ?", [listing_id]
    );

    res.json({ message: 'Listing removed successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Error removing listing.', error: err.message });
  }
});

// ── GET /api/listings/items ──────────────────────────────────
// Returns all items (for the "sell an item" dropdown)
router.get('/items', auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT i.item_id, i.item_name, i.brand, c.category_name
       FROM Item i JOIN Category c ON i.category_id = c.category_id
       ORDER BY i.item_name`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching items.', error: err.message });
  }
});

module.exports = router;
