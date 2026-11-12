import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { flushSync } from 'react-dom';

// Light / dark theme. The choice is saved in localStorage; until the user picks,
// it follows the operating system setting.
const ThemeContext = createContext({ theme: 'light', toggleTheme: () => {} });

const readSaved = () => {
  try {
    const t = localStorage.getItem('theme');
    return t === 'light' || t === 'dark' ? t : null;
  } catch {
    return null;
  }
};

const systemTheme = () =>
  window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

const applyTheme = (theme) => {
  document.documentElement.setAttribute('data-theme', theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0f0f10' : '#edebe8');
};

const prefersReducedMotion = () =>
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || readSaved() || systemTheme());

  useEffect(() => { applyTheme(theme); }, [theme]);

  // Follow the OS setting until the user makes an explicit choice
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => { if (!readSaved()) setTheme(mq.matches ? 'dark' : 'light'); };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // `origin` = {x, y} of the toggle button; the new theme spreads out from it
  const toggleTheme = useCallback((origin) => {
    const next = theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('theme', next); } catch { /* storage unavailable */ }

    const commit = () => {
      flushSync(() => setTheme(next));
      applyTheme(next);
    };

    if (document.startViewTransition && !prefersReducedMotion() && origin) {
      const { x, y } = origin;
      const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
      const transition = document.startViewTransition(commit);
      transition.ready.then(() => {
        document.documentElement.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          { duration: 600, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', pseudoElement: '::view-transition-new(root)' },
        );
      }).catch(() => {});
      return;
    }

    // Fallback: cross-fade colours
    const root = document.documentElement;
    root.classList.add('theme-switching');
    commit();
    window.setTimeout(() => root.classList.remove('theme-switching'), 500);
  }, [theme]);

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);
