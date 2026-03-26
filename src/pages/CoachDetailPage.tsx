import { useParams, useNavigate } from 'react-router-dom';
import Navigation from '../components/layout/Navigation';
import { coaches } from '../constants/coachesData';

const CoachDetailPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const coach = coaches.find((c) => c.slug === slug);

  if (!coach) {
    return (
      <div className="min-h-screen bg-black flex flex-col">
        <Navigation />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-400 text-lg mb-6">Coach not found.</p>
            <button
              onClick={() => navigate('/coaches')}
              className="text-white border border-white/20 px-6 py-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              Back to Coaches
            </button>
          </div>
        </div>
      </div>
    );
  }

  const sectionColors: Record<string, string> = {
    Youth: 'text-emerald-400',
    College: 'text-blue-400',
    Professional: 'text-amber-400',
    'National Team': 'text-red-400',
  };

  return (
    <div className="min-h-screen bg-black">
      <Navigation />

      <div className="pt-24 pb-20 px-6 md:px-10">
        <div className="max-w-6xl mx-auto">

          {/* Back link */}
          <button
            onClick={() => navigate('/coaches')}
            className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors mb-12 group"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M10 3L5 8l5 5" />
            </svg>
            <span className="text-xs uppercase tracking-widest font-medium">All Coaches</span>
          </button>

          {/* Main layout: image left, content right */}
          <div className="flex flex-col lg:flex-row gap-16 items-start">

            {/* ── LEFT: portrait image ── */}
            <div className="w-full lg:w-[380px] xl:w-[420px] flex-shrink-0">
              <div className="rounded-2xl overflow-hidden bg-gray-900 aspect-[3/4]">
                <img
                  src={coach.avatarUrl}
                  alt={coach.name}
                  className="w-full h-full object-cover object-top"
                />
              </div>

              {/* Career progression below image */}
              {coach.career && coach.career.length > 0 && (
                <div className="mt-8 space-y-6">
                  {coach.career.map((section) => (
                    <div key={section.label}>
                      <p className={`text-[10px] uppercase tracking-[0.2em] font-semibold mb-3 ${sectionColors[section.label] ?? 'text-gray-400'}`}>
                        {section.label}
                      </p>
                      <div className="space-y-2">
                        {section.entries.map((entry, i) => (
                          <div key={i} className="flex items-center gap-3">
                            <div className="w-7 h-7 flex-shrink-0 flex items-center justify-center">
                              <img
                                src={entry.icon}
                                alt={entry.name}
                                className="max-w-full max-h-full object-contain"
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                              />
                            </div>
                            <span className="text-gray-300 text-sm">{entry.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Contact button (mobile: shown below image) */}
              <div className="mt-8 lg:hidden">
                <button
                  onClick={() => navigate('/contact')}
                  className="w-full bg-white text-black font-semibold py-3 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Contact
                </button>
              </div>
            </div>

            {/* ── RIGHT: name, title, bio ── */}
            <div className="flex-1 min-w-0">

              {/* Title + name */}
              <p className="text-blue-400 text-xs font-semibold uppercase tracking-[0.2em] mb-3">
                {coach.title}
              </p>
              <h1 className="text-5xl xl:text-6xl font-bold text-white font-lt-wave leading-tight mb-5">
                {coach.name}
              </h1>

              {/* Status */}
              <div className="flex items-center gap-2 mb-8">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-green-400 text-sm font-medium">{coach.status}</span>
              </div>

              <div className="h-px bg-white/10 mb-10" />

              {/* Bio paragraphs */}
              {coach.bio && coach.bio.length > 0 ? (
                <div className="space-y-5">
                  {coach.bio.map((para, i) => (
                    <p key={i} className="text-gray-400 text-[15px] leading-relaxed">
                      {para}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm italic">Bio coming soon.</p>
              )}

              {/* Contact button (desktop) */}
              <div className="mt-12 hidden lg:block">
                <button
                  onClick={() => navigate('/contact')}
                  className="bg-white text-black font-semibold px-10 py-3 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Contact
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>

      <footer className="bg-black py-8 px-4 border-t border-gray-800">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-gray-400 text-sm">
            © {new Date().getFullYear()} Next Star Soccer. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default CoachDetailPage;
