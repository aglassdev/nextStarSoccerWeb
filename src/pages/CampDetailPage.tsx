import { useParams, useNavigate } from 'react-router-dom';
import Navigation from '../components/layout/Navigation';
import Footer from '../components/layout/Footer';
import { camps } from '../constants/campsData';

const CampDetailPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const camp = camps.find(c => c.slug === slug);

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

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <Navigation />

      {/* Hero */}
      <div className="relative h-[55vh] min-h-[340px] max-h-[520px] overflow-hidden">
        <img
          src={camp.image}
          alt={camp.name}
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black" />

        {/* Back button */}
        <button
          onClick={() => navigate('/services/camps')}
          className="absolute top-24 left-6 z-10 flex items-center gap-2 text-white/70 hover:text-white transition-colors text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Camps
        </button>

        {/* Hero text */}
        <div className="absolute bottom-0 left-0 right-0 px-6 pb-8 max-w-3xl mx-auto w-full" style={{ left: '50%', transform: 'translateX(-50%)' }}>
          <p className="text-white/50 text-xs tracking-[0.2em] uppercase mb-2">
            {camp.heroDateRange}
            {camp.isNike && <span className="ml-3 text-white/40">× Nike</span>}
          </p>
          <h1 className="text-white text-3xl sm:text-4xl font-bold leading-tight">{camp.name}</h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 py-10 pb-20">
        <div className="max-w-3xl mx-auto space-y-8">

          {/* Time + Location info box */}
          <div className="grid grid-cols-2 divide-x divide-white/[0.1] border border-white/[0.1] rounded-2xl overflow-hidden">
            {/* Sessions */}
            <div className="px-6 py-5">
              <p className="text-white/35 text-[10px] tracking-[0.15em] uppercase mb-3">Session Times</p>
              <div className="space-y-2">
                {camp.sessions.map(s => (
                  <div key={s.label}>
                    <p className="text-white font-medium text-sm">{s.time}</p>
                    {camp.sessions.length > 1 && (
                      <p className="text-white/35 text-xs mt-0.5">{s.label}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
            {/* Location */}
            <div className="px-6 py-5">
              <p className="text-white/35 text-[10px] tracking-[0.15em] uppercase mb-3">Location</p>
              <p className="text-white font-medium text-sm leading-snug">{camp.location.name}</p>
              <p className="text-white/40 text-xs mt-1 leading-snug">{camp.location.city}</p>
            </div>
          </div>

          {/* Register button */}
          {camp.registerType === 'nike' ? (
            <a
              href={camp.nikeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-white text-black text-center py-4 rounded-xl font-semibold text-[15px] hover:bg-white/90 transition-colors"
            >
              Register on Nike Soccer Camps ↗
            </a>
          ) : (
            <button
              disabled
              className="w-full bg-white/10 text-white/35 py-4 rounded-xl font-medium text-[15px] cursor-not-allowed"
            >
              Register In App
            </button>
          )}

          {/* Weeks */}
          <Section label="Weeks">
            <div className="space-y-2">
              {camp.weeks.map(w => (
                <div key={w.label} className="flex items-baseline gap-3">
                  <span className="text-white/35 text-xs w-14 flex-shrink-0">{w.label}</span>
                  <span className="text-white/85 text-sm">{w.dates}</span>
                </div>
              ))}
            </div>
          </Section>

          {/* Pricing */}
          <Section label="Pricing">
            <div className="space-y-1">
              {camp.pricing.split('\n').map((line, i) => (
                <p key={i} className="text-white/85 text-sm leading-relaxed">{line}</p>
              ))}
              <p className="text-white/35 text-xs mt-2">{camp.pricingNote}</p>
            </div>
          </Section>

          {/* Details */}
          <Section label="Details">
            <p className="text-white/75 text-sm leading-relaxed">{camp.description}</p>
          </Section>

          {/* Items to Bring */}
          <Section label="Items to Bring">
            <p className="text-white/75 text-sm leading-relaxed">{camp.itemsToBring}</p>
          </Section>

          {/* Map / Directions */}
          <Section label="Location">
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(camp.location.address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between bg-white/[0.04] border border-white/[0.08] rounded-xl px-5 py-4 hover:border-white/20 hover:bg-white/[0.07] transition-all group"
            >
              <div>
                <p className="text-white font-medium text-sm">{camp.location.name}</p>
                <p className="text-white/40 text-xs mt-0.5">{camp.location.address}</p>
              </div>
              <span className="text-white/40 text-xs group-hover:text-white/70 transition-colors flex-shrink-0 ml-4">
                Directions ↗
              </span>
            </a>
          </Section>

          {/* Nike disclaimer */}
          {camp.registerType === 'nike' && (
            <p className="text-white/25 text-xs text-center leading-relaxed border-t border-white/[0.06] pt-6">
              You will be redirected to ussportscamps.com (US Sports Camps) to complete your registration.
            </p>
          )}

        </div>
      </div>

      <Footer />
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

export default CampDetailPage;
