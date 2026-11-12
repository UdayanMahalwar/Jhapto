--  JHAPTO - migration v4: image storage in the database
--  Used when UPLOAD_STORAGE=db (hosts whose disk is wiped on restart, e.g. Render's free tier).
--  Run once, after jhapto_migrations_v3.sql:
--    mysql -u root jhapto < jhapto-database/jhapto_migrations_v4.sql

USE jhapto;

CREATE TABLE IF NOT EXISTS Upload (
    name        VARCHAR(64)  NOT NULL PRIMARY KEY,   -- "<32 hex>.<ext>", as in /uploads/<name>
    mime_type   VARCHAR(32)  NOT NULL,
    data        MEDIUMBLOB   NOT NULL,               -- up to 16 MB; the API caps images at 5 MB
    uploaded_by INT          NULL,
    created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (uploaded_by) REFERENCES Student(student_id) ON DELETE SET NULL
);
