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
    
    const [rows] = await connection.query("SELECT message_id, order_id, sender_id, receiver_id, message_text FROM Message WHERE order_id = 40");
    console.log("Messages for order 40:");
    console.table(rows);
    
    const [orderRows] = await connection.query("SELECT order_id, buyer_id FROM `Order` WHERE order_id = 40");
    console.log("Order 40 details:");
    console.table(orderRows);

    const [listingRows] = await connection.query("SELECT l.listing_id, l.seller_id FROM Listing l JOIN Order_Item oi ON l.listing_id = oi.listing_id WHERE oi.order_id = 40");
    console.log("Listing details for order 40:");
    console.table(listingRows);

    await connection.end();
  } catch (err) {
    console.error("Error:", err);
  }
}

check();
