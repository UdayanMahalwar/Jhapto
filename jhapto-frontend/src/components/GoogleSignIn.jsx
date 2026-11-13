import React, { useEffect, useRef, useState } from 'react';
import { getConfig } from '../utils/config';
import { isNativeApp, nativePlugin } from '../utils/native';
import { useTheme } from '../contexts/ThemeContext';

const GSI_SRC = 'https://accounts.google.com/gsi/client';
let gsiPromise = null;
const loadGsi = () => {
  gsiPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = GSI_SRC;
    s.async = true;
    s.onload = () => resolve(window.google);
    s.onerror = () => { gsiPromise = null; reject(new Error('Could not load Google sign-in.')); };
    document.head.appendChild(s);
  });
  return gsiPromise;
};

const GoogleMark = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.6 13.2l7.9 6.2C12.4 13.7 17.7 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.8c4.3-4 6.9-9.9 6.9-17.2z"/>
    <path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.2C1 16.5 0 20.1 0 24s1 7.5 2.6 10.8l7.9-6.2z"/>
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.8c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.6-4.2-13.5-10l-7.9 6.2C6.6 42.6 14.6 48 24 48z"/>
  </svg>
);

// "Continue with Google". Calls onCredential(idToken); the server checks it's a Thapar account.
// Website: Google's own button. Android app: native Google sign-in (Google blocks web sign-in inside apps).
const GoogleSignIn = ({ onCredential, onError }) => {
  const [config, setConfig] = useState(null);
  const [busy, setBusy] = useState(false);
  const buttonRef = useRef(null);
  const { theme } = useTheme();
  const native = isNativeApp();

  useEffect(() => { getConfig().then(setConfig); }, []);
  const clientId = config?.googleClientId;
  const domain = config?.allowedEmailDomains?.[0];

  // Website: render Google's button
  useEffect(() => {
    if (native || !clientId || !buttonRef.current) return;
    let cancelled = false;
    loadGsi().then((google) => {
      if (cancelled || !buttonRef.current) return;
      google.accounts.id.initialize({
        client_id: clientId,
        callback: (r) => onCredential(r.credential),
        hd: domain,                 // only offers Thapar accounts in the chooser (the server enforces it)
        ux_mode: 'popup',
        use_fedcm_for_button: true,
      });
      buttonRef.current.innerHTML = '';
      google.accounts.id.renderButton(buttonRef.current, {
        theme: theme === 'dark' ? 'filled_black' : 'outline',
        size: 'large', shape: 'pill', text: 'continue_with', logo_alignment: 'center',
        width: Math.min(400, buttonRef.current.offsetWidth || 320),
      });
    }).catch((err) => onError?.(err.message));
    return () => { cancelled = true; };
  }, [native, clientId, domain, theme]);

  if (!clientId) return null;   // Google sign-in not set up on the server

  if (native) {
    const signIn = async () => {
      setBusy(true);
      try {
        const SocialLogin = nativePlugin('SocialLogin');
        await SocialLogin.initialize({ google: { webClientId: clientId, hostedDomain: domain } });
        const res = await SocialLogin.login({ provider: 'google', options: { scopes: ['email', 'profile'] } });
        const idToken = res?.result?.idToken;
        if (!idToken) throw new Error('Google did not return a sign-in token.');
        await onCredential(idToken);
      } catch (err) {
        const msg = String(err?.message || err);
        if (!/cancel/i.test(msg)) onError?.('Google sign-in failed. Please try again.');
      } finally {
        setBusy(false);
      }
    };
    return (
      <button type="button" className="google-native-btn" onClick={signIn} disabled={busy}>
        <GoogleMark /> {busy ? 'Signing in…' : 'Continue with Google'}
      </button>
    );
  }

  return <div className="google-btn-slot" ref={buttonRef} />;
};

export default GoogleSignIn;
