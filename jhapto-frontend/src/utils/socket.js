import { io } from 'socket.io-client';

// One shared Socket.IO connection per logged-in student (same origin as the page).
let socket = null;

const handleAuthFailure = (message) => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  try {
    sessionStorage.setItem('authMessage', message);
  } catch { /* storage unavailable */ }
  window.location.assign('/login');
};

export const getSocket = () => {
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
