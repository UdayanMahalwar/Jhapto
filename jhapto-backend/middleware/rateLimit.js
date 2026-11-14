// middleware/rateLimit.js
// Throttles password guessing, spam sign-ups and general spam.
//
// Counters live in the database (table rate_limit), not in memory: on Vercel
// every request can land on a different server instance, so in-memory counters
// would let an attacker simply keep hitting fresh instances.

const jwt = require('jsonwebtoken');
const { rateLimit } = require('express-rate-limit');

const disabled = () => process.env.RATE_LIMIT_DISABLED === 'true';   // the test suite turns limits off

// express-rate-limit store backed by PostgreSQL
class PgStore {
  constructor(prefix) {
    this.prefix = prefix;
    this.localKeys = false;
  }

  init(options) {
    this.windowMs = options.windowMs;
  }

  db() {
    return require('../config/db');   // loaded lazily so requiring this file never opens a pool
  }

  async increment(key) {
    const k = `${this.prefix}:${key}`.slice(0, 200);
    // One atomic statement: start a new window if the old one ended, else count up
    const [rows] = await this.db().query(
      `INSERT INTO rate_limit (key, hits, reset_at) VALUES (?, 1, now() + (? * interval '1 millisecond'))
       ON CONFLICT (key) DO UPDATE SET
         hits     = CASE WHEN rate_limit.reset_at <= now() THEN 1 ELSE rate_limit.hits + 1 END,
         reset_at = CASE WHEN rate_limit.reset_at <= now() THEN EXCLUDED.reset_at ELSE rate_limit.reset_at END
       RETURNING hits, reset_at`,
      [k, this.windowMs]
    );
    // Now and then, clear out long-expired counters
    if (Math.random() < 0.01) {
      this.db().query("DELETE FROM rate_limit WHERE reset_at < now() - interval '1 day'").catch(() => {});
    }
    return { totalHits: Number(rows[0].hits), resetTime: new Date(rows[0].reset_at) };
  }

  async decrement(key) {
    await this.db().query(
      'UPDATE rate_limit SET hits = GREATEST(hits - 1, 0) WHERE key = ?',
      [`${this.prefix}:${key}`.slice(0, 200)]
    );
  }

  async resetKey(key) {
    await this.db().query('DELETE FROM rate_limit WHERE key = ?', [`${this.prefix}:${key}`.slice(0, 200)]);
  }
}

const makeStore = (prefix) => (process.env.USE_MOCK_DB === 'true' ? undefined : new PgStore(prefix));

const limiter = (prefix, options) => rateLimit({
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: disabled,
  store: makeStore(prefix),
  // If the counter store itself fails, let the request through rather than lock everyone out
  passOnStoreError: true,
  ...options,
});

const emailKey = (req) => `email:${String(req.body?.email || '').trim().toLowerCase().slice(0, 150)}`;

// Logged-in student id from the token (no DB lookup), else the IP
const userOrIpKey = (req) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
      if (decoded.student_id) return `student:${decoded.student_id}`;
      if (decoded.admin_id) return `admin:${decoded.admin_id}`;
    } catch {
      // fall through to the IP
    }
  }
  return `ip:${req.ip}`;
};

// Failed logins per IP
const loginLimiter = limiter('login-ip', {
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  message: { message: 'Too many login attempts. Please try again in 15 minutes.' },
});

// Failed logins per account, so rotating IP addresses doesn't help an attacker
const loginAccountLimiter = limiter('login-account', {
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  keyGenerator: emailKey,
  message: { message: 'Too many failed attempts for this account. Please try again in 15 minutes.' },
});

const registerLimiter = limiter('register', {
  windowMs: 60 * 60 * 1000,
  limit: 10,
  message: { message: 'Too many accounts created from this network. Try again later.' },
});

const uploadLimiter = limiter('upload', {
  windowMs: 60 * 60 * 1000,
  limit: 60,
  keyGenerator: userOrIpKey,
  message: { message: 'Too many uploads. Try again later.' },
});

// Any change (orders, messages, listings, reports …) per student — stops floods of
// spam messages, fake orders and the notifications / emails they would trigger
const writeLimiter = limiter('write', {
  windowMs: 15 * 60 * 1000,
  limit: 150,
  keyGenerator: userOrIpKey,
  skip: (req) => disabled() || ['GET', 'HEAD', 'OPTIONS'].includes(req.method),
  message: { message: 'You’re doing that too often. Please wait a few minutes.' },
});

module.exports = { loginLimiter, loginAccountLimiter, registerLimiter, uploadLimiter, writeLimiter, PgStore };
