import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { images } from '../../constants/images';
import { useAuth } from '../../contexts/AuthContext';
import CreateAccountModal from '../common/CreateAccountModal';
import AccountMenu from './AccountMenu';
import { ACCOUNTS_LIVE } from '../../constants/features';

// The wordmark is NEXT ⦿ STAR with the ball dead centre, and the ball is as
// wide as the image is tall (634 × 634 in a 2974 × 634 file). So collapsing it
// is a symmetric clip: narrow a window that keeps the image centred and the
// letters on either side wipe inward, leaving the ball exactly where it was.
const LOGO_HEIGHT = 28;
const LOGO_WIDTH = Math.round(LOGO_HEIGHT * (2974 / 634));

const CollapsingLogo = ({ collapsed }: { collapsed: boolean }) => (
  <span
    className="relative flex justify-center overflow-hidden transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
    style={{ width: collapsed ? LOGO_HEIGHT : LOGO_WIDTH, height: LOGO_HEIGHT }}
  >
    <img
      src={images.logo}
      alt="Next Star Soccer"
      className="max-w-none flex-shrink-0"
      style={{ width: LOGO_WIDTH, height: LOGO_HEIGHT }}
    />
  </span>
);

const Navigation = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showGetStarted, setShowGetStarted]     = useState(false);
  const [showChoiceMenu, setShowChoiceMenu]     = useState(false);
  const [scrolled, setScrolled]                 = useState(false);
  const getStartedRef = useRef<HTMLButtonElement>(null);

  // Past this point the wordmark folds away and leaves only the ball.
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 24);
    fn();
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  useEffect(() => {
    if (!showChoiceMenu) return;
    const fn = (e: MouseEvent) => {
      if (getStartedRef.current && !getStartedRef.current.closest('div')?.contains(e.target as Node)) {
        setShowChoiceMenu(false);
      }
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [showChoiceMenu]);

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
      {/* ─── Full-width bar, pinned to the top. It keeps its shape on scroll;
             only the logo changes. ─── */}
      <header className="fixed top-0 inset-x-0 z-50 bg-black/85 backdrop-blur-xl border-b border-white/[0.08]">
            <div className="flex items-center justify-between font-lt-wave max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16">
              {/* Logo — NEXT and STAR fold in behind the ball as the page scrolls.
                  The link keeps the full wordmark's width so the links beside it
                  never shift while it collapses. */}
              <Link
                to="/"
                aria-label="Next Star Soccer — home"
                className="flex-shrink-0 flex items-center hover:opacity-75 transition-opacity"
                style={{ width: LOGO_WIDTH }}
              >
                <CollapsingLogo collapsed={scrolled} />
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
                {ACCOUNTS_LIVE && user ? (
                  // Signed in: the person icon opens the account pages.
                  <AccountMenu />
                ) : (
                <div className="relative">
                  <button
                    ref={getStartedRef}
                    onClick={() => setShowChoiceMenu(v => !v)}
                    className="hidden sm:inline-flex items-center text-black bg-white hover:bg-white/85 px-4 py-2 text-sm font-semibold rounded-full transition-colors"
                  >
                    Get Started
                    <svg className={`ml-1.5 w-3 h-3 transition-transform duration-200 ${showChoiceMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {showChoiceMenu && (
                    <div className="absolute right-0 top-full mt-2 w-48 bg-[#111] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-[300]">
                      <button
                        onClick={() => { setShowChoiceMenu(false); setShowGetStarted(true); }}
                        className="w-full flex items-center gap-3 px-4 py-3.5 text-white text-sm font-medium hover:bg-white/[0.07] transition-colors text-left"
                      >
                        <svg className="w-4 h-4 text-white/40 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={ACCOUNTS_LIVE ? 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z' : 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'} />
                        </svg>
                        {ACCOUNTS_LIVE ? 'Create account' : 'Player'}
                      </button>
                      <div className="h-px bg-white/[0.06] mx-4" />
                      <button
                        onClick={() => { setShowChoiceMenu(false); navigate(ACCOUNTS_LIVE ? '/signin' : '/coachapply'); }}
                        className="w-full flex items-center gap-3 px-4 py-3.5 text-white text-sm font-medium hover:bg-white/[0.07] transition-colors text-left"
                      >
                        <svg className="w-4 h-4 text-white/40 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={ACCOUNTS_LIVE ? 'M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1' : 'M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z'} />
                        </svg>
                        {ACCOUNTS_LIVE ? 'Sign in' : 'Coach'}
                      </button>
                    </div>
                  )}
                </div>
                )}

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

          {/* Mobile dropdown */}
          {isMobileMenuOpen && (
            <div className="md:hidden border-t border-white/[0.08] bg-black/95 backdrop-blur-xl p-2">
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
              <div className="mt-1 px-2 pb-1 space-y-2">
                {ACCOUNTS_LIVE && user ? null : (
                  <>
                    <button
                      className="w-full text-black bg-white hover:bg-white/85 px-4 py-2.5 text-sm font-semibold rounded-full transition-colors"
                      onClick={() => { setIsMobileMenuOpen(false); setShowGetStarted(true); }}
                    >
                      {ACCOUNTS_LIVE ? 'Create account' : 'Get Started — Player'}
                    </button>
                    <button
                      className="w-full text-white bg-white/10 hover:bg-white/15 px-4 py-2.5 text-sm font-semibold rounded-full transition-colors"
                      onClick={() => { setIsMobileMenuOpen(false); navigate(ACCOUNTS_LIVE ? '/signin' : '/coachapply'); }}
                    >
                      {ACCOUNTS_LIVE ? 'Sign in' : 'Get Started — Coach'}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
      </header>

      {showGetStarted && <CreateAccountModal legacy={!ACCOUNTS_LIVE} onClose={() => setShowGetStarted(false)} />}
    </>
  );
};

export default Navigation;
