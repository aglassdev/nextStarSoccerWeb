import { coaches } from '../constants/coachesData';
import { camps } from '../constants/campsData';
import { visibleClinics } from '../constants/clinicsData';

// What search engines see for each public page: its title, description and
// address. The build writes each page's HTML with these in its <head> (and
// the sitemap from the same list), so a crawler gets them without running
// the site's JavaScript; the site sets them again as you move between pages.
// Signed-in and checkout pages are kept out of search.

export const SITE = 'https://www.nextstarsoccer.com';
export const SITE_NAME = 'Next Star Soccer';
export const DEFAULT_IMAGE = `${SITE}/assets/hero-poster.jpg`;

export interface SeoPage {
  path: string;
  title: string;
  description: string;
  image?: string;
  /** Sitemap hint. */
  priority?: number;
}

/** Where the sessions are (the venues in the admin event tools). */
const AREAS = 'Bethesda, Chevy Chase, Rockville, Gaithersburg, McLean and Washington, DC';

const clip = (text: string, max = 158) => {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`;
};

const STATIC: SeoPage[] = [
  {
    path: '/',
    title: 'Next Star Soccer | Soccer Training in DC, Maryland & Virginia',
    description: `Private, small-group and team soccer training, camps and clinics in ${AREAS}, coached by former professional and college players.`,
    priority: 1,
  },
  {
    path: '/services',
    title: 'Soccer Training: Private, Group & Team | Next Star Soccer',
    description: `Individual, two-person, small-group and team soccer training, goalkeeper training, camps, clinics and video analysis in ${AREAS}.`,
    priority: 0.9,
  },
  {
    path: '/services/camps',
    title: 'Soccer Camps in Maryland & Virginia | Next Star Soccer',
    description: 'Next Star Soccer camps in McLean, Bethesda, Chevy Chase and Rockville for players of every level: dates, schedules, prices and registration.',
    priority: 0.9,
  },
  {
    path: '/services/clinics',
    title: 'Soccer Clinics | Next Star Soccer',
    description: 'Clinics with Next Star Soccer coaches in the DC, Maryland and Virginia area: dates, locations and registration.',
    priority: 0.7,
  },
  {
    path: '/services/video-analysis',
    title: 'Soccer Game Video Analysis | Next Star Soccer',
    description: 'Send your game film and a Next Star Soccer coach reviews it, marks the key moments and gives you feedback to improve your game.',
    priority: 0.7,
  },
  {
    path: '/coaches',
    title: 'Soccer Coaches: Former Pros & College Players | Next Star Soccer',
    description: 'Meet the Next Star Soccer coaches, including former MLS and national team players Chris Pontius, Steve Birnbaum, Marco Etcheverry and Patrick Mullins.',
    priority: 0.8,
  },
  {
    path: '/about',
    title: 'About Next Star Soccer',
    description: 'Founded in 2016, Next Star Soccer gives players in the DC, Maryland and Virginia area the coaching, guidance and opportunities to reach their potential.',
    priority: 0.6,
  },
  {
    path: '/alumni',
    title: 'Alumni: College & Pro Players | Next Star Soccer',
    description: 'Next Star Soccer players who have gone on to play college and professional soccer.',
    priority: 0.6,
  },
  {
    path: '/calendar',
    title: 'Training Calendar | Next Star Soccer',
    description: `Group training sessions, camps and clinics on the Next Star Soccer calendar, in ${AREAS}.`,
    priority: 0.7,
  },
  {
    path: '/scholarships',
    title: 'Scholarships | Next Star Soccer',
    description: 'Next Star Soccer scholarships help players train with us. See who can apply and how.',
    priority: 0.5,
  },
  {
    path: '/contact',
    title: 'Contact | Next Star Soccer',
    description: 'Get in touch with Next Star Soccer about private training, group sessions, camps and clinics in the DC, Maryland and Virginia area.',
    priority: 0.6,
  },
  { path: '/faq', title: 'FAQ | Next Star Soccer', description: 'Answers to common questions about Next Star Soccer training, camps, billing and accounts.', priority: 0.4 },
  { path: '/store', title: 'Store | Next Star Soccer', description: 'Next Star Soccer apparel and gear.', priority: 0.3 },
  { path: '/coachapply', title: 'Coach with Next Star Soccer', description: 'Apply to coach with Next Star Soccer in the DC, Maryland and Virginia area.', priority: 0.3 },
  { path: '/terms', title: 'Terms of Service | Next Star Soccer', description: 'Next Star Soccer terms of service.', priority: 0.1 },
  { path: '/privacy', title: 'Privacy Policy | Next Star Soccer', description: 'Next Star Soccer privacy policy.', priority: 0.1 },
];

const COACH_PAGES: SeoPage[] = coaches.map((c) => ({
  path: `/coaches/${c.slug}`,
  title: `${c.name}, ${c.title} | Next Star Soccer`,
  description: clip(c.bio?.[0] || `${c.name} coaches with Next Star Soccer in the DC, Maryland and Virginia area.`),
  image: `${SITE}${c.cardPhoto || c.avatarUrl}`,
  priority: 0.6,
}));

const CAMP_PAGES: SeoPage[] = camps.map((c) => ({
  path: `/services/camps/${c.slug}`,
  title: `${c.name}, ${c.location.city} | Next Star Soccer`,
  description: clip(`${c.heroDateRange} at ${c.location.name}, ${c.location.city}. ${c.priceSummary}. ${c.pricingNote}. ${c.description}`),
  image: `${SITE}${c.photos[0]}`,
  priority: 0.7,
}));

const CLINIC_PAGES: SeoPage[] = visibleClinics.map((c) => ({
  path: `/services/clinics/${c.slug}`,
  title: `${c.name}, ${c.location.city} | Next Star Soccer`,
  description: clip(`${c.heroDateRange} at ${c.location.name}, ${c.location.city}. ${c.description}`),
  image: c.heroImage ? `${SITE}${c.heroImage}` : undefined,
  priority: 0.6,
}));

export const SEO_PAGES: SeoPage[] = [...STATIC, ...COACH_PAGES, ...CAMP_PAGES, ...CLINIC_PAGES];

const BY_PATH = new Map(SEO_PAGES.map((p) => [p.path, p]));

/** Signed-in, staff, checkout and sign-in pages: kept out of search. */
const PRIVATE = ['/account', '/coach', '/admin', '/checkout', '/signin', '/login', '/signup', '/user', '/dashboard', '/reset-password', '/verify', '/status', '/calendar-embed', '/services-preview', '/scholarships/apply'];

export const isPrivatePath = (pathname: string) =>
  PRIVATE.some((p) => pathname === p || pathname.startsWith(`${p}/`));

export const seoFor = (pathname: string): SeoPage | null => BY_PATH.get(pathname.replace(/\/+$/, '') || '/') ?? null;

/** The business, for search engines (schema.org). */
export const ORGANIZATION_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'SportsOrganization',
  name: SITE_NAME,
  url: SITE,
  logo: `${SITE}/favicon-light.png`,
  sport: 'Soccer',
  description: `Soccer training, camps and clinics for players of every age in ${AREAS}.`,
  foundingDate: '2016',
  email: 'info@nextstarsoccer.com',
  telephone: '+1-301-742-1796',
  areaServed: [
    { '@type': 'City', name: 'Bethesda, MD' },
    { '@type': 'City', name: 'Chevy Chase, MD' },
    { '@type': 'City', name: 'Rockville, MD' },
    { '@type': 'City', name: 'Gaithersburg, MD' },
    { '@type': 'City', name: 'McLean, VA' },
    { '@type': 'City', name: 'Washington, DC' },
  ],
  sameAs: ['https://www.instagram.com/nextstarsoccer/', 'https://www.facebook.com/nextstarsoccer/'],
};
