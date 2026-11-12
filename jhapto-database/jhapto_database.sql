
--  JHAPTO - Hostel Quick Commerce Database
--  UCS310 - DBMS Project | Thapar Institute of Engineering & Technology

CREATE DATABASE IF NOT EXISTS jhapto;
USE jhapto;

-- ============================================================
--  SECTION 1: TABLE DEFINITIONS (DDL)
-- ============================================================

-- TABLE 1: HOSTEL
CREATE TABLE Hostel (
    hostel_id     INT AUTO_INCREMENT PRIMARY KEY,
    hostel_name   VARCHAR(100) NOT NULL,
    hostel_code   VARCHAR(20)  NOT NULL UNIQUE
);

-- TABLE 2: FLOOR
CREATE TABLE Floor (
    floor_id      INT AUTO_INCREMENT PRIMARY KEY,
    floor_number  INT NOT NULL,
    hostel_id     INT NOT NULL,
    FOREIGN KEY (hostel_id) REFERENCES Hostel(hostel_id) ON DELETE CASCADE,
    UNIQUE (floor_number, hostel_id)
);

-- TABLE 3: ADMIN
CREATE TABLE Admin (
    admin_id      INT AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    email         VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- TABLE 4: STUDENT
CREATE TABLE Student (
    student_id    INT AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    email         VARCHAR(150) NOT NULL UNIQUE,
    phone_no      VARCHAR(15)  NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    hostel_id     INT NOT NULL,
    floor_id      INT NOT NULL,
    is_banned     BOOLEAN   DEFAULT FALSE,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (hostel_id) REFERENCES Hostel(hostel_id),
    FOREIGN KEY (floor_id)  REFERENCES Floor(floor_id)
);

-- TABLE 5: CATEGORY
CREATE TABLE Category (
    category_id   INT AUTO_INCREMENT PRIMARY KEY,
    category_name VARCHAR(100) NOT NULL UNIQUE
);

-- TABLE 6: ITEM
CREATE TABLE Item (
    item_id       INT AUTO_INCREMENT PRIMARY KEY,
    item_name     VARCHAR(150) NOT NULL,
    brand         VARCHAR(100),
    category_id   INT NOT NULL,
    FOREIGN KEY (category_id) REFERENCES Category(category_id)
);

-- TABLE 7: LISTING
CREATE TABLE Listing (
    listing_id         INT AUTO_INCREMENT PRIMARY KEY,
    seller_id          INT            NOT NULL,
    item_id            INT            NOT NULL,
    mrp                DECIMAL(10,2)  NOT NULL CHECK (mrp > 0),
    selling_price      DECIMAL(10,2)  NOT NULL CHECK (selling_price > 0),
    quantity_available INT            NOT NULL CHECK (quantity_available >= 0),
    description        TEXT,
    photo_url          VARCHAR(500),
    listing_status     ENUM('Active','OutOfStock','Removed') DEFAULT 'Active',
    created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (seller_id) REFERENCES Student(student_id),
    FOREIGN KEY (item_id)   REFERENCES Item(item_id)
);

-- TABLE 8: ORDER
CREATE TABLE `Order` (
    order_id      INT AUTO_INCREMENT PRIMARY KEY,
    buyer_id      INT           NOT NULL,
    order_status  ENUM('Placed','Confirmed','Delivered','Cancelled') DEFAULT 'Placed',
    total_amount  DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (buyer_id) REFERENCES Student(student_id)
);

-- TABLE 9: ORDER_ITEM
CREATE TABLE Order_Item (
    order_item_id     INT AUTO_INCREMENT PRIMARY KEY,
    order_id          INT           NOT NULL,
    listing_id        INT           NOT NULL,
    quantity          INT           NOT NULL CHECK (quantity > 0),
    price_at_purchase DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (order_id)   REFERENCES `Order`(order_id) ON DELETE CASCADE,
    FOREIGN KEY (listing_id) REFERENCES Listing(listing_id)
);

-- TABLE 10: MESSAGE (in-app chat between buyer and seller)
CREATE TABLE Message (
    message_id   INT AUTO_INCREMENT PRIMARY KEY,
    order_id     INT  NOT NULL,
    sender_id    INT  NOT NULL,
    receiver_id  INT  NOT NULL,
    message_text TEXT NOT NULL,
    sent_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id)    REFERENCES `Order`(order_id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id)   REFERENCES Student(student_id),
    FOREIGN KEY (receiver_id) REFERENCES Student(student_id)
);


