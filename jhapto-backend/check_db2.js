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
    
    console.log("--- Latest 5 Messages ---");
    const [msgs] = await connection.query("SELECT message_id, order_id, sender_id, receiver_id, message_text FROM Message ORDER BY message_id DESC LIMIT 5");
    console.table(msgs);
    
    if (msgs.length > 0) {
      const latestOrderId = msgs[0].order_id;
      console.log(`\n--- Order ${latestOrderId} details ---`);
      const [orderRows] = await connection.query("SELECT order_id, buyer_id FROM `Order` WHERE order_id = ?", [latestOrderId]);
      console.table(orderRows);

      const [listingRows] = await connection.query("SELECT l.listing_id, l.seller_id FROM Listing l JOIN Order_Item oi ON l.listing_id = oi.listing_id WHERE oi.order_id = ?", [latestOrderId]);
      console.table(listingRows);
    }

    await connection.end();
  } catch (err) {
    console.error("Error:", err);
  }
}

check();
