// routes/uploads.js
// Image uploads (listing photos, report proof). Files are stored on disk in
// UPLOAD_DIR under random names and served from /uploads/<name>; the database
// only stores that short URL instead of a base64 blob.

const express = require('express');
const crypto  = require('crypto');
const multer  = require('multer');
const { rateLimit } = require('express-rate-limit');
const auth    = require('../middleware/auth');
const { MAX_IMAGE_BYTES } = require('../utils/validate');
const { sniffImageType } = require('../utils/imageType');
const uploadStore = require('../utils/uploadStore');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 0 },
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 60,                               // 60 images per IP per hour
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => process.env.RATE_LIMIT_DISABLED === 'true',
  message: { message: 'Too many uploads. Try again later.' },
});

// ── POST /api/uploads ────────────────────────────────────────
// multipart/form-data with one file field named "image".
// Returns { url: "/uploads/<random>.<ext>" }
router.post('/', auth, uploadLimiter, (req, res) => {
  upload.single('image')(req, res, async (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ message: 'Image must be under 5 MB.' });
      }
      return res.status(400).json({ message: 'Upload one image in a field named "image".' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'No image uploaded.' });
    }

    const ext = sniffImageType(req.file.buffer);
    if (!ext) {
      return res.status(400).json({ message: 'File must be a PNG, JPEG, GIF or WebP image.' });
    }

    const name = `${crypto.randomBytes(16).toString('hex')}.${ext}`;
    try {
      await uploadStore.save(name, req.file.buffer, ext, req.user.student_id);
      res.status(201).json({ url: `/uploads/${name}` });
    } catch (e) {
      res.status(500).json({ message: 'Error saving image.', error: e.message });
    }
  });
});

module.exports = router;
