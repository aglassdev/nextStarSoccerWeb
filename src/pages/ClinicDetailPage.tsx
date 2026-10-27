import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navigation from '../components/layout/Navigation';
import Footer from '../components/layout/Footer';
import { clinics, isClinicOver } from '../constants/clinicsData';

const ClinicDetailPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [showMap, setShowMap] = useState(false);
  const clinic = clinics.find((c) => c.slug === slug);

  if (!clinic) {
    return (
      <div className="min-h-screen bg-black flex flex-col">
        <Navigation />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-white/40">Clinic not found.</p>
        </div>
        <Footer />
      </div>
    );
  }

  const over = isClinicOver(clinic);

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <Navigation />

      {/* Hero */}
      <div className="relative h-[55vh] min-h-[340px] max-h-[520px] overflow-hidden">
        <img
          src={clinic.heroImage}
          alt={clinic.name}
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black" />

        {/* Back button */}
        <button
          onClick={() => navigate('/services/clinics')}
          className="absolute top-24 left-6 z-10 flex items-center gap-2 text-white/70 hover:text-white transition-colors text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Clinics
        </button>

        {/* Hero text */}
        <div className="absolute bottom-0 left-0 right-0 px-6 pb-8 max-w-3xl mx-auto w-full" style={{ left: '50%', transform: 'translateX(-50%)' }}>
          <p className="text-white/50 text-xs tracking-[0.2em] uppercase mb-2">
            {clinic.heroDateRange}
            <span className="ml-3 text-white/40">× DC Power</span>
          </p>
          <h1 className="text-white text-3xl sm:text-4xl font-bold leading-tight">{clinic.name}</h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-10 pb-20">
        <div className="max-w-3xl mx-auto space-y-8">

          {/* Time + Location info box */}
          <div className="grid grid-cols-2 divide-x divide-white/[0.1] border border-white/[0.1] rounded-2xl overflow-hidden">
            <div className="px-6 py-5">
              <p className="text-white/35 text-[10px] tracking-[0.15em] uppercase mb-3">Session Time</p>
              <p className="text-white font-medium text-sm">{clinic.timeText}</p>
              <p className="text-white/35 text-xs mt-0.5">Saturday &amp; Sunday</p>
            </div>
            <div className="px-6 py-5">
              <p className="text-white/35 text-[10px] tracking-[0.15em] uppercase mb-3">Location</p>
              <p className="text-white font-medium text-sm leading-snug">{clinic.location.name}</p>
              <p className="text-white/40 text-xs mt-1 leading-snug">{clinic.location.city}</p>
            </div>
          </div>

          {/* Register button */}
          {over ? (
            <button
              disabled
              className="w-full bg-white/10 text-white/35 py-4 rounded-xl font-medium text-[15px] cursor-not-allowed"
            >
              Clinic Has Ended
            </button>
          ) : (
            <button
              onClick={() => navigate(`/checkout/${clinic.slug}`)}
              className="block w-full bg-white text-black text-center py-4 rounded-xl font-semibold text-[15px] hover:bg-white/90 transition-colors"
            >
              Register
            </button>
          )}

          {/* Days */}
          <Section label="Days">
            <div className="space-y-2">
              {clinic.days.map((d) => (
                <p key={d.date} className="text-white/85 text-sm">{d.label}</p>
              ))}
            </div>
            <p className="text-white/35 text-xs mt-2">Come for one day or both</p>
          </Section>

          {/* Pricing */}
          <Section label="Pricing">
            <p className="text-white/85 text-sm leading-relaxed">${clinic.pricePerPlayerPerDay} per player, per day</p>
            <p className="text-white/35 text-xs mt-2">Includes a DC Power match ticket</p>
          </Section>

          {/* Details */}
          <Section label="Details">
            <p className="text-white/75 text-sm leading-relaxed">{clinic.description}</p>
          </Section>

          {/* Items to Bring */}
          <Section label="Items to Bring">
            <p className="text-white/75 text-sm leading-relaxed">{clinic.itemsToBring}</p>
          </Section>

          {/* Location — opens the map */}
          <Section label="Location">
            <button
              type="button"
              onClick={() => setShowMap(true)}
              className="w-full text-left flex items-center justify-between bg-white/[0.04] border border-white/[0.08] rounded-xl px-5 py-4 hover:border-white/20 hover:bg-white/[0.07] transition-all group"
            >
              <div>
                <p className="text-white font-medium text-sm">{clinic.location.name}</p>
                <p className="text-white/40 text-xs mt-0.5">{clinic.location.address}</p>
              </div>
              <span className="text-white/40 text-xs group-hover:text-white/70 transition-colors flex-shrink-0 ml-4">
                View map
              </span>
            </button>
          </Section>

        </div>
      </div>

      <Footer />

      {showMap && (
        <MapModal
          name={clinic.location.name}
          address={`${clinic.location.name}, ${clinic.location.address}`}
          onClose={() => setShowMap(false)}
        />
      )}
    </div>
  );
};

// ── Map modal ─────────────────────────────────────────────────────────────────
// Same Maps Embed key and satellite view as the calendar's event map.
const MAPS_EMBED_KEY = 'AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8';

const MapModal = ({ name, address, onClose }: { name: string; address: string; onClose: () => void }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-[#0e0e0e] border border-white/10 rounded-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Map of ${name}`}
      >
        <div className="aspect-[4/3] sm:aspect-[16/9] bg-neutral-900">
          <iframe
            title={`Map of ${name}`}
            width="100%"
            height="100%"
            style={{ border: 0 }}
            src={`https://www.google.com/maps/embed/v1/place?key=${MAPS_EMBED_KEY}&q=${encodeURIComponent(address)}&maptype=satellite`}
            allowFullScreen
            loading="lazy"
          />
        </div>
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <div className="min-w-0">
            <p className="text-white font-medium text-sm">{name}</p>
            <p className="text-white/40 text-xs mt-0.5 truncate">{address.replace(`${name}, `, '')}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white/10 hover:bg-white/15 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors"
            >
              Directions ↗
            </a>
            <button
              type="button"
              onClick={onClose}
              className="text-white/50 hover:text-white text-xs px-3 py-2 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Small section helper ──────────────────────────────────────────────────────
const Section = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="border-t border-white/[0.07] pt-7">
    <p className="text-white/35 text-[10px] tracking-[0.2em] uppercase mb-4">{label}</p>
    {children}
  </div>
);

export default ClinicDetailPage;
