import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Navigation from '../components/layout/Navigation';
import Footer from '../components/layout/Footer';
import { useAuth } from '../contexts/AuthContext';
import { camps, campHasEnded, type Camp } from '../constants/campsData';
import { withPageImages } from '../hooks/usePageImages';

// A camp's page, MICHELIN Guide style: breadcrumb, three photos across, then
// the name, address and key facts, the description and actions, and the
// details in sections, with the registration card alongside.

// Same Maps Embed key and satellite view as the clinic and calendar maps.
const MAPS_EMBED_KEY = 'AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8';
const APP_STORE = 'https://apps.apple.com/us/app/next-star-soccer/id6754170423';
const PLAY_STORE = 'https://play.google.com/store/apps/details?id=com.nextstarsoccer.nextstar&hl=en_US';

const directionsUrl = (camp: Camp) =>
  `https://maps.google.com/?q=${encodeURIComponent(`${camp.location.name}, ${camp.location.address}`)}`;

/** "Ages 6-21 · Coed · All skill levels" → ages "6-21", good for "Coed · All skill levels". */
const splitNote = (note: string) => {
  const [ages, ...rest] = note.split(' · ');
  return { ages: ages.replace(/^Ages\s+/i, ''), goodFor: rest.join(' · ') };
};

/** "Full Week: $250" → ["Full Week", "$250"]; a line without a label stays whole. */
const splitLine = (line: string): [string, string] | [string] => {
  const i = line.indexOf(': ');
  return i === -1 ? [line] : [line.slice(0, i), line.slice(i + 2)];
};

/* ─── Icons ─────────────────────────────────────────────────────────────── */

const Icon = ({ d, className = 'w-5 h-5' }: { d: string; className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} d={d} />
  </svg>
);
const CHEVRON_RIGHT = 'M9 5l7 7-7 7';
const CHEVRON_LEFT = 'M15 19l-7-7 7-7';
const CLOSE = 'M6 18L18 6M6 6l12 12';
const PIN = 'M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z';
const CHAT = 'M8 10h8M8 14h5m-9 6l2.6-3H18a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v14z';
const SHARE = 'M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7';

const PhotosIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <rect x="7" y="7" width="14" height="12" rx="1.5" strokeWidth={1.7} />
    <path d="M4 15.5V6.5A1.5 1.5 0 0 1 5.5 5H16" strokeWidth={1.7} strokeLinecap="round" />
  </svg>
);

/* ─── Photos ────────────────────────────────────────────────────────────── */

// Three across on wider screens; one at a time, swiped, on phones.
const Gallery = ({ camp, onOpen }: { camp: Camp; onOpen: (i: number) => void }) => (
  <div className="relative">
    <div className="flex md:grid md:grid-cols-3 gap-[2px] overflow-x-auto md:overflow-visible snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {camp.photos.slice(0, 3).map((src, i) => (
        <button
          key={`${src}-${i}`}
          type="button"
          onClick={() => onOpen(i)}
          className="group relative shrink-0 w-full md:w-auto snap-start aspect-[4/3] md:aspect-auto md:h-[min(33.333vw,640px)] overflow-hidden bg-neutral-900"
          aria-label={`View photo ${i + 1} of ${camp.photos.length}`}
        >
          <img
            src={src}
            alt={`${camp.name}, photo ${i + 1}`}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
          />
        </button>
      ))}
    </div>
    <button
      type="button"
      onClick={() => onOpen(0)}
      className="absolute right-4 bottom-4 inline-flex items-center gap-1.5 bg-black/75 backdrop-blur-sm border border-white/20 text-white text-xs font-medium rounded-md px-2.5 py-2 hover:bg-black/90 transition-colors"
      aria-label={`View all ${camp.photos.length} photos`}
    >
      <PhotosIcon />
      {camp.photos.length}
    </button>
  </div>
);

