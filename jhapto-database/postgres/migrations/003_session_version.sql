-- Exact session revocation, including logins issued in the same second.
ALTER TABLE student ADD COLUMN IF NOT EXISTS session_version INT NOT NULL DEFAULT 0;
-- Existing tokens have implicit version 0. Revoke them for previously changed passwords.
UPDATE student SET session_version = 1 WHERE password_changed_at IS NOT NULL AND session_version = 0;
