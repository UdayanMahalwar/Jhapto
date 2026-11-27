// "Agira Hall (A)"; names that already contain the code (e.g. "Hostel FRF/G") stay as they are
export const hostelLabel = (h) => (h.hostel_name.includes(h.hostel_code) ? h.hostel_name : `${h.hostel_name} (${h.hostel_code})`);

// Room numbers like A-204, B 112, FRF/G-12 (the server checks the same rule)
export const ROOM_PATTERN = '[A-Za-z0-9][A-Za-z0-9 /\\-]{0,19}';
