// utils/google.js
// "Sign in with Google": verifies the ID token Google gives the browser / Android app
// and makes sure it belongs to a real, verified Thapar account.

const { OAuth2Client } = require('google-auth-library');

// Only these email domains may use Jhapto (comma-separated in ALLOWED_EMAIL_DOMAINS)
const allowedDomains = () =>
  (process.env.ALLOWED_EMAIL_DOMAINS || 'thapar.edu').split(',').map((d) => d.trim().toLowerCase()).filter(Boolean);

const isAllowedEmail = (email) => {
  const domain = String(email || '').trim().toLowerCase().split('@')[1];
  return Boolean(domain) && allowedDomains().includes(domain);
};

const clientId = () => process.env.GOOGLE_CLIENT_ID || '';
let client;

// Returns { sub, email, name } for a valid Thapar Google account, otherwise throws
// an Error whose .status / .message are safe to send to the user.
async function verifyGoogleCredential(credential) {
  if (!clientId()) {
    throw Object.assign(new Error('Google sign-in is not set up on this server.'), { status: 503 });
  }
  if (typeof credential !== 'string' || credential.length > 4096) {
    throw Object.assign(new Error('Invalid Google sign-in.'), { status: 400 });
  }
  client ??= new OAuth2Client();
  let payload;
  try {
    // Checks Google's signature, expiry, issuer and that the token was made for this app
    const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId() });
    payload = ticket.getPayload();
  } catch {
    throw Object.assign(new Error('Google sign-in failed or expired. Please try again.'), { status: 401 });
  }
  if (!payload?.email || payload.email_verified !== true) {
    throw Object.assign(new Error('Your Google email address is not verified.'), { status: 403 });
  }
  // Workspace accounts carry the domain in `hd`; checking both stops a personal
  // Gmail that merely has a thapar-looking address.
  const domain = payload.email.toLowerCase().split('@')[1];
  if (!isAllowedEmail(payload.email) || String(payload.hd || '').toLowerCase() !== domain) {
    throw Object.assign(new Error(`Only Thapar accounts (@${allowedDomains().join(', @')}) can use Jhapto.`), { status: 403 });
  }
  return { sub: payload.sub, email: payload.email.toLowerCase(), name: payload.name || payload.email.split('@')[0] };
}

module.exports = { verifyGoogleCredential, isAllowedEmail, allowedDomains };
