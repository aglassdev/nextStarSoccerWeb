import { useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { AccountProvider, useAccount } from '../account/AccountContext';
import { ensureCoachRole } from '../../services/videoAnalysis';
import { ACCOUNTS_LIVE } from '../../constants/features';

// The web coach dashboard: the same account a coach uses in the app. Admins
// can open it too (the admin dashboard's Video Analysis section links here).

export const COACH_TABS: { to: string; label: string; end?: boolean }[] = [
  { to: '/coach', label: 'Video Analysis', end: true },
  { to: '/coach/sessions', label: 'Sessions' },
  { to: '/coach/requests', label: 'Requests' },
];

let roleChecked = false;

const Frame = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { loading, isCoach, isAdmin, userType } = useAccount();
  const wide = pathname.startsWith('/coach/analysis/');

  // New coach accounts get the "coach" tag that lets them see game film.
  useEffect(() => {
    if (!loading && isCoach && !roleChecked) {
      roleChecked = true;
      ensureCoachRole().catch(() => { roleChecked = false; });
    }
  }, [loading, isCoach]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/40 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (ACCOUNTS_LIVE ? !isCoach && !isAdmin : !isAdmin) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <p className="text-white font-semibold">The coach dashboard is for Next Star coaches</p>
          <p className="text-gray-500 text-sm mt-2">This account doesn't have a coach profile.</p>
          <Link to={ACCOUNTS_LIVE ? '/account' : '/'} className="inline-block mt-5 px-6 py-2.5 bg-white text-black text-sm font-semibold rounded-lg">
            {ACCOUNTS_LIVE ? 'Go to your account' : 'Back to the site'}
          </Link>
        </div>
      </div>
    );
  }

  const hasAccountCenter = userType && userType !== 'coach';

  return (
    <div className="min-h-screen bg-black">
      <header className="border-b border-white/10">
        <div className={`${wide ? 'max-w-[1600px]' : 'max-w-6xl'} mx-auto px-4 md:px-6 py-4 flex items-center justify-between gap-3`}>
          <Link to="/coach" className="flex items-center gap-3 min-w-0">
            <img src="/assets/images/NextStarBall.png" alt="Next Star" className="w-7 h-7 opacity-90 flex-shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <h1 className="text-white font-bold text-lg truncate">Coach Dashboard</h1>
          </Link>
          <div className="flex items-center gap-2 flex-shrink-0">
            {isAdmin && <Link to="/admin/dashboard" className="hidden sm:inline-block text-sm text-gray-400 hover:text-white px-3 py-1.5">Admin</Link>}
            {ACCOUNTS_LIVE && hasAccountCenter && <Link to="/account" className="hidden sm:inline-block text-sm text-gray-400 hover:text-white px-3 py-1.5">Account Center</Link>}
            <button
              onClick={async () => { await logout(); navigate('/signin'); }}
              className="text-sm text-gray-400 hover:text-white border border-white/10 hover:border-white/30 rounded-lg px-4 py-1.5 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
        {!wide && (
          <nav className="max-w-6xl mx-auto px-4 md:px-6 flex gap-1 overflow-x-auto -mb-px">
            {COACH_TABS.map((t) => (
              <NavLink key={t.to} to={t.to} end={t.end}
                className={({ isActive }) =>
                  `whitespace-nowrap px-3 py-2.5 text-sm border-b-2 transition-colors ${
                    isActive ? 'border-white text-white' : 'border-transparent text-gray-500 hover:text-gray-300'
                  }`
                }>
                {t.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>
      <main className={`${wide ? 'max-w-[1600px] py-5' : 'max-w-6xl py-8'} mx-auto px-4 md:px-6`}>
        <Outlet />
      </main>
    </div>
  );
};

const CoachLayout = () => (
  <AccountProvider>
    <Frame />
  </AccountProvider>
);

export default CoachLayout;