const Lightbox = ({ camp, index, onIndex, onClose }: {
  camp: Camp; index: number; onIndex: (i: number) => void; onClose: () => void;
}) => {
  const count = camp.photos.length;
  const step = useCallback((d: number) => onIndex((index + d + count) % count), [index, count, onIndex]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose, step]);

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${camp.name} photos`}
    >
      <p className="absolute top-5 left-5 text-white/60 text-sm tabular-nums">{index + 1} / {count}</p>
      <button type="button" onClick={onClose} className="absolute top-3 right-3 p-2 text-white/70 hover:text-white" aria-label="Close">
        <Icon d={CLOSE} className="w-7 h-7" />
      </button>
      <img
        src={camp.photos[index]}
        alt={`${camp.name}, photo ${index + 1}`}
        className="max-w-[92vw] max-h-[86vh] object-contain select-none"
        onClick={(e) => e.stopPropagation()}
      />
      {count > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); step(-1); }}
            className="absolute left-2 sm:left-5 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white"
            aria-label="Previous photo"
          >
            <Icon d={CHEVRON_LEFT} className="w-6 h-6" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); step(1); }}
            className="absolute right-2 sm:right-5 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white"
            aria-label="Next photo"
          >
            <Icon d={CHEVRON_RIGHT} className="w-6 h-6" />
          </button>
        </>
      )}
    </div>
  );
};

/* ─── Details ───────────────────────────────────────────────────────────── */

// Label/value rows with dashed rules between them, like the Guide's
// Cuisine / Price / Good for table.
const Facts = ({ rows, className = '' }: { rows: ([string, string] | [string])[]; className?: string }) => (
  <dl className={`text-[15px] ${className}`}>
    {rows.map((row, i) => (
      <div key={i} className="flex gap-4 sm:gap-6 py-2.5 border-b border-dashed border-white/15">
        {row.length === 2 ? (
          <>
            <dt className="w-24 sm:w-32 shrink-0 font-semibold text-white">{row[0]}:</dt>
            <dd className="text-white/75">{row[1]}</dd>
          </>
        ) : (
          <dd className="text-white/75">{row[0]}</dd>
        )}
      </div>
    ))}
  </dl>
);

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-white text-[26px] md:text-[32px] font-medium mt-14 md:mt-16 mb-5">{children}</h2>
);

const chip = 'inline-flex items-center gap-2.5 h-11 px-4 rounded-md border border-white/[0.12] text-white/85 text-[15px] hover:border-white/30 hover:text-white transition-colors';

const ShareChip = ({ camp }: { camp: Camp }) => {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: camp.name, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // share sheet closed
    }
  };
  return (
    <button type="button" onClick={share} className={chip}>
      <Icon d={SHARE} />
      {copied ? 'Link copied' : 'Share'}
    </button>
  );
};

/* ─── Registration card ─────────────────────────────────────────────────── */

const button = 'inline-block bg-white text-black text-[13px] font-semibold uppercase tracking-[0.08em] px-7 py-3.5 rounded-[4px] hover:bg-white/85 transition-colors';

const RegisterCard = ({ camp }: { camp: Camp }) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  let action: React.ReactNode;
  let note: string | null = null;
  if (campHasEnded(camp)) {
    action = (
      <span className="inline-block bg-white/10 text-white/40 text-[13px] font-semibold uppercase tracking-[0.08em] px-7 py-3.5 rounded-[4px]">
        Registration closed
      </span>
    );
    note = 'This camp has finished.';
  } else if (camp.registerType === 'web') {
    // An account is required (no guest checkout): signed-out visitors sign in first, then land in checkout.
    action = (
      <button type="button" onClick={() => navigate(`/checkout/camp/${camp.checkoutId}`)} className={button}>
        Register
      </button>
    );
    note = user ? 'Pay online, or register in the Next Star app.' : "You'll sign in to your Next Star account to register.";
  } else if (camp.registerType === 'nike') {
    action = (
      <a href={camp.nikeUrl} target="_blank" rel="noopener noreferrer" className={button}>
        Register on Nike ↗
      </a>
    );
    note = "You'll finish registering on ussportscamps.com (US Sports Camps).";
  } else {
    action = (
      <div className="flex items-center justify-center gap-3">
        <a href={APP_STORE} target="_blank" rel="noopener noreferrer">
          <img src="/assets/images/badge-app-store.svg" alt="Download on the App Store" className="h-9 w-auto" />
        </a>
        <a href={PLAY_STORE} target="_blank" rel="noopener noreferrer">
          <img src="/assets/images/badge-google-play.png" alt="Get it on Google Play" className="h-9 w-auto" />
        </a>
      </div>
    );
    note = 'Register in the Next Star app.';
  }

  return (
    <div className="rounded-lg border border-white/10 bg-[#0e0e0e] p-5">
      <p className="text-white text-[17px] mb-4">Register</p>
      <div className="rounded-md bg-white/[0.04] px-6 py-8 text-center">
        <p className="text-white text-2xl font-medium leading-snug">{camp.name}</p>
        <p className="text-white/80 text-[15px] mt-2">{camp.location.name}, {camp.location.city}</p>
        <p className="text-white/50 text-[13px] mt-1">{camp.heroDateRange}</p>
        <div className="mt-7">{action}</div>
        {note && <p className="text-white/40 text-xs mt-4 leading-relaxed">{note}</p>}
      </div>
    </div>
  );
};

/* ─── Page ──────────────────────────────────────────────────────────────── */

const CampDetail = ({ camp }: { camp: Camp }) => {
  const [photo, setPhoto] = useState<number | null>(null);
  const closePhotos = useCallback(() => setPhoto(null), []);
  const { ages, goodFor } = splitNote(camp.pricingNote);

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <Navigation />

      <nav aria-label="Breadcrumb" className="max-w-[1560px] w-full mx-auto px-5 sm:px-6 md:px-9 pt-20 pb-4">
        <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-white/50">
          <li><Link to="/services" className="hover:text-white transition-colors">Services</Link></li>
          <li aria-hidden="true"><Icon d={CHEVRON_RIGHT} className="w-3.5 h-3.5" /></li>
          <li><Link to="/services/camps" className="hover:text-white transition-colors">Camps</Link></li>
          <li aria-hidden="true"><Icon d={CHEVRON_RIGHT} className="w-3.5 h-3.5" /></li>
          <li className="text-white" aria-current="page">{camp.name}</li>
        </ol>
      </nav>

      <Gallery camp={camp} onOpen={setPhoto} />

      <main className="flex-1 max-w-[1280px] w-full mx-auto px-5 sm:px-6 lg:px-8 pt-12 md:pt-16 pb-24">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-x-16">

          {/* Name, address and the key facts */}
          <header className="lg:col-start-1 lg:row-start-1">
            {camp.isNike && (
              <p className="text-white/50 text-xs font-semibold tracking-[0.18em] uppercase mb-3">× Nike</p>
            )}
            <h1 className="text-white text-[34px] md:text-5xl font-semibold leading-tight">{camp.name}</h1>
            <p className="text-white/70 text-[15px] mt-3">{camp.location.name}, {camp.location.address}</p>
            <Facts
              className="mt-6 max-w-md"
              rows={[
                ['Dates', camp.heroDateRange],
                ['Price', camp.priceSummary],
                ['Ages', ages],
                ...(goodFor ? [['Good for', goodFor] as [string, string]] : []),
              ]}
            />
          </header>

          {/* Registration, alongside on wide screens and under the facts on phones */}
          <aside className="mt-10 lg:mt-0 lg:col-start-2 lg:row-start-1 lg:row-span-2">
            <div className="lg:sticky lg:top-24">
              <RegisterCard camp={camp} />
            </div>
          </aside>

          <div className="lg:col-start-1 lg:row-start-2">
            <p className="mt-10 text-white/80 text-[17px] md:text-[19px] leading-[1.7]">{camp.description}</p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a href={directionsUrl(camp)} target="_blank" rel="noopener noreferrer" className={chip}>
                <Icon d={PIN} />
                Directions
              </a>
              <Link to="/contact" className={chip}>
                <Icon d={CHAT} />
                Contact us
              </Link>
              <ShareChip camp={camp} />
            </div>

            <SectionTitle>Sessions</SectionTitle>
            <Facts
              className="max-w-xl"
              rows={[
                ...camp.sessions.map((s) => [s.label, s.time] as [string, string]),
                ...(camp.weeks.length > 1 ? camp.weeks.map((w) => [w.label, w.dates] as [string, string]) : []),
              ]}
            />

            <SectionTitle>Pricing</SectionTitle>
            <Facts className="max-w-xl" rows={camp.pricing.split('\n').map(splitLine)} />

            <SectionTitle>What to bring</SectionTitle>
            <p className="text-white/80 text-[17px] leading-[1.7]">{camp.itemsToBring}</p>

            <SectionTitle>Location</SectionTitle>
            <div className="aspect-[4/3] sm:aspect-[16/9] rounded-md overflow-hidden border border-white/10 bg-neutral-900">
              <iframe
                title={`Map of ${camp.location.name}`}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                src={`https://www.google.com/maps/embed/v1/place?key=${MAPS_EMBED_KEY}&q=${encodeURIComponent(`${camp.location.name}, ${camp.location.address}`)}&maptype=satellite`}
                allowFullScreen
                loading="lazy"
              />
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-white text-[15px] font-medium">{camp.location.name}</p>
                <p className="text-white/50 text-sm mt-0.5">{camp.location.address}</p>
              </div>
              <a href={directionsUrl(camp)} target="_blank" rel="noopener noreferrer" className="text-white/70 hover:text-white text-sm underline underline-offset-4">
                Get directions
              </a>
            </div>
          </div>
        </div>
      </main>

      <Footer />

      {photo !== null && <Lightbox camp={camp} index={photo} onIndex={setPhoto} onClose={closePhotos} />}
    </div>
  );
};

const CampDetailPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const camp = camps.find((c) => c.slug === slug);

  if (!camp) {
    return (
      <div className="min-h-screen bg-black flex flex-col">
        <Navigation />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-white/40">Camp not found.</p>
        </div>
        <Footer />
      </div>
    );
  }
  return <CampDetail camp={camp} />;
};

// Loading screen until the three photos across the top are in.
export default withPageImages(CampDetailPage, ({ slug }) => ({
  first: camps.find((c) => c.slug === slug)?.photos.slice(0, 3) ?? [],
}));
