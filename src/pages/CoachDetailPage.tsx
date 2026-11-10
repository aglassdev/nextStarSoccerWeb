import { useParams, useNavigate } from 'react-router-dom';
import { useRef, useState, useCallback, useEffect } from 'react';
import Navigation from '../components/layout/Navigation';
import Footer from '../components/layout/Footer';
import { coaches, type Coach, type CareerEntry, type CareerSection } from '../constants/coachesData';
import { withPageImages } from '../hooks/usePageImages';

// ── Video Player ──────────────────────────────────────────────────────────────
const VideoPlayer = ({ src, poster }: { src: string; poster?: string }) => {
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
  // True while playback is waiting on data, so a spinner shows instead of a frozen frame.
  const [buffering, setBuffering] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      if (v.readyState < 3) setBuffering(true);
      v.play().catch(() => setBuffering(false));
      setPlaying(true);
    }
    else { v.pause(); setPlaying(false); }
  };

  const handleTimeUpdate = () => setCurrentTime(videoRef.current?.currentTime ?? 0);
  const handleLoaded = () => {
    const v = videoRef.current;
    if (!v) return;
    setDuration(v.duration ?? 0);
    // The poster stands in as the thumbnail, so nothing is fetched until play.
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
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onCanPlay={() => setBuffering(false)}
        playsInline
        preload="metadata"
        poster={poster}
      />

      {buffering && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-10 h-10 border-2 border-white/25 border-t-white rounded-full animate-spin" />
        </div>
      )}

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

// Highlight reels, served from the site itself (Appwrite storage streamed them
// too slowly to start). Each has a poster frame so it is never a black box.
const COACH_VIDEO_COUNT: Record<string, number> = {
  'paul-torres': 2,
  'chris-pontius': 2,
  'marco-etcheverry': 2,
  'patrick-mullins': 2,
};
// Coaches whose reels show last-numbered first.
const COACH_VIDEOS_REVERSED = new Set(['paul-torres']);
const COACH_VIDEOS: Record<string, { src: string; poster: string }[]> = Object.fromEntries(
  Object.entries(COACH_VIDEO_COUNT).map(([slug, n]) => {
    const reels = Array.from({ length: n }, (_, i) => ({
      src: `/assets/coaches/${slug}-${i + 1}.mp4`,
      poster: `/assets/coaches/${slug}-${i + 1}-poster.jpg`,
    }));
    return [slug, COACH_VIDEOS_REVERSED.has(slug) ? reels.reverse() : reels];
  }),
);

// ── The app's coach cards ─────────────────────────────────────────────────────
// The profile card (photo, name, role, flag) and the teams card, styled as in
// the app's coach screens.

const cardBox = 'bg-[#111] border border-[#222] rounded-[14px] overflow-hidden';

const ProfileCard = ({ coach }: { coach: Coach }) => {
  const [first, ...rest] = coach.name.split(' ');
  return (
    <div className={cardBox}>
      <div className="aspect-[4/5] bg-[#161616]">
        <img src={coach.cardPhoto ?? coach.avatarUrl} alt={coach.name} className="w-full h-full object-cover" />
      </div>
      <div className="px-5 pt-4 pb-5 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[#F4F2EE] text-[22px] leading-tight">{first}</p>
          <p className="text-[#F4F2EE] text-[28px] font-bold leading-tight -mt-0.5">{rest.join(' ')}</p>
          <p className="text-[#999] text-xs font-medium uppercase tracking-[2px] mt-1">{coach.title}</p>
        </div>
        {coach.flag && (
          <img src={coach.flag.src} alt={coach.flag.country} title={coach.flag.country} className="w-8 h-[22px] object-contain mb-1.5 shrink-0" />
        )}
      </div>
    </div>
  );
};

const Team = ({ entry, className = '' }: { entry: CareerEntry; className?: string }) => (
  <div className={`flex items-center gap-[5px] text-[#F4F2EE] text-xs ${className}`}>
    {entry.icon && (
      <img
        src={entry.icon}
        alt=""
        className="w-3.5 h-3.5 object-contain shrink-0"
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
      />
    )}
    <span>{entry.name}</span>
  </div>
);

