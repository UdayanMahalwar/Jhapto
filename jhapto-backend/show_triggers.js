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
    
    const [rows] = await connection.query("SHOW TRIGGERS");
    console.log(rows.map(r => r.Trigger));
    
    await connection.end();
  } catch (err) {
    console.error("Error:", err);
  }
}

showTriggers();
