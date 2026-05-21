import { useNavigate } from 'react-router-dom';
import Navigation from '../components/layout/Navigation';
import Footer from '../components/layout/Footer';
import { coaches } from '../constants/coachesData';

const CoachesPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0c0c0c] flex flex-col font-lt-wave">
      <Navigation />

      {/* ── Page header ── */}
      <div className="pt-32 pb-10 px-6 md:px-10 lg:px-14">
        <div className="max-w-[1560px] mx-auto">
          <div className="flex items-end justify-between">
            <div>
              <span
                className="text-white/25 uppercase tracking-[0.3em]"
                style={{ fontSize: '10px' }}
              >
                Next Star Soccer
              </span>
              <h1 className="text-white font-bold mt-2 leading-none"
                style={{ fontSize: 'clamp(2.4rem, 5.5vw, 4.5rem)' }}>
                Our Coaches
              </h1>
            </div>
            <span
              className="text-white/20 uppercase tracking-[0.25em] pb-1"
              style={{ fontSize: '10px' }}
            >
              {coaches.length} coaches
            </span>
          </div>
          <div className="h-px bg-white/8 mt-8" />
        </div>
      </div>

      {/* ── Roster grid ── */}
      <div className="flex-1 px-6 md:px-10 lg:px-14 pb-20">
        <div className="max-w-[1560px] mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-1">
            {coaches.map((coach, idx) => (
              <div
                key={coach.id}
                className="relative overflow-hidden cursor-pointer group coach-entry"
                style={{
                  aspectRatio: '3 / 4',
                  animationDelay: `${idx * 60}ms`,
                }}
                onClick={() => navigate(`/coaches/${coach.slug}`)}
              >
                {/* Portrait */}
                <img
                  src={coach.avatarUrl}
                  alt={coach.name}
                  className="absolute inset-0 w-full h-full object-cover object-top transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.05]"
                  loading="lazy"
                  decoding="async"
                />

                {/* Base gradient — ensures text is always readable */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />

                {/* Hover tint */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors duration-500" />

                {/* Top-right arrow */}
                <div className="absolute top-3.5 right-3.5 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-1 group-hover:translate-y-0">
                  <div className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                    <svg viewBox="0 0 14 14" className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 12L12 2M12 2H6M12 2v6" />
                    </svg>
                  </div>
                </div>

                {/* Bottom text block */}
                <div className="absolute inset-x-0 bottom-0 p-4 md:p-5">
                  {/* Title */}
                  <p
                    className="text-white/45 uppercase tracking-[0.18em] mb-1"
                    style={{ fontSize: '9px' }}
                  >
                    {coach.title}
                  </p>

                  {/* Name */}
                  <h3
                    className="text-white font-bold leading-tight"
                    style={{ fontSize: 'clamp(13px, 1.4vw, 17px)' }}
                  >
                    {coach.name}
                  </h3>

                  {/* Career club icons — revealed on hover */}
                  {coach.career && coach.career.length > 0 && (
                    <div
                      className="flex flex-wrap items-center gap-1 mt-2.5 opacity-0 group-hover:opacity-100 translate-y-1.5 group-hover:translate-y-0 transition-all duration-300"
                      style={{ transitionDelay: '60ms' }}
                    >
                      {coach.career
                        .flatMap((s) => s.entries)
                        .slice(0, 6)
                        .map((entry, i) => (
                          <div
                            key={i}
                            className="w-[18px] h-[18px] flex items-center justify-center flex-shrink-0"
                          >
                            <img
                              src={entry.icon}
                              alt={entry.name}
                              title={entry.name}
                              className="max-w-full max-h-full object-contain"
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Footer />

      <style>{`
        .coach-entry {
          animation: coachIn 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        @keyframes coachIn {
          from { opacity: 0; transform: scale(0.97); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

export default CoachesPage;
