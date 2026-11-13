-- Migration 001 — brings an existing database (e.g. the live Neon one) up to date with:
--   * Sign in with Google        (student.google_sub, nullable password_hash)
--   * Email / push notifications (notification.delivered, student.email_notifications, push_token)
--   * Report conversations       (report_message)
--   * Student-created items      (item.created_by, unique name + brand)
-- Safe to run more than once. Fresh databases get all of this from jhapto_postgres.sql.

ALTER TABLE student ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE student ADD COLUMN IF NOT EXISTS google_sub VARCHAR(64) UNIQUE;
ALTER TABLE student ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE item ADD COLUMN IF NOT EXISTS created_by INT REFERENCES student(student_id) ON DELETE SET NULL;
ALTER TABLE item ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS uq_item_name_brand ON item (lower(item_name), lower(coalesce(brand, '')));

-- Existing notifications are old news: mark them delivered so nobody gets a flood of emails
ALTER TABLE notification ADD COLUMN IF NOT EXISTS delivered BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE notification ALTER COLUMN delivered SET DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_notification_undelivered ON notification (notification_id) WHERE NOT delivered;

CREATE TABLE IF NOT EXISTS report_message (
    report_message_id SERIAL PRIMARY KEY,
    report_id         INT NOT NULL REFERENCES report(report_id) ON DELETE CASCADE,
    sender_role       VARCHAR(7) NOT NULL CHECK (sender_role IN ('student', 'admin')),
    student_id        INT REFERENCES student(student_id) ON DELETE CASCADE,
    admin_id          INT REFERENCES admin(admin_id) ON DELETE SET NULL,
    message_text      TEXT NOT NULL,
    created_at        TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_report_message_report ON report_message (report_id, created_at);

CREATE TABLE IF NOT EXISTS push_token (
    token       VARCHAR(512) PRIMARY KEY,
    student_id  INT NOT NULL REFERENCES student(student_id) ON DELETE CASCADE,
    platform    VARCHAR(10) NOT NULL CHECK (platform IN ('android', 'web')),
    updated_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_push_token_student ON push_token (student_id);
