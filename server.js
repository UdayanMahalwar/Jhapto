// server.js — the single entry point.
// Serves the API (jhapto-backend/app.js), live chat (Socket.IO) and the
// React frontend (Vite dev middleware, or the built files in production).

import http from 'http';
import path from 'path';
import express from 'express';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const { createApp } = require('./jhapto-backend/app.js');
const realtime = require('./jhapto-backend/realtime.js');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

async function start() {
  const app = createApp();
  const server = http.createServer(app);
  realtime.init(server);

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      root: path.resolve(__dirname, 'jhapto-frontend'),
      server: {
        middlewareMode: true,
        hmr: { server },        // share this server for hot reload (Socket.IO uses /socket.io/)
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

  server.listen(PORT, HOST, () => {
    console.log(`🚀 Jhapto running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
