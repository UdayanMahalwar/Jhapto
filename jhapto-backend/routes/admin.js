// routes/admin.js
// Admin-only routes: ban students, remove listings, view reports

const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../config/db');
const { loginLimiter, loginAccountLimiter } = require('../middleware/rateLimit');
const v       = require('../utils/validate');
const realtime = require('../realtime');

router.param('id', v.intParam);   // ids must be numbers

// Adds an in-app notification for a student (email / push follow automatically)
async function notifyStudent(student_id, type, message, link) {
  await db.query(
    'INSERT INTO Notification (student_id, type, message, link) VALUES (?, ?, ?, ?)',
    [student_id, type, message.length > 255 ? `${message.slice(0, 252)}…` : message, link]
  );
  realtime.emitToUser(student_id, 'notifications:changed');
}

// ── Admin auth middleware (separate from student auth) ───────
const adminAuth = async (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Admin access required.', code: 'INVALID_TOKEN' });
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return res.status(401).json({ message: 'Session expired. Please log in again.', code: 'INVALID_TOKEN' });
  }
  if (!decoded.is_admin || !decoded.admin_id) return res.status(403).json({ message: 'Not an admin.' });
  try {
    // The admin account must still exist (a removed admin's old token stops working)
    const [rows] = await db.query('SELECT admin_id, name FROM Admin WHERE admin_id = ?', [decoded.admin_id]);
    if (rows.length === 0) return res.status(401).json({ message: 'Admin account no longer exists.', code: 'INVALID_TOKEN' });
    req.admin = { ...decoded, name: rows[0].name };
  } catch (err) {
    return res.status(500).json({ message: 'Server error.', error: err.message });
  }
  next();
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
router.post('/login', loginLimiter, loginAccountLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }
  try {
    const [rows] = await db.query(
      'SELECT * FROM Admin WHERE lower(email) = lower(?)', [email.trim()]
    );
    const admin = rows[0];
    // bcrypt runs even for unknown emails so timing doesn't reveal which admin emails exist
    const isMatch = await bcrypt.compare(password, admin?.password_hash || '$2a$10$CwTycUXWue0Thq9StjUM0uJ8.8nQ3s8E5k0hYH7nEv0Gx0VdQ1v8W');
    if (!admin) return res.status(401).json({ message: 'Invalid email or password.' });
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
              (r.proof_url IS NOT NULL AND r.proof_url <> '') AS has_proof,
              (SELECT COUNT(*) FROM report_message m WHERE m.report_id = r.report_id) AS message_count,
              (SELECT m.sender_role FROM report_message m WHERE m.report_id = r.report_id
               ORDER BY m.created_at DESC, m.report_message_id DESC LIMIT 1) AS last_sender
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
    const [rows] = await db.query(
      `UPDATE Report SET status = ? WHERE report_id = ? AND status IS DISTINCT FROM ?
       RETURNING report_id, reporter_id`,
      [status, req.params.id, status]
    );
    if (rows.length > 0) {
      const { report_id, reporter_id } = rows[0];
      const text = status === 'Pending' ? 'was reopened' : `was marked ${status}`;
      await notifyStudent(reporter_id, 'report_update', `Your report #${report_id} ${text} by the admins.`, `/reports/${report_id}`);
    } else {
      const [exists] = await db.query('SELECT report_id FROM Report WHERE report_id = ?', [req.params.id]);
      if (exists.length === 0) return res.status(404).json({ message: 'Report not found.' });
    }
    res.json({ message: `Report marked ${status}.` });
  } catch (err) {
    res.status(500).json({ message: 'Error updating report.', error: err.message });
  }
});

// ── Report conversation ──────────────────────────────────────
const REPORT_MESSAGES_SQL =
  `SELECT m.report_message_id, m.sender_role, m.message_text, m.created_at,
          CASE WHEN m.sender_role = 'admin' THEN COALESCE(a.name, 'Admin') ELSE s.name END AS sender_name
   FROM report_message m
   LEFT JOIN Student s ON m.student_id = s.student_id
   LEFT JOIN Admin   a ON m.admin_id   = a.admin_id
   WHERE m.report_id = ?
   ORDER BY m.created_at, m.report_message_id`;

// GET /api/admin/reports/:id/messages
router.get('/reports/:id/messages', adminAuth, async (req, res) => {
  if (!v.isIntInRange(req.params.id, 1, 2147483647)) return res.status(400).json({ message: 'Invalid report id.' });
  try {
    const [reports] = await db.query('SELECT report_id FROM Report WHERE report_id = ?', [req.params.id]);
    if (reports.length === 0) return res.status(404).json({ message: 'Report not found.' });
    const [messages] = await db.query(REPORT_MESSAGES_SQL, [req.params.id]);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching messages.', error: err.message });
  }
});

