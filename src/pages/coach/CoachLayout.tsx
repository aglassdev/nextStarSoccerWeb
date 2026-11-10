import { useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import Navigation from '../../components/layout/Navigation';
import { AccountMenuButton, AccountSideMenu } from '../../components/layout/AccountSideMenu';
import type { MenuItem } from '../../components/layout/AccountMenu';
import { AccountProvider, useAccount } from '../account/AccountContext';
import { ensureCoachRole } from '../../services/videoAnalysis';
import { ACCOUNTS_LIVE } from '../../constants/features';

// The web coach dashboard: the same account a coach uses in the app. Admins
// can open it too. Laid out like the Account Center: the site's top bar, the
// page, and the coach's pages down the right side (behind a menu button on
// narrow screens). An opened video analysis uses the full width.

const ITEMS: MenuItem[] = [
  { label: 'Dashboard', to: '/coach' },
  { label: 'Calendar', to: '/coach/calendar' },
  { label: 'Inbox', to: '/coach/inbox' },
  { label: 'Video Analysis', to: '/coach/video-analysis' },
];

const isActive = (pathname: string, to: string) => {
  if (to === '/coach') return pathname === '/coach' || pathname === '/coach/' || pathname.startsWith('/coach/session/');
  if (to === '/coach/video-analysis') return pathname.startsWith('/coach/video-analysis') || pathname.startsWith('/coach/analysis/');
  return pathname === to || pathname.startsWith(`${to}/`);
};

let roleChecked = false;

const Frame = () => {
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

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen bg-black">
      <Navigation />
      {children}
    </div>
  );

  if (loading) {
    return shell(
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/40 border-t-transparent rounded-full animate-spin" />
      </div>,
    );
  }

  if (ACCOUNTS_LIVE ? !isCoach && !isAdmin : !isAdmin) {
    return shell(
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <p className="text-white font-semibold">The coach dashboard is for Next Star coaches</p>
          <p className="text-gray-500 text-sm mt-2">This account doesn't have a coach profile.</p>
          <Link to={ACCOUNTS_LIVE ? '/account' : '/'} className="inline-block mt-5 px-6 py-2.5 bg-white text-black text-sm font-semibold rounded-lg">
            {ACCOUNTS_LIVE ? 'Go to your account' : 'Back to the site'}
          </Link>
        </div>
      </div>,
    );
  }

  // Players and parents who also coach keep their Account Center; a coach-only account has Settings.
  const staff: MenuItem[] = [
    ...(userType && userType !== 'coach'
      ? [{ label: 'Account Center', to: '/account/profile' }]
      : [{ label: 'Settings', to: '/account/settings' }]),
    ...(isAdmin ? [{ label: 'Admin', to: '/admin/dashboard' }] : []),
  ];
  const menu = { items: ITEMS, staff, isActive };

  return shell(
    <div className={`${wide ? 'max-w-[1840px] px-4 md:px-6' : 'max-w-[1640px] px-4 md:px-8'} mx-auto pt-16`}>
      {!wide && (
        <div className="lg:hidden flex items-center justify-between h-14">
          <span className="text-white/40 text-xs tracking-[0.18em] uppercase">Coach Dashboard</span>
          <AccountMenuButton menu={menu} />
        </div>
      )}
      <div className="flex gap-12">
        <main className={`flex-1 min-w-0 ${wide ? 'pt-5' : 'pt-2 lg:pt-6'} pb-16`}>
          <Outlet />
        </main>
        {!wide && <AccountSideMenu menu={menu} />}
      </div>
    </div>,
  );
};

const CoachLayout = () => (
  <AccountProvider>
    <Frame />
  </AccountProvider>
);

export default CoachLayout;
