const mysql = require('mysql2/promise');
require('dotenv').config();

async function alterDb() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT,
    });
    console.log("Connected to DB");
    
    await connection.execute("ALTER TABLE Listing MODIFY photo_url LONGTEXT;");
    console.log("Successfully altered Listing table to support LONGTEXT photo_url");
    
    await connection.end();
  } catch (err) {
    console.error("Error:", err);
  }
}

alterDb();
