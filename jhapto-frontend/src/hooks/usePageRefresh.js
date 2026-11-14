import { useEffect, useRef } from 'react';

// Poll visible order screens and catch up immediately when returning to the app.
// Keep one timer even when a caller's filters or callback change.
export default function usePageRefresh(refresh, intervalMs = 15000) {
  const latest = useRef(refresh);
  useEffect(() => { latest.current = refresh; }, [refresh]);

  useEffect(() => {
    let pending = false;
    const run = async () => {
      if (document.hidden || pending) return;
      pending = true;
      try {
        await latest.current();
      } catch (error) {
        console.warn('Could not refresh orders', error);
      } finally {
        pending = false;
      }
    };
    const timer = window.setInterval(run, intervalMs);
    window.addEventListener('focus', run);
    document.addEventListener('visibilitychange', run);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', run);
      document.removeEventListener('visibilitychange', run);
    };
  }, [intervalMs]);
}
