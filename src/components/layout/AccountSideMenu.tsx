import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { LockIcon, MenuItem, useAccountMenuItems } from './AccountMenu';

// The account pages' menu, down the right side in place of the site's top
// bar: "– Page" for each account page, dimmed except the one you're on. On
// hover an item pops out a little (bigger, brighter). Locked pages stay
// dim with a lock and can't be clicked. Below lg it slides in from the right.

const isActive = (pathname: string, to: string) => pathname === to || pathname.startsWith(`${to}/`);

const Dash = () => (
  <span aria-hidden="true" className="block h-px w-3 bg-current transition-[width] duration-200 group-hover:w-4 flex-shrink-0" />
);

const Item = ({ m, active }: { m: MenuItem; active: boolean }) => {
  const base = 'group flex items-center gap-3 py-1.5 text-[15px] origin-left transition-all duration-200 ease-out';
  if (m.locked) {
    return (
      <div aria-disabled="true" className={`${base} cursor-default ${m.dim ? 'text-white/20' : 'text-white/30'}`}>
        <span aria-hidden="true" className="block h-px w-3 bg-current flex-shrink-0" />
        <span>{m.label}</span>
        <LockIcon />
      </div>
    );
  }
  return (
    <Link
      to={m.to}
      aria-current={active ? 'page' : undefined}
      className={`${base} ${
        active
          ? 'text-white font-medium'
          : 'text-white/35 hover:text-white hover:scale-[1.08] hover:-translate-x-1'
      }`}
    >
      {active ? <span aria-hidden="true" className="block h-px w-5 bg-current flex-shrink-0" /> : <Dash />}
      <span>{m.label}</span>
    </Link>
  );
};

const MenuList = () => {
  const { pathname } = useLocation();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { items, staff } = useAccountMenuItems();
  return (
    <nav aria-label="Account" className="flex flex-col">
      {items.map((m) => <Item key={m.to} m={m} active={isActive(pathname, m.to)} />)}
      {staff.length > 0 && (
        <div className="mt-6 flex flex-col">
          {staff.map((m) => <Item key={m.to} m={m} active={isActive(pathname, m.to)} />)}
        </div>
      )}
      <button
        onClick={async () => { await logout(); navigate('/'); }}
        className="group mt-6 flex items-center gap-3 py-1.5 text-[15px] text-white/35 hover:text-white hover:scale-[1.08] hover:-translate-x-1 origin-left transition-all duration-200 ease-out text-left"
      >
        <Dash />
        <span>Sign Out</span>
      </button>
    </nav>
  );
};

/** Wide screens: a column on the right that stays put as the page scrolls. */
export const AccountSideMenu = () => (
  <aside className="hidden lg:block w-48 flex-shrink-0 pt-6">
    <div className="sticky top-24 pt-1">
      <MenuList />
    </div>
  </aside>
);

/** Narrow screens: a button that slides the same menu in from the right. */
export const AccountMenuButton = () => {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        onClick={() => setOpen(true)}
        aria-label="Account menu"
        aria-expanded={open}
        className="flex items-center justify-center w-10 h-10 -mr-2 text-white"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeWidth={1.8} d="M4 7h16M8 12h12M12 17h8" />
        </svg>
      </button>
      <div
        className={`fixed inset-0 z-[400] bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setOpen(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Account menu"
        className={`fixed top-0 right-0 bottom-0 z-[401] w-72 max-w-[85vw] bg-[#0b0b0b] border-l border-white/10 px-8 pt-20 pb-10 overflow-y-auto transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <button onClick={() => setOpen(false)} aria-label="Close" className="absolute top-5 right-5 text-white/60 hover:text-white">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        {open && <MenuList />}
      </div>
    </div>
  );
};
