-- Migration 002 — security hardening. Safe to run more than once.
--   * rate_limit: request counters shared by every server instance (Vercel runs many),
--     so login / sign-up / spam limits can't be dodged by hitting a fresh instance.
--   * student.password_changed_at: sessions issued before a password change stop working.

CREATE TABLE IF NOT EXISTS rate_limit (
    key       VARCHAR(200) PRIMARY KEY,
    hits      INT NOT NULL,
    reset_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rate_limit_reset ON rate_limit (reset_at);

ALTER TABLE student ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;
