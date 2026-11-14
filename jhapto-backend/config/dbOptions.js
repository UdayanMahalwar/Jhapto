// config/dbOptions.js
// PostgreSQL connection settings shared by the app, the scripts and the tests.
//
// Either set DATABASE_URL (hosted, e.g. Neon: "postgresql://user:pass@host/db?sslmode=require")
// or the separate DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME values (local).

require('./env');

function connectionOptions({ database } = {}) {
  if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);
    if (database) url.pathname = `/${database}`;
    const needsSsl = /sslmode=(require|verify)/.test(url.search) || process.env.DB_SSL === 'true';
    // node-postgres treats sslmode in the URL specially; pass TLS settings explicitly instead
    url.searchParams.delete('sslmode');
    url.searchParams.delete('channel_binding');
    return {
      connectionString: url.toString(),
      ssl: needsSsl ? { rejectUnauthorized: true } : undefined,
    };
  }
  return {
    host    : process.env.DB_HOST || 'localhost',
    port    : Number(process.env.DB_PORT) || 5432,
    user    : process.env.DB_USER || 'jhapto',
    password: process.env.DB_PASSWORD || '',
    database: database || process.env.DB_NAME || 'jhapto',
    ssl     : process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
  };
}

module.exports = { connectionOptions };
