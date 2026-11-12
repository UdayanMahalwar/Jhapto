// utils/validate.js
// Small input validators shared by the route handlers.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[6-9]\d{9}$/;               // Indian 10-digit mobile
const IMAGE_DATA_URL_RE = /^data:image\/(png|jpe?g|gif|webp);base64,/i;

const MAX_IMAGE_CHARS = 7 * 1024 * 1024;       // ~5 MB image once base64-encoded

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

// Optional image: empty, a URL/path, or a base64 image data URL under the size cap
const isOptionalImage = (v) => {
  if (v === undefined || v === null || v === '') return true;
  if (typeof v !== 'string' || v.length > MAX_IMAGE_CHARS) return false;
  if (v.startsWith('data:')) return IMAGE_DATA_URL_RE.test(v);
  return v.length <= 2048;
};

const MIN_PASSWORD = 6;
const isPassword = (v) => typeof v === 'string' && v.length >= MIN_PASSWORD && v.length <= 72;

module.exports = {
  isNonEmptyString, isEmail, isPhone, isIntInRange, isPrice, isOptionalImage, isPassword,
  MIN_PASSWORD,
};
