--  JHAPTO - migration v3: categories & catalogue, revenue rules, notification links
--  Run once, after jhapto_migrations_v2.sql:
--    mysql -u root jhapto < jhapto-database/jhapto_migrations_v3.sql

USE jhapto;

-- ============================================================
--  CATEGORIES & CATALOGUE
--  The seed data had a single category, so every category filter but one was empty.
-- ============================================================

INSERT IGNORE INTO Category (category_name) VALUES
    ('Snacks & Food'),
    ('Noodles & Instant Food'),
    ('Beverages'),
    ('Chocolates & Sweets'),
    ('Stationery & Books'),
    ('Personal Care'),
    ('Electronics & Accessories');

-- Re-file the seed items
UPDATE Item i JOIN Category c ON c.category_name = 'Beverages'
SET i.category_id = c.category_id WHERE i.item_name = 'Amul Kool Milk';
UPDATE Item i JOIN Category c ON c.category_name = 'Noodles & Instant Food'
SET i.category_id = c.category_id WHERE i.item_name = 'Maggi Noodles 2-min';
UPDATE Item i JOIN Category c ON c.category_name = 'Chocolates & Sweets'
SET i.category_id = c.category_id WHERE i.item_name = 'Dark Fantasy Choco Fills';

-- Extended catalogue (replaces scripts/insert_items.js); skips names that already exist
CREATE TEMPORARY TABLE tmp_catalogue (
    item_name     VARCHAR(150),
    brand         VARCHAR(100),
    category_name VARCHAR(100)
);

INSERT INTO tmp_catalogue VALUES
    ("Lays India's Magic Masala",            'Lays',          'Snacks & Food'),
    ('Lays American Style Cream and Onion',  'Lays',          'Snacks & Food'),
    ('Bingo Mad Angles Tomato Madness',      'Bingo',         'Snacks & Food'),
    ('Uncle Chipps Spicy Treat',             'Uncle Chipps',  'Snacks & Food'),
    ('Balaji Wafers Cream & Onion',          'Balaji',        'Snacks & Food'),
    ('Kurkure Solid Masti',                  'Kurkure',       'Snacks & Food'),
    ("Haldiram's Moong Dal",                 "Haldiram's",    'Snacks & Food'),
    ("Haldiram's Aloo Bhujia",               "Haldiram's",    'Snacks & Food'),
    ("Haldiram's Bhujia Sev",                "Haldiram's",    'Snacks & Food'),
    ('Act II Golden Sizzle Popcorn',         'Act II',        'Snacks & Food'),
    ('Act II Butter Delite Popcorn',         'Act II',        'Snacks & Food'),
    ('Act II Chilli Surprise Popcorn',       'Act II',        'Snacks & Food'),
    ('4700BC Cheese Popcorn',                '4700BC',        'Snacks & Food'),
    ('Doritos Nacho Cheese',                 'Doritos',       'Snacks & Food'),
    ('Doritos Sweet Chili',                  'Doritos',       'Snacks & Food'),
    ('Cornitos Tikka Masala Nachos',         'Cornitos',      'Snacks & Food'),
    ('Cornitos Jalapeno Nachos',             'Cornitos',      'Snacks & Food'),
    ('Cornitos Cheese & Herbs Nachos',       'Cornitos',      'Snacks & Food'),
    ('Yippee Magic Masala Noodles',          'Sunfeast',      'Noodles & Instant Food'),
    ('Wai Wai Ready to Eat Noodles',         'Wai Wai',       'Noodles & Instant Food'),
    ("Ching's Secret Schezwan Noodles",      "Ching's",       'Noodles & Instant Food'),
    ('Top Ramen Curry Noodles',              'Nissin',        'Noodles & Instant Food'),
    ('Maggi Atta Noodles',                   'Maggi',         'Noodles & Instant Food'),
    ('Samyang Buldak Spicy Chicken Ramen',   'Samyang',       'Noodles & Instant Food'),
    ('Coca-Cola 750ml',                      'Coca-Cola',     'Beverages'),
    ('Red Bull 250ml',                       'Red Bull',      'Beverages'),
    ('Paper Boat Aamras',                    'Paper Boat',    'Beverages'),
    ('Nescafe Classic Sachet',               'Nescafe',       'Beverages'),
    ('Cadbury Dairy Milk Silk',              'Cadbury',       'Chocolates & Sweets'),
    ('KitKat 4 Finger',                      'Nestle',        'Chocolates & Sweets'),
    ('Oreo Chocolate Cream',                 'Cadbury',       'Chocolates & Sweets'),
    ('Classmate Spiral Notebook',            'Classmate',     'Stationery & Books'),
    ('Pilot V5 Hi-Tecpoint Pen',             'Pilot',         'Stationery & Books'),
    ('Casio FX-991ES Calculator',            'Casio',         'Stationery & Books'),
    ('Colgate MaxFresh Toothpaste',          'Colgate',       'Personal Care'),
    ('Dettol Hand Sanitizer 50ml',           'Dettol',        'Personal Care'),
    ('USB Type-C Fast Cable',                'boAt',          'Electronics & Accessories'),
    ('AA Batteries (pack of 4)',             'Duracell',      'Electronics & Accessories');

