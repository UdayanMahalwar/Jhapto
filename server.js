import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createRequire } from 'module';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

process.env.JWT_SECRET = process.env.JWT_SECRET || 'jhapto_super_secret_jwt_key_2026';

const app = express();
const PORT = 3000;

// ── Middleware ───────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// ── API Routes ───────────────────────────────────────────────
const authRoutes = require('./jhapto-backend/routes/auth.js');
const listingsRoutes = require('./jhapto-backend/routes/listings.js');
const ordersRoutes = require('./jhapto-backend/routes/orders.js');
const messagesRoutes = require('./jhapto-backend/routes/messages.js');
const adminRoutes = require('./jhapto-backend/routes/admin.js');
const reportsRoutes = require('./jhapto-backend/routes/reports.js');

app.use('/api/auth', authRoutes);
app.use('/api/listings', listingsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reports', reportsRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Jhapto Server is running!' });
});

// ── Frontend / Vite Integration ──────────────────────────────
async function setupViteOrStatic() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      root: path.resolve(__dirname, 'jhapto-frontend'),
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        port: PORT,
        allowedHosts: true,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'jhapto-frontend/dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Jhapto unified server running on http://0.0.0.0:${PORT}`);
  });
}

setupViteOrStatic().catch(err => {
  console.error('Failed to start server:', err);
});
