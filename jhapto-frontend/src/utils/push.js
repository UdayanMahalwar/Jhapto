// Push notifications: Android app (native Firebase) and browsers (Web Push via Firebase).
// The device token is sent to the server, which pushes every new notification to it.

import api from './api';
import { getConfig } from './config';
import { isNativeApp, nativePlugin } from './native';

const TOKEN_KEY = 'jhapto_push_token';

const saveToken = async (token, platform) => {
  await api.post('/push/register', { token, platform });
  localStorage.setItem(TOKEN_KEY, token);
};

// ── Android app ──────────────────────────────────────────────
let nativeListenersAdded = false;

async function enableNative(onOpenLink) {
  const Push = nativePlugin('PushNotifications');
  if (!Push) return 'unsupported';
  if (!nativeListenersAdded) {
    nativeListenersAdded = true;
    await Push.addListener('registration', (t) => saveToken(t.value, 'android').catch(() => {}));
    await Push.addListener('registrationError', (e) => console.warn('Push registration failed', e));
    // Tapping a notification opens the page it's about
    await Push.addListener('pushNotificationActionPerformed', (action) => {
      const link = action?.notification?.data?.link;
      if (link && onOpenLink) onOpenLink(link);
    });
    await Push.createChannel?.({ id: 'jhapto', name: 'Orders and messages', importance: 4, vibration: true }).catch(() => {});
  }
  let perm = await Push.checkPermissions();
  if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') perm = await Push.requestPermissions();
  if (perm.receive !== 'granted') return 'denied';
  await Push.register();
  return 'granted';
}

// ── Browsers ─────────────────────────────────────────────────
export const webPushSupported = () =>
  typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;

async function enableWeb() {
  if (!webPushSupported()) return 'unsupported';
  const config = await getConfig();
  if (!config.firebase || !config.vapidKey) return 'unsupported';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return 'denied';

  const [{ initializeApp, getApps }, { getMessaging, getToken }] = await Promise.all([
    import('firebase/app'), import('firebase/messaging'),
  ]);
  const app = getApps()[0] || initializeApp(config.firebase);
  const registration = await navigator.serviceWorker.register('/push-sw.js');
  const token = await getToken(getMessaging(app), { vapidKey: config.vapidKey, serviceWorkerRegistration: registration });
  if (!token) return 'denied';
  await saveToken(token, 'web');
  return 'granted';
}

// Returns 'granted' | 'denied' | 'unsupported'
export async function enablePush(onOpenLink) {
  try {
    return isNativeApp() ? await enableNative(onOpenLink) : await enableWeb();
  } catch (err) {
    console.warn('Could not turn on push notifications', err);
    return 'unsupported';
  }
}

// Current state without prompting: 'granted' | 'prompt' | 'denied' | 'unsupported'
export async function pushStatus() {
  if (isNativeApp()) {
    const Push = nativePlugin('PushNotifications');
    if (!Push) return 'unsupported';
    const { receive } = await Push.checkPermissions();
    return receive === 'granted' ? 'granted' : receive === 'denied' ? 'denied' : 'prompt';
  }
  if (!webPushSupported()) return 'unsupported';
  const config = await getConfig();
  if (!config.firebase || !config.vapidKey) return 'unsupported';
  if (Notification.permission === 'granted') return localStorage.getItem(TOKEN_KEY) ? 'granted' : 'prompt';
  return Notification.permission === 'denied' ? 'denied' : 'prompt';
}

// On logout: stop sending this account's notifications to this device.
// authToken is passed in because the login is cleared right after this starts.
export async function forgetPushToken(authToken) {
  const token = localStorage.getItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
  if (!token || !authToken) return;
  try {
    await api.delete('/push/register', { data: { token }, headers: { Authorization: `Bearer ${authToken}` } });
  } catch {
    // the server also drops tokens that stop working
  }
}