// A section on its own spans the card, its teams two across; beside another,
// its teams are listed down the middle of its half.
const TeamsCell = ({ section, alone }: { section: CareerSection; alone: boolean }) => (
  <div className="py-3.5 px-4 flex flex-col items-center">
    <p className="text-[#888] text-xs mb-2">{section.label}</p>
    {alone && section.entries.length > 1 ? (
      <div className="grid grid-cols-2 gap-x-1.5 gap-y-1 w-[92%]">
        {section.entries.map((e) => <Team key={e.name} entry={e} />)}
      </div>
    ) : (
      <div className="flex flex-col items-center gap-1">
        {section.entries.map((e) => <Team key={e.name} entry={e} className="justify-center text-center" />)}
      </div>
    )}
  </div>
);

const CareerCard = ({ rows }: { rows: CareerSection[][] }) => (
  <div className={`${cardBox} mt-4 divide-y divide-[#333]`}>
    {rows.map((row) => (
      <div key={row.map((s) => s.label).join('|')} className={row.length > 1 ? 'grid grid-cols-2 divide-x divide-[#333]' : ''}>
        {row.map((section) => <TeamsCell key={section.label} section={section} alone={row.length === 1} />)}
      </div>
    ))}
  </div>
);

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
    <div className="min-h-screen bg-[#0c0c0c] flex flex-col font-lt-wave">
      <Navigation />

      <div className="pt-28 pb-20 px-6 md:px-10 lg:px-14">
        <div className="max-w-6xl mx-auto">

          {/* Back link */}
          <button
            onClick={() => navigate('/coaches')}
            className="flex items-center gap-2 text-white/30 hover:text-white/70 transition-colors mb-14 group"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 2L4 7l5 5" />
            </svg>
            <span style={{ fontSize: '10px' }} className="uppercase tracking-[0.28em]">All Coaches</span>
          </button>

          {/* Main layout */}
          <div className="flex flex-col lg:flex-row gap-14 xl:gap-20 items-start">

            {/* ── LEFT: the coach's cards, as in the app ── */}
            <div className="w-full max-w-[420px] lg:max-w-none lg:w-[340px] xl:w-[380px] flex-shrink-0">
              <ProfileCard coach={coach} />
              {coach.career && coach.career.length > 0 && <CareerCard rows={coach.career} />}
            </div>

            {/* ── RIGHT: name + bio ── */}
            <div className="flex-1 min-w-0">
              <span className="text-white/30 uppercase tracking-[0.25em]" style={{ fontSize: '10px' }}>
                {coach.title}
              </span>
              <h1
                className="text-white font-bold leading-none mt-3 mb-8"
                style={{ fontSize: 'clamp(2.8rem, 5.5vw, 5rem)' }}
              >
                {coach.name}
              </h1>

              <div className="h-px bg-white/8 mb-10" />

              {/* Bio */}
              {coach.bio && coach.bio.length > 0 ? (
                <div className="space-y-5">
                  {coach.bio.map((para, i) => (
                    <p key={i} className="text-white/55 text-[14px] md:text-[15px] leading-relaxed md:leading-loose">
                      {para}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-white/30 text-sm">Bio coming soon.</p>
              )}
            </div>
          </div>

          {/* Highlights videos */}
          {COACH_VIDEOS[coach.slug] && (
            <div className="mt-20">
              <div className="h-px bg-white/8 mb-12" />
              <div className="flex items-center gap-4 mb-8">
                <span className="text-white/25 uppercase tracking-[0.25em]" style={{ fontSize: '10px' }}>Highlights</span>
                <div className="h-px flex-1 bg-white/8" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {COACH_VIDEOS[coach.slug].map((v, i) => (
                  <VideoPlayer key={i} src={v.src} poster={v.poster} />
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

// Loading screen until the coach's card photo is in; their flag and club logos follow.
export default withPageImages(CoachDetailPage, ({ slug }) => {
  const coach = coaches.find((c) => c.slug === slug);
  return {
    first: [coach?.cardPhoto ?? coach?.avatarUrl],
    more: [coach?.flag?.src, ...(coach?.career ?? []).flat().flatMap((s) => s.entries.map((e) => e.icon))],
  };
});
