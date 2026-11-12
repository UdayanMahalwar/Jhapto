import api from './api';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

// Uploads one image file and returns its URL ("/uploads/<name>").
// Throws an Error with a user-facing message on failure.
export async function uploadImage(file) {
  if (!ALLOWED.includes(file.type)) throw new Error('Choose a PNG, JPEG, GIF or WebP image.');
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Image must be under 5 MB.');
  const form = new FormData();
  form.append('image', file);
  try {
    const res = await api.post('/uploads', form);
    return res.data.url;
  } catch (err) {
    throw new Error(err.response?.data?.message || 'Upload failed. Please try again.');
  }
}
