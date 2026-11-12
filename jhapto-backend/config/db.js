// config/db.js
// PostgreSQL access for the routes, with a small adapter that keeps the
// mysql2-style interface the code was written against:
//
//   const [rows]   = await db.query('SELECT … WHERE id = ?', [id]);
//   const [result] = await db.query('INSERT …', [...]);   // result.insertId, result.affectedRows
//   const conn = await db.getConnection();                  // beginTransaction / commit / rollback / release
//
// Set USE_MOCK_DB=true to use the in-memory mock instead (no database needed).

require('./env');

if (process.env.USE_MOCK_DB === 'true') {
  console.log('⚠️  USE_MOCK_DB=true — using in-memory mock database');
  module.exports = require('./mockDb');
  return;
}

const { Pool, types } = require('pg');
const { connectionOptions } = require('./dbOptions');

// COUNT(*) etc. come back as BIGINT; return plain numbers like MySQL did.
// NUMERIC stays a string ("30.00"), the same as MySQL's DECIMAL.
types.setTypeParser(20, (v) => (v === null ? null : Number(v)));

const pool = new Pool({
  ...connectionOptions(),
  max: Number(process.env.DB_POOL_SIZE) || 10,
  idleTimeoutMillis: 10000,
});

// Replace ? placeholders with $1, $2, … (ignoring ? inside quotes)
function toPgPlaceholders(sql) {
  let out = '';
  let n = 0;
  let quote = null;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (quote) {
      out += ch;
      if (ch === quote) quote = null;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
      out += ch;
    } else if (ch === '?') {
      out += `$${++n}`;
    } else {
      out += ch;
    }
  }
  return out;
}

// pg error codes → the mysql2 codes the routes already check
function translateError(err) {
  if (err.code === '45000') err.sqlState = '45000';             // RAISE ... USING ERRCODE = '45000'
  else if (err.code === '23505') err.code = 'ER_DUP_ENTRY';      // unique violation
  else if (err.code === '23503') err.code = 'ER_NO_REFERENCED_ROW_2';  // foreign key violation
  return err;
}

async function run(client, sql, params = []) {
  let text = toPgPlaceholders(sql.trim());
  const isWrite = /^(insert|update|delete)\s/i.test(text);
  const explicitReturning = /\breturning\b/i.test(text);
  // mysql2 gave us insertId; get the new row's key back with RETURNING
  if (/^insert\s/i.test(text) && !explicitReturning) text += ' RETURNING *';

  let result;
  try {
    result = await client.query(text, params);
  } catch (err) {
    throw translateError(err);
  }

  // SELECTs (and statements that asked for RETURNING themselves) give rows
  if (!isWrite || explicitReturning) {
    return [result.rows, result.fields];
  }
  // INSERT / UPDATE / DELETE give a mysql2-style result object
  const first = result.rows && result.rows[0];
  return [{
    affectedRows: result.rowCount,
    insertId: first ? first[Object.keys(first)[0]] : undefined,
    rows: result.rows,
  }];
}

const db = {
  query: (sql, params) => run(pool, sql, params),

  async getConnection() {
    const client = await pool.connect();
    return {
      query: (sql, params) => run(client, sql, params),
      beginTransaction: () => client.query('BEGIN'),
      commit: () => client.query('COMMIT'),
      rollback: () => client.query('ROLLBACK'),
      release: () => client.release(),
    };
  },

  end: () => pool.end(),
  pool,
};

// Test the connection on startup (quiet under the test runner)
if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL) {
  pool.query('SELECT current_database() AS db')
    .then(({ rows }) => console.log(`✅ Connected to PostgreSQL database: ${rows[0].db}`))
    .catch((err) => console.error('❌ Database connection failed:', err.message));
}

module.exports = db;
module.exports.toPgPlaceholders = toPgPlaceholders;