-- ============================================================
--  SECTION 2: TRIGGERS  (PL/SQL - Compulsory)
-- ============================================================

DELIMITER $$

-- TRIGGER 1: Block selling price > 1.5x MRP on INSERT
CREATE TRIGGER trg_check_price_insert
BEFORE INSERT ON Listing
FOR EACH ROW
BEGIN
    IF NEW.selling_price > 1.5 * NEW.mrp THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'ERROR: Selling price cannot exceed 1.5x MRP.';
    END IF;
END$$

-- TRIGGER 2: Block selling price > 1.5x MRP on UPDATE
CREATE TRIGGER trg_check_price_update
BEFORE UPDATE ON Listing
FOR EACH ROW
BEGIN
    IF NEW.selling_price > 1.5 * NEW.mrp THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'ERROR: Selling price cannot exceed 1.5x MRP.';
    END IF;
END$$

-- TRIGGER 3: Block new listing if student already has Active listing for same item
CREATE TRIGGER trg_one_active_listing
BEFORE INSERT ON Listing
FOR EACH ROW
BEGIN
    DECLARE active_count INT;
    SELECT COUNT(*) INTO active_count
    FROM Listing
    WHERE seller_id      = NEW.seller_id
      AND item_id        = NEW.item_id
      AND listing_status = 'Active';

    IF active_count > 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'ERROR: You already have an Active listing for this item.';
    END IF;
END$$

-- TRIGGER 4: Auto-mark listing OutOfStock when quantity drops to 0
CREATE TRIGGER trg_auto_out_of_stock
AFTER UPDATE ON Listing
FOR EACH ROW
BEGIN
    IF NEW.quantity_available = 0 AND NEW.listing_status = 'Active' THEN
        UPDATE Listing
        SET listing_status = 'OutOfStock'
        WHERE listing_id = NEW.listing_id;
    END IF;
END$$

-- TRIGGER 5: Block cancellation if order is already Confirmed or beyond
CREATE TRIGGER trg_cancel_only_if_placed
BEFORE UPDATE ON `Order`
FOR EACH ROW
BEGIN
    IF NEW.order_status = 'Cancelled' AND OLD.order_status != 'Placed' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'ERROR: Order can only be cancelled before seller confirms it.';
    END IF;
END$$

-- TRIGGER 6: Deduct stock when an Order_Item is inserted
CREATE TRIGGER trg_deduct_stock_on_order
BEFORE INSERT ON Order_Item
FOR EACH ROW
BEGIN
    DECLARE v_available INT;
    SELECT quantity_available INTO v_available
    FROM Listing WHERE listing_id = NEW.listing_id;

    IF v_available < NEW.quantity THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'ERROR: Insufficient stock for this listing.';
    END IF;

    UPDATE Listing
    SET quantity_available = quantity_available - NEW.quantity
    WHERE listing_id = NEW.listing_id;
END$$

-- TRIGGER 7: Restore stock when an order is cancelled
CREATE TRIGGER trg_restore_stock_on_cancel
AFTER UPDATE ON `Order`
FOR EACH ROW
BEGIN
    IF NEW.order_status = 'Cancelled' AND OLD.order_status = 'Placed' THEN
        UPDATE Listing l
        JOIN Order_Item oi ON l.listing_id = oi.listing_id
        SET l.quantity_available = l.quantity_available + oi.quantity,
            l.listing_status     = 'Active'
        WHERE oi.order_id = NEW.order_id;
    END IF;
END$$

DELIMITER ;


-- ============================================================
--  SECTION 3: FUNCTIONS  (PL/SQL - Compulsory)
-- ============================================================

DELIMITER $$

