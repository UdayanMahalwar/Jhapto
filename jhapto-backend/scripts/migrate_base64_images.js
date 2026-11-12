// scripts/migrate_base64_images.js
// One-time migration: moves base64 images stored in the database
// (Listing.photo_url, Report.proof_url) into files under UPLOAD_DIR and
// replaces each value with its /uploads/<name> URL.
//
//   npm run images:migrate             # dry run — shows what would change
//   npm run images:migrate -- --apply  # write files and update rows

require('../config/env');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const mysql  = require('mysql2/promise');
const { sniffImageType } = require('../utils/imageType');
const { connectionOptions } = require('../config/dbOptions');

const TARGETS = [
  { table: 'Listing', id: 'listing_id', column: 'photo_url' },
  { table: 'Report',  id: 'report_id',  column: 'proof_url' },
];

async function main() {
  const apply = process.argv.includes('--apply');
  const conn = await mysql.createConnection(connectionOptions());

  let moved = 0, skipped = 0;
  try {
    await fs.promises.mkdir(process.env.UPLOAD_DIR, { recursive: true });
    for (const { table, id, column } of TARGETS) {
      const [rows] = await conn.query(
        `SELECT ${id} AS id, ${column} AS value FROM ${table} WHERE ${column} LIKE 'data:%'`
      );
      for (const row of rows) {
        const m = /^data:[^;,]*;base64,(.*)$/s.exec(row.value);
        const buf = m ? Buffer.from(m[1], 'base64') : null;
        const ext = buf ? sniffImageType(buf) : null;
        if (!ext) {
          console.warn(`  ${table} #${row.id}: not a PNG/JPEG/GIF/WebP image — left unchanged`);
          skipped++;
          continue;
        }
        const name = `${crypto.randomBytes(16).toString('hex')}.${ext}`;
        console.log(`  ${table} #${row.id}: ${(buf.length / 1024).toFixed(0)} KB → /uploads/${name}`);
        if (apply) {
          await fs.promises.writeFile(path.join(process.env.UPLOAD_DIR, name), buf, { flag: 'wx' });
          await conn.query(`UPDATE ${table} SET ${column} = ? WHERE ${id} = ?`, [`/uploads/${name}`, row.id]);
        }
        moved++;
      }
    }
  } finally {
    await conn.end();
  }

  console.log(`${apply ? 'Moved' : 'Would move'} ${moved} image(s); ${skipped} skipped.`);
  if (!apply && moved > 0) console.log('Run again with --apply to make the changes.');
}

main().catch((err) => {
  console.error('❌ Image migration failed:', err.message);
  process.exit(1);
});
