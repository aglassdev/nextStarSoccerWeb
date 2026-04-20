import { useState } from 'react';
import { Link } from 'react-router-dom';
import { images } from '../../constants/images';

const Navigation = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showGetStarted, setShowGetStarted] = useState(false);

  const navLinks = [
    { name: 'Coaches', path: '/coaches' },
    { name: 'Alumni', path: '/alumni' },
    { name: 'Services', path: '/services' },
    { name: 'Calendar', path: '/calendar' },
    { name: 'Scholarships', path: '/scholarships' },
    { name: 'Store', path: '/store' },
    { name: 'Contact', path: '/contact' },
  ];

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <div className="flex-shrink-0">
              <Link to="/" className="flex items-center hover:opacity-80 transition-opacity">
                <img
                  src={images.logo}
                  alt="Next Star Soccer"
                  className="h-8 w-auto"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const parent = e.currentTarget.parentElement;
                    if (parent) {
                      parent.innerHTML = '<span class="text-white text-xl font-bold">⚽ NSS</span>';
                    }
                  }}
                />
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className="text-white hover:text-gray-300 px-3 py-2 text-sm font-medium transition-colors"
                >
                  {link.name}
                </Link>
              ))}
              <button
                onClick={() => setShowGetStarted(true)}
                className="text-black bg-white hover:bg-gray-100 px-4 py-2 text-sm font-semibold rounded-lg transition-colors"
              >
                Get Started
              </button>
            </div>

            {/* Right side controls */}
            <div className="flex items-center">
              {/* Mobile menu button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden ml-4 p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-800 focus:outline-none"
                aria-label="Toggle menu"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  {isMobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-gray-900 border-t border-gray-800">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className="text-white hover:text-gray-300 hover:bg-gray-800 block px-3 py-2 rounded-md text-base font-medium transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {link.name}
                </Link>
              ))}
              <button
                className="w-full text-left text-white hover:text-gray-300 hover:bg-gray-800 block px-3 py-2 rounded-md text-base font-medium transition-colors"
                onClick={() => { setIsMobileMenuOpen(false); setShowGetStarted(true); }}
              >
                Get Started
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Get Started Modal */}
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
            <h2 className="text-white text-xl font-bold mb-2 leading-snug">
              Get Started with Next Star
            </h2>
            <p className="text-gray-400 text-sm mb-2">
              Download the app and create a free account to book sessions, track your progress, and get the full Next Star Soccer experience.
            </p>
            <p className="text-gray-600 text-xs mb-7">Available on iOS and Android</p>
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
