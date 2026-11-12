// server.js
// Main entry point — starts the Jhapto backend server

const express  = require('express');
const cors     = require('cors');
require('dotenv').config();

const app = express();

// ── Middleware ───────────────────────────────────────────────
app.use(cors());                  // allows React frontend to call this server
app.use(express.json({ limit: '10mb' }));          // parses JSON bodies; 10mb leaves room for one base64 photo (validated to <5MB)
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// ── Routes ───────────────────────────────────────────────────
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/listings', require('./routes/listings'));
app.use('/api/orders',   require('./routes/orders'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/admin',    require('./routes/admin'));
app.use('/api/reports',  require('./routes/reports'));

// ── Health check ─────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ message: '✅ Jhapto Backend is running!' });
});

// ── Start server ─────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Jhapto server running at http://localhost:${PORT}`);
});
