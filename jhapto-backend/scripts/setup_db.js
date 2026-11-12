// scripts/setup_db.js
// Creates the database from jhapto-database/*.sql (schema, seed data, migrations).
//
//   npm run db:setup            # create DB_NAME if it doesn't exist yet
//   npm run db:setup -- --reset # DROP and rebuild DB_NAME (deletes all data!)
//
// Uses the connection settings in jhapto-backend/.env. The user needs CREATE
// rights on the database (e.g. run once as root: DB_USER=root DB_PASSWORD= npm run db:setup).

require('../config/env');
const mysql = require('mysql2/promise');
const { buildDatabase } = require('./lib/sqlRunner');
const { connectionOptions } = require('../config/dbOptions');

async function main() {
  const reset = process.argv.includes('--reset');
  const dbName = process.env.DB_NAME || 'jhapto';

  const conn = await mysql.createConnection(connectionOptions({ database: false }));

  try {
    const [rows] = await conn.query('SHOW DATABASES LIKE ?', [dbName]);
    if (rows.length > 0 && !reset) {
      console.log(`Database "${dbName}" already exists — nothing to do. Use --reset to rebuild it (deletes data).`);
      return;
    }
    await buildDatabase(conn, dbName, { drop: reset });
    console.log(`✅ Database "${dbName}" ${reset ? 'rebuilt' : 'created'} with seed data.`);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('❌ Database setup failed:', err.message);
  if (/1418|1419|log_bin_trust_function_creators/.test(err.message)) {
    console.error('   Run once as root:  mysql -u root -e "SET PERSIST log_bin_trust_function_creators = 1;"');
  }
  process.exit(1);
});
