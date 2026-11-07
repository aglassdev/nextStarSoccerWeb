import { ReactNode, forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { formatTimestamp } from '../../services/videoAnalysis';

// The game film player used by the coach workspace, the family's finished
// analysis and the family's moment marking: a large film with a timeline that
// carries a dash per marker (an annotation or a marked moment). Clicking a
// dash calls onMarkerClick. Space plays/pauses, ←/→ skip 5 s.

export interface FilmMarker {
  id: string;
  t: number;
  title: string;
  /** white: annotations; sky: the family's marked moments. */
  tone?: 'white' | 'sky';
}

export interface FilmPlayerHandle {
  seek: (t: number) => void;
  pause: () => void;
  currentTime: () => number;
}

interface Props {
  src: string;
  poster?: string;
  markers: FilmMarker[];
  activeId?: string | null;
  onMarkerClick?: (id: string) => void;
  /** Called as the film plays (about 4 times a second). */
  onTime?: (t: number) => void;
  /** Shown over the film (e.g. a composer over the paused frame). */
  overlay?: ReactNode;
  /** Buttons in the control bar, before the speed menu. */
  actions?: ReactNode;
  /** Extra one-key shortcuts (lower-case key → action); ignored while typing. */
  shortcuts?: Record<string, () => void>;
}

const SPEEDS = [0.5, 1, 1.5, 2];

const isTyping = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  const tag = el?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!el?.isContentEditable;
};

