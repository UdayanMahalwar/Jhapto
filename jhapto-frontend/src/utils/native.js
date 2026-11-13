// Helpers for when the site runs inside the Jhapto Android app (Capacitor).
// The app loads this website; Capacitor's bridge connects these plugin
// proxies to the native code (Google sign-in, push notifications).
// In a normal browser isNativeApp() is false and the plugins are never called.

import { Capacitor, registerPlugin } from '@capacitor/core';

export const isNativeApp = () => Capacitor.isNativePlatform();

const plugins = {
  SocialLogin: registerPlugin('SocialLogin'),
  PushNotifications: registerPlugin('PushNotifications'),
};

export const nativePlugin = (name) => (isNativeApp() ? plugins[name] : undefined);
