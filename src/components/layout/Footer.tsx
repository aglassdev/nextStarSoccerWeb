import { Link } from 'react-router-dom';
import { images } from '../../constants/images';

const Footer = () => {
  return (
    <footer className="bg-black border-t border-white/10">
      {/* Main grid */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-10 lg:gap-8">

          {/* ── Left: Logo only ──────────────────────────────────────── */}
          <div className="col-span-2 md:col-span-1 lg:col-span-1 flex flex-col">
            <Link to="/" className="inline-flex items-center hover:opacity-80 transition-opacity">
              <img
                src={images.logo}
                alt="Next Star Soccer"
                className="h-9 w-auto"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            </Link>
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
