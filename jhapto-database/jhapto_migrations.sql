--  JHAPTO - schema changes applied after jhapto_database.sql
--  Consolidates jhapto-backend/{alter_db,fix_trigger,migrate_is_read,migrate_reports,migrate_room}.js
--  Run once on a fresh import:  mysql -u root jhapto < jhapto-database/jhapto_migrations.sql

USE jhapto;

-- alter_db.js: allow base64 images in photo_url
ALTER TABLE Listing MODIFY photo_url LONGTEXT;

-- migrate_room.js: seller room number on listings
ALTER TABLE Listing ADD COLUMN room_number VARCHAR(50) DEFAULT NULL;

-- migrate_is_read.js: unread message tracking
ALTER TABLE Message ADD COLUMN is_read BOOLEAN DEFAULT FALSE;

-- migrate_reports.js: user reports
CREATE TABLE IF NOT EXISTS Report (
    report_id        INT AUTO_INCREMENT PRIMARY KEY,
    order_id         INT NOT NULL,
    reporter_id      INT NOT NULL,
    reported_user_id INT NOT NULL,
    reason           TEXT NOT NULL,
    proof_url        LONGTEXT,
    status           VARCHAR(50) DEFAULT 'Pending',
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id)         REFERENCES `Order`(order_id)   ON DELETE CASCADE,
    FOREIGN KEY (reporter_id)      REFERENCES Student(student_id) ON DELETE CASCADE,
    FOREIGN KEY (reported_user_id) REFERENCES Student(student_id) ON DELETE CASCADE
);

-- fix_trigger.js: original AFTER UPDATE trigger updated its own table (error 1442)
DROP TRIGGER IF EXISTS trg_auto_out_of_stock;

DELIMITER $$

CREATE TRIGGER trg_auto_out_of_stock
BEFORE UPDATE ON Listing
FOR EACH ROW
BEGIN
    IF NEW.quantity_available = 0 AND NEW.listing_status = 'Active' THEN
        SET NEW.listing_status = 'OutOfStock';
    END IF;
END$$

-- migrate_room.js: procedure now returns room_number
DROP PROCEDURE IF EXISTS sp_floor_priority_listings$$

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
        DECLARE done              INT DEFAULT FALSE;
        DECLARE v_listing_id      INT;
        DECLARE v_item_name       VARCHAR(150);
        DECLARE v_seller_name     VARCHAR(100);
        DECLARE v_seller_floor_id INT;
        DECLARE v_seller_floor_num INT;
        DECLARE v_selling_price   DECIMAL(10,2);
        DECLARE v_quantity        INT;
        DECLARE v_description     TEXT;
        DECLARE v_photo_url       LONGTEXT;
        DECLARE v_room_number     VARCHAR(50);
        DECLARE v_priority        INT;

        DECLARE cur_listings CURSOR FOR
            SELECT l.listing_id, i.item_name, s.name, s.floor_id, f.floor_number,
                   l.selling_price, l.quantity_available, l.description, l.photo_url, l.room_number
            FROM Listing  l
            JOIN Student  s ON l.seller_id = s.student_id
            JOIN Floor    f ON s.floor_id  = f.floor_id
            JOIN Item     i ON l.item_id   = i.item_id
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
END$$

DELIMITER ;

-- migrate_room.js: view now exposes room_number
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

-- Dev logins for the seed accounts (seed file only has placeholder hashes)
--   students: password123   admin@jhapto.com: admin123
UPDATE Student SET password_hash = '$2a$10$Er7RAvUKbORp/Fp411lXLO1zYNhMGFdUopOahefH1eLHJUx.JKyR2'
WHERE password_hash IN ('hash1', 'hash2', 'hash3', 'hash4', 'hash5');
UPDATE Admin SET password_hash = '$2a$10$qbhq.15XRbBYGk7EXf1CzOZ/Z8TXJpsDSRwDywflGXZdwbapzs10e'
WHERE password_hash = 'hashed_admin_password';
