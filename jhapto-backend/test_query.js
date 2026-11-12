const mysql = require('mysql2/promise');
require('dotenv').config();

async function test() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT,
    });
    console.log("Connected to DB");
    
    // We assume the user has a floor_id = 1
    const [rows] = await connection.query("CALL sp_floor_priority_listings(1)");
    console.log("Query succeeded! Rows:", rows[0].length);
    
    await connection.end();
  } catch (err) {
    console.error("Query Error:", err);
  }
}

test();
