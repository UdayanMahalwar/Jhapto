# Jhapto Quick Commerce

This repository contains the code for the Jhapto Quick Commerce platform, built for university hostels.

## What is in this repo
* **jhapto-database**: SQL script to set up the MySQL database, tables, triggers, and sample data.
* **jhapto-backend**: Node.js/Express backend server that connects to the MySQL database.
* **jhapto-frontend**: React (Vite) frontend application.

## How to run locally

### 1. Database (MySQL 8.x)
```bash
brew install mysql@8.4 && brew services start mysql@8.4   # macOS
mysql -u root < jhapto-database/jhapto_database.sql
mysql -u root < jhapto-database/jhapto_migrations.sql      # room_number, is_read, Report table, dev logins
mysql -u root -e "CREATE USER 'jhapto'@'localhost' IDENTIFIED BY 'jhapto_local'; GRANT ALL ON jhapto.* TO 'jhapto'@'localhost';"
cp jhapto-backend/.env.example jhapto-backend/.env           # then set DB_PASSWORD
```
Seed logins: any student (e.g. `aarav@tiet.ac.in`) / `password123`, admin `admin@jhapto.com` / `admin123`.
Set `USE_MOCK_DB=true` in `jhapto-backend/.env` to run without MySQL.

### Quick start (frontend + API on one port)
```bash
npm install && (cd jhapto-backend && npm install)
npm run dev   # http://localhost:3000
```

### 2. Backend Server
1. Open a terminal and navigate to the backend folder:
   ```bash
   cd jhapto/jhapto-backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file with your database credentials (check `.env` for variables like `DB_PASSWORD`, `DB_HOST`, etc.).
4. Start the server:
   ```bash
   npm run dev
   ```
   (Runs on http://localhost:5001 — port 5000 is taken by AirPlay on macOS)

### 3. Frontend Application
1. Open a new terminal and navigate to the frontend folder:
   ```bash
   cd jhapto/jhapto-frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the React app:
   ```bash
   npm run dev
   ```
   (Runs on http://localhost:5173)
