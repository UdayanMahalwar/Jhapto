const mysql = require('mysql2/promise');
require('dotenv').config();

async function check() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT
    });
    
    console.log("--- Student Accounts ---");
    const [students] = await connection.query("SELECT student_id, name, email FROM Student ORDER BY student_id DESC LIMIT 10");
    console.table(students);
    
    console.log("--- Order 42 ---");
    const [o42] = await connection.query("SELECT * FROM `Order` WHERE order_id = 42");
    console.table(o42);

    const [l42] = await connection.query("SELECT l.seller_id FROM Listing l JOIN Order_Item oi ON l.listing_id = oi.listing_id WHERE oi.order_id = 42");
    console.table(l42);

    await connection.end();
  } catch (err) {
    console.error("Error:", err);
  }
}

check();
