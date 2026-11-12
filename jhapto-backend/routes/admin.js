// routes/admin.js
// Admin-only routes: ban students, remove listings, view reports

const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../config/db');
const { loginLimiter } = require('../middleware/rateLimit');
const v       = require('../utils/validate');
const realtime = require('../realtime');

// ── Admin auth middleware (separate from student auth) ───────
const adminAuth = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Admin access required.', code: 'INVALID_TOKEN' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.is_admin) return res.status(403).json({ message: 'Not an admin.' });
    req.admin = decoded;
    next();
  } catch {
    return res.status(401).json({ message: 'Session expired. Please log in again.', code: 'INVALID_TOKEN' });
  }
};

// ── POST /api/admin/register ─────────────────────────────────
// Creates another admin. Only a logged-in admin can do this —
// public sign-up would let anyone grant themselves admin powers.
router.post('/register', adminAuth, async (req, res) => {
  let { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email, and password are required.' });
  }
  if (!v.isNonEmptyString(name, 100)) {
    return res.status(400).json({ message: 'Name must be 1–100 characters.' });
  }
  if (!v.isEmail(email)) {
    return res.status(400).json({ message: 'Enter a valid email address.' });
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 72) {
    return res.status(400).json({ message: 'Admin password must be at least 8 characters.' });
  }
  name = name.trim();
  email = email.trim().toLowerCase();
  try {
    const [existing] = await db.query('SELECT admin_id FROM Admin WHERE lower(email) = lower(?)', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ message: 'Admin email already registered.' });
    }
    const password_hash = await bcrypt.hash(password, 10);
    await db.query(
      'INSERT INTO Admin (name, email, password_hash) VALUES (?, ?, ?)',
      [name, email, password_hash]
    );
    res.status(201).json({ message: `Admin account created for ${email}.` });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// ── GET /api/admin/admins ────────────────────────────────────
router.get('/admins', adminAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT admin_id, name, email, created_at FROM Admin ORDER BY created_at ASC'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching admins.', error: err.message });
  }
});

// ── POST /api/admin/login ────────────────────────────────────
router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }
  try {
    const [rows] = await db.query(
      'SELECT * FROM Admin WHERE lower(email) = lower(?)', [email.trim()]
    );
    const admin = rows[0];
    const isMatch = admin ? await bcrypt.compare(password, admin.password_hash) : false;
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }
    const token = jwt.sign(
      { admin_id: admin.admin_id, name: admin.name, is_admin: true },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );
    res.json({
      message: 'Admin login successful!',
      token,
      admin: { admin_id: admin.admin_id, name: admin.name, email: admin.email },
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// ── GET /api/admin/listings ──────────────────────────────────
// View all listings (uses vw_admin_listings view)
router.get('/listings', adminAuth, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM vw_admin_listings ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching listings.', error: err.message });
  }
});

// ── DELETE /api/admin/listings/:id ──────────────────────────
// Admin removes a listing
router.delete('/listings/:id', adminAuth, async (req, res) => {
  try {
    await db.query(
      "UPDATE Listing SET listing_status = 'Removed' WHERE listing_id = ?",
      [req.params.id]
    );
    res.json({ message: 'Listing removed by admin.' });
  } catch (err) {
    res.status(500).json({ message: 'Error removing listing.', error: err.message });
  }
});

// ── PATCH /api/admin/students/:id/ban ───────────────────────
// Admin bans a student
router.patch('/students/:id/ban', adminAuth, async (req, res) => {
  try {
    await db.query(
      'UPDATE Student SET is_banned = TRUE WHERE student_id = ?', [req.params.id]
    );
    realtime.disconnectUser(Number(req.params.id));
    res.json({ message: 'Student banned successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Error banning student.', error: err.message });
  }
});

// ── PATCH /api/admin/students/:id/unban ─────────────────────
// Admin unbans a student
router.patch('/students/:id/unban', adminAuth, async (req, res) => {
  try {
    await db.query(
      'UPDATE Student SET is_banned = FALSE WHERE student_id = ?', [req.params.id]
    );
    res.json({ message: 'Student unbanned successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Error unbanning student.', error: err.message });
  }
});

// ── GET /api/admin/report ────────────────────────────────────
// Full admin report using stored procedure with cursor
router.get('/report', adminAuth, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM sp_admin_report()');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Error generating report.', error: err.message });
  }
});

// ── GET /api/admin/students ──────────────────────────────────
// View all students
router.get('/students', adminAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT s.student_id, s.name, s.email, s.phone_no,
              f.floor_number, s.is_banned, s.created_at
       FROM Student s JOIN Floor f ON s.floor_id = f.floor_id
       ORDER BY s.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching students.', error: err.message });
  }
});

// ── GET /api/admin/reports ───────────────────────────────────
// All user reports, newest first, pending ones on top.
// Proof images can be large, so the list only says whether one exists.
router.get('/reports', adminAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT r.report_id, r.order_id, r.reason, r.status, r.created_at,
              r.reporter_id, rep.name AS reporter_name, rep.email AS reporter_email,
              r.reported_user_id, tgt.name AS reported_name, tgt.email AS reported_email,
              tgt.is_banned AS reported_is_banned,
              (r.proof_url IS NOT NULL AND r.proof_url <> '') AS has_proof
       FROM Report r
       JOIN Student rep ON r.reporter_id      = rep.student_id
       JOIN Student tgt ON r.reported_user_id = tgt.student_id
       ORDER BY (r.status = 'Pending') DESC, r.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching reports.', error: err.message });
  }
});

// ── GET /api/admin/reports/:id/proof ─────────────────────────
router.get('/reports/:id/proof', adminAuth, async (req, res) => {
  if (!v.isIntInRange(req.params.id, 1, 2147483647)) {
    return res.status(400).json({ message: 'Invalid report id.' });
  }
  try {
    const [rows] = await db.query(
      'SELECT proof_url FROM Report WHERE report_id = ?', [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Report not found.' });
    res.json({ proof_url: rows[0].proof_url });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching proof.', error: err.message });
  }
});

// ── PATCH /api/admin/reports/:id ─────────────────────────────
// Body: { status: 'Resolved' | 'Dismissed' | 'Pending' }
router.patch('/reports/:id', adminAuth, async (req, res) => {
  const { status } = req.body;
  if (!v.isIntInRange(req.params.id, 1, 2147483647)) {
    return res.status(400).json({ message: 'Invalid report id.' });
  }
  if (!['Pending', 'Resolved', 'Dismissed'].includes(status)) {
    return res.status(400).json({ message: 'Status must be Pending, Resolved or Dismissed.' });
  }
  try {
    const [result] = await db.query(
      'UPDATE Report SET status = ? WHERE report_id = ?', [status, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Report not found.' });
    res.json({ message: `Report marked ${status}.` });
  } catch (err) {
    res.status(500).json({ message: 'Error updating report.', error: err.message });
  }
});

module.exports = router;
