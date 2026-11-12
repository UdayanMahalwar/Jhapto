// routes/auth.js
// Handles student registration and login

const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../config/db');
const { loginLimiter, registerLimiter } = require('../middleware/rateLimit');
const v       = require('../utils/validate');
require('dotenv').config();

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
      `SELECT student_id, name, email, password_hash, floor_id, hostel_id, is_banned
       FROM Student WHERE email = ?`,
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
        hostel_id  : student.hostel_id,
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error.', error: err.message });
  }
});

module.exports = router;
