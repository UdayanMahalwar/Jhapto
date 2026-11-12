import React from 'react';
import { Smartphone } from 'lucide-react';

export const APK_URL = '/downloads/jhapto.apk';

// The Android app adds "JhaptoAndroid" to its user agent; don't offer the app inside the app
export const inAndroidApp = () => typeof navigator !== 'undefined' && navigator.userAgent.includes('JhaptoAndroid');

// "Get the Android app" link to the APK hosted on this site
const AppDownload = ({ className = '' }) => {
  if (inAndroidApp()) return null;
  return (
    <a className={`app-download ${className}`} href={APK_URL} download="Jhapto.apk">
      <Smartphone size={16} aria-hidden="true" />
      <span>Get the Android app</span>
    </a>
  );
};

export default AppDownload;
