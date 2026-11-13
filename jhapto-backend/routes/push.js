// routes/push.js
// Devices register their Firebase Cloud Messaging token here so the server can
// send them push notifications.

const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const auth    = require('../middleware/auth');

const isToken = (t) => typeof t === 'string' && t.length >= 20 && t.length <= 512 && /^[\w:.\-]+$/.test(t);

// POST /api/push/register  { token, platform: 'android' | 'web' }
router.post('/register', auth, async (req, res) => {
  const { token, platform } = req.body;
  if (!isToken(token) || !['android', 'web'].includes(platform)) {
    return res.status(400).json({ message: 'Invalid push token.' });
  }
  try {
    // A device that logs into another account moves to that account
    await db.query(
      `INSERT INTO push_token (token, student_id, platform, updated_at) VALUES (?, ?, ?, now())
       ON CONFLICT (token) DO UPDATE SET student_id = EXCLUDED.student_id, platform = EXCLUDED.platform, updated_at = now()`,
      [token, req.user.student_id, platform]
    );
    res.json({ message: 'Push notifications on.' });
  } catch (err) {
    res.status(500).json({ message: 'Error saving push token.', error: err.message });
  }
});

// DELETE /api/push/register  { token } — on logout
router.delete('/register', auth, async (req, res) => {
  if (!isToken(req.body.token)) return res.status(400).json({ message: 'Invalid push token.' });
  try {
    await db.query('DELETE FROM push_token WHERE token = ? AND student_id = ?', [req.body.token, req.user.student_id]);
    res.json({ message: 'Push notifications off for this device.' });
  } catch (err) {
    res.status(500).json({ message: 'Error removing push token.', error: err.message });
  }
});

module.exports = router;
