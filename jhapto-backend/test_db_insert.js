const mysql = require('mysql2/promise');
require('dotenv').config();

async function testInsert() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT,
    });
    
    // Check max_allowed_packet
    const [rows] = await connection.query("SHOW VARIABLES LIKE 'max_allowed_packet'");
    console.log("max_allowed_packet:", rows);
    
    await connection.end();
  } catch (err) {
    console.error("Error:", err);
  }
}

testInsert();
