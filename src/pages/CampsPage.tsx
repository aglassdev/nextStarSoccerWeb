import { useNavigate } from 'react-router-dom';
import Navigation from '../components/layout/Navigation';
import Footer from '../components/layout/Footer';
import { camps } from '../constants/campsData';

const CampsPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <Navigation />

      <div className="flex-1 pt-28 pb-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">

          {/* Header */}
          <div className="mb-10">
            <p className="text-white/40 text-xs tracking-[0.2em] uppercase mb-3">Next Star 2026 Selection</p>
            <h1 className="text-white text-4xl font-bold leading-tight">Summer Camps</h1>
            <p className="text-white/50 mt-3 text-base leading-relaxed">
              Five locations across the DMV. All ages, all skill levels. Led by Howard Men's Soccer Coach Phillip Gyau and Next Star Soccer Director Paul Torres.
            </p>
          </div>

          {/* Camp Cards — column */}
          <div className="space-y-4">
            {camps.map((camp) => (
              <button
                key={camp.id}
                onClick={() => navigate(`/services/camps/${camp.slug}`)}
                className="w-full text-left group"
              >
                <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0d0d0d] hover:border-white/20 transition-all duration-300">

                  {/* Desktop: side-by-side │ Mobile: image on top, content below */}
                  <div className="flex flex-col sm:flex-row">

                    {/* Image */}
                    <div className="w-full h-44 sm:w-[280px] sm:h-auto lg:w-[320px] relative flex-shrink-0 overflow-hidden">
                      <img
                        src={camp.image}
                        alt={camp.name}
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      {/* Fade: bottom on mobile, right on desktop */}
                      <div className="sm:hidden absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/70" />
                      <div className="hidden sm:block absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[#0d0d0d]" />
                      {/* Nike badge */}
                      {camp.isNike && (
                        <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-sm border border-white/20 rounded-md px-2 py-0.5">
                          <span className="text-white text-[10px] font-bold tracking-widest uppercase">× Nike</span>
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 flex flex-col justify-center px-5 py-5 sm:px-7 sm:py-6 min-w-0">
                      <p className="text-white/40 text-[11px] tracking-[0.15em] uppercase mb-1.5">
                        {camp.heroDateRange}
                      </p>
                      <h2 className="text-white font-semibold text-lg sm:text-xl leading-snug mb-2 group-hover:text-white/90 transition-colors">
                        {camp.name}
                      </h2>
                      <p className="text-white/50 text-sm mb-4 leading-snug">
                        {camp.location.name}
                        <span className="text-white/25 mx-1.5">·</span>
                        {camp.location.city}
                      </p>

                      {/* Session + week tags */}
                      <div className="flex flex-wrap gap-2">
                        {camp.sessions.map(s => (
                          <span
                            key={s.label}
                            className="text-[11px] text-white/50 border border-white/[0.12] rounded-md px-2.5 py-1 leading-none whitespace-nowrap"
                          >
                            {s.label} · {s.time}
                          </span>
                        ))}
                        <span className="text-[11px] text-white/50 border border-white/[0.12] rounded-md px-2.5 py-1 leading-none">
                          {camp.weeks.length} {camp.weeks.length === 1 ? 'week' : 'weeks'}
                        </span>
                      </div>
                    </div>

                    {/* Arrow — visible on desktop only */}
                    <div className="hidden sm:flex items-center pr-5 flex-shrink-0">
                      <svg
                        className="w-4 h-4 text-white/20 group-hover:text-white/60 transition-colors"
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>

                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default CampsPage;
