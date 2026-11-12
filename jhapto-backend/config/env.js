// config/env.js
// Loads jhapto-backend/.env once, before anything reads process.env.
// Values already set in the environment (e.g. by tests) win over the file.

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production.');
  }
  process.env.JWT_SECRET = 'jhapto_dev_only_secret_change_me';
  console.warn('⚠️  JWT_SECRET not set — using an insecure development default.');
}

process.env.UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');

module.exports = process.env;
