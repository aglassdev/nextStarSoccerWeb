import { Link, Outlet, useLocation } from 'react-router-dom';
import { images } from '../../constants/images';
import { AccountMenuButton, AccountSideMenu } from '../../components/layout/AccountSideMenu';
import { AccountProvider } from './AccountContext';

// The website's account pages (My Schedule, Payment Center, Video Analysis,
// Inbox, Profile, My Family, Settings), opened from the person icon in the
// site navigation. Each mirrors its screen in the app, laid out for a wide
// screen. There's no top bar here: the logo (back to the site) sits top
// left and the account pages are listed down the right side. An opened
// video analysis uses the full width, so the film fills the screen.

const AccountLayout = () => {
  const wide = /^\/account\/video-analysis\/[^/]+/.test(useLocation().pathname);
  return (
    <AccountProvider>
      <div className="min-h-screen bg-black">
        <div className={`${wide ? 'max-w-[1840px] px-4 md:px-6' : 'max-w-[1640px] px-4 md:px-8'} mx-auto`}>
          <header className="flex items-center justify-between h-20">
            <Link to="/" aria-label="Next Star Soccer home" className="opacity-90 hover:opacity-100 transition-opacity">
              <img src={images.logo} alt="Next Star Soccer" style={{ height: 24, width: Math.round(24 * (2974 / 634)) }} />
            </Link>
            <AccountMenuButton />
          </header>
          <div className={`flex ${wide ? 'gap-8' : 'gap-12'}`}>
            <main className="flex-1 min-w-0 pt-2 pb-16">
              <Outlet />
            </main>
            <AccountSideMenu />
          </div>
        </div>
      </div>
    </AccountProvider>
  );
};

export default AccountLayout;

/** A section's header, as in the app: a back arrow to the Dashboard and the title. */
/** Page title; a back arrow only when the page sits under another (e.g. one analysis → Video Analysis). */
export const AccountPageHeader = ({ title, back, right }: { title: string; back?: string; right?: React.ReactNode }) => (
  <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
    <div className="flex items-center gap-4 min-w-0">
      {back && (
        <Link to={back} aria-label="Back" className="text-white hover:text-gray-300 transition-colors flex-shrink-0">
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
      )}
      <h2 className="text-white text-2xl md:text-3xl font-bold truncate">{title}</h2>
    </div>
    {right}
  </div>
);

/** Shared spinner for account pages. */
export const AccountSpinner = () => (
  <div className="flex items-center justify-center h-48">
    <div className="w-8 h-8 border-2 border-white/40 border-t-transparent rounded-full animate-spin" />
  </div>
);
