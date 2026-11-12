import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

// Sun / moon button; the icon spins and swaps, the page reveals the new theme
const ThemeToggle = ({ className = 'icon-btn' }) => {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === 'dark';

  const onClick = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    toggleTheme({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  };

  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={dark ? 'Light theme' : 'Dark theme'}
      style={{ overflow: 'hidden' }}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ y: -18, rotate: -90, opacity: 0 }}
          animate={{ y: 0, rotate: 0, opacity: 1 }}
          exit={{ y: 18, rotate: 90, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 26 }}
          style={{ display: 'flex' }}
        >
          {dark ? <Sun size={19} /> : <Moon size={19} />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
};

export default ThemeToggle;
