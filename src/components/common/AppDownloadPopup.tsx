import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

const STORAGE_KEY = 'nss_app_popup_shown';

const AppDownloadPopup = () => {
    const [visible, setVisible] = useState(false);
    const { pathname } = useLocation();

    useEffect(() => {
        if (pathname.startsWith('/admin')) return;
        if (sessionStorage.getItem(STORAGE_KEY)) return;
        const timer = setTimeout(() => {
            setVisible(true);
            sessionStorage.setItem(STORAGE_KEY, '1');
        }, 1500);
        return () => clearTimeout(timer);
    }, [pathname]);

    if (!visible) return null;

    return (
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
            onClick={() => setVisible(false)}
        >
            <div
                className="bg-[#111] border border-white/10 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <img
                    src="/assets/images/nss-icon.png"
                    alt="Next Star Soccer"
                    className="w-16 h-16 mx-auto mb-5 rounded-2xl"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <h2 className="text-white text-xl font-bold mb-2 leading-snug">
                    Get The Full Next Star Experience
                </h2>
                <p className="text-gray-400 text-sm mb-7">
                    Download our mobile app today
                </p>
                <div className="flex justify-center items-center gap-4">
                    <a
                        href="https://apps.apple.com/us/app/next-star-soccer/id6754170423"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <img
                            src="/assets/images/badge-app-store.svg"
                            alt="Download on the App Store"
                            className="h-9 w-auto"
                        />
                    </a>
                    <a
                        href="https://play.google.com/store/apps/details?id=com.nextstarsoccer.nextstar&hl=en_US"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <img
                            src="/assets/images/badge-google-play.png"
                            alt="Get it on Google Play"
                            className="h-9 w-auto"
                        />
                    </a>
                </div>
                <button
                    className="mt-6 text-gray-500 text-xs hover:text-gray-300 transition-colors"
                    onClick={() => setVisible(false)}
                >
                    Not now
                </button>
            </div>
        </div>
    );
};

export default AppDownloadPopup;
