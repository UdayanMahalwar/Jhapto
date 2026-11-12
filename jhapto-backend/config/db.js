// config/db.js
// Connects Node.js to the local MySQL `jhapto` database.
// Set USE_MOCK_DB=true in .env to use the in-memory mock instead (no MySQL needed).

require('./env');

if (process.env.USE_MOCK_DB === 'true') {
  console.log('⚠️  USE_MOCK_DB=true — using in-memory mock database');
  module.exports = require('./mockDb');
  return;
}

const mysql = require('mysql2');

const pool = mysql.createPool({
  host     : process.env.DB_HOST || 'localhost',
  user     : process.env.DB_USER || 'root',
  password : process.env.DB_PASSWORD || '',
  database : process.env.DB_NAME || 'jhapto',
  port     : Number(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit   : 10,
});

// Test the connection on startup (quiet under the test runner)
if (process.env.NODE_ENV !== 'test') pool.getConnection((err, connection) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
  } else {
    console.log(`✅ Connected to MySQL database: ${process.env.DB_NAME || 'jhapto'}`);
    connection.release();
  }
});

module.exports = pool.promise();  // use promise-based queries
