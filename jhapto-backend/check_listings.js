const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkListings() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT,
    });
    
    // Check all active listings
    const [rows] = await connection.query(`
      SELECT l.listing_id, i.item_name, s.name as seller, l.listing_status
      FROM Listing l
      JOIN Item i ON l.item_id = i.item_id
      JOIN Student s ON l.seller_id = s.student_id
      WHERE l.listing_status = 'Active'
    `);
    console.log(rows);
    
    await connection.end();
  } catch (err) {
    console.error("Error:", err);
  }
}

checkListings();
