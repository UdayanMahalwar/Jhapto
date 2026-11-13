// middleware/auth.js
// Checks if the student is logged in (valid JWT) and not banned before allowing access.
// Ban status is read from the database on every request so a ban takes effect
// immediately, not only at the next login.

const jwt = require('jsonwebtoken');
const db  = require('../config/db');

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ message: 'Access denied. Please log in.', code: 'INVALID_TOKEN' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return res.status(401).json({ message: 'Session expired. Please log in again.', code: 'INVALID_TOKEN' });
  }

  if (!decoded.student_id) {
    return res.status(401).json({ message: 'Student login required.', code: 'INVALID_TOKEN' });
  }

  try {
    const [rows] = await db.query(
      'SELECT is_banned, name, floor_id, hostel_id, password_changed_at FROM Student WHERE student_id = ?', [decoded.student_id]
    );
    if (rows.length === 0) {
      return res.status(401).json({ message: 'Account no longer exists.', code: 'INVALID_TOKEN' });
    }
    // Tokens issued before the last password change are no longer valid
    const changedAt = rows[0].password_changed_at;
    if (changedAt && decoded.iat * 1000 < new Date(changedAt).getTime()) {
      return res.status(401).json({ message: 'Your password was changed. Please log in again.', code: 'INVALID_TOKEN' });
    }
    if (rows[0].is_banned) {
      return res.status(403).json({ message: 'Your account has been banned. Contact admin.', code: 'ACCOUNT_BANNED' });
    }

    // Use current profile values, not the ones frozen into the token at login
    // (the student may have changed floor or name since).
    req.user = {
      student_id: decoded.student_id,
      name      : rows[0].name,
      floor_id  : rows[0].floor_id,
      hostel_id : rows[0].hostel_id,
    };
  } catch (err) {
    return res.status(500).json({ message: 'Server error.', error: err.message });
  }

  next();
};

module.exports = authMiddleware;
