import { images, serviceImages, homeImages } from '../constants/images';
import { coaches } from '../constants/coachesData';
import { camps } from '../constants/campsData';
import { visibleClinics, isClinicOver } from '../constants/clinicsData';
import { loadAlumni, firstScreenAlumniImages } from '../services/alumniData';
import { preloadQueue } from './imagePreload';

// Once the site has opened and the first page has its photos, the other
// pages' photos load in the background, a few at a time at low priority, so
// moving around the site doesn't wait on them (and the loading screen is
// usually skipped). The Alumni list and its first cards load too.
//
// Phones get the first screen of each page only, and nothing loads on a slow
// connection or with Data Saver on.

const clinicsInOrder = [
  ...visibleClinics.filter((c) => !isClinicOver(c)),
  ...visibleClinics.filter((c) => isClinicOver(c)),
];

/** What each page shows first, in rough order of where people go next. */
const FIRST_SCREENS = [
  serviceImages.individual, serviceImages.twoPerson, serviceImages.smallGroup,
  serviceImages.largeGroup, serviceImages.goalkeeping,
  ...coaches.map((c) => c.avatarUrl),
  ...camps.slice(0, 4).map((c) => c.photos[0]),
  ...clinicsInOrder.slice(0, 2).map((c) => c.image),
  images.charity1,
];

/** Everything further down those pages, and the detail pages' photos. */
const FURTHER_DOWN = [
  ...Object.values(serviceImages),
  ...coaches.map((c) => c.cardPhoto),
  homeImages.about, homeImages.team, homeImages.fundamentalsPoster,
  ...camps.flatMap((c) => c.photos),
  ...clinicsInOrder.map((c) => c.image),
  ...clinicsInOrder.map((c) => c.heroImage),
  images.charity2,
];

function slowConnection(): boolean {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return !!c && (!!c.saveData || ['slow-2g', '2g', '3g'].includes(c.effectiveType ?? ''));
}

let started = false;

export function startSitePreload() {
  if (started || typeof window === 'undefined' || slowConnection()) return;
  started = true;
  const phone = window.matchMedia('(max-width: 767px)').matches;

  const run = async () => {
    await preloadQueue(FIRST_SCREENS);
    try {
      await preloadQueue(firstScreenAlumniImages(await loadAlumni()));
    } catch {
      // the Alumni page fetches (and reports) it itself
    }
    if (!phone) await preloadQueue(FURTHER_DOWN);
  };

  // After the first page has finished loading, when the browser is idle.
  const whenIdle = () => {
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
    if (idle) idle(() => void run(), { timeout: 3000 });
    else setTimeout(() => void run(), 1000);
  };
  if (document.readyState === 'complete') whenIdle();
  else window.addEventListener('load', whenIdle, { once: true });
}