const FilmPlayer = forwardRef<FilmPlayerHandle, Props>(
  ({ src, poster, markers, activeId, onMarkerClick, onTime, overlay, actions, shortcuts }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [playing, setPlaying] = useState(false);
    const [time, setTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [buffering, setBuffering] = useState(false);
    const [failed, setFailed] = useState(false);
    const [speed, setSpeed] = useState(1);
    const [hoverT, setHoverT] = useState<number | null>(null);

    const sorted = useMemo(() => [...markers].sort((a, b) => a.t - b.t), [markers]);

    const seek = useCallback((t: number) => {
      const v = videoRef.current;
      if (!v) return;
      v.currentTime = Math.max(0, Math.min(t, v.duration || t));
      setTime(v.currentTime);
      onTime?.(v.currentTime);
    }, [onTime]);

    const togglePlay = useCallback(() => {
      const v = videoRef.current;
      if (!v) return;
      if (v.paused) v.play().catch(() => {});
      else v.pause();
    }, []);

    useImperativeHandle(ref, () => ({
      seek,
      pause: () => videoRef.current?.pause(),
      currentTime: () => videoRef.current?.currentTime || 0,
    }), [seek]);

    useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
        if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
        if (e.code === 'Space') { e.preventDefault(); togglePlay(); return; }
        if (e.key === 'ArrowLeft') { seek((videoRef.current?.currentTime || 0) - 5); return; }
        if (e.key === 'ArrowRight') { seek((videoRef.current?.currentTime || 0) + 5); return; }
        const extra = shortcuts?.[e.key.toLowerCase()];
        if (extra) { e.preventDefault(); extra(); }
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }, [togglePlay, seek, shortcuts]);

    useEffect(() => {
      if (videoRef.current) videoRef.current.playbackRate = speed;
    }, [speed]);

    const pct = (t: number) => (duration > 0 ? Math.min(100, (t / duration) * 100) : 0);

    const scrubFromEvent = (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * duration;
    };

    return (
      <div className="flex-1 min-w-0 flex flex-col bg-[#0b0b0b] border border-white/10 rounded-2xl overflow-hidden">
        <div className="relative flex-1 min-h-[240px] bg-black flex items-center justify-center" onClick={togglePlay}>
          {failed ? (
            <div className="text-center px-6">
              <p className="text-white text-sm">This film can't play in this browser.</p>
              <p className="text-gray-500 text-xs mt-1">
                It may be in a format like HEVC. Try Safari, or{' '}
                <a href={src} target="_blank" rel="noopener noreferrer" className="underline" onClick={(e) => e.stopPropagation()}>download it</a>.
              </p>
            </div>
          ) : (
            <video
              ref={videoRef}
              src={src}
              poster={poster}
              playsInline
              preload="metadata"
              className="absolute inset-0 w-full h-full object-contain"
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onTimeUpdate={(e) => { setTime(e.currentTarget.currentTime); onTime?.(e.currentTarget.currentTime); }}
              onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
              onDurationChange={(e) => setDuration(e.currentTarget.duration || 0)}
              onWaiting={() => setBuffering(true)}
              onPlaying={() => setBuffering(false)}
              onCanPlay={() => setBuffering(false)}
              onError={() => setFailed(true)}
            />
          )}
          {buffering && !failed && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-10 h-10 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
          )}
          {!playing && !buffering && !failed && !overlay && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-16 h-16 rounded-full bg-black/50 backdrop-blur flex items-center justify-center">
                <svg className="w-7 h-7 text-white ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
              </div>
            </div>
          )}
          {overlay}
        </div>

        {/* ── Controls ── */}
        <div className="px-4 pt-3 pb-3 border-t border-white/10 space-y-2.5">
          <div
            className="relative h-6 cursor-pointer group"
            onClick={(e) => duration && seek(scrubFromEvent(e))}
            onMouseMove={(e) => duration && setHoverT(scrubFromEvent(e))}
            onMouseLeave={() => setHoverT(null)}
          >
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-white/15 overflow-hidden">
              <div className="h-full bg-white/50" style={{ width: `${pct(time)}%` }} />
            </div>
            {duration > 0 && sorted.map((m) => {
              const color = m.tone === 'sky' ? 'bg-[#7dd3fc]' : 'bg-white';
              return (
                <button
                  key={m.id}
                  type="button"
                  title={`${formatTimestamp(m.t)} · ${m.title.slice(0, 60)}`}
                  onClick={(e) => { e.stopPropagation(); seek(m.t); onMarkerClick?.(m.id); }}
                  className="absolute top-0 h-6 w-2.5 -ml-[5px] flex justify-center"
                  style={{ left: `${pct(m.t)}%` }}
                >
                  <span className={`block h-full rounded-sm transition-all ${color} ${activeId === m.id ? 'w-1' : 'w-0.5 opacity-90 hover:w-1'}`} />
                </button>
              );
            })}
            <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 -ml-1.5 rounded-full bg-white shadow pointer-events-none" style={{ left: `${pct(time)}%` }} />
            {hoverT !== null && (
              <div className="absolute -top-6 -translate-x-1/2 px-1.5 py-0.5 rounded bg-black/80 text-white text-[10px] tabular-nums pointer-events-none" style={{ left: `${pct(hoverT)}%` }}>
                {formatTimestamp(hoverT)}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button onClick={togglePlay} className="text-white hover:text-gray-300" aria-label={playing ? 'Pause' : 'Play'}>
              {playing ? (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
              ) : (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
              )}
            </button>
            <button onClick={() => seek(time - 5)} className="text-gray-400 hover:text-white text-xs tabular-nums" title="Back 5 seconds (←)">−5s</button>
            <button onClick={() => seek(time + 5)} className="text-gray-400 hover:text-white text-xs tabular-nums" title="Forward 5 seconds (→)">+5s</button>
            <span className="text-gray-400 text-xs tabular-nums">{formatTimestamp(time)} / {formatTimestamp(duration)}</span>
            <div className="flex-1" />
            {actions}
            <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}
              className="bg-transparent text-gray-400 text-xs border border-white/10 rounded-md px-1.5 py-1 focus:outline-none" aria-label="Playback speed">
              {SPEEDS.map((s) => <option key={s} value={s} className="bg-black">{s}×</option>)}
            </select>
            <button onClick={() => videoRef.current?.requestFullscreen?.()} className="text-gray-400 hover:text-white" aria-label="Full screen">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  },
);

FilmPlayer.displayName = 'FilmPlayer';

export default FilmPlayer;
