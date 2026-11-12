const mysql = require('mysql2/promise');
require('dotenv').config();

async function showTriggers() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT,
    });
    
    const [rows] = await connection.query("SHOW CREATE TRIGGER trg_one_active_listing");
    console.log(rows[0]['SQL Original Statement']);

    const [rows2] = await connection.query("SHOW CREATE TRIGGER trg_check_price_insert");
    console.log(rows2[0]['SQL Original Statement']);

    await connection.end();
  } catch (err) {
    console.error("Error:", err);
  }
}

showTriggers();
