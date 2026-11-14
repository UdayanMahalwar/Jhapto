// utils/notify/push.js
// Phone / browser push notifications through Firebase Cloud Messaging.
// Needs FIREBASE_SERVICE_ACCOUNT (the service-account JSON, as one line or base64).

const db = require('../../config/db');

let messaging;   // firebase-admin messaging, created on first use
let initFailed = false;

const isConfigured = () => Boolean(process.env.FIREBASE_SERVICE_ACCOUNT) && process.env.PUSH_NOTIFICATIONS !== 'off';

function getMessaging() {
  if (messaging || initFailed) return messaging;
  try {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
    const json = JSON.parse(raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8'));
    const { initializeApp, cert, getApps } = require('firebase-admin/app');
    const { getMessaging: gm } = require('firebase-admin/messaging');
    const app = getApps().find((a) => a.name === 'jhapto') || initializeApp({ credential: cert(json) }, 'jhapto');
    messaging = gm(app);
  } catch (err) {
    initFailed = true;
    console.error('Push notifications disabled — bad FIREBASE_SERVICE_ACCOUNT:', err.message);
  }
  return messaging;
}

const siteUrl = () => (process.env.SITE_URL || 'https://jhapto.vercel.app').replace(/\/$/, '');

// Errors that mean the token will never work again (app uninstalled, permission revoked …)
const DEAD_TOKEN = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

// Sends one notification to every registered device of a student. Returns how many got it.
async function sendPush(student_id, { title, body, link }) {
  if (!isConfigured() || !getMessaging()) return 0;
  const [tokens] = await db.query('SELECT token, platform FROM push_token WHERE student_id = ?', [student_id]);
  if (tokens.length === 0) return 0;

  const path = link || '/';
  const result = await messaging.sendEachForMulticast({
    tokens: tokens.map((t) => t.token),
    notification: { title, body },
    data: { link: path },
    android: { priority: 'high', notification: { channelId: 'jhapto', color: '#ff6a3d', icon: 'ic_stat_jhapto' } },
    webpush: { fcmOptions: { link: `${siteUrl()}${path}` }, notification: { icon: '/icon-192.png', badge: '/icon-192.png' } },
  });

  const dead = result.responses
    .map((r, i) => (!r.success && DEAD_TOKEN.has(r.error?.code) ? tokens[i].token : null))
    .filter(Boolean);
  if (dead.length) {
    await db.query(`DELETE FROM push_token WHERE token IN (${dead.map(() => '?').join(', ')})`, dead);
  }
  return result.successCount;
}

module.exports = { sendPush, isConfigured };
