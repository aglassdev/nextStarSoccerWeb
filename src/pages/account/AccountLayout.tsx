import { Link, Outlet, useLocation } from 'react-router-dom';
import { AccountProvider } from './AccountContext';

// The website's Account Center, laid out like the app's Account screen: the
// Dashboard is the hub, and each section (Payment Center, My Family, Video
// Analysis, Settings) opens as its own page with a back arrow — the same
// design, wider, with bigger cards. An opened video analysis uses the full
// width, like the coach's workspace, so the film fills the screen.

const AccountLayout = () => {
  const wide = /^\/account\/video-analysis\/[^/]+/.test(useLocation().pathname);
  return (
  <AccountProvider>
    <div className="min-h-screen bg-black">
      <div className={`${wide ? 'max-w-[1600px] px-4 md:px-6' : 'max-w-6xl px-5 md:px-8'} mx-auto pt-6 pb-16`}>
        <Link to="/" aria-label="Next Star Soccer — home" className="inline-block opacity-80 hover:opacity-100 transition-opacity">
          <img
            src="/assets/images/NextStarBall.png"
            alt="Next Star"
            className="w-8 h-8"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </Link>
        <main className="mt-4">
          <Outlet />
        </main>
      </div>
    </div>
  </AccountProvider>
  );
};

export default AccountLayout;

/** A section's header, as in the app: a back arrow to the Dashboard and the title. */
export const AccountPageHeader = ({ title, back = '/account', right }: { title: string; back?: string; right?: React.ReactNode }) => (
  <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
    <div className="flex items-center gap-4 min-w-0">
      <Link to={back} aria-label="Back" className="text-white hover:text-gray-300 transition-colors flex-shrink-0">
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </Link>
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
