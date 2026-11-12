const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT,
      multipleStatements: true
    });
    
    // 1. Alter Table
    try {
      await connection.query("ALTER TABLE Listing ADD COLUMN room_number VARCHAR(50) DEFAULT NULL;");
      console.log("Added room_number to Listing table");
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') console.log("room_number already exists");
      else throw e;
    }

    // 2. Alter Procedure sp_floor_priority_listings
    await connection.query(`DROP PROCEDURE IF EXISTS sp_floor_priority_listings;`);
    await connection.query(`
    CREATE PROCEDURE sp_floor_priority_listings(
        IN p_buyer_floor_id INT
    )
    BEGIN
        DROP TEMPORARY TABLE IF EXISTS tmp_listings;
        CREATE TEMPORARY TABLE tmp_listings (
            listing_id         INT,
            item_name          VARCHAR(150),
            seller_name        VARCHAR(100),
            seller_floor       INT,
            selling_price      DECIMAL(10,2),
            quantity_available INT,
            description        TEXT,
            photo_url          LONGTEXT,
            room_number        VARCHAR(50),
            priority_rank      INT
        );
    
        BEGIN
            DECLARE done             INT DEFAULT FALSE;
            DECLARE v_listing_id     INT;
            DECLARE v_item_name      VARCHAR(150);
            DECLARE v_seller_name    VARCHAR(100);
            DECLARE v_seller_floor_id INT;
            DECLARE v_seller_floor_num INT;
            DECLARE v_selling_price  DECIMAL(10,2);
            DECLARE v_quantity       INT;
            DECLARE v_description    TEXT;
            DECLARE v_photo_url      LONGTEXT;
            DECLARE v_room_number    VARCHAR(50);
            DECLARE v_priority       INT;
    
            DECLARE cur_listings CURSOR FOR
                SELECT
                    l.listing_id,
                    i.item_name,
                    s.name,
                    s.floor_id,
                    f.floor_number,
                    l.selling_price,
                    l.quantity_available,
                    l.description,
                    l.photo_url,
                    l.room_number
                FROM Listing  l
                JOIN Student  s ON l.seller_id   = s.student_id
                JOIN Floor    f ON s.floor_id    = f.floor_id
                JOIN Item     i ON l.item_id     = i.item_id
                WHERE l.listing_status = 'Active'
                  AND s.is_banned      = FALSE;
    
            DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
    
            OPEN cur_listings;
    
            read_loop: LOOP
                FETCH cur_listings INTO
                    v_listing_id, v_item_name, v_seller_name,
                    v_seller_floor_id, v_seller_floor_num,
                    v_selling_price, v_quantity, v_description, v_photo_url, v_room_number;
    
                IF done THEN LEAVE read_loop; END IF;
    
                IF v_seller_floor_id = p_buyer_floor_id THEN
                    SET v_priority = 0;
                ELSE
                    SET v_priority = 1;
                END IF;
    
                INSERT INTO tmp_listings VALUES (
                    v_listing_id, v_item_name, v_seller_name,
                    v_seller_floor_num, v_selling_price,
                    v_quantity, v_description, v_photo_url, v_room_number, v_priority
                );
            END LOOP;
    
            CLOSE cur_listings;
        END;
    
        SELECT * FROM tmp_listings ORDER BY priority_rank ASC, listing_id DESC;
        DROP TEMPORARY TABLE IF EXISTS tmp_listings;
    END
    `);
    console.log("Updated sp_floor_priority_listings");

    // 3. Alter View vw_active_listings
    await connection.query(`
    CREATE OR REPLACE VIEW vw_active_listings AS
    SELECT
        l.listing_id,
        s.name          AS seller_name,
        s.phone_no      AS seller_phone,
        s.floor_id      AS seller_floor_id,
        f.floor_number  AS seller_floor_number,
        i.item_name,
        i.brand,
        c.category_name,
        l.mrp,
        l.selling_price,
        l.quantity_available,
        l.description,
        l.photo_url,
        l.room_number,
        l.created_at
    FROM Listing  l
    JOIN Student  s ON l.seller_id   = s.student_id
    JOIN Floor    f ON s.floor_id    = f.floor_id
    JOIN Item     i ON l.item_id     = i.item_id
    JOIN Category c ON i.category_id = c.category_id
    WHERE l.listing_status = 'Active' AND s.is_banned = FALSE;
    `);
    console.log("Updated vw_active_listings");

    await connection.end();
  } catch (err) {
    console.error("Migration Error:", err);
  }
}

migrate();
