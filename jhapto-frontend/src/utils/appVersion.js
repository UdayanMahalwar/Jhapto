// Version check for the Android app.
//
// The app adds "JhaptoAndroid/<version>" to its user agent (capacitor.config.json
// → android.appendUserAgent), so this website — which the app loads — knows which
// version is installed and can ask old installs to update.
//
// When you publish a new APK: bump versionName in jhapto-mobile/android/app/build.gradle,
// the user agent in capacitor.config.json, and LATEST_ANDROID_VERSION + WHATS_NEW here.

export const LATEST_ANDROID_VERSION = '1.1';
export const WHATS_NEW = [
  'Notifications on your phone for orders, chats and report replies',
  'Sign in with your Thapar Google account',
  'Sell items that aren’t in the list yet',
];

// The APK is served from a second domain on purpose: the app opens links to
// other sites in the phone's browser, which downloads the file and offers to install it.
export const APK_DOWNLOAD_URL = `https://jhapto-download.vercel.app/downloads/jhapto.apk?v=${LATEST_ANDROID_VERSION}`;

// Installed app version, or null in a normal browser
export const installedAppVersion = () => {
  const m = typeof navigator !== 'undefined' && /JhaptoAndroid\/(\d+(?:\.\d+)*)/.exec(navigator.userAgent);
  return m ? m[1] : null;
};

// -1 / 0 / 1, comparing "1.10" > "1.9" correctly
export const compareVersions = (a, b) => {
  const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
};

export const appUpdateAvailable = () => {
  const v = installedAppVersion();
  return Boolean(v) && compareVersions(v, LATEST_ANDROID_VERSION) < 0;
};
