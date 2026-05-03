# Jhapto Quick Commerce

This repository contains the code for the Jhapto Quick Commerce platform, built for university hostels.

## What is in this repo
* **jhapto-database**: SQL script to set up the MySQL database, tables, triggers, and sample data.
* **jhapto-backend**: Node.js/Express backend server that connects to the MySQL database.
* **jhapto-frontend**: React (Vite) frontend application.

## How to run locally

### 1. Database
Import the `jhapto-database/jhapto_database.sql` file into your local MySQL server.

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
   (Runs on http://localhost:5000)

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
