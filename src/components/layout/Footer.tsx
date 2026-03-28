import { Link } from 'react-router-dom';
import { images } from '../../constants/images';

const Footer = () => {
  return (
    <footer className="bg-black border-t border-white/10">
      {/* Main grid */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-10 lg:gap-8">

          {/* ── Left: Logo + App Store buttons ───────────────────────── */}
          <div className="col-span-2 md:col-span-1 lg:col-span-1 flex flex-col gap-5">
            <Link to="/" className="inline-flex items-center hover:opacity-80 transition-opacity">
              <img
                src={images.logo}
                alt="Next Star Soccer"
                className="h-9 w-auto"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            </Link>

            {/* App store badges */}
            <div className="flex flex-col gap-2.5">
              {/* Apple App Store */}
              <a
                href="https://apps.apple.com/us/app/next-star-soccer/id6754170423"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 rounded-lg px-3 py-2 transition-colors w-fit"
                aria-label="Download on the App Store"
              >
                {/* Apple logo */}
                <svg viewBox="0 0 814 1000" className="w-4 h-4 fill-white flex-shrink-0" xmlns="http://www.w3.org/2000/svg">
                  <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-37.5-167.7-107.4C67.3 730.3 14.3 620.6 14.3 510.4c0-171.4 111.8-262 221.7-262 83.5 0 152.9 55.4 204.7 55.4 49.3 0 132.9-58.9 225.9-58.9zm-101.6-179.2c37.5-44.6 64.5-107.1 64.5-169.6 0-8.9-.6-17.8-2.2-25.4-61 2.3-132.8 41.3-176.7 93.1-34.8 39.5-66.9 103.8-66.9 167.3 0 9.5 1.6 18.9 2.2 22.4 4.5.6 11.7 1.6 18.9 1.6 54.2.1 123.1-36.9 160.2-89.4z"/>
                </svg>
                <div className="flex flex-col leading-none">
                  <span className="text-white/50 text-[8px] uppercase tracking-widest">Download on the</span>
                  <span className="text-white text-[11px] font-semibold">App Store</span>
                </div>
              </a>

              {/* Google Play */}
              <a
                href="https://play.google.com/store/apps/details?id=com.nextstarsoccer.nextstar&hl=en_US"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 rounded-lg px-3 py-2 transition-colors w-fit"
                aria-label="Get it on Google Play"
              >
                {/* Google Play triangle logo */}
                <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3.18 23.76a2.07 2.07 0 0 1-1.12-.32L13.64 12 2.06.56A2.07 2.07 0 0 1 3.18.24c.38 0 .77.11 1.12.32l14.13 8.17-3.93 3.27z" fill="#EA4335"/>
                  <path d="M20.8 13.6l-2.37 1.37L14.5 12l3.93-3.27 2.37 1.37c.68.39 1.06.92 1.06 1.5s-.38 1.11-1.06 1.5z" fill="#FBBC04"/>
                  <path d="M2.06.56 13.64 12 2.06 23.44A2.3 2.3 0 0 1 1.5 22V2c0-.53.2-1.04.56-1.44z" fill="#4285F4"/>
                  <path d="M18.43 9.1 4.3.93A2.18 2.18 0 0 0 3.18.24L14.5 12l3.93-3.27-.97-.56-.03-.07z" fill="#34A853"/>
                </svg>
                <div className="flex flex-col leading-none">
                  <span className="text-white/50 text-[8px] uppercase tracking-widest">Get it on</span>
                  <span className="text-white text-[11px] font-semibold">Google Play</span>
                </div>
              </a>
            </div>
          </div>

          {/* ── Locations ────────────────────────────────────────────── */}
          <div>
            <p className="text-gray-500 text-[11px] uppercase tracking-[0.15em] font-semibold mb-4">
              Locations
            </p>
            <ul className="space-y-3">
              {['Maryland', 'Virginia', 'Washington D.C.'].map((loc) => (
                <li key={loc} className="text-gray-400 text-sm">{loc}</li>
              ))}
            </ul>
          </div>

          {/* ── Products ─────────────────────────────────────────────── */}
          <div>
            <p className="text-gray-500 text-[11px] uppercase tracking-[0.15em] font-semibold mb-4">
              Products
            </p>
            <ul className="space-y-3">
              <li>
                <Link to="/alumni" className="text-gray-400 text-sm hover:text-white transition-colors">
                  Alumni
                </Link>
              </li>
              <li>
                <Link to="/services" className="text-gray-400 text-sm hover:text-white transition-colors">
                  Services
                </Link>
              </li>
            </ul>
          </div>

          {/* ── Company ──────────────────────────────────────────────── */}
          <div>
            <p className="text-gray-500 text-[11px] uppercase tracking-[0.15em] font-semibold mb-4">
              Company
            </p>
            <ul className="space-y-3">
              <li>
                <Link to="/coaches" className="text-gray-400 text-sm hover:text-white transition-colors">
                  Coaches
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-gray-400 text-sm hover:text-white transition-colors">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* ── Connect ──────────────────────────────────────────────── */}
          <div>
            <p className="text-gray-500 text-[11px] uppercase tracking-[0.15em] font-semibold mb-4">
              Connect
            </p>
            <ul className="space-y-3">
              <li>
                <a href="https://www.instagram.com/nextstarsoccer/" target="_blank" rel="noopener noreferrer"
                  className="text-gray-400 text-sm hover:text-white transition-colors">
                  Instagram
                </a>
              </li>
              <li>
                <a href="https://www.facebook.com/nextstarsoccer/" target="_blank" rel="noopener noreferrer"
                  className="text-gray-400 text-sm hover:text-white transition-colors">
                  Facebook
                </a>
              </li>
            </ul>
          </div>

        </div>
      </div>

      {/* ── Bottom bar ────────────────────────────────────────────────── */}
      <div className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-gray-600 text-xs">
            © {new Date().getFullYear()} Next Star Soccer. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <Link to="/privacy" className="text-gray-600 text-xs hover:text-gray-400 transition-colors">
              Privacy Policy
            </Link>
            <Link to="/terms" className="text-gray-600 text-xs hover:text-gray-400 transition-colors">
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