INSERT INTO Item (item_name, brand, category_id)
SELECT t.item_name, t.brand, c.category_id
FROM tmp_catalogue t
JOIN Category c ON c.category_name = t.category_name
WHERE NOT EXISTS (SELECT 1 FROM Item i WHERE i.item_name = t.item_name);

DROP TEMPORARY TABLE tmp_catalogue;

-- The seed listings pointed at /photos/*.jpg files that never existed
UPDATE Listing SET photo_url = NULL WHERE photo_url LIKE '/photos/%';

-- ============================================================
--  NOTIFICATIONS: "rate your seller" should open the order history tab
-- ============================================================
UPDATE Notification SET link = '/orders?tab=history' WHERE type = 'order_delivered';

DROP TRIGGER IF EXISTS trg_notify_order_status;

DELIMITER $$

CREATE TRIGGER trg_notify_order_status
AFTER UPDATE ON `Order`
FOR EACH ROW
BEGIN
    DECLARE v_seller INT DEFAULT NULL;
    DECLARE v_item   VARCHAR(150) DEFAULT 'your item';

    IF NEW.order_status <> OLD.order_status THEN
        SELECT l.seller_id, i.item_name INTO v_seller, v_item
        FROM Order_Item oi
        JOIN Listing l ON oi.listing_id = l.listing_id
        JOIN Item    i ON l.item_id     = i.item_id
        WHERE oi.order_id = NEW.order_id
        LIMIT 1;

        IF NEW.order_status = 'Confirmed' THEN
            INSERT INTO Notification (student_id, type, message, link)
            VALUES (NEW.buyer_id, 'order_confirmed',
                    CONCAT('Order #', NEW.order_id, ' (', v_item, ') was confirmed. You can now chat with the seller.'),
                    CONCAT('/chat/', NEW.order_id));
        ELSEIF NEW.order_status = 'Delivered' THEN
            INSERT INTO Notification (student_id, type, message, link)
            VALUES (NEW.buyer_id, 'order_delivered',
                    CONCAT('Order #', NEW.order_id, ' (', v_item, ') was delivered. Rate your seller!'),
                    '/orders?tab=history');
        ELSEIF NEW.order_status = 'Cancelled' AND v_seller IS NOT NULL THEN
            INSERT INTO Notification (student_id, type, message, link)
            VALUES (v_seller, 'order_cancelled',
                    CONCAT('Order #', NEW.order_id, ' (', v_item, ') was cancelled by the buyer.'),
                    '/seller?tab=history');
        END IF;
    END IF;
END$$

-- ============================================================
--  REVENUE: only Delivered orders count as earned revenue
-- ============================================================
DROP FUNCTION IF EXISTS fn_get_seller_revenue$$

CREATE FUNCTION fn_get_seller_revenue(
    p_seller_id INT
)
RETURNS DECIMAL(12,2)
READS SQL DATA
BEGIN
    DECLARE v_revenue DECIMAL(12,2) DEFAULT 0.00;

    SELECT COALESCE(SUM(oi.price_at_purchase * oi.quantity), 0.00)
    INTO v_revenue
    FROM Order_Item oi
    JOIN Listing  l ON oi.listing_id = l.listing_id
    JOIN `Order`  o ON oi.order_id   = o.order_id
    WHERE l.seller_id    = p_seller_id
      AND o.order_status = 'Delivered';

    RETURN v_revenue;
END$$

-- Admin report: every student (banned ones flagged, not hidden), earned vs pending revenue
DROP PROCEDURE IF EXISTS sp_admin_report$$

CREATE PROCEDURE sp_admin_report()
BEGIN
    DROP TEMPORARY TABLE IF EXISTS tmp_report;
    CREATE TEMPORARY TABLE tmp_report (
        student_id      INT,
        student_name    VARCHAR(100),
        floor_number    INT,
        is_banned       BOOLEAN,
        total_listings  INT,
        total_orders    INT,
        total_revenue   DECIMAL(12,2),
        pending_revenue DECIMAL(12,2)
    );

    BEGIN
        DECLARE done           INT DEFAULT FALSE;
        DECLARE v_student_id   INT;
        DECLARE v_student_name VARCHAR(100);
        DECLARE v_floor_number INT;
        DECLARE v_is_banned    BOOLEAN;

        DECLARE cur_students CURSOR FOR
            SELECT s.student_id, s.name, f.floor_number, s.is_banned
            FROM Student s
            JOIN Floor f ON s.floor_id = f.floor_id;

        DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

        OPEN cur_students;

        student_loop: LOOP
            FETCH cur_students INTO v_student_id, v_student_name, v_floor_number, v_is_banned;
            IF done THEN LEAVE student_loop; END IF;

            INSERT INTO tmp_report
            SELECT
                v_student_id,
                v_student_name,
                v_floor_number,
                v_is_banned,
                (SELECT COUNT(*) FROM Listing WHERE seller_id = v_student_id AND listing_status <> 'Removed'),
                (SELECT COUNT(*) FROM `Order` WHERE buyer_id  = v_student_id AND order_status <> 'Cancelled'),
                fn_get_seller_revenue(v_student_id),
                (SELECT COALESCE(SUM(oi.price_at_purchase * oi.quantity), 0.00)
                 FROM Order_Item oi
                 JOIN Listing l ON oi.listing_id = l.listing_id
                 JOIN `Order` o ON oi.order_id   = o.order_id
                 WHERE l.seller_id = v_student_id
                   AND o.order_status IN ('Placed', 'Confirmed'));
        END LOOP;

        CLOSE cur_students;
    END;

    SELECT * FROM tmp_report ORDER BY total_revenue DESC, pending_revenue DESC;
    DROP TEMPORARY TABLE IF EXISTS tmp_report;
END$$

-- ============================================================
--  sp_floor_priority_listings: also return item id + category
--  (the frontend used to guess the category from the item name)
-- ============================================================
DROP PROCEDURE IF EXISTS sp_floor_priority_listings$$

CREATE PROCEDURE sp_floor_priority_listings(
    IN p_buyer_floor_id INT
)
BEGIN
    DROP TEMPORARY TABLE IF EXISTS tmp_listings;
    CREATE TEMPORARY TABLE tmp_listings (
        listing_id          INT,
        item_id             INT,
        item_name           VARCHAR(150),
        category_name       VARCHAR(100),
        seller_id           INT,
        seller_name         VARCHAR(100),
        seller_floor        INT,
        seller_rating       DECIMAL(3,2),
        seller_rating_count INT,
        selling_price       DECIMAL(10,2),
        mrp                 DECIMAL(10,2),
        quantity_available  INT,
        description         TEXT,
        photo_url           LONGTEXT,
        room_number         VARCHAR(50),
        priority_rank       INT
    );

    BEGIN
        DECLARE done               INT DEFAULT FALSE;
        DECLARE v_listing_id       INT;
        DECLARE v_item_id          INT;
        DECLARE v_item_name        VARCHAR(150);
        DECLARE v_category_name    VARCHAR(100);
        DECLARE v_seller_id        INT;
        DECLARE v_seller_name      VARCHAR(100);
        DECLARE v_seller_floor_id  INT;
        DECLARE v_seller_floor_num INT;
        DECLARE v_rating           DECIMAL(3,2);
        DECLARE v_rating_count     INT;
        DECLARE v_selling_price    DECIMAL(10,2);
        DECLARE v_mrp              DECIMAL(10,2);
        DECLARE v_quantity         INT;
        DECLARE v_description      TEXT;
        DECLARE v_photo_url        LONGTEXT;
        DECLARE v_room_number      VARCHAR(50);
        DECLARE v_priority         INT;

        DECLARE cur_listings CURSOR FOR
            SELECT l.listing_id, i.item_id, i.item_name, c.category_name,
                   s.student_id, s.name, s.floor_id, f.floor_number,
                   s.avg_rating, s.rating_count,
                   l.selling_price, l.mrp, l.quantity_available, l.description, l.photo_url, l.room_number
            FROM Listing  l
            JOIN Student  s ON l.seller_id   = s.student_id
            JOIN Floor    f ON s.floor_id    = f.floor_id
            JOIN Item     i ON l.item_id     = i.item_id
            JOIN Category c ON i.category_id = c.category_id
            WHERE l.listing_status = 'Active'
              AND s.is_banned      = FALSE;

        DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

        OPEN cur_listings;

        read_loop: LOOP
            FETCH cur_listings INTO
                v_listing_id, v_item_id, v_item_name, v_category_name,
                v_seller_id, v_seller_name, v_seller_floor_id, v_seller_floor_num,
                v_rating, v_rating_count,
                v_selling_price, v_mrp, v_quantity, v_description, v_photo_url, v_room_number;

            IF done THEN LEAVE read_loop; END IF;

            IF v_seller_floor_id = p_buyer_floor_id THEN
                SET v_priority = 0;
            ELSE
                SET v_priority = 1;
            END IF;

            INSERT INTO tmp_listings VALUES (
                v_listing_id, v_item_id, v_item_name, v_category_name,
                v_seller_id, v_seller_name, v_seller_floor_num, v_rating, v_rating_count,
                v_selling_price, v_mrp, v_quantity, v_description, v_photo_url,
                v_room_number, v_priority
            );
        END LOOP;

        CLOSE cur_listings;
    END;

    SELECT * FROM tmp_listings ORDER BY priority_rank ASC, listing_id DESC;
    DROP TEMPORARY TABLE IF EXISTS tmp_listings;
END$$

DELIMITER ;
