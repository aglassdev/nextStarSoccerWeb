import { useState, useEffect } from 'react';

// ── Config ──────────────────────────────────────────────────────────────────
// Bump this string whenever you need to force all users to update again.
// Users who have already acknowledged THIS version won't see the modal.
const FORCED_VERSION = '1.0.1';
const LS_KEY = 'nss_update_ack_version';

const APP_STORE_URL = 'https://apps.apple.com/us/app/next-star-soccer/id6754170423';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.nextstarsoccer.nextstar&hl=en_US';
// ────────────────────────────────────────────────────────────────────────────

const ForceUpdateModal = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const acked = localStorage.getItem(LS_KEY);
    if (acked !== FORCED_VERSION) {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  const isAndroid = /Android/.test(ua);

  const handleUpdate = (url: string) => {
    localStorage.setItem(LS_KEY, FORCED_VERSION);
    window.open(url, '_blank', 'noopener,noreferrer');
    setShow(false);
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center p-6">
      <div className="bg-[#0d0d0d] border border-white/10 rounded-2xl p-8 max-w-xs w-full text-center shadow-2xl">

        {/* Icon */}
        <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </div>

        {/* Text */}
        <h2 className="text-white text-xl font-semibold mb-2">Update Required</h2>
        <p className="text-white/50 text-sm leading-relaxed mb-7">
          A new version of the Next Star Soccer app is available. Please update to continue.
        </p>

        {/* Buttons */}
        {isIOS && (
          <button
            onClick={() => handleUpdate(APP_STORE_URL)}
            className="w-full bg-white text-black font-semibold py-3 rounded-xl hover:bg-gray-100 transition-colors"
          >
            Update on the App Store
          </button>
        )}

        {isAndroid && (
          <button
            onClick={() => handleUpdate(PLAY_STORE_URL)}
            className="w-full bg-white text-black font-semibold py-3 rounded-xl hover:bg-gray-100 transition-colors"
          >
            Update on Google Play
          </button>
        )}

        {/* Desktop: show both */}
        {!isIOS && !isAndroid && (
          <div className="flex flex-col gap-3">
            <button
              onClick={() => handleUpdate(APP_STORE_URL)}
              className="w-full bg-white text-black font-semibold py-3 rounded-xl hover:bg-gray-100 transition-colors"
            >
              App Store
            </button>
            <button
              onClick={() => handleUpdate(PLAY_STORE_URL)}
              className="w-full bg-white/10 text-white font-semibold py-3 rounded-xl hover:bg-white/15 transition-colors border border-white/10"
            >
              Google Play
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default ForceUpdateModal;
