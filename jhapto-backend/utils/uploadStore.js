// utils/uploadStore.js
// Where uploaded images live:
//   UPLOAD_STORAGE=disk (default) → files in UPLOAD_DIR, served by express.static
//   UPLOAD_STORAGE=db             → rows in the Upload table (for hosts with a wiped disk)

const fs   = require('fs');
const path = require('path');

const MIME = { png: 'image/png', jpg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };

const usesDatabase = () => process.env.UPLOAD_STORAGE === 'db';

// db is required lazily so scripts that only need the helpers don't open a pool
const db = () => require('../config/db');

async function save(name, buffer, ext, uploadedBy = null) {
  if (usesDatabase()) {
    await db().query(
      'INSERT INTO Upload (name, mime_type, data, uploaded_by) VALUES (?, ?, ?, ?)',
      [name, MIME[ext], buffer, uploadedBy]
    );
    return;
  }
  await fs.promises.mkdir(process.env.UPLOAD_DIR, { recursive: true });
  await fs.promises.writeFile(path.join(process.env.UPLOAD_DIR, name), buffer, { flag: 'wx' });
}

// Returns { data, mime_type } or null (database mode only)
async function load(name) {
  const [rows] = await db().query('SELECT data, mime_type FROM Upload WHERE name = ?', [name]);
  return rows[0] || null;
}

// Synchronous existence check used by input validation. In database mode the
// name format is checked by the caller; a missing row just shows the placeholder.
function existsSync(name) {
  if (usesDatabase()) return true;
  return fs.existsSync(path.join(process.env.UPLOAD_DIR, name));
}

module.exports = { save, load, existsSync, usesDatabase, MIME };
