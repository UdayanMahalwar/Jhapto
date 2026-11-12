// routes/auth.js
// Handles student registration and login

const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../config/db');
const { loginLimiter, registerLimiter } = require('../middleware/rateLimit');
const v       = require('../utils/validate');
const auth    = require('../middleware/auth');

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
    const [floorRows] = await db.query(
      'SELECT floor_id FROM Floor WHERE floor_id = ? AND hostel_id = ?', [floor_id, hostel_id]
    );
    if (floorRows.length === 0) {
      return res.status(400).json({ message: 'That floor does not belong to the selected hostel.' });
    }

    // Check if email already exists
    const [existingEmail] = await db.query(
      'SELECT student_id FROM Student WHERE email = ?', [email]
    );
    if (existingEmail.length > 0) {
      return res.status(409).json({ message: 'Email already registered.' });
    }

    // Check if phone number already exists
    const [existingPhone] = await db.query(
      'SELECT student_id FROM Student WHERE phone_no = ?', [phone_no]
    );
    if (existingPhone.length > 0) {
      return res.status(409).json({ message: 'Phone number already registered.' });
    }

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
router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    const [rows] = await db.query(
      `SELECT s.student_id, s.name, s.email, s.password_hash, s.floor_id, s.hostel_id, s.is_banned,
              f.floor_number
       FROM Student s JOIN Floor f ON s.floor_id = f.floor_id
       WHERE s.email = ?`,
      [email.trim()]
    );

    // Same message for unknown email and wrong password, so attackers
    // can't use this endpoint to discover which emails are registered.
    const student = rows[0];
    const isMatch = student ? await bcrypt.compare(password, student.password_hash) : false;
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    if (student.is_banned) {
      return res.status(403).json({ message: 'Your account has been banned. Contact admin.', code: 'ACCOUNT_BANNED' });
    }

    // Create a login token valid for 7 days
    const token = jwt.sign(
      { student_id: student.student_id, name: student.name, floor_id: student.floor_id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message : 'Login successful!',
      token,
      student : {
        student_id : student.student_id,
        name       : student.name,
        email      : student.email,
        floor_id   : student.floor_id,
        floor_number: student.floor_number,
        hostel_id  : student.hostel_id,
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

// ── Profile ──────────────────────────────────────────────────
const PROFILE_SQL =
  `SELECT s.student_id, s.name, s.email, s.phone_no, s.hostel_id, h.hostel_name,
          s.floor_id, f.floor_number, s.avg_rating, s.rating_count, s.created_at
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
  const { name, phone_no, floor_id } = req.body;

  if (name === undefined && phone_no === undefined && floor_id === undefined) {
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
           floor_id = COALESCE(?, floor_id)
       WHERE student_id = ?`,
      [name !== undefined ? name.trim() : null,
       phone_no !== undefined ? phone_no.trim() : null,
       floor_id !== undefined ? Number(floor_id) : null,
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
    const isMatch = rows[0] ? await bcrypt.compare(current_password, rows[0].password_hash) : false;
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect.' });
    }
    const password_hash = await bcrypt.hash(new_password, 10);
    await db.query(
      'UPDATE Student SET password_hash = ? WHERE student_id = ?', [password_hash, req.user.student_id]
    );
    res.json({ message: 'Password changed.' });
  } catch (err) {
    res.status(500).json({ message: 'Error changing password.', error: err.message });
  }
});

module.exports = router;
