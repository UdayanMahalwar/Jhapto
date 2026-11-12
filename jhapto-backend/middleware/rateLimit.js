// middleware/rateLimit.js
// Throttles login / registration to slow down password guessing and spam sign-ups.

const { rateLimit } = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,                       // 10 attempts per IP per 15 minutes
  skipSuccessfulRequests: true,    // only failed logins count
  skip: () => process.env.RATE_LIMIT_DISABLED === 'true',   // set by the test suite
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again in 15 minutes.' },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,                       // 10 sign-ups per IP per hour
  skip: () => process.env.RATE_LIMIT_DISABLED === 'true',
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many accounts created from this network. Try again later.' },
});

module.exports = { loginLimiter, registerLimiter };
