// scripts/lib/schema.js
// Builds the PostgreSQL schema + sample data from jhapto-database/postgres/jhapto_postgres.sql.

const fs   = require('fs');
const path = require('path');

const SCHEMA_FILE = path.join(__dirname, '..', '..', '..', 'jhapto-database', 'postgres', 'jhapto_postgres.sql');

// `client` is a connected pg Client/PoolClient. With reset, everything in the
// public schema is dropped first (all data is lost).
async function buildDatabase(client, { reset = false } = {}) {
  if (reset) {
    await client.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
  }
  // The file is plain SQL with $$-quoted function bodies, which the simple
  // query protocol runs as one multi-statement batch.
  await client.query(fs.readFileSync(SCHEMA_FILE, 'utf8'));
}

async function isInitialised(client) {
  const { rows } = await client.query("SELECT to_regclass('public.student') IS NOT NULL AS ok");
  return rows[0].ok;
}

module.exports = { buildDatabase, isInitialised, SCHEMA_FILE };
