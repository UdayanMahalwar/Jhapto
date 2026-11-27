-- Migration 004 — Thapar hostels and room numbers. Safe to run more than once.
--   * student.room_number: given at sign-up; listings use it as the pickup room
--     (sellers no longer type a room for every listing).
--   * The real TIET hostels, each with one internal floor (the app no longer
--     asks for floors; "same floor first" ranking now means "same hostel first").
-- Removing old demo hostels / data is a one-off clean-up, not part of this file.

ALTER TABLE student ADD COLUMN IF NOT EXISTS room_number VARCHAR(20);

-- Thapar Institute (TIET), Patiala halls of residence, from thapar.edu
-- (students/pages/boys-hostel and girls-hostel). The app doesn't use floors:
-- each hostel has one internal floor, so "same floor" ranking = "same hostel".
INSERT INTO hostel (hostel_name, hostel_code) VALUES
    ('Agira Hall', 'A'),
    ('Amritam Hall', 'B'),
    ('Prithvi Hall', 'C'),
    ('Neeram Hall', 'D'),
    ('Vyan Hall', 'H'),
    ('Tejas Hall', 'J'),
    ('Ambaram Hall', 'K'),
    ('Viyat Hall', 'L'),
    ('Anantam Hall', 'M'),
    ('Vyom Hall', 'O'),
    ('Vasudha Hall (Block E)', 'E'),
    ('Vasudha Hall (Block G)', 'G'),
    ('Ira Hall', 'I'),
    ('Ananta Hall', 'N'),
    ('Dhriti Hall', 'PG'),
    ('Vahni Hall', 'Q'),
    ('Pavani Hall', 'PG-2'),
    ('Hostel FRF/G', 'FRF/G')
ON CONFLICT (hostel_code) DO NOTHING;
INSERT INTO floor (floor_number, hostel_id)
SELECT 0, h.hostel_id FROM hostel h
WHERE NOT EXISTS (SELECT 1 FROM floor f WHERE f.hostel_id = h.hostel_id)
ORDER BY h.hostel_id;
