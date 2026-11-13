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
const { verifyGoogleCredential, isAllowedEmail, allowedDomains } = require('../utils/google');

// bcrypt hash of a random string: compared against when the email doesn't exist
const DUMMY_HASH = '$2a$10$CwTycUXWue0Thq9StjUM0uJ8.8nQ3s8E5k0hYH7nEv0Gx0VdQ1v8W';

const domainMessage = () => `Use your Thapar email (@${allowedDomains().join(', @')}).`;

// Login token + the student details the frontend keeps in AuthContext
function sessionFor(student) {
  const token = jwt.sign(
    { student_id: student.student_id, name: student.name, floor_id: student.floor_id },
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
      floor_number: student.floor_number,
      hostel_id   : student.hostel_id,
      hostel_name : student.hostel_name,
    },
  };
}

const STUDENT_SESSION_SQL =
  `SELECT s.student_id, s.name, s.email, s.password_hash, s.google_sub, s.floor_id, s.hostel_id, s.is_banned,
          f.floor_number, h.hostel_name
   FROM Student s
   JOIN Floor  f ON s.floor_id  = f.floor_id
   JOIN Hostel h ON s.hostel_id = h.hostel_id`;

// Shared checks for a new student's phone / hostel / floor (password and Google sign-up)
async function checkNewStudent({ email, phone_no, hostel_id, floor_id }) {
  const [floorRows] = await db.query(
    'SELECT floor_id FROM Floor WHERE floor_id = ? AND hostel_id = ?', [floor_id, hostel_id]
  );
  if (floorRows.length === 0) return [400, 'That floor does not belong to the selected hostel.'];
  const [existingEmail] = await db.query('SELECT student_id FROM Student WHERE lower(email) = lower(?)', [email]);
  if (existingEmail.length > 0) return [409, 'Email already registered.'];
  const [existingPhone] = await db.query('SELECT student_id FROM Student WHERE phone_no = ?', [phone_no]);
  if (existingPhone.length > 0) return [409, 'Phone number already registered.'];
  return null;
}

