// routes/auth.js
// Handles student registration and login

const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../config/db');
const { loginLimiter, loginAccountLimiter, registerLimiter } = require('../middleware/rateLimit');
const v       = require('../utils/validate');
const auth    = require('../middleware/auth');
const realtime = require('../realtime');
const { verifyGoogleCredential, isAllowedEmail, allowedDomains } = require('../utils/google');

// bcrypt hash of a random string: compared against when the email doesn't exist
const DUMMY_HASH = '$2a$10$CwTycUXWue0Thq9StjUM0uJ8.8nQ3s8E5k0hYH7nEv0Gx0VdQ1v8W';

const domainMessage = () => `Use your Thapar email (@${allowedDomains().join(', @')}).`;

// Login token + the student details the frontend keeps in AuthContext
function sessionFor(student) {
  const token = jwt.sign(
    { student_id: student.student_id, name: student.name, floor_id: student.floor_id, session_version: student.session_version },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
  return {
    token,
    student: {
      student_id  : student.student_id,
      name        : student.name,
      email       : student.email,
      floor_id    : student.floor_id,
      hostel_id   : student.hostel_id,
      hostel_name : student.hostel_name,
      hostel_code : student.hostel_code,
      room_number : student.room_number,
    },
  };
}

const STUDENT_SESSION_SQL =
  `SELECT s.student_id, s.name, s.email, s.password_hash, s.google_sub, s.floor_id, s.hostel_id, s.is_banned, s.session_version,
          s.room_number, h.hostel_name, h.hostel_code
   FROM Student s
   JOIN Hostel h ON s.hostel_id = h.hostel_id`;

// Floors aren't shown in the app any more: every hostel has one internal floor,
// which keeps the database's "same floor first" ranking working as "same hostel first".
async function hostelFloor(hostel_id) {
  const [rows] = await db.query(
    'SELECT floor_id FROM Floor WHERE hostel_id = ? ORDER BY floor_number LIMIT 1', [hostel_id]
  );
  return rows[0] ? rows[0].floor_id : null;
}

// Shared checks for a new student's phone / hostel (password and Google sign-up).
// Returns [status, message] on a problem, else { floor_id } for the chosen hostel.
async function checkNewStudent({ email, phone_no, hostel_id }) {
  const floor_id = await hostelFloor(hostel_id);
  if (!floor_id) return [400, 'Choose your hostel from the list.'];
  const [existingEmail] = await db.query('SELECT student_id FROM Student WHERE lower(email) = lower(?)', [email]);
  if (existingEmail.length > 0) return [409, 'Email already registered.'];
  const [existingPhone] = await db.query('SELECT student_id FROM Student WHERE phone_no = ?', [phone_no]);
  if (existingPhone.length > 0) return [409, 'Phone number already registered.'];
  return { floor_id };
}

// ── GET /api/auth/hostels ────────────────────────────────────
// Public: hostels for the sign-up form
router.get('/hostels', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT hostel_id, hostel_name, hostel_code FROM Hostel
       WHERE EXISTS (SELECT 1 FROM Floor f WHERE f.hostel_id = Hostel.hostel_id)
       ORDER BY hostel_name`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching hostels.', error: err.message });
  }
});

// ── POST /api/auth/register ──────────────────────────────────
// Registers a new student
router.post('/register', registerLimiter, async (req, res) => {
  let { name, email, phone_no, password, hostel_id, room_number } = req.body;

  if (!name || !email || !phone_no || !password || !hostel_id || !room_number) {
    return res.status(400).json({ message: 'All fields are required.' });
  }
  if (!v.isNonEmptyString(name, 100)) {
    return res.status(400).json({ message: 'Name must be 1–100 characters.' });
  }
  if (!v.isEmail(email)) {
    return res.status(400).json({ message: 'Enter a valid email address.' });
  }
  if (!isAllowedEmail(email)) {
    return res.status(400).json({ message: domainMessage() });
  }
  if (!v.isPhone(phone_no)) {
    return res.status(400).json({ message: 'Enter a valid 10-digit mobile number.' });
  }
  if (!v.isPassword(password)) {
    return res.status(400).json({ message: `Password must be at least ${v.MIN_PASSWORD} characters and at most 72 UTF-8 bytes.` });
  }
  if (!v.isIntInRange(hostel_id, 1, 1e6)) {
    return res.status(400).json({ message: 'Choose your hostel from the list.' });
  }
  if (!v.isRoom(room_number)) {
    return res.status(400).json({ message: v.ROOM_MESSAGE });
  }
  name = name.trim();
  email = email.trim().toLowerCase();
  phone_no = phone_no.trim();

  try {
    const checked = await checkNewStudent({ email, phone_no, hostel_id });
    if (Array.isArray(checked)) return res.status(checked[0]).json({ message: checked[1] });

    // Hash password before storing
    const password_hash = await bcrypt.hash(password, 10);

    await db.query(
      `INSERT INTO Student (name, email, phone_no, password_hash, hostel_id, floor_id, room_number)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, email, phone_no, password_hash, hostel_id, checked.floor_id, room_number.trim().toUpperCase()]
    );

    res.status(201).json({ message: 'Registration successful! Please log in.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// ── POST /api/auth/login ─────────────────────────────────────
// Logs in a student and returns a JWT token
router.post('/login', loginLimiter, loginAccountLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    const [rows] = await db.query(`${STUDENT_SESSION_SQL} WHERE lower(s.email) = lower(?)`, [email.trim()]);

    // Same message for unknown email and wrong password, so attackers
    // can't use this endpoint to discover which emails are registered.
    const student = rows[0];
    if (student && !student.password_hash && student.google_sub) {
      return res.status(401).json({ message: 'This account uses Google sign-in. Tap "Continue with Google".' });
    }
    // Always run bcrypt, even for unknown emails, so response time doesn't reveal which emails exist
    const isMatch = await bcrypt.compare(password, student?.password_hash || DUMMY_HASH);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    if (student.is_banned) {
      return res.status(403).json({ message: 'Your account has been banned. Contact admin.', code: 'ACCOUNT_BANNED' });
    }

    res.json({ message: 'Login successful!', ...sessionFor(student) });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// ── POST /api/auth/google ────────────────────────────────────
// Body: { credential } — the ID token from Google (website button or Android app).
// Existing student → logged in. New Thapar student → { needs_profile, signup_token }
// and the frontend asks for phone / hostel / room, then calls /google/complete.
router.post('/google', loginLimiter, async (req, res) => {
  let google;
  try {
    google = await verifyGoogleCredential(req.body.credential);
  } catch (err) {
    return res.status(err.status || 401).json({ message: err.message });
  }
  try {
    const [rows] = await db.query(
      `${STUDENT_SESSION_SQL} WHERE s.google_sub = ? OR lower(s.email) = lower(?) ORDER BY (s.google_sub = ?) DESC LIMIT 1`,
      [google.sub, google.email, google.sub]
    );
    const student = rows[0];
    if (student) {
      if (student.is_banned) {
        return res.status(403).json({ message: 'Your account has been banned. Contact admin.', code: 'ACCOUNT_BANNED' });
      }
      // An account registered with a password links to Google the first time (same verified email)
      if (!student.google_sub) {
        await db.query('UPDATE Student SET google_sub = ? WHERE student_id = ?', [google.sub, student.student_id]);
      }
      return res.json({ message: 'Login successful!', ...sessionFor(student) });
    }
    // Short-lived token so the profile step can't be used with someone else's Google identity
    const signup_token = jwt.sign({ google_signup: google }, process.env.JWT_SECRET, { expiresIn: '30m' });
    res.json({ needs_profile: true, signup_token, name: google.name, email: google.email });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// ── POST /api/auth/google/complete ───────────────────────────
// Body: { signup_token, name?, phone_no, hostel_id, room_number } — creates the account and logs in
router.post('/google/complete', registerLimiter, async (req, res) => {
  const { signup_token, phone_no, hostel_id, room_number } = req.body;
  let google;
  try {
    google = jwt.verify(signup_token, process.env.JWT_SECRET, { algorithms: ['HS256'] }).google_signup;
  } catch {
    google = null;
  }
  if (!google) return res.status(401).json({ message: 'Sign-up expired. Continue with Google again.' });

  const name = req.body.name !== undefined ? req.body.name : google.name;
  if (!v.isNonEmptyString(name, 100)) return res.status(400).json({ message: 'Name must be 1–100 characters.' });
  if (!v.isPhone(phone_no)) return res.status(400).json({ message: 'Enter a valid 10-digit mobile number.' });
  if (!v.isIntInRange(hostel_id, 1, 1e6)) {
    return res.status(400).json({ message: 'Choose your hostel from the list.' });
  }
  if (!v.isRoom(room_number)) {
    return res.status(400).json({ message: v.ROOM_MESSAGE });
  }
  try {
    const checked = await checkNewStudent({ email: google.email, phone_no: phone_no.trim(), hostel_id });
    if (Array.isArray(checked)) return res.status(checked[0]).json({ message: checked[1] });
    const [result] = await db.query(
      `INSERT INTO Student (name, email, phone_no, password_hash, google_sub, hostel_id, floor_id, room_number)
       VALUES (?, ?, ?, NULL, ?, ?, ?, ?)`,
      [name.trim(), google.email, phone_no.trim(), google.sub, hostel_id, checked.floor_id, room_number.trim().toUpperCase()]
    );
    const [rows] = await db.query(`${STUDENT_SESSION_SQL} WHERE s.student_id = ?`, [result.insertId]);
    res.status(201).json({ message: 'Welcome to Jhapto!', ...sessionFor(rows[0]) });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'This Google account is already registered.' });
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// ── Profile ──────────────────────────────────────────────────
const PROFILE_SQL =
  `SELECT s.student_id, s.name, s.email, s.phone_no, s.hostel_id, h.hostel_name, h.hostel_code,
          s.floor_id, s.room_number, s.avg_rating, s.rating_count, s.created_at,
          s.email_notifications, (s.password_hash IS NOT NULL) AS has_password, (s.google_sub IS NOT NULL) AS google_linked
   FROM Student s
   JOIN Hostel h ON s.hostel_id = h.hostel_id
   WHERE s.student_id = ?`;

// GET /api/auth/me — current student's profile
router.get('/me', auth, async (req, res) => {
  try {
    const [rows] = await db.query(PROFILE_SQL, [req.user.student_id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Profile not found.' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching profile.', error: err.message });
  }
});

// PATCH /api/auth/me — update name, phone number, hostel and/or room
// (a new hostel / room is also copied to the student's current listings,
//  since buyers collect from that room)
router.patch('/me', auth, async (req, res) => {
  const student_id = req.user.student_id;
  const { name, phone_no, hostel_id, room_number, email_notifications } = req.body;

  if (email_notifications !== undefined && typeof email_notifications !== 'boolean') {
    return res.status(400).json({ message: 'email_notifications must be true or false.' });
  }
  if ([name, phone_no, hostel_id, room_number, email_notifications].every((x) => x === undefined)) {
    return res.status(400).json({ message: 'Nothing to update.' });
  }
  if (name !== undefined && !v.isNonEmptyString(name, 100)) {
    return res.status(400).json({ message: 'Name must be 1–100 characters.' });
  }
  if (phone_no !== undefined && !v.isPhone(phone_no)) {
    return res.status(400).json({ message: 'Enter a valid 10-digit mobile number.' });
  }
  if (hostel_id !== undefined && !v.isIntInRange(hostel_id, 1, 1e6)) {
    return res.status(400).json({ message: 'Choose your hostel from the list.' });
  }
  if (room_number !== undefined && !v.isRoom(room_number)) {
    return res.status(400).json({ message: v.ROOM_MESSAGE });
  }

  try {
    if (phone_no !== undefined) {
      const [dupe] = await db.query(
        'SELECT student_id FROM Student WHERE phone_no = ? AND student_id <> ?',
        [phone_no.trim(), student_id]
      );
      if (dupe.length > 0) {
        return res.status(409).json({ message: 'That phone number is already registered.' });
      }
    }
    let floor_id = null;
    if (hostel_id !== undefined) {
      floor_id = await hostelFloor(hostel_id);
      if (!floor_id) return res.status(400).json({ message: 'Choose your hostel from the list.' });
    }
    const room = room_number !== undefined ? room_number.trim().toUpperCase() : null;

    await db.query(
      `UPDATE Student
       SET name        = COALESCE(?, name),
           phone_no    = COALESCE(?, phone_no),
           hostel_id   = COALESCE(?::int, hostel_id),
           floor_id    = COALESCE(?::int, floor_id),
           room_number = COALESCE(?, room_number),
           email_notifications = COALESCE(?::boolean, email_notifications)
       WHERE student_id = ?`,
      [name !== undefined ? name.trim() : null,
       phone_no !== undefined ? phone_no.trim() : null,
       hostel_id !== undefined ? Number(hostel_id) : null,
       floor_id,
       room,
       email_notifications !== undefined ? email_notifications : null,
       student_id]
    );
    // Buyers pick up from the seller's room, so open listings follow a move
    if (room) {
      await db.query(
        `UPDATE Listing SET room_number = ? WHERE seller_id = ? AND listing_status <> 'Removed'`, [room, student_id]
      );
    }

    const [rows] = await db.query(PROFILE_SQL, [student_id]);
    res.json({ message: 'Profile updated.', profile: rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Error updating profile.', error: err.message });
  }
});

// PATCH /api/auth/me/password — change password (requires the current one)
router.patch('/me/password', auth, loginLimiter, async (req, res) => {
  const { current_password, new_password } = req.body;
  if (typeof current_password !== 'string' || !current_password) {
    return res.status(400).json({ message: 'Enter your current password.' });
  }
  if (!v.isPassword(new_password)) {
    return res.status(400).json({ message: `New password must be at least ${v.MIN_PASSWORD} characters and at most 72 UTF-8 bytes.` });
  }
  if (new_password === current_password) {
    return res.status(400).json({ message: 'New password must be different from the current one.' });
  }

  try {
    const [rows] = await db.query(
      'SELECT password_hash FROM Student WHERE student_id = ?', [req.user.student_id]
    );
    if (rows[0] && !rows[0].password_hash) {
      return res.status(400).json({ message: 'Your account signs in with Google, so it has no password to change.' });
    }
    const isMatch = rows[0] ? await bcrypt.compare(current_password, rows[0].password_hash) : false;
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect.' });
    }
    const password_hash = await bcrypt.hash(new_password, 10);
    // Increment an exact version: JWT timestamps have only second precision.
    const [changed] = await db.query(
      `UPDATE Student SET password_hash = ?, password_changed_at = now(), session_version = session_version + 1
       WHERE student_id = ? AND password_hash = ? RETURNING session_version`,
      [password_hash, req.user.student_id, rows[0].password_hash]
    );
    if (!changed.length) return res.status(401).json({ message: 'Password changed. Please log in again.', code: 'INVALID_TOKEN' });
    realtime.disconnectUser(req.user.student_id);
    const [fresh] = await db.query(`${STUDENT_SESSION_SQL} WHERE s.student_id = ?`, [req.user.student_id]);
    // a fresh token for this device, so the person changing it stays logged in
    res.json({ message: 'Password changed. Other devices have been signed out.', ...sessionFor({ ...fresh[0], session_version: changed[0].session_version }) });
  } catch (err) {
    res.status(500).json({ message: 'Error changing password.', error: err.message });
  }
});

module.exports = router;
