import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, Sparkles } from 'lucide-react';
import { appUpdateAvailable, installedAppVersion, LATEST_ANDROID_VERSION, WHATS_NEW, APK_DOWNLOAD_URL } from '../utils/appVersion';

const SNOOZE_KEY = 'jhapto_update_snoozed';
const SNOOZE_MS = 12 * 60 * 60 * 1000;   // "Later" hides it for 12 hours

const snoozed = () => {
  try {
    const v = JSON.parse(localStorage.getItem(SNOOZE_KEY) || 'null');
    return v && v.version === LATEST_ANDROID_VERSION && Date.now() - v.at < SNOOZE_MS;
  } catch {
    return false;
  }
};

// "Update available" dialog, shown only inside an outdated Android app
const AppUpdatePrompt = () => {
  const [open, setOpen] = useState(() => appUpdateAvailable() && !snoozed());
  const [started, setStarted] = useState(false);

  const later = () => {
    try { localStorage.setItem(SNOOZE_KEY, JSON.stringify({ version: LATEST_ANDROID_VERSION, at: Date.now() })); } catch { /* ignore */ }
    setOpen(false);
  };

  const update = () => {
    setStarted(true);
    // Opens in the phone's browser, which downloads the APK; Android then offers "Install"
    window.location.href = APK_DOWNLOAD_URL;
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="modal-backdrop update-backdrop" role="dialog" aria-modal="true" aria-labelledby="update-title"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="modal update-sheet"
            initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}>
            <div className="update-icon" aria-hidden="true"><Sparkles size={22} /></div>
            <h3 id="update-title" className="modal-title">Update available</h3>
            <p className="muted">Version {LATEST_ANDROID_VERSION} of Jhapto is ready (you have {installedAppVersion()}).</p>
            <ul className="update-list">
              {WHATS_NEW.map((line) => <li key={line}>{line}</li>)}
            </ul>
            {started ? (
              <p className="update-steps">
                Downloading… When it finishes, tap the file and choose <strong>Install</strong>.
                If Android asks, allow your browser to install apps. You’ll stay logged in.
              </p>
            ) : null}
            <button type="button" className="btn btn-primary btn-block" onClick={update}>
              <Download size={17} /> {started ? 'Download again' : 'Update now'}
            </button>
            <button type="button" className="btn btn-ghost btn-block" onClick={later}>Later</button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AppUpdatePrompt;