-- FUNCTION 1: fn_is_price_valid
-- Returns 1 if selling_price <= 1.5 * mrp, else returns 0
-- Example: SELECT fn_is_price_valid(20.00, 25.00);
CREATE FUNCTION fn_is_price_valid(
    p_mrp           DECIMAL(10,2),
    p_selling_price DECIMAL(10,2)
)
RETURNS TINYINT
DETERMINISTIC
BEGIN
    IF p_selling_price <= 1.5 * p_mrp THEN
        RETURN 1;
    ELSE
        RETURN 0;
    END IF;
END$$

-- FUNCTION 2: fn_check_stock
-- Returns available quantity for a listing
-- Returns -1 if listing does not exist or is not Active
-- Example: SELECT fn_check_stock(1);
CREATE FUNCTION fn_check_stock(
    p_listing_id INT
)
RETURNS INT
DETERMINISTIC
BEGIN
    DECLARE v_qty    INT DEFAULT -1;
    DECLARE v_status VARCHAR(20);

    SELECT quantity_available, listing_status
    INTO v_qty, v_status
    FROM Listing
    WHERE listing_id = p_listing_id;

    IF v_status != 'Active' THEN
        RETURN -1;
    END IF;

    RETURN v_qty;
END$$

-- FUNCTION 3: fn_get_seller_revenue
-- Returns total revenue earned by a seller (excludes cancelled orders)
-- Example: SELECT fn_get_seller_revenue(1);
CREATE FUNCTION fn_get_seller_revenue(
    p_seller_id INT
)
RETURNS DECIMAL(12,2)
DETERMINISTIC
BEGIN
    DECLARE v_revenue DECIMAL(12,2) DEFAULT 0.00;

    SELECT COALESCE(SUM(oi.price_at_purchase * oi.quantity), 0.00)
    INTO v_revenue
    FROM Order_Item oi
    JOIN Listing  l ON oi.listing_id = l.listing_id
    JOIN `Order`  o ON oi.order_id   = o.order_id
    WHERE l.seller_id    = p_seller_id
      AND o.order_status != 'Cancelled';

    RETURN v_revenue;
END$$

DELIMITER ;


-- ============================================================
--  SECTION 4: STORED PROCEDURES WITH CURSORS  (PL/SQL - Compulsory)
-- ============================================================

DELIMITER $$

-- PROCEDURE 1: place_order
-- Places a complete order atomically using a transaction
-- Calls fn_check_stock() to validate before proceeding
-- Example: CALL place_order(3, 2, 1, @oid, @msg);
--          SELECT @oid, @msg;
CREATE PROCEDURE place_order(
    IN  p_buyer_id   INT,
    IN  p_listing_id INT,
    IN  p_quantity   INT,
    OUT p_order_id   INT,
    OUT p_message    VARCHAR(255)
)
BEGIN
    DECLARE v_price  DECIMAL(10,2);
    DECLARE v_total  DECIMAL(10,2);
    DECLARE v_stock  INT;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_order_id = -1;
        SET p_message  = 'ERROR: Order failed. Transaction rolled back.';
    END;

    SET v_stock = fn_check_stock(p_listing_id);

    IF v_stock = -1 THEN
        SET p_order_id = -1;
        SET p_message  = 'ERROR: Listing is not active or does not exist.';
    ELSEIF v_stock < p_quantity THEN
        SET p_order_id = -1;
        SET p_message  = 'ERROR: Not enough stock available.';
    ELSE
        SELECT selling_price INTO v_price
        FROM Listing WHERE listing_id = p_listing_id;

        SET v_total = v_price * p_quantity;

        START TRANSACTION;

            INSERT INTO `Order` (buyer_id, order_status, total_amount)
            VALUES (p_buyer_id, 'Placed', v_total);

            SET p_order_id = LAST_INSERT_ID();

            INSERT INTO Order_Item (order_id, listing_id, quantity, price_at_purchase)
            VALUES (p_order_id, p_listing_id, p_quantity, v_price);

        COMMIT;

        SET p_message = 'SUCCESS: Order placed successfully.';
    END IF;
END$$


