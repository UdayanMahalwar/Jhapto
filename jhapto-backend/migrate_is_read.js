const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT
    });
    
    await connection.query("ALTER TABLE Message ADD COLUMN is_read BOOLEAN DEFAULT FALSE;");
    console.log("Added is_read column to Message table");
    await connection.end();
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log("is_read column already exists.");
    } else {
      console.error("Migration Error:", err);
    }
  }
}

migrate();
