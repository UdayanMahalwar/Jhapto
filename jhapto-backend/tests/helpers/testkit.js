// Shared helpers for the API tests.
const mysql   = require('mysql2/promise');
const request = require('supertest');
const { createApp } = require('../../app');
const db = require('../../config/db');
const { buildDatabase } = require('../../scripts/lib/sqlRunner');

// Seed data (jhapto_database.sql + migrations). Student ids 1-5 sell listings 1-5.
const STUDENTS = {
  aarav: { id: 1, email: 'aarav@tiet.ac.in', floor_id: 1 },
  priya: { id: 2, email: 'priya@tiet.ac.in', floor_id: 1 },
  rohan: { id: 3, email: 'rohan@tiet.ac.in', floor_id: 2 },
  sneha: { id: 4, email: 'sneha@tiet.ac.in', floor_id: 3 },
  karan: { id: 5, email: 'karan@tiet.ac.in', floor_id: 4 },
};
const PASSWORD = 'password123';
const ADMIN = { email: 'admin@jhapto.com', password: 'admin123' };

// Drop and rebuild the test database from the real SQL files (~0.5s)
async function resetDb() {
  const conn = await mysql.createConnection({
    host    : process.env.DB_HOST || 'localhost',
    port    : Number(process.env.DB_PORT) || 3306,
    user    : process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  });
  try {
    await buildDatabase(conn, process.env.DB_NAME, { drop: true });
  } finally {
    await conn.end();
  }
}

const app = createApp();
const api = () => request(app);

async function login(name, password = PASSWORD) {
  const res = await api().post('/api/auth/login').send({ email: STUDENTS[name].email, password });
  if (res.status !== 200) throw new Error(`login ${name} failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.token;
}

async function adminLogin() {
  const res = await api().post('/api/admin/login').send(ADMIN);
  if (res.status !== 200) throw new Error(`admin login failed: ${res.status}`);
  return res.body.token;
}

const bearer = (token) => ({ Authorization: `Bearer ${token}` });

// Direct SQL for arranging state and checking results
const sql = async (query, params = []) => (await db.query(query, params))[0];

module.exports = { app, api, db, sql, resetDb, login, adminLogin, bearer, STUDENTS, PASSWORD, ADMIN };