-- PROCEDURE 2: sp_floor_priority_listings
-- Uses an EXPLICIT CURSOR to fetch all active listings and
-- applies floor-based priority (same floor shown first)
-- Example: CALL sp_floor_priority_listings(1);
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
        photo_url          VARCHAR(500),
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
        DECLARE v_photo_url      VARCHAR(500);
        DECLARE v_priority       INT;

        -- EXPLICIT CURSOR: iterates all active listings
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

            -- 0 = same floor (priority), 1 = other floors
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
END$$


-- PROCEDURE 3: sp_admin_report
-- Uses an EXPLICIT CURSOR to loop through all students and
-- build a full report: listings count, orders count, revenue
-- Internally calls fn_get_seller_revenue() function
-- Example: CALL sp_admin_report();
CREATE PROCEDURE sp_admin_report()
BEGIN
    DROP TEMPORARY TABLE IF EXISTS tmp_report;
    CREATE TEMPORARY TABLE tmp_report (
        student_id     INT,
        student_name   VARCHAR(100),
        floor_number   INT,
        total_listings INT,
        total_orders   INT,
        total_revenue  DECIMAL(12,2)
    );

    BEGIN
        DECLARE done           INT DEFAULT FALSE;
        DECLARE v_student_id   INT;
        DECLARE v_student_name VARCHAR(100);
        DECLARE v_floor_number INT;

        -- EXPLICIT CURSOR: loops through every student
        DECLARE cur_students CURSOR FOR
            SELECT s.student_id, s.name, f.floor_number
            FROM Student s
            JOIN Floor f ON s.floor_id = f.floor_id
            WHERE s.is_banned = FALSE;

        DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

        OPEN cur_students;

        student_loop: LOOP
            FETCH cur_students INTO v_student_id, v_student_name, v_floor_number;
            IF done THEN LEAVE student_loop; END IF;

            INSERT INTO tmp_report
            SELECT
                v_student_id,
                v_student_name,
                v_floor_number,
                (SELECT COUNT(*) FROM Listing    WHERE seller_id = v_student_id),
                (SELECT COUNT(*) FROM `Order`    WHERE buyer_id  = v_student_id
                 AND order_status != 'Cancelled'),
                fn_get_seller_revenue(v_student_id);
        END LOOP;

        CLOSE cur_students;
    END;

    SELECT * FROM tmp_report ORDER BY total_revenue DESC;
    DROP TEMPORARY TABLE IF EXISTS tmp_report;
END$$

DELIMITER ;


-- ============================================================
--  SECTION 5: VIEWS
-- ============================================================

CREATE VIEW vw_active_listings AS
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
    l.created_at
FROM Listing  l
JOIN Student  s ON l.seller_id   = s.student_id
JOIN Floor    f ON s.floor_id    = f.floor_id
JOIN Item     i ON l.item_id     = i.item_id
JOIN Category c ON i.category_id = c.category_id
WHERE l.listing_status = 'Active' AND s.is_banned = FALSE;

CREATE VIEW vw_order_history AS
SELECT
    o.order_id,
    s.name          AS buyer_name,
    i.item_name,
    oi.quantity,
    oi.price_at_purchase,
    o.total_amount,
    o.order_status,
    o.created_at
FROM `Order`    o
JOIN Order_Item oi ON o.order_id    = oi.order_id
JOIN Listing    l  ON oi.listing_id = l.listing_id
JOIN Item       i  ON l.item_id     = i.item_id
JOIN Student    s  ON o.buyer_id    = s.student_id;

CREATE VIEW vw_admin_listings AS
SELECT
    l.listing_id,
    s.name         AS seller_name,
    s.email        AS seller_email,
    f.floor_number AS seller_floor,
    i.item_name,
    l.mrp,
    l.selling_price,
    fn_is_price_valid(l.mrp, l.selling_price) AS price_is_valid,
    l.quantity_available,
    l.listing_status,
    l.created_at
FROM Listing  l
JOIN Student  s ON l.seller_id = s.student_id
JOIN Floor    f ON s.floor_id  = f.floor_id
JOIN Item     i ON l.item_id   = i.item_id;


-- ============================================================
--  SECTION 6: SAMPLE DATA
-- ============================================================

INSERT INTO Hostel (hostel_name, hostel_code)
VALUES ('Kailash Hostel', 'KH01');

