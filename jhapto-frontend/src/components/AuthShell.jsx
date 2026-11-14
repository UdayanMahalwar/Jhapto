import React from 'react';
import { motion } from 'framer-motion';
import ThemeToggle from './ThemeToggle';
import AppDownload from './AppDownload';

const BG_EMOJI = [
  { e: '🍜', x: '8%', y: '14%', s: 54, d: 0 },
  { e: '🥤', x: '84%', y: '18%', s: 60, d: 1 },
  { e: '🍫', x: '12%', y: '74%', s: 48, d: 2 },
  { e: '🍿', x: '80%', y: '72%', s: 56, d: 0.5 },
  { e: '🖊️', x: '50%', y: '8%', s: 34, d: 1.5 },
  { e: '🧃', x: '48%', y: '88%', s: 40, d: 2.5 },
];

// Shared frame for the login pages: floating emoji backdrop, theme toggle, animated card
const AuthShell = ({ children }) => (
  <div className="auth-container">
    <div className="auth-theme"><ThemeToggle /></div>
    <div className="auth-backdrop" aria-hidden="true">
      {BG_EMOJI.map(b => (
        <motion.span
          key={b.e}
          style={{ left: b.x, top: b.y, fontSize: b.s }}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 0.9, scale: 1, y: [0, -14, 0], rotate: [0, 8, 0] }}
          transition={{ opacity: { duration: 0.6, delay: b.d * 0.15 }, scale: { duration: 0.6, delay: b.d * 0.15 }, y: { duration: 6 + b.d, repeat: Infinity, ease: 'easeInOut' }, rotate: { duration: 7 + b.d, repeat: Infinity, ease: 'easeInOut' } }}
        >
          {b.e}
        </motion.span>
      ))}
    </div>
    <motion.div
      layout
      className="auth-card"
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], layout: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } }}
    >
      {children}
    </motion.div>
    <AppDownload className="auth-app-download" />
  </div>
);

export default AuthShell;
