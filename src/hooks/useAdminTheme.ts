import { useEffect, useState } from 'react';

// The admin pages are built dark. Light mode inverts the whole page once at
// the root (see `html.admin-light` in index.css) and flips photos and video
// back, which turns every hand-picked dark shade into its light counterpart
// without restyling each section.
export type AdminTheme = 'system' | 'light' | 'dark';

const KEY = 'nss.adminTheme';
const EVENT = 'nss-admin-theme';

export const readAdminTheme = (): AdminTheme => {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
  } catch { return 'system'; }
};

export const setAdminTheme = (t: AdminTheme) => {
  try { localStorage.setItem(KEY, t); } catch { /* storage blocked */ }
  window.dispatchEvent(new Event(EVENT));
};

const prefersLight = () => window.matchMedia('(prefers-color-scheme: light)').matches;

export const useAdminTheme = (): AdminTheme => {
  const [theme, setTheme] = useState<AdminTheme>(readAdminTheme);
  useEffect(() => {
    const sync = () => setTheme(readAdminTheme());
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener('storage', sync); };
  }, []);
  return theme;
};

// Applies the chosen theme while `active` (an admin route is showing), and
// follows the device setting live when the choice is System.
export const useApplyAdminTheme = (active: boolean) => {
  const theme = useAdminTheme();
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const apply = () => {
      const light = active && (theme === 'light' || (theme === 'system' && prefersLight()));
      root.classList.toggle('admin-light', light);
    };
    apply();
    mq.addEventListener('change', apply);
    return () => { mq.removeEventListener('change', apply); root.classList.remove('admin-light'); };
  }, [active, theme]);
};
