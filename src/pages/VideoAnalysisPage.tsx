import { useNavigate } from 'react-router-dom';
import Navigation from '../components/layout/Navigation';
import Footer from '../components/layout/Footer';
import { ANALYSIS_COACHES, VIDEO_ANALYSIS } from '../constants/videoAnalysis';

const STEPS = [
  { title: 'Buy', text: 'Pick how many analyses you want and who each one is for. Buy several and use them whenever you like.' },
  { title: 'Upload your film', text: 'From your Account Center, upload a full game as a video file (MP4 or MOV, up to 5 GB). No links needed.' },
  { title: 'Your coach breaks it down', text: `Your coach watches the game, adds timestamped notes on the film and records themselves talking through it, within ${VIDEO_ANALYSIS.turnaroundDays} days.` },
  { title: 'Watch your analysis', text: "We'll email you when it's ready. Watch the annotated film and your coach's video from your Account Center." },
];

const VideoAnalysisPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <Navigation />

      {/* Hero */}
      <div className="relative h-[55vh] min-h-[340px] max-h-[520px] overflow-hidden">
        <img src="/assets/images/gameAnalysis.png" alt="Video analysis" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black" />
        <button
          onClick={() => navigate('/services')}
          className="absolute top-24 left-6 z-10 flex items-center gap-2 text-white/70 hover:text-white transition-colors text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Services
        </button>
        <div className="absolute bottom-0 left-0 right-0 px-6 pb-8 max-w-3xl mx-auto w-full" style={{ left: '50%', transform: 'translateX(-50%)' }}>
          <p className="text-white/50 text-xs tracking-[0.2em] uppercase mb-2">Online · Prerecorded</p>
          <h1 className="text-white text-3xl sm:text-4xl font-bold leading-tight">Video Analysis</h1>
        </div>
      </div>

      <div className="flex-1 px-4 py-10 pb-20">
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="grid grid-cols-2 divide-x divide-white/[0.1] border border-white/[0.1] rounded-2xl overflow-hidden">
            <div className="px-6 py-5">
              <p className="text-white/35 text-[10px] tracking-[0.15em] uppercase mb-3">Price</p>
              <p className="text-white font-medium text-sm">${VIDEO_ANALYSIS.pricePerAnalysis} per analysis</p>
              <p className="text-white/35 text-xs mt-0.5">One game each</p>
            </div>
            <div className="px-6 py-5">
              <p className="text-white/35 text-[10px] tracking-[0.15em] uppercase mb-3">Turnaround</p>
              <p className="text-white font-medium text-sm">Within {VIDEO_ANALYSIS.turnaroundDays} days</p>
              <p className="text-white/35 text-xs mt-0.5">From when you upload</p>
            </div>
          </div>

          <button
            onClick={() => navigate('/checkout/video-analysis')}
            className="block w-full bg-white text-black text-center py-4 rounded-xl font-semibold text-[15px] hover:bg-white/90 transition-colors"
          >
            Buy
          </button>

          <Section label="What you get">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-5 py-4">
                <p className="text-white font-medium text-sm">Annotated game film</p>
                <p className="text-white/45 text-xs mt-1 leading-relaxed">Your coach's comments pinned to the exact moments in your game, so you can jump straight to each one.</p>
              </div>
              <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-5 py-4">
                <p className="text-white font-medium text-sm">Your coach's video breakdown</p>
                <p className="text-white/45 text-xs mt-1 leading-relaxed">A recording of your coach talking through your game: what went well, what to fix, and how.</p>
              </div>
            </div>
          </Section>

          <Section label="How it works">
            <ol className="space-y-4">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex gap-4">
                  <span className="w-6 h-6 rounded-full border border-white/20 text-white/60 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                  <div>
                    <p className="text-white text-sm font-medium">{s.title}</p>
                    <p className="text-white/50 text-sm leading-relaxed mt-0.5">{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Section>

          <Section label="Coaches">
            <p className="text-white/85 text-sm">{ANALYSIS_COACHES.join(' · ')}</p>
            <p className="text-white/35 text-xs mt-2">Choose your preferred coach at checkout</p>
          </Section>

          <Section label="Live or in person">
            <p className="text-white/75 text-sm leading-relaxed">
              Prefer to go through the film together? Live video-call and in-person analysis sessions are requested in the
              Next Star app.
            </p>
            <div className="flex items-center gap-4 mt-4">
              <a href="https://apps.apple.com/us/app/next-star-soccer/id6754170423" target="_blank" rel="noopener noreferrer">
                <img src="/assets/images/badge-app-store.svg" alt="Download on the App Store" className="h-9 w-auto" />
              </a>
              <a href="https://play.google.com/store/apps/details?id=com.nextstarsoccer.nextstar&hl=en_US" target="_blank" rel="noopener noreferrer">
                <img src="/assets/images/badge-google-play.png" alt="Get it on Google Play" className="h-9 w-auto" />
              </a>
            </div>
          </Section>
        </div>
      </div>

      <Footer />
    </div>
  );
};

const Section = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="border-t border-white/[0.07] pt-7">
    <p className="text-white/35 text-[10px] tracking-[0.2em] uppercase mb-4">{label}</p>
    {children}
  </div>
);

export default VideoAnalysisPage;
