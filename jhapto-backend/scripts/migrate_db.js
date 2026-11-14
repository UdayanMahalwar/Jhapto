// scripts/migrate_db.js
// Applies jhapto-database/postgres/migrations/*.sql (in name order) to an existing
// database without touching its data. Every migration is written to be safe to re-run.
//
//   npm run db:migrate                              # local DB from jhapto-backend/.env
//   DATABASE_URL="postgresql://…" npm run db:migrate   # e.g. the live Neon database

const fs   = require('fs');
const path = require('path');
const { Client } = require('pg');
const { connectionOptions } = require('../config/dbOptions');

const DIR = path.join(__dirname, '..', '..', 'jhapto-database', 'postgres', 'migrations');

(async () => {
  const client = new Client(connectionOptions());
  await client.connect();
  try {
    for (const file of fs.readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort()) {
      process.stdout.write(`Applying ${file} … `);
      await client.query('BEGIN');
      await client.query(fs.readFileSync(path.join(DIR, file), 'utf8'));
      await client.query('COMMIT');
      console.log('done');
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(`\nMigration failed: ${err.message}`);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
})();
