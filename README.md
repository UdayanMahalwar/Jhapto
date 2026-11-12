# Jhapto Quick Commerce

This repository contains the code for the Jhapto Quick Commerce platform, built for university hostels.

## What is in this repo
* **server.js**: the single entry point. Serves the API, live chat (Socket.IO) and the React frontend on one port.
* **jhapto-database**: the PostgreSQL schema (`postgres/`) plus the original MySQL scripts it was ported from.
* **jhapto-backend**: Express API (`app.js`, `routes/`), Socket.IO (`realtime.js`), tests (`tests/`) and admin scripts (`scripts/`).
* **jhapto-frontend**: React (Vite) frontend.

## How to run locally

### 1. PostgreSQL
```bash
brew install postgresql@17 && brew services start postgresql@17      # macOS
psql -d postgres -c "CREATE ROLE jhapto LOGIN PASSWORD 'jhapto_local' CREATEDB;" \
                 -c "CREATE DATABASE jhapto OWNER jhapto;" \
                 -c "CREATE DATABASE jhapto_test OWNER jhapto;"
```

### 2. App
```bash
npm install
cp jhapto-backend/.env.example jhapto-backend/.env   # set DB_PASSWORD (jhapto_local above)
npm run db:setup                                     # tables, triggers, functions, views + sample data
npm run dev                                          # http://localhost:3000
```
Seed logins: any student (e.g. `aarav@tiet.ac.in`) / `password123`, admin `admin@jhapto.com` / `admin123`.

`npm run dev` (nodemon, see `nodemon.json`) restarts the server when backend code changes; frontend changes hot-reload in the browser.
Set `USE_MOCK_DB=true` in `jhapto-backend/.env` to run without a database (in-memory data, resets on restart).

## Database
The live schema is PostgreSQL: [`jhapto-database/postgres/jhapto_postgres.sql`](jhapto-database/postgres/jhapto_postgres.sql)
(tables, 11 triggers, functions, cursor-based procedures, views and sample data).
The original MySQL scripts (`jhapto-database/jhapto_database.sql` + migrations v1–v4) are kept for reference; they describe the same design.

## Hosting (Vercel + Neon, free)
* **Neon** hosts PostgreSQL. Create a project, then run the schema against it:
  `DATABASE_URL="postgresql://…?sslmode=require" npm run db:setup`
* **Vercel** serves the built frontend and runs the API as one serverless function (`api/index.js`, config in `vercel.json`).
  Environment variables: `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV=production`, `UPLOAD_STORAGE=db`, `TRUST_PROXY=1`,
  `DB_POOL_SIZE=3`, and `VITE_REALTIME=false` (Vercel has no WebSockets, so chat and notifications refresh every few seconds instead of instantly).
* Images are stored in the database (`UPLOAD_STORAGE=db`) because serverless functions have no persistent disk; uploads are capped at 4 MB.

## Prohibited-item checks
New listings, and edits to a listing's description or photo, are checked before they go live (`jhapto-backend/utils/moderation.js`):
1. **Keyword rules** (always on, free): blocks descriptions that mention alcohol, tobacco/vapes, drugs, weapons, prescription medicines, exam leaks or fake documents, including spellings like `w33d` or `c i g s`.
2. **AI review with Claude** (on when `ANTHROPIC_API_KEY` is set): reads the item, description **and photo**, and catches coded wording or a photo that doesn't match a harmless item. Uses `claude-opus-5-5` by default; set `MODERATION_MODEL` to change it, or `AI_MODERATION=off` to disable.
   If the AI service is unavailable, the listing goes through on the keyword check alone.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | App on http://localhost:3000 with auto-restart |
| `npm test` | API + live-chat test suite against a throwaway `jhapto_test` PostgreSQL database |
| `npm run db:setup` | Set up the database from `jhapto-database/postgres/jhapto_postgres.sql` (`-- --reset` wipes and rebuilds it) |
| `npm run images:migrate` | Move old base64 images out of the database into `jhapto-backend/uploads/` (dry run; add `-- --apply`) |

## How things work
* **Images** are uploaded to `POST /api/uploads`, checked by their actual bytes (PNG/JPEG/GIF/WebP, max 4 MB) and saved under random names — on disk locally, in the `upload` table on Vercel — and served from `/uploads/…`.
* **Live chat**: locally, the chat page joins a Socket.IO room for the order and updates are pushed instantly; on Vercel the same pages poll every few seconds.
* **Tests** rebuild `jhapto_test` from the real SQL file before each test file, so triggers and procedures are tested too. They refuse to run against a database whose name doesn't end in `_test`.
