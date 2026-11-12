import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

// App-wide toast messages (replaces window.alert and the per-page notification banners)
const ToastContext = createContext(() => {});

export const ToastProvider = ({ children }) => {
  const [toast, setToast] = useState(null);   // { message, type }
  const timer = useRef(null);

  const show = useCallback((message, type = 'success') => {
    clearTimeout(timer.current);
    setToast({ message, type });
    timer.current = setTimeout(() => setToast(null), type === 'error' ? 4500 : 3000);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <div
          role={toast.type === 'error' ? 'alert' : 'status'}
          onClick={() => setToast(null)}
          style={{
            position: 'fixed', top: '80px', left: '50%', transform: 'translateX(-50%)', zIndex: 2000,
            maxWidth: 'calc(100vw - 32px)', textAlign: 'center', cursor: 'pointer',
            background: toast.type === 'error' ? 'var(--secondary-color)' : 'var(--primary-color)',
            color: toast.type === 'error' ? 'white' : 'black',
            padding: '0.9rem 1.6rem', borderRadius: '30px', fontWeight: 'bold', boxShadow: '0 10px 20px rgba(0,0,0,0.5)',
            animation: 'slideDown 0.3s ease-out',
          }}
        >
          {toast.message}
        </div>
      )}
    </ToastContext.Provider>
  );
};

// const toast = useToast(); toast('Saved'); toast('Something failed', 'error');
export const useToast = () => useContext(ToastContext);
