import { io } from 'socket.io-client';

// One shared Socket.IO connection per logged-in student (same origin as the page).
// On serverless hosting (Vercel) there is no WebSocket server: the build sets
// VITE_REALTIME=false and pages fall back to polling.
export const REALTIME_ENABLED = import.meta.env.VITE_REALTIME !== 'false';

let socket = null;

// Stand-in used when realtime is off: same methods, never connects
const offlineSocket = {
  connected: false,
  on() { return this; },
  off() { return this; },
  emit() { return this; },
  connect() { return this; },
  disconnect() { return this; },
  removeAllListeners() { return this; },
};

const handleAuthFailure = (message) => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  try {
    sessionStorage.setItem('authMessage', message);
  } catch { /* storage unavailable */ }
  window.location.assign('/login');
};

export const getSocket = () => {
  if (!REALTIME_ENABLED) return offlineSocket;
  if (socket) return socket;
  socket = io({
    // read the token on every (re)connect so a new login is picked up
    auth: (cb) => cb({ token: localStorage.getItem('token') }),
    transports: ['websocket', 'polling'],
  });
  socket.on('connect_error', (err) => {
    if (err.message === 'ACCOUNT_BANNED') handleAuthFailure('Your account has been banned. Contact admin.');
    else if (err.message === 'INVALID_TOKEN') handleAuthFailure('Session expired. Please log in again.');
  });
  socket.on('disconnect', (reason) => {
    // "io server disconnect" = the server dropped us (e.g. ban) — check before reconnecting
    if (reason === 'io server disconnect') socket.connect();
  });
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
};
