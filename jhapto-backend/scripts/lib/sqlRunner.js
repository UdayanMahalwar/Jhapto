// scripts/lib/sqlRunner.js
// Runs the jhapto-database/*.sql files through mysql2, so neither setup nor
// the tests need the `mysql` command-line client. Understands the CLI's
// DELIMITER command used around triggers / procedures.

const fs   = require('fs');
const path = require('path');

const SQL_DIR = path.join(__dirname, '..', '..', '..', 'jhapto-database');

// In order: base schema + seed data, then the migrations
const SCHEMA_FILES = [
  'jhapto_database.sql',
  'jhapto_migrations.sql',
  'jhapto_migrations_v2.sql',
  'jhapto_migrations_v3.sql',
  'jhapto_migrations_v4.sql',
];

// Split a SQL script into statements, honouring DELIMITER changes.
function splitStatements(sql) {
  const statements = [];
  let delimiter = ';';
  let buffer = [];

  for (const rawLine of sql.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+$/, '');
    const delimMatch = /^\s*DELIMITER\s+(\S+)\s*$/i.exec(line);
    if (delimMatch) {
      delimiter = delimMatch[1];
      continue;
    }
    if (buffer.length === 0 && (/^\s*--/.test(line) || line.trim() === '')) continue;

    buffer.push(line);
    if (line.endsWith(delimiter)) {
      const stmt = buffer.join('\n');
      statements.push(stmt.slice(0, stmt.length - delimiter.length).trim());
      buffer = [];
    }
  }
  const rest = buffer.join('\n').trim();
  if (rest && !/^(--[^\n]*\n?)*$/.test(rest)) statements.push(rest);
  return statements.filter(Boolean);
}

const checkDbName = (dbName) => {
  if (!/^[A-Za-z0-9_]+$/.test(dbName)) throw new Error(`Unsafe database name: ${dbName}`);
  return dbName;
};

// The SQL files say `CREATE DATABASE ... jhapto; USE jhapto;` — point them at dbName instead
function retarget(sql, dbName) {
  checkDbName(dbName);
  return sql
    .replace(/CREATE DATABASE IF NOT EXISTS\s+jhapto\s*;/gi, `CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`)
    .replace(/^\s*USE\s+jhapto\s*;/gim, `USE \`${dbName}\`;`);
}

// Runs every statement of a file on `conn` (a mysql2/promise connection)
async function runSqlFile(conn, fileName, dbName) {
  const sql = retarget(fs.readFileSync(path.join(SQL_DIR, fileName), 'utf8'), dbName);
  for (const statement of splitStatements(sql)) {
    try {
      await conn.query(statement);
    } catch (err) {
      err.message = `${fileName}: ${err.message}\n--- statement ---\n${statement.slice(0, 400)}`;
      throw err;
    }
  }
}

// Drops (optionally) and rebuilds the full schema + seed data in dbName
async function buildDatabase(conn, dbName, { drop = false } = {}) {
  if (drop) await conn.query(`DROP DATABASE IF EXISTS \`${checkDbName(dbName)}\``);
  for (const file of SCHEMA_FILES) {
    await runSqlFile(conn, file, dbName);
  }
}

module.exports = { splitStatements, runSqlFile, buildDatabase, SCHEMA_FILES };
