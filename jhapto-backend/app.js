// app.js
// Builds the Express API app. Used by the root server.js (which adds the
// frontend, Socket.IO and listen()) and by the test suite (supertest).

require('./config/env');

const express = require('express');
const cors    = require('cors');

function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));   // images go through /api/uploads, not JSON
  app.use(express.urlencoded({ limit: '1mb', extended: true }));

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

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Jhapto Server is running!' });
  });

  // Unknown API routes return JSON, not the SPA's index.html
  app.use('/api', (req, res) => {
    res.status(404).json({ message: 'Not found.' });
  });

  // ── Uploaded images ────────────────────────────────────────
  app.use('/uploads', express.static(process.env.UPLOAD_DIR, {
    maxAge: '30d',
    immutable: true,          // names are random and never reused
    index: false,
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'");
    },
  }));

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
