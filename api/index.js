// Vercel serverless entry: the whole Express API (and /uploads) as one function.
// Static frontend files are served by Vercel directly; see vercel.json.
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { createApp } = require('../jhapto-backend/app.js');

export default createApp();
