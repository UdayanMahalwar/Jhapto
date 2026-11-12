# Jhapto Quick Commerce

This repository contains the code for the Jhapto Quick Commerce platform, built for university hostels.

## What is in this repo
* **server.js**: the single entry point. Serves the API, live chat (Socket.IO) and the React frontend on one port.
* **jhapto-database**: SQL scripts for the MySQL schema, triggers, procedures, sample data and migrations.
* **jhapto-backend**: Express API (`app.js`, `routes/`), Socket.IO (`realtime.js`), tests (`tests/`) and admin scripts (`scripts/`).
* **jhapto-frontend**: React (Vite) frontend.

## How to run locally

### 1. MySQL (8.x)
```bash
brew install mysql@8.4 && brew services start mysql@8.4      # macOS
mysql -u root -e "CREATE USER 'jhapto'@'localhost' IDENTIFIED BY 'jhapto_local';
                  GRANT ALL ON jhapto.* TO 'jhapto'@'localhost';
                  GRANT ALL ON jhapto_test.* TO 'jhapto'@'localhost';
                  SET PERSIST log_bin_trust_function_creators = 1;"
```
The last line lets a non-root user create the project's triggers and functions.

### 2. App
```bash
npm install
cp jhapto-backend/.env.example jhapto-backend/.env   # set DB_PASSWORD (jhapto_local above)
npm run db:setup                                     # creates the jhapto database with sample data
npm run dev                                          # http://localhost:3000
```
Seed logins: any student (e.g. `aarav@tiet.ac.in`) / `password123`, admin `admin@jhapto.com` / `admin123`.

`npm run dev` restarts the server when backend code changes; frontend changes hot-reload in the browser.
Set `USE_MOCK_DB=true` in `jhapto-backend/.env` to run without MySQL (in-memory data, resets on restart).

### Production
```bash
npm run build && npm start
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | App on http://localhost:3000 with auto-restart |
| `npm test` | API + live-chat test suite against a throwaway `jhapto_test` database |
| `npm run db:setup` | Create the database from `jhapto-database/*.sql` (`-- --reset` drops and rebuilds it) |
| `npm run images:migrate` | Move old base64 images out of the database into `jhapto-backend/uploads/` (dry run; add `-- --apply`) |
| `node jhapto-backend/scripts/insert_items.js` | Add the extended snack catalogue to the Item table |

## Updating an existing database
If your database was created before ratings/notifications were added, apply the migrations once:
```bash
mysql -u root jhapto < jhapto-database/jhapto_migrations.sql      # only if it predates room numbers / reports
mysql -u root jhapto < jhapto-database/jhapto_migrations_v2.sql   # seller ratings, notifications
npm run images:migrate -- --apply                                  # if listings/reports have base64 images
```

## How things work
* **Images** are uploaded to `POST /api/uploads`, checked by their actual bytes (PNG/JPEG/GIF/WebP, max 5 MB), saved under random names in `jhapto-backend/uploads/` and served from `/uploads/…`. The database stores only the URL.
* **Live chat**: the chat page joins a Socket.IO room for the order; new messages, order status changes and notification badges are pushed instantly.
* **Tests** rebuild `jhapto_test` from the real SQL files before each test file, so triggers and procedures are tested too. They refuse to run against a database whose name doesn't end in `_test`.
