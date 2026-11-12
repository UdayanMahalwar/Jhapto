// scripts/setup_db.js
// Creates the tables, triggers, functions, views and sample data in PostgreSQL.
//
//   npm run db:setup            # set up an empty database (does nothing if already set up)
//   npm run db:setup -- --reset # DROP everything and rebuild (deletes all data!)
//
// Uses DATABASE_URL, or DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME from jhapto-backend/.env.

require('../config/env');
const { Client } = require('pg');
const { buildDatabase, isInitialised } = require('./lib/schema');
const { connectionOptions } = require('../config/dbOptions');

async function main() {
  const reset = process.argv.includes('--reset');
  const client = new Client(connectionOptions());
  await client.connect();
  try {
    const { rows } = await client.query('SELECT current_database() AS db');
    if (!reset && await isInitialised(client)) {
      console.log(`Database "${rows[0].db}" is already set up — nothing to do. Use --reset to rebuild it (deletes data).`);
      return;
    }
    await buildDatabase(client, { reset });
    console.log(`✅ Database "${rows[0].db}" ${reset ? 'rebuilt' : 'set up'} with sample data.`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('❌ Database setup failed:', err.message);
  process.exit(1);
});
