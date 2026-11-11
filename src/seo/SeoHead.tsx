import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { SEO_PAGES, SITE, SITE_NAME, isPrivatePath, seoFor } from './seoRoutes';

// Keeps the page's title, description, canonical address and (for signed-in
// and checkout pages) noindex in step with the page you're on. The built
// HTML already has them for each public page; this covers moving around the
// site without a reload.

const HOME = SEO_PAGES[0];

const setMeta = (attr: 'name' | 'property', key: string, content: string | null) => {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (content === null) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
};

const setCanonical = (href: string) => {
  let el = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.rel = 'canonical';
    document.head.appendChild(el);
  }
  el.href = href;
};

const SeoHead = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    const page = seoFor(pathname);
    const hidden = isPrivatePath(pathname);
    const title = page?.title ?? (hidden ? SITE_NAME : HOME.title);
    const description = page?.description ?? HOME.description;
    const url = `${SITE}${page ? page.path : pathname}`;
    document.title = title;
    setMeta('name', 'description', description);
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:url', url);
    setMeta('name', 'robots', hidden ? 'noindex, nofollow' : null);
    setCanonical(url);
  }, [pathname]);
  return null;
};

export default SeoHead;
