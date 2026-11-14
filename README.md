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
These seed passwords are for **local** development only; the live site's demo and admin accounts use different, private passwords.

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

## Android app
`jhapto-mobile/` is a Capacitor app that opens https://jhapto.vercel.app in a native shell. Because it loads the live site, website updates reach the app without a reinstall. It adds the app icon, a splash screen, the hardware Back button, camera/gallery photo picking, and an offline screen.
The signed APK is published with the website at `/downloads/jhapto.apk`, linked from the login and profile pages as **Get the Android app**.

Rebuilding the APK (needs JDK 21 and the Android SDK):
```bash
cd jhapto-mobile && npm install
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home ANDROID_HOME=$HOME/Library/Android/sdk
npm run build:apk
cp android/app/build/outputs/apk/release/app-release.apk ../jhapto-frontend/public/downloads/jhapto.apk
```
Release signing reads `jhapto-mobile/android/keystore.properties` (kept out of git). Back up the key: Android won't install an update signed with a different key over an existing install.

## Security
- Logins: bcrypt-hashed passwords (min 8 characters), JWT sessions (HS256 only) that stop working after a password change, ban or admin removal; new sign-ups need a verified @thapar.edu address.
- Abuse limits stored in the database (shared by every Vercel instance): failed logins per IP **and** per account, sign-ups, uploads, write requests per student, and new catalogue items per student per day.
- Every route checks ownership (buyer / seller / reporter / admin); ids must be numbers; SQL is always parameterised; uploads are checked by their bytes, not their name.
- Browser protections: strict Content-Security-Policy, no framing, `nosniff`, HSTS, and an API that only Jhapto's own sites can call. Server errors never send internal details to the browser.
- `jhapto-backend/tests/security.test.js` keeps these attacks failing.

### Session revocation update

Run `npm run db:migrate` before deploying code that uses `student.session_version`.
Password changes increment this version atomically, reject concurrent reuse of the old
password, disconnect live chats, and invalidate older tokens even within the same second.
Previously changed passwords invalidate legacy tokens when migration 003 runs.

Verification: `npm test` covers the API, database triggers, security cases and live chats;
`npm run lint` checks frontend JSX and Hooks; `npm run build` builds production assets.
`npm audit --omit=dev` checks production packages. The full development audit still
reports the unpatched low-severity deepmerge advisory via Jest (GHSA-gcqx-w48m-w2h4);
production dependencies do not include it. Dependabot checks both npm lockfiles weekly.
CI runs lint with zero warnings, database-backed tests, a production build, and dependency
audits. Production findings of any severity and development findings of moderate severity
or higher fail CI. Screens load on demand, and React is cached in a separate vendor chunk.

Visible buyer and seller order screens refresh every 15 seconds and when the app regains focus.
The refresh runs quietly without replacing the order list with a loading message.
