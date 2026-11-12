import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertCircle } from 'lucide-react';

// App-wide toast messages (replaces window.alert and the per-page notification banners)
const ToastContext = createContext(() => {});

export const ToastProvider = ({ children }) => {
  const [toast, setToast] = useState(null);   // { id, message, type }
  const timer = useRef(null);

  const show = useCallback((message, type = 'success') => {
    clearTimeout(timer.current);
    setToast({ id: Date.now(), message, type });
    timer.current = setTimeout(() => setToast(null), type === 'error' ? 4500 : 3000);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div style={{ position: 'fixed', top: 76, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 2000, pointerEvents: 'none' }}>
        <AnimatePresence>
          {toast && (
            <motion.div
              key={toast.id}
              role={toast.type === 'error' ? 'alert' : 'status'}
              onClick={() => setToast(null)}
              initial={{ opacity: 0, y: -24, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.96, transition: { duration: 0.18 } }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              style={{
                pointerEvents: 'auto', maxWidth: 'calc(100vw - 32px)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '0.6rem',
                background: 'var(--banner-bg)', color: 'var(--banner-text)',
                padding: '0.75rem 1.2rem 0.75rem 0.9rem', borderRadius: 999, fontWeight: 600, fontSize: '0.92rem',
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              {toast.type === 'error'
                ? <AlertCircle size={19} color="var(--secondary-color)" />
                : <CheckCircle2 size={19} color="var(--success)" />}
              {toast.message}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

// const toast = useToast(); toast('Saved'); toast('Something failed', 'error');
export const useToast = () => useContext(ToastContext);
