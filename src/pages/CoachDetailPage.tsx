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

  return (
    <div className="min-h-screen bg-black">
      <Navigation />

      <div className="pt-24 pb-16 px-4">
        <div className="max-w-5xl mx-auto">

          {/* Back link */}
          <button
            onClick={() => navigate('/coaches')}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-10 group"
          >
            <svg
              width="18" height="18" viewBox="0 0 18 18" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            >
              <path d="M11 4L6 9l5 5" />
            </svg>
            <span className="text-sm font-medium">All Coaches</span>
          </button>

          {/* Hero */}
          <div className="flex flex-col md:flex-row gap-12 items-end">

            {/* Image */}
            <div className="w-full md:w-80 lg:w-96 flex-shrink-0 bg-gray-900 rounded-2xl overflow-hidden">
              <img
                src={coach.avatarUrl}
                alt={coach.name}
                className="w-full object-cover object-top"
                style={{ borderRadius: 0 }}
              />
            </div>

            {/* Details */}
            <div className="flex-1 pb-4">
              <p className="text-blue-400 text-sm font-semibold uppercase tracking-widest mb-3">
                {coach.title}
              </p>
              <h1 className="text-5xl lg:text-6xl font-bold text-white font-lt-wave leading-tight mb-6">
                {coach.name}
              </h1>
              <div className="flex items-center gap-2 mb-8">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-green-400 text-sm font-medium">{coach.status}</span>
              </div>
              <div className="h-px bg-white/10 mb-8" />
              <button
                onClick={() => navigate('/contact')}
                className="bg-white text-black font-semibold px-8 py-3 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Contact
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Footer */}
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
