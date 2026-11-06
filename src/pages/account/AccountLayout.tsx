import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { AccountProvider, useAccount } from './AccountContext';
import { COACH_DASHBOARD_LIVE } from '../../services/accountProfile';

// The website's Account Center, mirroring the app's: overview, payments
// (the app's Payment Center), family, settings. Every page under /account
// renders inside this frame.

export const ACCOUNT_TABS: { to: string; label: string; end?: boolean; parentsOnly?: boolean }[] = [
  { to: '/account', label: 'Overview', end: true },
  { to: '/account/video-analysis', label: 'Video Analysis' },
  { to: '/account/payments', label: 'Payment Center' },
  { to: '/account/family', label: 'My Family', parentsOnly: true },
  { to: '/account/settings', label: 'Settings' },
];

const Frame = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { userType, isAdmin } = useAccount();
  const isCoach = useAccount().isCoach && COACH_DASHBOARD_LIVE;
  const tabs = ACCOUNT_TABS.filter((t) => !t.parentsOnly || userType === 'parent');

  return (
    <div className="min-h-screen bg-black">
      <header className="border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-3 min-w-0">
            <img
              src="/assets/images/NextStarBall.png"
              alt="Next Star"
              className="w-7 h-7 opacity-90 flex-shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <h1 className="text-white font-bold text-lg truncate">Account Center</h1>
          </Link>
          <div className="flex items-center gap-2 flex-shrink-0">
            {isAdmin && (
              <Link
                to="/admin/dashboard"
                className="hidden sm:inline-block text-sm text-gray-400 hover:text-white px-3 py-1.5 transition-colors"
              >
                Admin
              </Link>
            )}
            {isCoach && (
              <Link
                to="/coach"
                className="hidden sm:inline-block text-sm text-gray-400 hover:text-white px-3 py-1.5 transition-colors"
              >
                Coach Dashboard
              </Link>
            )}
            <button
              onClick={async () => { await logout(); navigate('/signin'); }}
              className="text-sm text-gray-400 hover:text-white border border-white/10 hover:border-white/30 rounded-lg px-4 py-1.5 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
        <nav className="max-w-5xl mx-auto px-4 md:px-6 flex gap-1 overflow-x-auto scrollbar-none -mb-px">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `whitespace-nowrap px-3 py-2.5 text-sm border-b-2 transition-colors ${
                  isActive ? 'border-white text-white' : 'border-transparent text-gray-500 hover:text-gray-300'
                }`
              }
            >
              {t.label}
            </NavLink>
          ))}
          {isCoach && (
            <NavLink to="/coach" className="sm:hidden whitespace-nowrap px-3 py-2.5 text-sm border-b-2 border-transparent text-gray-500">
              Coach Dashboard
            </NavLink>
          )}
        </nav>
      </header>
      <main className="max-w-5xl mx-auto px-4 md:px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
};

const AccountLayout = () => (
  <AccountProvider>
    <Frame />
  </AccountProvider>
);

export default AccountLayout;

/** Shared spinner for account pages. */
export const AccountSpinner = () => (
  <div className="flex items-center justify-center h-48">
    <div className="w-8 h-8 border-2 border-white/40 border-t-transparent rounded-full animate-spin" />
  </div>
);
