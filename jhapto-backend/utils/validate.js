// utils/validate.js
// Small input validators shared by the route handlers.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[6-9]\d{9}$/;               // Indian 10-digit mobile
const UPLOAD_URL_RE = /^\/uploads\/([0-9a-f]{32}\.(png|jpg|gif|webp))$/;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;       // 5 MB per uploaded image

const isNonEmptyString = (v, max) =>
  typeof v === 'string' && v.trim().length > 0 && v.trim().length <= max;

const isEmail = (v) => typeof v === 'string' && v.length <= 100 && EMAIL_RE.test(v.trim());
const isPhone = (v) => typeof v === 'string' && PHONE_RE.test(v.trim());

// Integer within [min, max]; accepts numeric strings from form inputs
const isIntInRange = (v, min, max) => {
  const n = Number(v);
  return v !== '' && v !== null && Number.isInteger(n) && n >= min && n <= max;
};

// Money: positive, at most 2 decimals, below a sanity cap
const isPrice = (v) => {
  if (!/^\d+(\.\d{1,2})?$/.test(String(v))) return false;
  const n = Number(v);
  return n > 0 && n <= 100000;
};

// Optional image reference: empty, an image uploaded through POST /api/uploads
// ("/uploads/<random>.<ext>", must exist on disk), or an http(s) URL.
// Base64 data URLs are no longer accepted — images are stored as files.
const isOptionalImage = (v) => {
  if (v === undefined || v === null || v === '') return true;
  if (typeof v !== 'string' || v.length > 2048) return false;
  const m = UPLOAD_URL_RE.exec(v);
  if (m) return require('./uploadStore').existsSync(m[1]);
  return /^https?:\/\/[^\s"'<>]+$/i.test(v);
};

const MIN_PASSWORD = 6;
const isPassword = (v) => typeof v === 'string' && v.length >= MIN_PASSWORD && v.length <= 72;

module.exports = {
  isNonEmptyString, isEmail, isPhone, isIntInRange, isPrice, isOptionalImage, isPassword,
  MIN_PASSWORD, MAX_IMAGE_BYTES,
};