// ── GET /api/auth/hostels ────────────────────────────────────
// Public: hostels and their floors for the sign-up form
router.get('/hostels', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT h.hostel_id, h.hostel_name, f.floor_id, f.floor_number
       FROM Hostel h JOIN Floor f ON f.hostel_id = h.hostel_id
       ORDER BY h.hostel_name, f.floor_number`
    );
    const hostels = [];
    for (const r of rows) {
      let h = hostels.find((x) => x.hostel_id === r.hostel_id);
      if (!h) hostels.push(h = { hostel_id: r.hostel_id, hostel_name: r.hostel_name, floors: [] });
      h.floors.push({ floor_id: r.floor_id, floor_number: r.floor_number });
    }
    res.json(hostels);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching hostels.', error: err.message });
  }
});

// ── POST /api/auth/register ──────────────────────────────────
// Registers a new student
router.post('/register', registerLimiter, async (req, res) => {
  let { name, email, phone_no, password, hostel_id, floor_id } = req.body;

  if (!name || !email || !phone_no || !password || !hostel_id || !floor_id) {
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
    return res.status(400).json({ message: `Password must be at least ${v.MIN_PASSWORD} characters.` });
  }
  if (!v.isIntInRange(hostel_id, 1, 1e6) || !v.isIntInRange(floor_id, 1, 1e6)) {
    return res.status(400).json({ message: 'Invalid hostel or floor.' });
  }
  name = name.trim();
  email = email.trim().toLowerCase();
  phone_no = phone_no.trim();

  try {
    const problem = await checkNewStudent({ email, phone_no, hostel_id, floor_id });
    if (problem) return res.status(problem[0]).json({ message: problem[1] });

    // Hash password before storing
    const password_hash = await bcrypt.hash(password, 10);

    await db.query(
      `INSERT INTO Student (name, email, phone_no, password_hash, hostel_id, floor_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, email, phone_no, password_hash, hostel_id, floor_id]
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
// and the frontend asks for phone / hostel / floor, then calls /google/complete.
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
// Body: { signup_token, name?, phone_no, hostel_id, floor_id } — creates the account and logs in
router.post('/google/complete', registerLimiter, async (req, res) => {
  const { signup_token, phone_no, hostel_id, floor_id } = req.body;
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
  if (!v.isIntInRange(hostel_id, 1, 1e6) || !v.isIntInRange(floor_id, 1, 1e6)) {
    return res.status(400).json({ message: 'Invalid hostel or floor.' });
  }
  try {
    const problem = await checkNewStudent({ email: google.email, phone_no: phone_no.trim(), hostel_id, floor_id });
    if (problem) return res.status(problem[0]).json({ message: problem[1] });
    const [result] = await db.query(
      `INSERT INTO Student (name, email, phone_no, password_hash, google_sub, hostel_id, floor_id)
       VALUES (?, ?, ?, NULL, ?, ?, ?)`,
      [name.trim(), google.email, phone_no.trim(), google.sub, hostel_id, floor_id]
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
  `SELECT s.student_id, s.name, s.email, s.phone_no, s.hostel_id, h.hostel_name,
          s.floor_id, f.floor_number, s.avg_rating, s.rating_count, s.created_at,
          s.email_notifications, (s.password_hash IS NOT NULL) AS has_password, (s.google_sub IS NOT NULL) AS google_linked
   FROM Student s
   JOIN Hostel h ON s.hostel_id = h.hostel_id
   JOIN Floor  f ON s.floor_id  = f.floor_id
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

// GET /api/auth/floors — floors of the student's hostel (for the profile floor picker)
router.get('/floors', auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT floor_id, floor_number FROM Floor WHERE hostel_id = ? ORDER BY floor_number',
      [req.user.hostel_id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching floors.', error: err.message });
  }
});

// PATCH /api/auth/me — update name, phone number and/or floor
router.patch('/me', auth, async (req, res) => {
  const student_id = req.user.student_id;
  const { name, phone_no, floor_id, email_notifications } = req.body;

  if (email_notifications !== undefined && typeof email_notifications !== 'boolean') {
    return res.status(400).json({ message: 'email_notifications must be true or false.' });
  }
  if (name === undefined && phone_no === undefined && floor_id === undefined && email_notifications === undefined) {
    return res.status(400).json({ message: 'Nothing to update.' });
  }
  if (name !== undefined && !v.isNonEmptyString(name, 100)) {
    return res.status(400).json({ message: 'Name must be 1–100 characters.' });
  }
  if (phone_no !== undefined && !v.isPhone(phone_no)) {
    return res.status(400).json({ message: 'Enter a valid 10-digit mobile number.' });
  }
  if (floor_id !== undefined && !v.isIntInRange(floor_id, 1, 1e6)) {
    return res.status(400).json({ message: 'Invalid floor.' });
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
    if (floor_id !== undefined) {
      // Floor must be in the student's own hostel
      const [floorRows] = await db.query(
        'SELECT floor_id FROM Floor WHERE floor_id = ? AND hostel_id = ?', [floor_id, req.user.hostel_id]
      );
      if (floorRows.length === 0) {
        return res.status(400).json({ message: 'That floor does not belong to your hostel.' });
      }
    }

    await db.query(
      `UPDATE Student
       SET name     = COALESCE(?, name),
           phone_no = COALESCE(?, phone_no),
           floor_id = COALESCE(?, floor_id),
           email_notifications = COALESCE(?::boolean, email_notifications)
       WHERE student_id = ?`,
      [name !== undefined ? name.trim() : null,
       phone_no !== undefined ? phone_no.trim() : null,
       floor_id !== undefined ? Number(floor_id) : null,
       email_notifications !== undefined ? email_notifications : null,
       student_id]
    );

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
    return res.status(400).json({ message: `New password must be at least ${v.MIN_PASSWORD} characters.` });
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
    // password_changed_at signs out every other device (their tokens are older)
    await db.query(
      `UPDATE Student SET password_hash = ?, password_changed_at = now() - interval '1 second' WHERE student_id = ?`,
      [password_hash, req.user.student_id]
    );
    const [fresh] = await db.query(`${STUDENT_SESSION_SQL} WHERE s.student_id = ?`, [req.user.student_id]);
    // a fresh token for this device, so the person changing it stays logged in
    res.json({ message: 'Password changed. Other devices have been signed out.', ...sessionFor(fresh[0]) });
  } catch (err) {
    res.status(500).json({ message: 'Error changing password.', error: err.message });
  }
});

module.exports = router;
