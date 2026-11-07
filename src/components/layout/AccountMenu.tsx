import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { AccountInfo, COACH_DASHBOARD_LIVE, isPureCoach, resolveAccount } from '../../services/accountProfile';

// The signed-in person icon in the site navigation. It opens a menu of the
// account pages (there's no separate account hub page), like the app's
// Account screen.

type MenuItem = { label: string; to: string };

// Profile and Inbox join the menu once their pages are in place.
const PROFILE_PAGE_LIVE = false;
const INBOX_PAGE_LIVE = true;

// One lookup per signed-in user, shared by every page's navigation bar.
const accountCache = new Map<string, Promise<AccountInfo>>();
const accountInfoFor = (userId: string) => {
  if (!accountCache.has(userId)) {
    accountCache.set(userId, resolveAccount(userId).catch((e) => {
      accountCache.delete(userId);
      throw e;
    }));
  }
  return accountCache.get(userId)!;
};

const menuFor = (info: AccountInfo | null): { items: MenuItem[]; staff: MenuItem[] } => {
  const staff: MenuItem[] = [
    ...(info?.isCoach && COACH_DASHBOARD_LIVE ? [{ label: 'Coach Dashboard', to: '/coach' }] : []),
    ...(info?.isAdmin ? [{ label: 'Admin', to: '/admin/dashboard' }] : []),
  ];
  if (info && COACH_DASHBOARD_LIVE && isPureCoach(info)) {
    return { items: [{ label: 'Settings', to: '/account/settings' }], staff };
  }
  return {
    items: [
      ...(PROFILE_PAGE_LIVE ? [{ label: 'Profile', to: '/account/profile' }] : []),
      { label: 'My Schedule', to: '/account/schedule' },
      { label: 'Payment Center', to: '/account/payments' },
      { label: 'Video Analysis', to: '/account/video-analysis' },
      ...(INBOX_PAGE_LIVE ? [{ label: 'Inbox', to: '/account/inbox' }] : []),
      ...(info?.userType === 'parent' ? [{ label: 'My Family', to: '/account/family' }] : []),
      { label: 'Settings', to: '/account/settings' },
    ],
    staff,
  };
};

const PersonIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.9} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const AccountMenu = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<AccountInfo | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    let live = true;
    accountInfoFor(user.$id).then((i) => live && setInfo(i)).catch(() => {});
    return () => { live = false; };
  }, [user]);

  // Close on navigation, outside click and Escape.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!user) return null;
  const { items, staff } = menuFor(info);
  const itemClass = (to: string) =>
    `block px-4 py-2.5 text-sm transition-colors ${
      pathname === to || pathname.startsWith(`${to}/`) ? 'text-white bg-white/[0.08]' : 'text-white/80 hover:text-white hover:bg-white/[0.06]'
    }`;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center justify-center w-9 h-9 rounded-full bg-white text-black hover:bg-white/85 transition-colors"
      >
        <PersonIcon />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-full mt-2 w-64 bg-[#111] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-[300]">
          <div className="px-4 py-3.5 border-b border-white/[0.08]">
            <p className="text-white text-sm font-semibold truncate">{user.name || 'Your account'}</p>
            <p className="text-white/45 text-xs truncate mt-0.5">{user.email}</p>
          </div>
          <div className="py-1.5">
            {items.map((m) => (
              <Link key={m.to} to={m.to} role="menuitem" className={itemClass(m.to)}>{m.label}</Link>
            ))}
          </div>
          {staff.length > 0 && (
            <div className="py-1.5 border-t border-white/[0.08]">
              {staff.map((m) => (
                <Link key={m.to} to={m.to} role="menuitem" className={itemClass(m.to)}>{m.label}</Link>
              ))}
            </div>
          )}
          <div className="py-1.5 border-t border-white/[0.08]">
            <button
              role="menuitem"
              onClick={async () => { setOpen(false); await logout(); navigate('/'); }}
              className="w-full text-left px-4 py-2.5 text-sm text-white/80 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountMenu;
