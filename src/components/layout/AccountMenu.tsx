import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Query } from 'appwrite';
import { AccountInfo, COACH_DASHBOARD_LIVE, isPureCoach, resolveAccount } from '../../services/accountProfile';
import { databases, databaseId } from '../../services/appwrite';
import { ANALYSES_COLLECTION } from '../../services/videoAnalysis';

// The signed-in person icon in the site navigation. It opens a menu of the
// account pages (there's no separate account hub page), like the app's
// Account screen.

/** `locked` shows a lock and can't be clicked; `dim` greys it out. */
export type MenuItem = { label: string; to: string; locked?: boolean; dim?: boolean };

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

// Whether the account has bought a video analysis (Video Analysis is locked until then).
const purchaseCache = new Map<string, Promise<boolean>>();
const hasVideoAnalysis = (userId: string) => {
  if (!purchaseCache.has(userId)) {
    purchaseCache.set(userId, databases
      .listDocuments(databaseId, ANALYSES_COLLECTION, [Query.equal('purchaserUserId', userId), Query.limit(1)])
      .then((r) => r.total > 0)
      .catch(() => {
        purchaseCache.delete(userId);
        return false;
      }));
  }
  return purchaseCache.get(userId)!;
};

const menuFor = (info: AccountInfo | null, boughtAnalysis: boolean): { items: MenuItem[]; staff: MenuItem[] } => {
  const staff: MenuItem[] = [
    ...(info?.isCoach && COACH_DASHBOARD_LIVE ? [{ label: 'Coach Dashboard', to: '/coach' }] : []),
    ...(info?.isAdmin ? [{ label: 'Admin', to: '/admin/dashboard' }] : []),
  ];
  if (info && COACH_DASHBOARD_LIVE && isPureCoach(info)) {
    return { items: [{ label: 'Settings', to: '/account/settings' }], staff };
  }
  return {
    items: [
      { label: 'Profile', to: '/account/profile' },
      { label: 'My Schedule', to: '/account/schedule' },
      { label: 'Payment Center', to: '/account/payments' },
      // Not open yet: shown greyed out and locked.
      { label: 'At-Home Training', to: '/account/home-training', locked: true, dim: true },
      { label: 'Video Analysis', to: '/account/video-analysis', locked: !boughtAnalysis },
      { label: 'Inbox', to: '/account/inbox' },
      ...(info?.userType === 'parent' ? [{ label: 'My Family', to: '/account/family' }] : []),
      { label: 'Settings', to: '/account/settings' },
    ],
    staff,
  };
};

/** The account pages for the signed-in user, shared by this menu and the account pages' side menu. */
export const useAccountMenuItems = () => {
  const { user } = useAuth();
  const [info, setInfo] = useState<AccountInfo | null>(null);
  const [boughtAnalysis, setBoughtAnalysis] = useState(false);
  useEffect(() => {
    if (!user) return;
    let live = true;
    accountInfoFor(user.$id).then((i) => live && setInfo(i)).catch(() => {});
    hasVideoAnalysis(user.$id).then((b) => live && setBoughtAnalysis(b));
    return () => { live = false; };
  }, [user]);
  return menuFor(info, boughtAnalysis);
};

export const LockIcon = () => (
  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-label="Locked">
    <rect x="5" y="11" width="14" height="9" rx="2" strokeWidth={1.9} />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.9} d="M8 11V8a4 4 0 118 0v3" />
  </svg>
);

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
  const { items, staff } = useAccountMenuItems();
  const ref = useRef<HTMLDivElement>(null);

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
  const itemClass = (m: MenuItem) => {
    const active = pathname === m.to || pathname.startsWith(`${m.to}/`);
    const tone = m.locked
      ? `cursor-default ${m.dim ? 'text-white/35' : 'text-white/80'}`
      : active ? 'text-white bg-white/[0.08]' : 'text-white/80 hover:text-white hover:bg-white/[0.06]';
    return `flex items-center justify-between gap-3 px-4 py-2.5 text-sm transition-colors ${tone}`;
  };
  const renderItem = (m: MenuItem) => {
    const content = <><span>{m.label}</span>{m.locked && <LockIcon />}</>;
    return m.locked ? (
      <div key={m.to} role="menuitem" aria-disabled="true" className={itemClass(m)}>{content}</div>
    ) : (
      <Link key={m.to} to={m.to} role="menuitem" className={itemClass(m)}>{content}</Link>
    );
  };

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
            {items.map(renderItem)}
          </div>
          {staff.length > 0 && (
            <div className="py-1.5 border-t border-white/[0.08]">
              {staff.map(renderItem)}
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
