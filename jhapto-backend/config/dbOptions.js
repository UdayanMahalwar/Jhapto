// config/dbOptions.js
// MySQL connection settings shared by the app, the scripts and the tests.
//
// Hosted MySQL (e.g. Aiven) requires TLS. Set one of:
//   DB_SSL_CA_FILE=/path/to/ca.pem      (local scripts)
//   DB_SSL_CA="-----BEGIN CERTIFICATE-----\n..."   (hosting dashboards; \n may be literal)
// or DB_SSL=true to use TLS with the system's trusted CAs.

require('./env');
const fs = require('fs');

function sslOptions() {
  let ca = null;
  if (process.env.DB_SSL_CA_FILE) {
    ca = fs.readFileSync(process.env.DB_SSL_CA_FILE, 'utf8');
  } else if (process.env.DB_SSL_CA) {
    ca = process.env.DB_SSL_CA.replace(/\\n/g, '\n');
  }
  if (ca) return { ca, rejectUnauthorized: true };
  if (process.env.DB_SSL === 'true') return { rejectUnauthorized: true };
  return undefined;
}

// Options for mysql.createConnection / createPool. Pass { database: false } to
// connect without selecting a database (needed to create it).
function connectionOptions({ database = true } = {}) {
  const options = {
    host    : process.env.DB_HOST || 'localhost',
    port    : Number(process.env.DB_PORT) || 3306,
    user    : process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    ssl     : sslOptions(),
  };
  if (database) options.database = process.env.DB_NAME || 'jhapto';
  return options;
}

module.exports = { connectionOptions };
