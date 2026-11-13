// utils/notify/index.js
// Delivers in-app notifications by email and push.
//
// Notification rows are written by database triggers (new order, order status,
// review) and by a few routes (report replies). Every row starts with
// delivered = FALSE; deliverPending() claims undelivered rows atomically, so
// two requests running at once never send the same email twice.
//
// It runs after every successful write request (see app.js). On Vercel the
// work is handed to waitUntil() so the response isn't delayed.

const db = require('../../config/db');
const { sendEmail, isConfigured: emailOn } = require('./email');
const { sendPush, isConfigured: pushOn } = require('./push');

const SUBJECTS = {
  order_placed: 'New order on Jhapto',
  order_confirmed: 'Your order was confirmed',
  order_delivered: 'Your order was delivered',
  order_cancelled: 'An order was cancelled',
  review: 'You got a new rating',
  report_update: 'Update on your report',
};
const TITLES = {
  order_placed: 'New order 🛒',
  order_confirmed: 'Order confirmed ✅',
  order_delivered: 'Order delivered 📦',
  order_cancelled: 'Order cancelled',
  review: 'New rating ⭐',
  report_update: 'Report update',
};

let running = null;

async function deliverBatch() {
  // Claim up to 25 rows; SKIP LOCKED lets parallel requests take different rows
  const [rows] = await db.query(
    `UPDATE Notification n SET delivered = TRUE
     FROM Student s
     WHERE n.student_id = s.student_id
       AND n.notification_id IN (
         SELECT notification_id FROM Notification
         WHERE NOT delivered ORDER BY notification_id LIMIT 25 FOR UPDATE SKIP LOCKED)
     RETURNING n.notification_id, n.student_id, n.type, n.message, n.link,
               s.name, s.email, s.email_notifications, s.is_banned`
  );
  await Promise.all(rows.map(async (n) => {
    if (n.is_banned) return;
    const jobs = [];
    if (n.email_notifications) {
      jobs.push(sendEmail({
        to: n.email, name: n.name.split(' ')[0], subject: SUBJECTS[n.type] || 'Jhapto notification',
        message: n.message, link: n.link,
      }));
    }
    jobs.push(sendPush(n.student_id, { title: TITLES[n.type] || 'Jhapto', body: n.message, link: n.link }));
    const results = await Promise.allSettled(jobs);
    for (const r of results) {
      if (r.status === 'rejected') console.warn(`Notification ${n.notification_id} delivery failed:`, r.reason?.message);
    }
  }));
  return rows.length;
}

// Delivers everything that's waiting. Concurrent calls in one process share the same run.
function deliverPending() {
  if (!emailOn() && !pushOn()) return Promise.resolve(0);
  if (running) return running;
  running = (async () => {
    let total = 0;
    try {
      for (let i = 0; i < 4; i++) {          // at most 100 per call; the rest go next time
        const n = await deliverBatch();
        total += n;
        if (n < 25) break;
      }
    } catch (err) {
      console.warn('Notification delivery error:', err.message);
    } finally {
      running = null;
    }
    return total;
  })();
  return running;
}

// Push without an in-app notification row (used for chat messages)
const pushOnly = (student_id, payload) =>
  sendPush(student_id, payload).catch((err) => console.warn('Push failed:', err.message));

// Emails every admin (new reports, report replies). Best effort.
async function emailAdmins({ subject, message, link }) {
  if (!emailOn()) return;
  const [admins] = await db.query('SELECT name, email FROM Admin');
  await Promise.allSettled(admins.map((a) =>
    sendEmail({ to: a.email, name: a.name.split(' ')[0], subject, message, link })));
}

// Starts background work during a request (kept alive on Vercel until it finishes)
function inBackground(promise) {
  const safe = Promise.resolve(promise).catch((err) => console.warn('Background notification error:', err.message));
  if (process.env.VERCEL) require('@vercel/functions').waitUntil(safe);
  return safe;
}

module.exports = { deliverPending, pushOnly, emailAdmins, inBackground };
