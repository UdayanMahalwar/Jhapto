--  JHAPTO - feature migration v2: seller ratings & reviews, notifications
--  Run once, after jhapto_database.sql and jhapto_migrations.sql:
--    mysql -u root jhapto < jhapto-database/jhapto_migrations_v2.sql

USE jhapto;

-- ============================================================
--  TABLES
-- ============================================================

-- Seller rating summary, kept up to date by trg_review_after_insert
ALTER TABLE Student
    ADD COLUMN avg_rating   DECIMAL(3,2) NULL,
    ADD COLUMN rating_count INT NOT NULL DEFAULT 0;

-- One review per delivered order, written by the buyer about the seller
CREATE TABLE Review (
    review_id    INT AUTO_INCREMENT PRIMARY KEY,
    order_id     INT NOT NULL UNIQUE,
    reviewer_id  INT NOT NULL,
    seller_id    INT NOT NULL,
    rating       TINYINT NOT NULL,
    comment      VARCHAR(500),
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_review_rating CHECK (rating BETWEEN 1 AND 5),
    FOREIGN KEY (order_id)    REFERENCES `Order`(order_id)    ON DELETE CASCADE,
    FOREIGN KEY (reviewer_id) REFERENCES Student(student_id) ON DELETE CASCADE,
    FOREIGN KEY (seller_id)   REFERENCES Student(student_id) ON DELETE CASCADE,
    INDEX idx_review_seller (seller_id, created_at)
);

-- In-app notifications (created by triggers below)
CREATE TABLE Notification (
    notification_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id      INT NOT NULL,
    type            VARCHAR(30)  NOT NULL,
    message         VARCHAR(255) NOT NULL,
    link            VARCHAR(100),
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES Student(student_id) ON DELETE CASCADE,
    INDEX idx_notification_student (student_id, is_read, created_at)
);

DELIMITER $$

-- ============================================================
--  REVIEW TRIGGERS
-- ============================================================

-- Only the buyer of a Delivered order may review it; seller is filled in from the order
CREATE TRIGGER trg_review_validate
BEFORE INSERT ON Review
FOR EACH ROW
BEGIN
    DECLARE v_buyer  INT DEFAULT NULL;
    DECLARE v_seller INT DEFAULT NULL;
    DECLARE v_status VARCHAR(20) DEFAULT NULL;

    SELECT o.buyer_id, l.seller_id, o.order_status
      INTO v_buyer, v_seller, v_status
    FROM `Order` o
    JOIN Order_Item oi ON o.order_id    = oi.order_id
    JOIN Listing    l  ON oi.listing_id = l.listing_id
    WHERE o.order_id = NEW.order_id
    LIMIT 1;

    IF v_buyer IS NULL OR v_buyer <> NEW.reviewer_id THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'ERROR: Only the buyer of this order can review it.';
    END IF;

    IF v_status <> 'Delivered' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'ERROR: You can review an order only after it is delivered.';
    END IF;

    SET NEW.seller_id = v_seller;
END$$

-- Recompute the seller's average rating and notify them
CREATE TRIGGER trg_review_after_insert
AFTER INSERT ON Review
FOR EACH ROW
BEGIN
    UPDATE Student
    SET rating_count = (SELECT COUNT(*)    FROM Review WHERE seller_id = NEW.seller_id),
        avg_rating   = (SELECT AVG(rating) FROM Review WHERE seller_id = NEW.seller_id)
    WHERE student_id = NEW.seller_id;

    INSERT INTO Notification (student_id, type, message, link)
    SELECT NEW.seller_id, 'review',
           CONCAT(s.name, ' rated you ', NEW.rating, '/5 for order #', NEW.order_id),
           '/profile'
    FROM Student s WHERE s.student_id = NEW.reviewer_id;
END$$

-- ============================================================
--  NOTIFICATION TRIGGERS
-- ============================================================

-- Seller: a new order came in
CREATE TRIGGER trg_notify_new_order
AFTER INSERT ON Order_Item
FOR EACH ROW
BEGIN
    INSERT INTO Notification (student_id, type, message, link)
    SELECT l.seller_id, 'order_placed',
           CONCAT('New order #', NEW.order_id, ': ', NEW.quantity, ' x ', i.item_name),
           '/seller'
    FROM Listing l
    JOIN Item    i ON l.item_id = i.item_id
    WHERE l.listing_id = NEW.listing_id;
END$$

-- Buyer: order confirmed / delivered.  Seller: order cancelled.
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
                    '/orders');
        ELSEIF NEW.order_status = 'Cancelled' AND v_seller IS NOT NULL THEN
            INSERT INTO Notification (student_id, type, message, link)
            VALUES (v_seller, 'order_cancelled',
                    CONCAT('Order #', NEW.order_id, ' (', v_item, ') was cancelled by the buyer.'),
                    '/seller');
        END IF;
    END IF;
END$$

-- ============================================================
--  sp_floor_priority_listings: now also returns seller id + rating
-- ============================================================
DROP PROCEDURE IF EXISTS sp_floor_priority_listings$$

CREATE PROCEDURE sp_floor_priority_listings(
    IN p_buyer_floor_id INT
)
BEGIN
    DROP TEMPORARY TABLE IF EXISTS tmp_listings;
    CREATE TEMPORARY TABLE tmp_listings (
        listing_id          INT,
        item_name           VARCHAR(150),
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
        DECLARE v_item_name        VARCHAR(150);
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
            SELECT l.listing_id, i.item_name, s.student_id, s.name, s.floor_id, f.floor_number,
                   s.avg_rating, s.rating_count,
                   l.selling_price, l.mrp, l.quantity_available, l.description, l.photo_url, l.room_number
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
                v_listing_id, v_item_name, v_seller_id, v_seller_name,
                v_seller_floor_id, v_seller_floor_num, v_rating, v_rating_count,
                v_selling_price, v_mrp, v_quantity, v_description, v_photo_url, v_room_number;

            IF done THEN LEAVE read_loop; END IF;

            IF v_seller_floor_id = p_buyer_floor_id THEN
                SET v_priority = 0;
            ELSE
                SET v_priority = 1;
            END IF;

            INSERT INTO tmp_listings VALUES (
                v_listing_id, v_item_name, v_seller_id, v_seller_name,
                v_seller_floor_num, v_rating, v_rating_count,
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
