--  JHAPTO - Hostel Quick Commerce Database (PostgreSQL edition)
--  Same design as the MySQL scripts in ../ (base schema + migrations v1–v4),
--  rewritten for PostgreSQL so the app can run on free hosting (Neon + Vercel).
--  Triggers, functions, cursor procedures and views are kept as database logic.
--
--  Apply to an empty database:
--    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f jhapto-database/postgres/jhapto_postgres.sql
--  (or `npm run db:setup -- --reset`, which drops and recreates the public schema first)

-- ============================================================
--  SECTION 1: TABLES
--  "Order" is a reserved word, so that table name is always quoted.
-- ============================================================

CREATE TABLE hostel (
    hostel_id     SERIAL PRIMARY KEY,
    hostel_name   VARCHAR(100) NOT NULL,
    hostel_code   VARCHAR(20)  NOT NULL UNIQUE
);

CREATE TABLE floor (
    floor_id      SERIAL PRIMARY KEY,
    floor_number  INT NOT NULL,
    hostel_id     INT NOT NULL REFERENCES hostel(hostel_id) ON DELETE CASCADE,
    UNIQUE (floor_number, hostel_id)
);

CREATE TABLE admin (
    admin_id      SERIAL PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    email         VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE student (
    student_id    SERIAL PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    email         VARCHAR(150) NOT NULL UNIQUE,
    phone_no      VARCHAR(15)  NOT NULL UNIQUE,
    password_hash VARCHAR(255),                       -- NULL for Google-only accounts
    google_sub    VARCHAR(64) UNIQUE,                 -- Google account id (sign in with Google)
    hostel_id     INT NOT NULL REFERENCES hostel(hostel_id),
    floor_id      INT NOT NULL REFERENCES floor(floor_id),
    is_banned     BOOLEAN NOT NULL DEFAULT FALSE,
    email_notifications BOOLEAN NOT NULL DEFAULT TRUE,
    avg_rating    NUMERIC(3,2),                       -- maintained by trg_review_after_insert
    rating_count  INT NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE category (
    category_id   SERIAL PRIMARY KEY,
    category_name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE item (
    item_id       SERIAL PRIMARY KEY,
    item_name     VARCHAR(150) NOT NULL,
    brand         VARCHAR(100),
    category_id   INT NOT NULL REFERENCES category(category_id),
    created_by    INT REFERENCES student(student_id) ON DELETE SET NULL,   -- NULL = catalogue item
    created_at    TIMESTAMPTZ DEFAULT now()
);
-- One catalogue entry per name + brand, whatever the capitalisation
CREATE UNIQUE INDEX uq_item_name_brand ON item (lower(item_name), lower(coalesce(brand, '')));

CREATE TABLE listing (
    listing_id         SERIAL PRIMARY KEY,
    seller_id          INT           NOT NULL REFERENCES student(student_id),
    item_id            INT           NOT NULL REFERENCES item(item_id),
    mrp                NUMERIC(10,2) NOT NULL CHECK (mrp > 0),
    selling_price      NUMERIC(10,2) NOT NULL CHECK (selling_price > 0),
    quantity_available INT           NOT NULL CHECK (quantity_available >= 0),
    description        TEXT,
    photo_url          TEXT,
    room_number        VARCHAR(50),
    listing_status     VARCHAR(12)   NOT NULL DEFAULT 'Active'
                       CHECK (listing_status IN ('Active', 'OutOfStock', 'Removed')),
    created_at         TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE "Order" (
    order_id      SERIAL PRIMARY KEY,
    buyer_id      INT           NOT NULL REFERENCES student(student_id),
    order_status  VARCHAR(10)   NOT NULL DEFAULT 'Placed'
                  CHECK (order_status IN ('Placed', 'Confirmed', 'Delivered', 'Cancelled')),
    total_amount  NUMERIC(10,2) NOT NULL CHECK (total_amount >= 0),
    created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE order_item (
    order_item_id     SERIAL PRIMARY KEY,
    order_id          INT           NOT NULL REFERENCES "Order"(order_id) ON DELETE CASCADE,
    listing_id        INT           NOT NULL REFERENCES listing(listing_id),
    quantity          INT           NOT NULL CHECK (quantity > 0),
    price_at_purchase NUMERIC(10,2) NOT NULL
);

CREATE TABLE message (
    message_id   SERIAL PRIMARY KEY,
    order_id     INT  NOT NULL REFERENCES "Order"(order_id) ON DELETE CASCADE,
    sender_id    INT  NOT NULL REFERENCES student(student_id),
    receiver_id  INT  NOT NULL REFERENCES student(student_id),
    message_text TEXT NOT NULL,
    is_read      BOOLEAN NOT NULL DEFAULT FALSE,
    sent_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE report (
    report_id        SERIAL PRIMARY KEY,
    order_id         INT NOT NULL REFERENCES "Order"(order_id)     ON DELETE CASCADE,
    reporter_id      INT NOT NULL REFERENCES student(student_id)   ON DELETE CASCADE,
    reported_user_id INT NOT NULL REFERENCES student(student_id)   ON DELETE CASCADE,
    reason           TEXT NOT NULL,
    proof_url        TEXT,
    status           VARCHAR(50) NOT NULL DEFAULT 'Pending',
    created_at       TIMESTAMPTZ DEFAULT now()
);

-- Conversation between the student who filed a report and the admins
CREATE TABLE report_message (
    report_message_id SERIAL PRIMARY KEY,
    report_id         INT NOT NULL REFERENCES report(report_id) ON DELETE CASCADE,
    sender_role       VARCHAR(7) NOT NULL CHECK (sender_role IN ('student', 'admin')),
    student_id        INT REFERENCES student(student_id) ON DELETE CASCADE,
    admin_id          INT REFERENCES admin(admin_id) ON DELETE SET NULL,
    message_text      TEXT NOT NULL,
    created_at        TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_report_message_report ON report_message (report_id, created_at);

-- Firebase Cloud Messaging device tokens (Android app + browsers)
CREATE TABLE push_token (
    token       VARCHAR(512) PRIMARY KEY,
    student_id  INT NOT NULL REFERENCES student(student_id) ON DELETE CASCADE,
    platform    VARCHAR(10) NOT NULL CHECK (platform IN ('android', 'web')),
    updated_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_push_token_student ON push_token (student_id);

CREATE TABLE review (
    review_id    SERIAL PRIMARY KEY,
    order_id     INT NOT NULL UNIQUE REFERENCES "Order"(order_id) ON DELETE CASCADE,
    reviewer_id  INT NOT NULL REFERENCES student(student_id) ON DELETE CASCADE,
    seller_id    INT NOT NULL REFERENCES student(student_id) ON DELETE CASCADE,
    rating       SMALLINT NOT NULL,
    comment      VARCHAR(500),
    created_at   TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT chk_review_rating CHECK (rating BETWEEN 1 AND 5)
);
CREATE INDEX idx_review_seller ON review (seller_id, created_at);

CREATE TABLE notification (
    notification_id SERIAL PRIMARY KEY,
    student_id      INT NOT NULL REFERENCES student(student_id) ON DELETE CASCADE,
    type            VARCHAR(30)  NOT NULL,
    message         VARCHAR(255) NOT NULL,
    link            VARCHAR(100),
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    delivered       BOOLEAN NOT NULL DEFAULT FALSE,   -- sent by email / push yet?
    created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_notification_undelivered ON notification (notification_id) WHERE NOT delivered;
CREATE INDEX idx_notification_student ON notification (student_id, is_read, created_at);

-- Uploaded images (UPLOAD_STORAGE=db, used on Vercel where there is no disk)
CREATE TABLE upload (
    name        VARCHAR(64) PRIMARY KEY,
    mime_type   VARCHAR(32) NOT NULL,
    data        BYTEA       NOT NULL,
    uploaded_by INT REFERENCES student(student_id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ DEFAULT now()
);


-- ============================================================
--  SECTION 2: FUNCTIONS
-- ============================================================

-- FUNCTION 1: selling price may not exceed 1.5 × MRP
CREATE FUNCTION fn_is_price_valid(p_mrp NUMERIC, p_selling_price NUMERIC)
RETURNS BOOLEAN
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
    RETURN p_selling_price <= 1.5 * p_mrp;
END;
$$;

-- FUNCTION 2: available quantity of an Active listing, -1 if missing / not Active
CREATE FUNCTION fn_check_stock(p_listing_id INT)
RETURNS INT
LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_qty    INT;
    v_status VARCHAR(12);
BEGIN
    SELECT quantity_available, listing_status INTO v_qty, v_status
    FROM listing WHERE listing_id = p_listing_id;
    IF v_status IS DISTINCT FROM 'Active' THEN
        RETURN -1;
    END IF;
    RETURN v_qty;
END;
$$;

-- FUNCTION 3: revenue earned by a seller (Delivered orders only)
CREATE FUNCTION fn_get_seller_revenue(p_seller_id INT)
RETURNS NUMERIC(12,2)
LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_revenue NUMERIC(12,2);
BEGIN
    SELECT COALESCE(SUM(oi.price_at_purchase * oi.quantity), 0.00) INTO v_revenue
    FROM order_item oi
    JOIN listing l ON oi.listing_id = l.listing_id
    JOIN "Order" o ON oi.order_id   = o.order_id
    WHERE l.seller_id = p_seller_id
      AND o.order_status = 'Delivered';
    RETURN v_revenue;
END;
$$;


-- ============================================================
--  SECTION 3: TRIGGERS
--  Errors use SQLSTATE 45000 like the MySQL version, so the API can tell
--  business-rule violations apart from real failures.
-- ============================================================

-- TRIGGERS 1 & 2: block selling price > 1.5 × MRP on insert and update
CREATE FUNCTION trg_check_price() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.selling_price > 1.5 * NEW.mrp THEN
        RAISE EXCEPTION 'ERROR: Selling price cannot exceed 1.5x MRP.' USING ERRCODE = '45000';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_check_price_insert BEFORE INSERT ON listing FOR EACH ROW EXECUTE FUNCTION trg_check_price();
CREATE TRIGGER trg_check_price_update BEFORE UPDATE ON listing FOR EACH ROW EXECUTE FUNCTION trg_check_price();

-- TRIGGER 3: one Active listing per item per seller
CREATE FUNCTION trg_one_active_listing() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM listing
               WHERE seller_id = NEW.seller_id AND item_id = NEW.item_id AND listing_status = 'Active') THEN
        RAISE EXCEPTION 'ERROR: You already have an Active listing for this item.' USING ERRCODE = '45000';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_one_active_listing BEFORE INSERT ON listing FOR EACH ROW EXECUTE FUNCTION trg_one_active_listing();

-- TRIGGER 4: an Active listing whose stock reaches 0 becomes OutOfStock
CREATE FUNCTION trg_auto_out_of_stock() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.quantity_available = 0 AND NEW.listing_status = 'Active' THEN
        NEW.listing_status := 'OutOfStock';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_auto_out_of_stock BEFORE UPDATE ON listing FOR EACH ROW EXECUTE FUNCTION trg_auto_out_of_stock();

-- TRIGGER 5: orders can only be cancelled while still Placed
CREATE FUNCTION trg_cancel_only_if_placed() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.order_status = 'Cancelled' AND OLD.order_status <> 'Placed' THEN
        RAISE EXCEPTION 'ERROR: Order can only be cancelled before seller confirms it.' USING ERRCODE = '45000';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_cancel_only_if_placed BEFORE UPDATE ON "Order" FOR EACH ROW EXECUTE FUNCTION trg_cancel_only_if_placed();

-- TRIGGER 6: deduct stock when an order line is inserted (and re-check it)
CREATE FUNCTION trg_deduct_stock_on_order() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_available INT;
BEGIN
    SELECT quantity_available INTO v_available FROM listing WHERE listing_id = NEW.listing_id;
    IF v_available < NEW.quantity THEN
        RAISE EXCEPTION 'ERROR: Insufficient stock for this listing.' USING ERRCODE = '45000';
    END IF;
    UPDATE listing SET quantity_available = quantity_available - NEW.quantity WHERE listing_id = NEW.listing_id;
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_deduct_stock_on_order BEFORE INSERT ON order_item FOR EACH ROW EXECUTE FUNCTION trg_deduct_stock_on_order();

-- TRIGGER 7: give the stock back when a Placed order is cancelled
CREATE FUNCTION trg_restore_stock_on_cancel() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.order_status = 'Cancelled' AND OLD.order_status = 'Placed' THEN
        UPDATE listing l
        SET quantity_available = l.quantity_available + oi.quantity,
            listing_status     = 'Active'
        FROM order_item oi
        WHERE oi.listing_id = l.listing_id AND oi.order_id = NEW.order_id;
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_restore_stock_on_cancel AFTER UPDATE ON "Order" FOR EACH ROW EXECUTE FUNCTION trg_restore_stock_on_cancel();

-- TRIGGER 8: only the buyer of a Delivered order may review it; seller filled in from the order
CREATE FUNCTION trg_review_validate() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_buyer  INT;
    v_seller INT;
    v_status VARCHAR(10);
BEGIN
    SELECT o.buyer_id, l.seller_id, o.order_status INTO v_buyer, v_seller, v_status
    FROM "Order" o
    JOIN order_item oi ON o.order_id = oi.order_id
    JOIN listing l     ON oi.listing_id = l.listing_id
    WHERE o.order_id = NEW.order_id
    LIMIT 1;

    IF v_buyer IS NULL OR v_buyer <> NEW.reviewer_id THEN
        RAISE EXCEPTION 'ERROR: Only the buyer of this order can review it.' USING ERRCODE = '45000';
    END IF;
    IF v_status <> 'Delivered' THEN
        RAISE EXCEPTION 'ERROR: You can review an order only after it is delivered.' USING ERRCODE = '45000';
    END IF;
    NEW.seller_id := v_seller;
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_review_validate BEFORE INSERT ON review FOR EACH ROW EXECUTE FUNCTION trg_review_validate();

-- TRIGGER 9: recompute the seller's average rating and notify them
CREATE FUNCTION trg_review_after_insert() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    UPDATE student
    SET rating_count = (SELECT COUNT(*)    FROM review WHERE seller_id = NEW.seller_id),
        avg_rating   = (SELECT AVG(rating) FROM review WHERE seller_id = NEW.seller_id)
    WHERE student_id = NEW.seller_id;

    INSERT INTO notification (student_id, type, message, link)
    SELECT NEW.seller_id, 'review',
           s.name || ' rated you ' || NEW.rating || '/5 for order #' || NEW.order_id,
           '/profile'
    FROM student s WHERE s.student_id = NEW.reviewer_id;
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_review_after_insert AFTER INSERT ON review FOR EACH ROW EXECUTE FUNCTION trg_review_after_insert();

-- TRIGGER 10: tell the seller about a new order
CREATE FUNCTION trg_notify_new_order() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO notification (student_id, type, message, link)
    SELECT l.seller_id, 'order_placed',
           'New order #' || NEW.order_id || ': ' || NEW.quantity || ' x ' || i.item_name,
           '/seller'
    FROM listing l JOIN item i ON l.item_id = i.item_id
    WHERE l.listing_id = NEW.listing_id;
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_notify_new_order AFTER INSERT ON order_item FOR EACH ROW EXECUTE FUNCTION trg_notify_new_order();

-- TRIGGER 11: buyer hears about confirm / deliver, seller about cancel
CREATE FUNCTION trg_notify_order_status() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_seller INT;
    v_item   VARCHAR(150) := 'your item';
BEGIN
    IF NEW.order_status IS DISTINCT FROM OLD.order_status THEN
        SELECT l.seller_id, i.item_name INTO v_seller, v_item
        FROM order_item oi
        JOIN listing l ON oi.listing_id = l.listing_id
        JOIN item i    ON l.item_id     = i.item_id
        WHERE oi.order_id = NEW.order_id
        LIMIT 1;

        IF NEW.order_status = 'Confirmed' THEN
            INSERT INTO notification (student_id, type, message, link)
            VALUES (NEW.buyer_id, 'order_confirmed',
                    'Order #' || NEW.order_id || ' (' || v_item || ') was confirmed. You can now chat with the seller.',
                    '/chat/' || NEW.order_id);
        ELSIF NEW.order_status = 'Delivered' THEN
            INSERT INTO notification (student_id, type, message, link)
            VALUES (NEW.buyer_id, 'order_delivered',
                    'Order #' || NEW.order_id || ' (' || v_item || ') was delivered. Rate your seller!',
                    '/orders?tab=history');
        ELSIF NEW.order_status = 'Cancelled' AND v_seller IS NOT NULL THEN
            INSERT INTO notification (student_id, type, message, link)
            VALUES (v_seller, 'order_cancelled',
                    'Order #' || NEW.order_id || ' (' || v_item || ') was cancelled by the buyer.',
                    '/seller?tab=history');
        END IF;
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_notify_order_status AFTER UPDATE ON "Order" FOR EACH ROW EXECUTE FUNCTION trg_notify_order_status();


-- ============================================================
--  SECTION 4: PROCEDURES (as set-returning functions)
--  PostgreSQL procedures can't return result sets, so these are functions
--  called with SELECT * FROM ...; they still walk explicit cursors like MySQL.
-- ============================================================

-- place_order: validate with fn_check_stock, insert the order + line, return (order_id, message).
-- Runs inside the caller's transaction; a failure returns order_id = -1 and changes nothing.
CREATE FUNCTION place_order(p_buyer_id INT, p_listing_id INT, p_quantity INT)
RETURNS TABLE (order_id INT, message TEXT)
LANGUAGE plpgsql AS $$
DECLARE
    v_stock    INT;
    v_price    NUMERIC(10,2);
    v_order_id INT;
BEGIN
    v_stock := fn_check_stock(p_listing_id);
    IF v_stock = -1 THEN
        RETURN QUERY SELECT -1, 'ERROR: Listing is not active or does not exist.'::TEXT;
        RETURN;
    ELSIF v_stock < p_quantity THEN
        RETURN QUERY SELECT -1, 'ERROR: Not enough stock available.'::TEXT;
        RETURN;
    END IF;

    SELECT selling_price INTO v_price FROM listing WHERE listing_id = p_listing_id;

    BEGIN
        INSERT INTO "Order" (buyer_id, order_status, total_amount)
        VALUES (p_buyer_id, 'Placed', v_price * p_quantity)
        RETURNING "Order".order_id INTO v_order_id;

        INSERT INTO order_item (order_id, listing_id, quantity, price_at_purchase)
        VALUES (v_order_id, p_listing_id, p_quantity, v_price);
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT -1, 'ERROR: Order failed. Transaction rolled back.'::TEXT;
        RETURN;
    END;

    RETURN QUERY SELECT v_order_id, 'SUCCESS: Order placed successfully.'::TEXT;
END;
$$;

-- sp_floor_priority_listings: active listings, same-floor sellers first.
-- Walks an explicit cursor and returns each row (RETURN NEXT).
CREATE FUNCTION sp_floor_priority_listings(p_buyer_floor_id INT)
RETURNS TABLE (
    listing_id          INT,
    item_id             INT,
    item_name           VARCHAR(150),
    category_name       VARCHAR(100),
    seller_id           INT,
    seller_name         VARCHAR(100),
    seller_floor        INT,
    seller_rating       NUMERIC(3,2),
    seller_rating_count INT,
    selling_price       NUMERIC(10,2),
    mrp                 NUMERIC(10,2),
    quantity_available  INT,
    description         TEXT,
    photo_url           TEXT,
    room_number         VARCHAR(50),
    priority_rank       INT
)
LANGUAGE plpgsql STABLE AS $$
DECLARE
    rec RECORD;
    cur_listings CURSOR FOR
        SELECT l.listing_id, i.item_id, i.item_name, c.category_name,
               s.student_id, s.name, s.floor_id, f.floor_number,
               s.avg_rating, s.rating_count,
               l.selling_price, l.mrp, l.quantity_available, l.description, l.photo_url, l.room_number
        FROM listing  l
        JOIN student  s ON l.seller_id   = s.student_id
        JOIN floor    f ON s.floor_id    = f.floor_id
        JOIN item     i ON l.item_id     = i.item_id
        JOIN category c ON i.category_id = c.category_id
        WHERE l.listing_status = 'Active' AND s.is_banned = FALSE
        ORDER BY (s.floor_id <> p_buyer_floor_id), l.listing_id DESC;
BEGIN
    OPEN cur_listings;
    LOOP
        FETCH cur_listings INTO rec;
        EXIT WHEN NOT FOUND;
        listing_id          := rec.listing_id;
        item_id             := rec.item_id;
        item_name           := rec.item_name;
        category_name       := rec.category_name;
        seller_id           := rec.student_id;
        seller_name         := rec.name;
        seller_floor        := rec.floor_number;
        seller_rating       := rec.avg_rating;
        seller_rating_count := rec.rating_count;
        selling_price       := rec.selling_price;
        mrp                 := rec.mrp;
        quantity_available  := rec.quantity_available;
        description         := rec.description;
        photo_url           := rec.photo_url;
        room_number         := rec.room_number;
        priority_rank       := CASE WHEN rec.floor_id = p_buyer_floor_id THEN 0 ELSE 1 END;
        RETURN NEXT;
    END LOOP;
    CLOSE cur_listings;
END;
$$;

-- sp_admin_report: per-student summary (explicit cursor); banned students flagged
CREATE FUNCTION sp_admin_report()
RETURNS TABLE (
    student_id      INT,
    student_name    VARCHAR(100),
    floor_number    INT,
    is_banned       BOOLEAN,
    total_listings  INT,
    total_orders    INT,
    total_revenue   NUMERIC(12,2),
    pending_revenue NUMERIC(12,2)
)
LANGUAGE plpgsql STABLE AS $$
DECLARE
    rec RECORD;
    cur_students CURSOR FOR
        SELECT s.student_id AS sid, s.name, f.floor_number AS floor_no, s.is_banned AS banned,
               fn_get_seller_revenue(s.student_id) AS earned,
               (SELECT COALESCE(SUM(oi.price_at_purchase * oi.quantity), 0.00)
                FROM order_item oi
                JOIN listing l ON oi.listing_id = l.listing_id
                JOIN "Order" o ON oi.order_id   = o.order_id
                WHERE l.seller_id = s.student_id AND o.order_status IN ('Placed', 'Confirmed')) AS pending
        FROM student s JOIN floor f ON s.floor_id = f.floor_id
        ORDER BY earned DESC, pending DESC, s.student_id;
BEGIN
    OPEN cur_students;
    LOOP
        FETCH cur_students INTO rec;
        EXIT WHEN NOT FOUND;
        student_id      := rec.sid;
        student_name    := rec.name;
        floor_number    := rec.floor_no;
        is_banned       := rec.banned;
        total_listings  := (SELECT COUNT(*) FROM listing WHERE seller_id = rec.sid AND listing_status <> 'Removed');
        total_orders    := (SELECT COUNT(*) FROM "Order" WHERE buyer_id = rec.sid AND order_status <> 'Cancelled');
        total_revenue   := rec.earned;
        pending_revenue := rec.pending;
        RETURN NEXT;
    END LOOP;
    CLOSE cur_students;
END;
$$;


-- ============================================================
--  SECTION 5: VIEWS
-- ============================================================

CREATE VIEW vw_active_listings AS
SELECT l.listing_id, s.name AS seller_name, s.phone_no AS seller_phone,
       s.floor_id AS seller_floor_id, f.floor_number AS seller_floor_number,
       i.item_name, i.brand, c.category_name, l.mrp, l.selling_price,
       l.quantity_available, l.description, l.photo_url, l.room_number, l.created_at
FROM listing  l
JOIN student  s ON l.seller_id   = s.student_id
JOIN floor    f ON s.floor_id    = f.floor_id
JOIN item     i ON l.item_id     = i.item_id
JOIN category c ON i.category_id = c.category_id
WHERE l.listing_status = 'Active' AND s.is_banned = FALSE;

CREATE VIEW vw_order_history AS
SELECT o.order_id, s.name AS buyer_name, i.item_name, oi.quantity, oi.price_at_purchase,
       o.total_amount, o.order_status, o.created_at
FROM "Order"    o
JOIN order_item oi ON o.order_id    = oi.order_id
JOIN listing    l  ON oi.listing_id = l.listing_id
JOIN item       i  ON l.item_id     = i.item_id
JOIN student    s  ON o.buyer_id    = s.student_id;

CREATE VIEW vw_admin_listings AS
SELECT l.listing_id, s.name AS seller_name, s.email AS seller_email, f.floor_number AS seller_floor,
       i.item_name, l.mrp, l.selling_price,
       fn_is_price_valid(l.mrp, l.selling_price) AS price_is_valid,
       l.quantity_available, l.listing_status, l.created_at
FROM listing l
JOIN student s ON l.seller_id = s.student_id
JOIN floor   f ON s.floor_id  = f.floor_id
JOIN item    i ON l.item_id   = i.item_id;


-- ============================================================
--  SECTION 6: SAMPLE DATA
--  Demo logins: students password123, admin@jhapto.com admin123
-- ============================================================

INSERT INTO hostel (hostel_name, hostel_code) VALUES ('Kailash Hostel', 'KH01');
INSERT INTO floor (floor_number, hostel_id) VALUES (1,1),(2,1),(3,1),(4,1),(5,1),(6,1);

INSERT INTO admin (name, email, password_hash)
VALUES ('Admin Jhapto', 'admin@jhapto.com', '$2a$10$qbhq.15XRbBYGk7EXf1CzOZ/Z8TXJpsDSRwDywflGXZdwbapzs10e');

INSERT INTO student (name, email, phone_no, password_hash, hostel_id, floor_id) VALUES
('Aarav Sharma', 'aarav@tiet.ac.in', '9876543210', '$2a$10$Er7RAvUKbORp/Fp411lXLO1zYNhMGFdUopOahefH1eLHJUx.JKyR2', 1, 1),
('Priya Mehta',  'priya@tiet.ac.in', '9876543211', '$2a$10$Er7RAvUKbORp/Fp411lXLO1zYNhMGFdUopOahefH1eLHJUx.JKyR2', 1, 1),
('Rohan Verma',  'rohan@tiet.ac.in', '9876543212', '$2a$10$Er7RAvUKbORp/Fp411lXLO1zYNhMGFdUopOahefH1eLHJUx.JKyR2', 1, 2),
('Sneha Gupta',  'sneha@tiet.ac.in', '9876543213', '$2a$10$Er7RAvUKbORp/Fp411lXLO1zYNhMGFdUopOahefH1eLHJUx.JKyR2', 1, 3),
('Karan Singh',  'karan@tiet.ac.in', '9876543214', '$2a$10$Er7RAvUKbORp/Fp411lXLO1zYNhMGFdUopOahefH1eLHJUx.JKyR2', 1, 4);

INSERT INTO category (category_name) VALUES
('Snacks & Food'), ('Noodles & Instant Food'), ('Beverages'), ('Chocolates & Sweets'),
('Stationery & Books'), ('Personal Care'), ('Electronics & Accessories');

-- Seed items first (ids 1–5 are used by the sample listings), then the extended catalogue
INSERT INTO item (item_name, brand, category_id) VALUES
('Lays Classic Salted',      'Lays',     1),
('Maggi Noodles 2-min',      'Maggi',    2),
('Dark Fantasy Choco Fills', 'Sunfeast', 4),
('Amul Kool Milk',           'Amul',     3),
('Kurkure Masala Munch',     'Kurkure',  1);

INSERT INTO item (item_name, brand, category_id)
SELECT t.item_name, t.brand, c.category_id
FROM (VALUES
    ('Lays India''s Magic Masala',           'Lays',          'Snacks & Food'),
    ('Lays American Style Cream and Onion',  'Lays',          'Snacks & Food'),
    ('Bingo Mad Angles Tomato Madness',      'Bingo',         'Snacks & Food'),
    ('Uncle Chipps Spicy Treat',             'Uncle Chipps',  'Snacks & Food'),
    ('Balaji Wafers Cream & Onion',          'Balaji',        'Snacks & Food'),
    ('Kurkure Solid Masti',                  'Kurkure',       'Snacks & Food'),
    ('Haldiram''s Moong Dal',                'Haldiram''s',   'Snacks & Food'),
    ('Haldiram''s Aloo Bhujia',              'Haldiram''s',   'Snacks & Food'),
    ('Haldiram''s Bhujia Sev',               'Haldiram''s',   'Snacks & Food'),
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
    ('Ching''s Secret Schezwan Noodles',     'Ching''s',      'Noodles & Instant Food'),
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
    ('AA Batteries (pack of 4)',             'Duracell',      'Electronics & Accessories')
) AS t(item_name, brand, category_name)
JOIN category c ON c.category_name = t.category_name;

INSERT INTO listing (seller_id, item_id, mrp, selling_price, quantity_available, description) VALUES
(1, 1, 20.00, 22.00, 5,  'Fresh pack, bought yesterday'),
(2, 2, 14.00, 15.00, 3,  'Masala flavor available'),
(3, 3, 50.00, 55.00, 2,  'Sealed pack'),
(4, 4, 30.00, 30.00, 10, 'Cold, just from canteen'),
(5, 5, 20.00, 20.00, 7,  'Full party pack');

INSERT INTO "Order" (buyer_id, order_status, total_amount) VALUES
(3, 'Delivered', 22.00),
(1, 'Placed',    15.00),
(2, 'Confirmed', 30.00);

-- (these fire the stock/notification triggers like real orders)
INSERT INTO order_item (order_id, listing_id, quantity, price_at_purchase) VALUES
(1, 1, 1, 22.00),
(2, 2, 1, 15.00),
(3, 4, 1, 30.00);

INSERT INTO message (order_id, sender_id, receiver_id, message_text) VALUES
(2, 1, 2, 'Hi! I ordered Maggi. When can I pick it up?'),
(2, 2, 1, 'Come to room 204 after 6 PM!');

-- Same demo order the MySQL script places through the procedure: Rohan buys 2 × Kurkure
SELECT * FROM place_order(3, 5, 2);

-- The sample orders above are history, not new events: start with no notifications
-- (the MySQL version added its notification triggers after the seed data).
DELETE FROM notification;
