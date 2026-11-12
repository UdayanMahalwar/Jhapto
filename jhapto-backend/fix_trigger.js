const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixTrigger() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT,
      multipleStatements: true
    });
    
    const dropSql = `DROP TRIGGER IF EXISTS trg_auto_out_of_stock;`;
    
    const createSql = `
    CREATE TRIGGER trg_auto_out_of_stock
    BEFORE UPDATE ON Listing
    FOR EACH ROW
    BEGIN
        IF NEW.quantity_available = 0 AND NEW.listing_status = 'Active' THEN
            SET NEW.listing_status = 'OutOfStock';
        END IF;
    END;
    `;
    
    await connection.query(dropSql);
    await connection.query(createSql);
    console.log("Trigger trg_auto_out_of_stock fixed successfully!");
    
    await connection.end();
  } catch (err) {
    console.error("Error:", err);
  }
}

fixTrigger();
