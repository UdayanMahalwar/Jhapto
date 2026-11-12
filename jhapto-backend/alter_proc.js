const mysql = require('mysql2/promise');
require('dotenv').config();

async function alterProc() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT,
      multipleStatements: true
    });
    
    const dropSql = `DROP PROCEDURE IF EXISTS sp_floor_priority_listings;`;
    
    const createSql = `
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
                    l.photo_url
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
                    v_selling_price, v_quantity, v_description, v_photo_url;
    
                IF done THEN LEAVE read_loop; END IF;
    
                IF v_seller_floor_id = p_buyer_floor_id THEN
                    SET v_priority = 0;
                ELSE
                    SET v_priority = 1;
                END IF;
    
                INSERT INTO tmp_listings VALUES (
                    v_listing_id, v_item_name, v_seller_name,
                    v_seller_floor_num, v_selling_price,
                    v_quantity, v_description, v_photo_url, v_priority
                );
            END LOOP;
    
            CLOSE cur_listings;
        END;
    
        SELECT * FROM tmp_listings ORDER BY priority_rank ASC, listing_id DESC;
        DROP TEMPORARY TABLE IF EXISTS tmp_listings;
    END
    `;
    
    await connection.query(dropSql);
    await connection.query(createSql);
    console.log("Procedure sp_floor_priority_listings altered successfully!");
    
    await connection.end();
  } catch (err) {
    console.error("Error:", err);
  }
}

alterProc();
