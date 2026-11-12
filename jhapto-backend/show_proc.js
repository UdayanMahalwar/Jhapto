const mysql = require('mysql2/promise');
require('dotenv').config();

async function showProc() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT,
    });
    
    const [rows] = await connection.query("SHOW CREATE PROCEDURE sp_floor_priority_listings");
    console.log(rows[0]['Create Procedure']);
    
    await connection.end();
  } catch (err) {
    console.error("Error:", err);
  }
}

showProc();