// POST /api/admin/reports/:id/messages  { message_text } — the reporter is notified (in-app, email, push)
router.post('/reports/:id/messages', adminAuth, async (req, res) => {
  const { message_text } = req.body;
  if (!v.isIntInRange(req.params.id, 1, 2147483647)) return res.status(400).json({ message: 'Invalid report id.' });
  if (!v.isNonEmptyString(message_text, 1000)) return res.status(400).json({ message: 'Message must be 1–1000 characters.' });
  try {
    const [reports] = await db.query('SELECT report_id, reporter_id FROM Report WHERE report_id = ?', [req.params.id]);
    if (reports.length === 0) return res.status(404).json({ message: 'Report not found.' });
    const { report_id, reporter_id } = reports[0];
    const [rows] = await db.query(
      `INSERT INTO report_message (report_id, sender_role, admin_id, message_text)
       VALUES (?, 'admin', ?, ?) RETURNING report_message_id, sender_role, message_text, created_at`,
      [report_id, req.admin.admin_id, message_text.trim()]
    );
    await notifyStudent(reporter_id, 'report_update',
      `Admin replied to your report #${report_id}: "${message_text.trim()}"`, `/reports/${report_id}`);
    res.status(201).json({ message: 'Reply sent.', data: { ...rows[0], sender_name: req.admin.name || 'Admin' } });
  } catch (err) {
    res.status(500).json({ message: 'Error sending reply.', error: err.message });
  }
});

// ── Hostels ──────────────────────────────────────────────────
// GET /api/admin/hostels — every hostel with its floors and student count
router.get('/hostels', adminAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT h.hostel_id, h.hostel_name, h.hostel_code,
              (SELECT COUNT(*) FROM Student s WHERE s.hostel_id = h.hostel_id) AS student_count,
              COALESCE((SELECT json_agg(f.floor_number ORDER BY f.floor_number) FROM Floor f WHERE f.hostel_id = h.hostel_id), '[]') AS floors
       FROM Hostel h ORDER BY h.hostel_name`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching hostels.', error: err.message });
  }
});

// POST /api/admin/hostels  { hostel_name, hostel_code, floor_count } — floors are numbered 1..floor_count
router.post('/hostels', adminAuth, async (req, res) => {
  let { hostel_name, hostel_code, floor_count } = req.body;
  if (!v.isNonEmptyString(hostel_name, 100)) return res.status(400).json({ message: 'Hostel name must be 1–100 characters.' });
  if (typeof hostel_code !== 'string' || !/^[A-Za-z0-9-]{1,20}$/.test(hostel_code.trim())) {
    return res.status(400).json({ message: 'Hostel code must be 1–20 letters, numbers or dashes (e.g. KH02).' });
  }
  if (!v.isIntInRange(floor_count, 1, 30)) return res.status(400).json({ message: 'Number of floors must be between 1 and 30.' });
  hostel_name = hostel_name.trim();
  hostel_code = hostel_code.trim().toUpperCase();

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [dupes] = await conn.query(
      'SELECT hostel_id FROM Hostel WHERE upper(hostel_code) = ? OR lower(hostel_name) = lower(?)', [hostel_code, hostel_name]
    );
    if (dupes.length > 0) {
      await conn.rollback();
      return res.status(409).json({ message: 'A hostel with that name or code already exists.' });
    }
    const [created] = await conn.query('INSERT INTO Hostel (hostel_name, hostel_code) VALUES (?, ?)', [hostel_name, hostel_code]);
    const floors = Array.from({ length: Number(floor_count) }, (_, i) => i + 1);
    await conn.query(
      `INSERT INTO Floor (floor_number, hostel_id) VALUES ${floors.map(() => '(?, ?)').join(', ')}`,
      floors.flatMap((n) => [n, created.insertId])
    );
    await conn.commit();
    res.status(201).json({ message: `${hostel_name} added with ${floors.length} floors.`, hostel_id: created.insertId });
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'A hostel with that code already exists.' });
    res.status(500).json({ message: 'Error adding hostel.', error: err.message });
  } finally {
    conn.release();
  }
});

// POST /api/admin/hostels/:id/floors  { floor_count } — adds floors on top of the existing ones
router.post('/hostels/:id/floors', adminAuth, async (req, res) => {
  const { floor_count } = req.body;
  if (!v.isIntInRange(req.params.id, 1, 2147483647)) return res.status(400).json({ message: 'Invalid hostel.' });
  if (!v.isIntInRange(floor_count, 1, 30)) return res.status(400).json({ message: 'Add between 1 and 30 floors.' });
  try {
    const [rows] = await db.query(
      'SELECT h.hostel_id, COALESCE(MAX(f.floor_number), 0) AS top FROM Hostel h LEFT JOIN Floor f ON f.hostel_id = h.hostel_id WHERE h.hostel_id = ? GROUP BY h.hostel_id',
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Hostel not found.' });
    const top = Number(rows[0].top);
    if (top + Number(floor_count) > 50) return res.status(400).json({ message: 'A hostel can have at most 50 floors.' });
    const floors = Array.from({ length: Number(floor_count) }, (_, i) => top + i + 1);
    await db.query(
      `INSERT INTO Floor (floor_number, hostel_id) VALUES ${floors.map(() => '(?, ?)').join(', ')}`,
      floors.flatMap((n) => [n, rows[0].hostel_id])
    );
    res.status(201).json({ message: `Added floors ${floors[0]}–${floors[floors.length - 1]}.` });
  } catch (err) {
    res.status(500).json({ message: 'Error adding floors.', error: err.message });
  }
});

module.exports = router;