INSERT INTO Floor (floor_number, hostel_id)
VALUES (1,1),(2,1),(3,1),(4,1),(5,1),(6,1);

INSERT INTO Admin (name, email, password_hash)
VALUES ('Admin Jhapto', 'admin@jhapto.com', 'hashed_admin_password');

INSERT INTO Student (name, email, phone_no, password_hash, hostel_id, floor_id)
VALUES
('Aarav Sharma', 'aarav@tiet.ac.in', '9876543210', 'hash1', 1, 1),
('Priya Mehta',  'priya@tiet.ac.in', '9876543211', 'hash2', 1, 1),
('Rohan Verma',  'rohan@tiet.ac.in', '9876543212', 'hash3', 1, 2),
('Sneha Gupta',  'sneha@tiet.ac.in', '9876543213', 'hash4', 1, 3),
('Karan Singh',  'karan@tiet.ac.in', '9876543214', 'hash5', 1, 4);

INSERT INTO Category (category_name) VALUES ('Snacks & Food');

INSERT INTO Item (item_name, brand, category_id)
VALUES
('Lays Classic Salted',     'Lays',    1),
('Maggi Noodles 2-min',     'Maggi',   1),
('Dark Fantasy Choco Fills','Sunfeast', 1),
('Amul Kool Milk',          'Amul',    1),
('Kurkure Masala Munch',    'Kurkure', 1);

INSERT INTO Listing (seller_id, item_id, mrp, selling_price, quantity_available, description, photo_url)
VALUES
(1, 1, 20.00, 22.00, 5,  'Fresh pack, bought yesterday', '/photos/lays.jpg'),
(2, 2, 14.00, 15.00, 3,  'Masala flavor available',      '/photos/maggi.jpg'),
(3, 3, 50.00, 55.00, 2,  'Sealed pack',                  '/photos/darkfantasy.jpg'),
(4, 4, 30.00, 30.00, 10, 'Cold, just from canteen',      '/photos/amulkool.jpg'),
(5, 5, 20.00, 20.00, 7,  'Full party pack',              '/photos/kurkure.jpg');

INSERT INTO `Order` (buyer_id, order_status, total_amount)
VALUES
(3, 'Delivered', 22.00),
(1, 'Placed',    15.00),
(2, 'Confirmed', 30.00);

INSERT INTO Order_Item (order_id, listing_id, quantity, price_at_purchase)
VALUES
(1, 1, 1, 22.00),
(2, 2, 1, 15.00),
(3, 4, 1, 30.00);

INSERT INTO Message (order_id, sender_id, receiver_id, message_text)
VALUES
(2, 1, 2, 'Hi! I ordered Maggi. When can I pick it up?'),
(2, 2, 1, 'Come to room 204 after 6 PM!');


-- ============================================================
--  SECTION 7: TEST / VERIFICATION QUERIES
-- ============================================================

-- View all active listings
SELECT * FROM vw_active_listings;

-- View all orders
SELECT * FROM vw_order_history;

-- Admin listings panel (with price validity column)
SELECT * FROM vw_admin_listings;

-- Test Function 1: MRP=20, Price=25 → INVALID (returns 0)
SELECT fn_is_price_valid(20.00, 25.00) AS is_valid;

-- Test Function 2: Stock for listing 1
SELECT fn_check_stock(1) AS stock_available;

-- Test Function 3: Revenue for student 1
SELECT fn_get_seller_revenue(1) AS revenue;

-- Test Cursor Procedure 1: Floor-priority for buyer on floor 1
CALL sp_floor_priority_listings(1);

-- Test Cursor Procedure 2: Full admin report
CALL sp_admin_report();

-- Test place_order Procedure
CALL place_order(3, 5, 2, @order_id, @msg);
SELECT @order_id AS new_order_id, @msg AS result_message;

-- Test Trigger (uncomment to verify price trigger fires):
-- INSERT INTO Listing (seller_id, item_id, mrp, selling_price, quantity_available)
-- VALUES (1, 3, 20.00, 40.00, 5);  -- Should FAIL: 40 > 1.5 * 20