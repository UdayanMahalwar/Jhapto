// app.js
// Builds the Express API app. Used by the root server.js (which adds the
// frontend, Socket.IO and listen()) and by the test suite (supertest).

require('./config/env');

const express = require('express');
const cors    = require('cors');
const uploadStore = require('./utils/uploadStore');
const { deliverPending } = require('./utils/notify');
const { writeLimiter } = require('./middleware/rateLimit');

// Only Jhapto's own sites may call the API from a browser (the Android app loads
// the live site, so it's same-origin too). Requests without an Origin header
// (curl, server-to-server, same-origin GETs) aren't affected by CORS anyway.
function allowedOrigins() {
  const list = new Set(['http://localhost:3000', 'http://localhost:5173', 'http://localhost:4173']);
  for (const url of [process.env.SITE_URL, 'https://jhapto.vercel.app', ...(process.env.EXTRA_ORIGINS || '').split(',')]) {
    try { if (url) list.add(new URL(url.trim()).origin); } catch { /* ignore bad values */ }
  }
  return list;
}

// Security headers for API responses (pages get theirs from vercel.json / server.js)
function apiSecurityHeaders(req, res, next) {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
  });
  if (req.path.startsWith('/api')) res.set('Cache-Control', 'no-store');
  next();
}

// 5xx responses keep a friendly message but never send internal details
// (SQL errors, stack traces) to the browser; they're logged on the server instead.
function hideServerErrors(req, res, next) {
  const json = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode >= 500 && body && typeof body === 'object' && 'error' in body && process.env.SHOW_ERROR_DETAILS !== 'true') {
      console.error(`${req.method} ${req.originalUrl} → ${res.statusCode}:`, body.error);
      const { error, ...rest } = body;   // eslint-disable-line no-unused-vars
      return json(rest);
    }
    return json(body);
  };
  next();
}

// After a successful write request, send the email / push for any notifications it created.
// Vercel freezes a function once it has responded, so there the work is registered
// with waitUntil() while the request is still running.
function deliverAfterWrite(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  const finished = new Promise((resolve) => res.on('finish', resolve));
  const work = finished.then(() => (res.statusCode < 400 ? deliverPending() : 0));
  if (process.env.VERCEL) require('@vercel/functions').waitUntil(work);
  next();
}

// Public settings the frontend needs at runtime (all safe to expose)
function publicConfig() {
  let firebase = null;
  try {
    firebase = process.env.FIREBASE_WEB_CONFIG ? JSON.parse(process.env.FIREBASE_WEB_CONFIG) : null;
  } catch {
    firebase = null;
  }
  return {
    googleClientId: process.env.GOOGLE_CLIENT_ID || null,
    allowedEmailDomains: (process.env.ALLOWED_EMAIL_DOMAINS || 'thapar.edu').split(',').map((d) => d.trim()),
    firebase,
    vapidKey: process.env.FIREBASE_VAPID_KEY || null,
  };
}

const UPLOAD_NAME_RE = /^[0-9a-f]{32}\.(png|jpg|gif|webp)$/;
const UPLOAD_HEADERS = {
  'Cache-Control': 'public, max-age=2592000, immutable',   // names are random and never reused
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
};

function createApp() {
  const app = express();

  app.disable('x-powered-by');
  // Behind a hosting proxy (Render, etc.) use the real client IP for rate limiting
  if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
  const origins = allowedOrigins();
  app.use(cors({ origin: (origin, cb) => cb(null, !origin || origins.has(origin)) }));
  app.use(apiSecurityHeaders);
  app.use(hideServerErrors);
  app.use(express.json({ limit: '1mb' }));   // images go through /api/uploads, not JSON
  app.use(express.urlencoded({ limit: '1mb', extended: true }));

  app.use('/api', deliverAfterWrite);
  app.use('/api', writeLimiter);

  // ── API routes ─────────────────────────────────────────────
  app.use('/api/auth',          require('./routes/auth'));
  app.use('/api/listings',      require('./routes/listings'));
  app.use('/api/orders',        require('./routes/orders'));
  app.use('/api/messages',      require('./routes/messages'));
  app.use('/api/admin',         require('./routes/admin'));
  app.use('/api/reports',       require('./routes/reports'));
  app.use('/api/reviews',       require('./routes/reviews'));
  app.use('/api/notifications', require('./routes/notifications'));
  app.use('/api/uploads',       require('./routes/uploads'));
  app.use('/api/push',          require('./routes/push'));

  app.get('/api/config', (req, res) => {
    res.set('Cache-Control', 'no-cache').json(publicConfig());
  });

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Jhapto Server is running!' });
  });

  // Unknown API routes return JSON, not the SPA's index.html
  app.use('/api', (req, res) => {
    res.status(404).json({ message: 'Not found.' });
  });

  // ── Uploaded images ────────────────────────────────────────
  if (uploadStore.usesDatabase()) {
    app.get('/uploads/:name', async (req, res, next) => {
      if (!UPLOAD_NAME_RE.test(req.params.name)) return res.status(404).end();
      try {
        const file = await uploadStore.load(req.params.name);
        if (!file) return res.status(404).end();
        res.set({ ...UPLOAD_HEADERS, 'Content-Type': file.mime_type }).send(file.data);
      } catch (err) {
        next(err);
      }
    });
  } else {
    app.use('/uploads', express.static(process.env.UPLOAD_DIR, {
      maxAge: '30d',
      immutable: true,
      index: false,
      setHeaders: (res) => {
        res.setHeader('X-Content-Type-Options', UPLOAD_HEADERS['X-Content-Type-Options']);
        res.setHeader('Content-Security-Policy', UPLOAD_HEADERS['Content-Security-Policy']);
      },
    }));
  }

  // Malformed JSON bodies etc. → JSON error instead of an HTML stack trace
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status || err.statusCode || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({
      message: status === 413 ? 'Request too large.' : status === 400 ? 'Malformed request.' : 'Server error.',
    });
  });

  return app;
}

module.exports = { createApp };
