import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { images } from '../../constants/images';

const Navigation = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showGetStarted, setShowGetStarted]     = useState(false);
  const [scrolled, setScrolled]                 = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 10);
    fn();
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  const navLinks = [
    { name: 'Coaches',      path: '/coaches'      },
    { name: 'Alumni',       path: '/alumni'       },
    { name: 'Services',     path: '/services'     },
    { name: 'Calendar',     path: '/calendar'     },
    { name: 'Scholarships', path: '/scholarships' },
    { name: 'Store',        path: '/store'        },
    { name: 'Contact',      path: '/contact'      },
  ];

  return (
    <>
      {/* ─── Fixed header shell — padding grows on scroll to "float" the pill ─── */}
      <header
        className={[
          'fixed top-0 inset-x-0 z-50 transition-all duration-500',
          scrolled ? 'pt-3' : 'pt-0',
        ].join(' ')}
      >
        <div
          className={[
            'mx-auto transition-all duration-500',
            scrolled ? 'max-w-7xl px-4 md:px-6' : 'max-w-none px-0',
          ].join(' ')}
        >
          {/* Nav bar — full-width bar at top, floating pill when scrolled */}
          <div
            className={[
              'transition-all duration-500',
              scrolled
                ? 'rounded-full border border-white/10 bg-black/90 backdrop-blur-xl shadow-2xl'
                : 'bg-black border-b border-white/10',
            ].join(' ')}
          >
            <div
              className={[
                'flex items-center justify-between font-lt-wave',
                scrolled
                  ? 'px-5 md:px-6 py-3'
                  : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20',
              ].join(' ')}
            >
              {/* Logo */}
              <Link to="/" className="flex-shrink-0 flex items-center hover:opacity-75 transition-opacity">
                <img
                  src={images.logo}
                  alt="Next Star Soccer"
                  className={['w-auto transition-all duration-500', scrolled ? 'h-7' : 'h-8'].join(' ')}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const p = e.currentTarget.parentElement;
                    if (p) p.innerHTML = '<span class="text-white text-xl font-bold">NSS</span>';
                  }}
                />
              </Link>

              {/* Desktop links */}
              <div className="hidden md:flex items-center space-x-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    className="text-white/75 hover:text-white px-3 py-1.5 text-sm transition-colors rounded-full hover:bg-white/8"
                  >
                    {link.name}
                  </Link>
                ))}
              </div>

              {/* Right — CTA + hamburger */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowGetStarted(true)}
                  className="hidden sm:inline-flex items-center text-black bg-white hover:bg-white/85 px-4 py-2 text-sm font-semibold rounded-full transition-colors"
                >
                  Get Started
                </button>

                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="md:hidden p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label="Toggle menu"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    {isMobileMenuOpen
                      ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    }
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Mobile dropdown */}
          {isMobileMenuOpen && (
            <div
              className={[
                'md:hidden mt-2 border border-white/10 bg-black/95 backdrop-blur-xl p-2',
                scrolled ? 'rounded-2xl' : 'rounded-none',
              ].join(' ')}
            >
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className="block px-4 py-2.5 text-sm text-white/75 hover:text-white hover:bg-white/8 rounded-xl transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {link.name}
                </Link>
              ))}
              <div className="mt-1 px-2 pb-1">
                <button
                  className="w-full text-black bg-white hover:bg-white/85 px-4 py-2.5 text-sm font-semibold rounded-full transition-colors"
                  onClick={() => { setIsMobileMenuOpen(false); setShowGetStarted(true); }}
                >
                  Get Started
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Get Started modal — unchanged */}
      {showGetStarted && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
          onClick={() => setShowGetStarted(false)}
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
            <h2 className="text-white text-xl font-bold mb-2 leading-snug font-lt-wave">
              Get Started with Next Star
            </h2>
            <p className="text-gray-400 text-sm mb-2 font-lt-wave">
              Download the app and create a free account to book sessions, track your progress, and get the full Next Star Soccer experience.
            </p>
            <p className="text-gray-600 text-xs mb-7 font-lt-wave">Available on iOS and Android</p>
            <div className="flex justify-center items-center gap-4">
              <a href="https://apps.apple.com/us/app/next-star-soccer/id6754170423" target="_blank" rel="noopener noreferrer">
                <img src="/assets/images/badge-app-store.svg" alt="Download on the App Store" className="h-9 w-auto" />
              </a>
              <a href="https://play.google.com/store/apps/details?id=com.nextstarsoccer.nextstar&hl=en_US" target="_blank" rel="noopener noreferrer">
                <img src="/assets/images/badge-google-play.png" alt="Get it on Google Play" className="h-9 w-auto" />
              </a>
            </div>
            <button
              className="mt-6 text-gray-500 text-xs hover:text-gray-300 transition-colors font-lt-wave"
              onClick={() => setShowGetStarted(false)}
            >
              Maybe later
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default Navigation;
