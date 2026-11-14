// utils/notify/email.js
// Sends notification emails through Gmail SMTP (GMAIL_USER + GMAIL_APP_PASSWORD).
// Without those settings, email is simply skipped.

const nodemailer = require('nodemailer');

let transport;
const isConfigured = () => Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) && process.env.EMAIL_NOTIFICATIONS !== 'off';

function getTransport() {
  transport ??= nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
    pool: false,
    connectionTimeout: 8000,
    socketTimeout: 8000,
  });
  return transport;
}

const siteUrl = () => (process.env.SITE_URL || 'https://jhapto.vercel.app').replace(/\/$/, '');

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Plain, mobile-friendly email matching the app's look
function render({ name, message, link }) {
  const url = `${siteUrl()}${link || '/'}`;
  const text = `Hi ${name},\n\n${message}\n\nOpen Jhapto: ${url}\n\nYou can turn these emails off on your Jhapto profile.`;
  const html = `<!doctype html><html><body style="margin:0;background:#edebe8;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1b1a19">
  <div style="max-width:480px;margin:0 auto;padding:24px 16px">
    <p style="font-size:26px;font-weight:800;letter-spacing:-1px;margin:0 0 16px">jhapto<span style="color:#ff6a3d">.</span></p>
    <div style="background:#fff;border-radius:20px;padding:24px">
      <p style="margin:0 0 8px;color:#7a7570">Hi ${escapeHtml(name)},</p>
      <p style="margin:0 0 20px;font-size:17px;line-height:1.5">${escapeHtml(message)}</p>
      <a href="${escapeHtml(url)}" style="display:inline-block;background:#ff6a3d;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:999px">Open Jhapto</a>
    </div>
    <p style="font-size:12px;color:#7a7570;margin:16px 4px 0">You get this because email alerts are on. Turn them off on your Jhapto profile.</p>
  </div></body></html>`;
  return { text, html };
}

async function sendEmail({ to, name, subject, message, link }) {
  if (!isConfigured() || !to) return false;
  const { text, html } = render({ name, message, link });
  await getTransport().sendMail({
    from: `"Jhapto" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    text,
    html,
  });
  return true;
}

module.exports = { sendEmail, isConfigured, render };
