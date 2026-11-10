import { Link } from 'react-router-dom';
import Navigation from '../components/layout/Navigation';
import Footer from '../components/layout/Footer';
import { camps, campHasEnded, type Camp } from '../constants/campsData';
import { withPageImages } from '../hooks/usePageImages';

// The camps as a grid of cards, MICHELIN Guide style: the photo with a chip
// when the camp can be booked here, then the name, where it is, and when and
// how much.

const CheckIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
  </svg>
);

// Two stacked frames: the camp has more photos on its page.
const PhotosIcon =({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <rect x="7" y="7" width="14" height="12" rx="1.5" strokeWidth={1.6} />
    <path d="M4 15.5V6.5A1.5 1.5 0 0 1 5.5 5H16" strokeWidth={1.6} strokeLinecap="round" />
  </svg>
);

const CampCard = ({ camp }: { camp: Camp }) => {
  const bookable = camp.registerType === 'web' && !campHasEnded(camp);
  return (
    <Link
      to={`/services/camps/${camp.slug}`}
      className="group flex flex-col h-full bg-[#111] rounded-md overflow-hidden border border-white/[0.06] hover:border-white/20 transition-colors"
    >
      <div className="relative aspect-[6/5] overflow-hidden bg-neutral-900">
        <img
          src={camp.photos[0]}
          alt={camp.name}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          loading="lazy"
          decoding="async"
        />
        {bookable && (
          <span className="absolute left-4 bottom-4 inline-flex items-center gap-1.5 bg-white text-black text-[13px] font-medium px-2.5 py-1.5 rounded-[4px]">
            <CheckIcon />
            Register online
          </span>
        )}
        {camp.photos.length > 1 && (
          <span className="absolute right-4 bottom-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
            <PhotosIcon />
          </span>
        )}
      </div>
      <div className="flex-1 px-5 pt-5 pb-6">
        {camp.isNike && (
          <p className="text-white/50 text-[11px] font-semibold tracking-[0.18em] uppercase mb-2">× Nike</p>
        )}
        <h2 className="text-white text-[21px] leading-snug font-medium">{camp.name}</h2>
        <p className="text-white/60 text-sm mt-2">
          {camp.location.name}, {camp.location.city}
        </p>
        <p className="text-white/60 text-sm mt-0.5">{camp.heroDateRange}</p>
        <p className="text-white/60 text-sm mt-0.5">{camp.priceSummary}</p>
      </div>
    </Link>
  );
};

const CampsPage = () => (
  <div className="min-h-screen bg-black flex flex-col">
    <Navigation />

    <main className="flex-1 pt-28 pb-24">
      <div className="max-w-[1560px] mx-auto px-5 sm:px-6 md:px-9">
        <h1 className="text-white text-[22px] md:text-2xl mb-8">
          Camps <span className="text-white/45">· {camps.length} camps</span>
        </h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 lg:gap-9">
          {camps.map((camp) => (
            <CampCard key={camp.id} camp={camp} />
          ))}
        </div>
      </div>
    </main>

    <Footer />
  </div>
);

// Loading screen until the first row's photos are in; the camp pages' photos follow.
export default withPageImages(CampsPage, () => ({
  first: camps.slice(0, 4).map((c) => c.photos[0]),
  more: camps.flatMap((c) => c.photos),
}));
