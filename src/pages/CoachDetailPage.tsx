import { useParams, useNavigate } from 'react-router-dom';
import { useRef, useState, useCallback, useEffect } from 'react';
import Navigation from '../components/layout/Navigation';
import Footer from '../components/layout/Footer';
import { coaches } from '../constants/coachesData';

// ── Video Player ──────────────────────────────────────────────────────────────
const VideoPlayer = ({ src }: { src: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const seekRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [seeking, setSeeking] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setPlaying(true); }
    else { v.pause(); setPlaying(false); }
  };

  const handleTimeUpdate = () => setCurrentTime(videoRef.current?.currentTime ?? 0);
  const handleLoaded = () => {
    const v = videoRef.current;
    if (!v) return;
    setDuration(v.duration ?? 0);
    // Seek to first frame so the browser renders a thumbnail
    v.currentTime = 0.001;
  };
  const handleEnded = () => setPlaying(false);

  const seekTo = useCallback((e: React.MouseEvent | MouseEvent) => {
    const bar = seekRef.current;
    const v = videoRef.current;
    if (!bar || !v || !duration) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    v.currentTime = pct * duration;
    setCurrentTime(v.currentTime);
  }, [duration]);

  const handleSeekMouseDown = (e: React.MouseEvent) => {
    setSeeking(true);
    seekTo(e);
  };

  useEffect(() => {
    if (!seeking) return;
    const onMove = (e: MouseEvent) => seekTo(e);
    const onUp = () => setSeeking(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [seeking, seekTo]);

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (!v) return;
    const val = parseFloat(e.target.value);
    v.volume = val;
    v.muted = val === 0;
    setVolume(val);
    setMuted(val === 0);
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    if (!v.muted && volume === 0) { v.volume = 0.5; setVolume(0.5); }
  };

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen();
      setFullscreen(true);
    } else {
      document.exitFullscreen();
      setFullscreen(false);
    }
  };

  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const resetHideTimer = () => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => { if (playing) setShowControls(false); }, 2500);
  };

  useEffect(() => { if (!playing) setShowControls(true); }, [playing]);

  const pct = duration ? (currentTime / duration) * 100 : 0;
  const effectiveVolume = muted ? 0 : volume;

  const VolumeIcon = () => effectiveVolume === 0
    ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zM17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
    : effectiveVolume < 0.5
      ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.536 8.464a5 5 0 010 7.072M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
      : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.536 8.464a5 5 0 010 7.072M12 6a7 7 0 010 12M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />;

  return (
    <div
      ref={containerRef}
      className="relative bg-black rounded-xl overflow-hidden group select-none"
      onMouseMove={resetHideTimer}
      onMouseLeave={() => { if (playing) setShowControls(false); }}
    >
      <video
        ref={videoRef}
        src={src}
        className="w-full aspect-video block cursor-pointer"
        onClick={togglePlay}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoaded}
        onEnded={handleEnded}
        playsInline
        preload="metadata"
      />

      {/* Controls overlay */}
      <div
        className="absolute inset-x-0 bottom-0 transition-opacity duration-200"
        style={{ opacity: showControls ? 1 : 0 }}
      >
        {/* Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />

        <div className="relative px-4 pb-4 pt-8 space-y-2">
          {/* Seek bar */}
          <div
            ref={seekRef}
            className="relative h-1 bg-white/20 rounded-full cursor-pointer group/seek"
            onMouseDown={handleSeekMouseDown}
          >
            <div
              className="absolute inset-y-0 left-0 bg-white rounded-full"
              style={{ width: `${pct}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow opacity-0 group-hover/seek:opacity-100 transition-opacity -ml-1.5"
              style={{ left: `${pct}%` }}
            />
          </div>

          {/* Buttons row */}
          <div className="flex items-center gap-3">
            {/* Play/Pause */}
            <button onClick={togglePlay} className="text-white hover:text-gray-300 transition-colors flex-shrink-0">
              {playing
                ? <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                : <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
              }
            </button>

            {/* Time */}
            <span className="text-white/60 text-[11px] tabular-nums flex-shrink-0">
              {fmt(currentTime)} / {fmt(duration)}
            </span>

            <div className="flex-1" />

            {/* Volume */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={toggleMute} className="text-white hover:text-gray-300 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <VolumeIcon />
                </svg>
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={effectiveVolume}
                onChange={handleVolume}
                className="w-16 h-1 accent-white cursor-pointer"
              />
            </div>

            {/* Fullscreen */}
            <button onClick={toggleFullscreen} className="text-white hover:text-gray-300 transition-colors flex-shrink-0">
              {fullscreen
                ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" /></svg>
                : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /></svg>
              }
            </button>
          </div>
        </div>
      </div>

      {/* Big play button overlay when paused */}
      {!playing && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center"
        >
          <div className="w-14 h-14 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border border-white/20 hover:bg-black/70 transition-colors">
            <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
            </svg>
          </div>
        </button>
      )}
    </div>
  );
};

const COACH_VIDEOS: Record<string, string[]> = {
  'paul-torres': [
    'https://nyc.cloud.appwrite.io/v1/storage/buckets/69f691c700097947a134/files/69f691d20027926a600e/view?project=68577380002195dec512&mode=admin',
    'https://nyc.cloud.appwrite.io/v1/storage/buckets/69f691c700097947a134/files/69f691db000a78c0bf98/view?project=68577380002195dec512&mode=admin',
  ],
  'chris-pontius': [
    'https://nyc.cloud.appwrite.io/v1/storage/buckets/69f691c700097947a134/files/69f69462003b81d263ed/view?project=68577380002195dec512&mode=admin',
    'https://nyc.cloud.appwrite.io/v1/storage/buckets/69f691c700097947a134/files/69f694590015d8fae8e6/view?project=68577380002195dec512&mode=admin',
  ],
  'marco-etcheverry': [
    'https://nyc.cloud.appwrite.io/v1/storage/buckets/69f691c700097947a134/files/69f694b9002f044fc033/view?project=68577380002195dec512&mode=admin',
    'https://nyc.cloud.appwrite.io/v1/storage/buckets/69f691c700097947a134/files/69f694b30029c4461181/view?project=68577380002195dec512&mode=admin',
  ],
  'patrick-mullins': [
    'https://nyc.cloud.appwrite.io/v1/storage/buckets/69f691c700097947a134/files/69f6946e000a7e34b93d/view?project=68577380002195dec512&mode=admin',
    'https://nyc.cloud.appwrite.io/v1/storage/buckets/69f691c700097947a134/files/69f69551000754f0e1eb/view?project=68577380002195dec512&mode=admin',
  ],
};

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
    <div className="min-h-screen bg-black flex flex-col">
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

          {/* Highlights videos */}
          {COACH_VIDEOS[coach.slug] && (
            <div className="mt-20">
              <div className="h-px bg-white/10 mb-12" />
              <h2 className="text-2xl font-bold text-white font-lt-wave mb-8">Highlights</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {COACH_VIDEOS[coach.slug].map((src, i) => (
                  <VideoPlayer key={i} src={src} />
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      <Footer />
    </div>
  );
};

export default CoachDetailPage;
