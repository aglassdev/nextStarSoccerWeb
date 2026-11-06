import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Annotation, formatTimestamp } from '../../services/videoAnalysis';

// The game film with its annotations: a large player on the left, the
// annotations in a column on the right, and a white dash on the timeline for
// each one. Clicking a dash (or an annotation) jumps the film there, scrolls
// the column to it and enlarges it. Coaches (editable) pause and add
// comments or notes at the current moment; players see the same thing
// read-only.

interface Props {
  src: string;
  poster?: string;
  annotations: Annotation[];
  editable?: boolean;
  onAdd?: (a: Pick<Annotation, 't' | 'kind' | 'text'>) => void;
  onEdit?: (id: string, text: string) => void;
  onDelete?: (id: string) => void;
  /** Shown under the column header (e.g. save status). */
  sidebarNote?: React.ReactNode;
}

const SPEEDS = [0.5, 1, 1.5, 2];

const KindIcon = ({ kind, className = 'w-3.5 h-3.5' }: { kind: Annotation['kind']; className?: string }) =>
  kind === 'comment' ? (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 10h8M8 14h5m-9 6l2.5-3H18a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v14z" />
    </svg>
  ) : (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15.232 5.232l3.536 3.536M4 20h4l10.5-10.5a2.5 2.5 0 00-3.536-3.536L4 16.5V20z" />
    </svg>
  );

const AnnotatedPlayer = ({ src, poster, annotations, editable, onAdd, onEdit, onDelete, sidebarNote }: Props) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffering, setBuffering] = useState(false);
  const [failed, setFailed] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [composer, setComposer] = useState<{ kind: Annotation['kind']; t: number; text: string } | null>(null);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [hoverT, setHoverT] = useState<number | null>(null);

  const sorted = useMemo(() => [...annotations].sort((a, b) => a.t - b.t), [annotations]);

  const seek = useCallback((t: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(t, v.duration || t));
    setTime(v.currentTime);
  }, []);

  const focusAnnotation = useCallback((a: Annotation, jump = true) => {
    setActiveId(a.id);
    if (jump) seek(a.t);
    itemRefs.current[a.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [seek]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  }, []);

  const openComposer = useCallback((kind: Annotation['kind']) => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    setComposer({ kind, t: v.currentTime, text: '' });
  }, []);

  const saveComposer = () => {
    if (!composer || !composer.text.trim()) return;
    onAdd?.({ t: composer.t, kind: composer.kind, text: composer.text.trim() });
    setComposer(null);
  };

  // Keyboard: space play/pause, ←/→ 5 s, C comment, N note — not while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
      else if (e.key === 'ArrowLeft') seek((videoRef.current?.currentTime || 0) - 5);
      else if (e.key === 'ArrowRight') seek((videoRef.current?.currentTime || 0) + 5);
      else if (editable && (e.key === 'c' || e.key === 'C')) { e.preventDefault(); openComposer('comment'); }
      else if (editable && (e.key === 'n' || e.key === 'N')) { e.preventDefault(); openComposer('note'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePlay, seek, openComposer, editable]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = speed;
  }, [speed]);

  // While the film plays, the most recent annotation it has passed is marked.
  const current = useMemo(() => {
    let last: Annotation | null = null;
    for (const a of sorted) if (a.t <= time + 0.25) last = a;
    return last && time - last.t < 6 ? last.id : null;
  }, [sorted, time]);

  const pct = (t: number) => (duration > 0 ? Math.min(100, (t / duration) * 100) : 0);

  const scrubFromEvent = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * duration;
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:h-[calc(100vh-11rem)] min-h-0">
      {/* ── Film ── */}
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
              onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
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
          {!playing && !buffering && !failed && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-16 h-16 rounded-full bg-black/50 backdrop-blur flex items-center justify-center">
                <svg className="w-7 h-7 text-white ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
              </div>
            </div>
          )}

          {/* Composer, over the paused frame */}
          {composer && (
            <div className="absolute inset-x-3 bottom-3 sm:inset-x-auto sm:right-3 sm:w-96 bg-[#141414]/95 backdrop-blur border border-white/15 rounded-xl p-3 shadow-2xl"
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2 text-white text-xs mb-2">
                <KindIcon kind={composer.kind} />
                <span className="font-medium capitalize">{composer.kind}</span>
                <span className="text-gray-500">at {formatTimestamp(composer.t)}</span>
              </div>
              <textarea
                autoFocus
                value={composer.text}
                onChange={(e) => setComposer({ ...composer, text: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveComposer();
                  if (e.key === 'Escape') setComposer(null);
                }}
                rows={3}
                placeholder={composer.kind === 'comment' ? 'What should the player see here?' : 'Add a note for this moment…'}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30 resize-none"
              />
              <div className="flex justify-end gap-2 mt-2">
                <button onClick={() => setComposer(null)} className="px-3 py-1.5 text-xs text-gray-400 hover:text-white">Cancel</button>
                <button onClick={saveComposer} disabled={!composer.text.trim()}
                  className="px-4 py-1.5 text-xs bg-white text-black font-semibold rounded-lg disabled:opacity-40">
                  Add {composer.kind}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Controls ── */}
        <div className="px-4 pt-3 pb-3 border-t border-white/10 space-y-2.5">
          {/* Timeline with a white dash per annotation */}
          <div
            className="relative h-6 cursor-pointer group"
            onClick={(e) => duration && seek(scrubFromEvent(e))}
            onMouseMove={(e) => duration && setHoverT(scrubFromEvent(e))}
            onMouseLeave={() => setHoverT(null)}
          >
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-white/15 overflow-hidden">
              <div className="h-full bg-white/50" style={{ width: `${pct(time)}%` }} />
            </div>
            {duration > 0 && sorted.map((a) => (
              <button
                key={a.id}
                type="button"
                title={`${formatTimestamp(a.t)} · ${a.text.slice(0, 60)}`}
                onClick={(e) => { e.stopPropagation(); focusAnnotation(a); }}
                className={`absolute top-0 h-6 w-2.5 -ml-[5px] flex justify-center`}
                style={{ left: `${pct(a.t)}%` }}
              >
                <span className={`block h-full rounded-sm transition-all ${activeId === a.id ? 'w-1 bg-white' : 'w-0.5 bg-white/90 hover:w-1'}`} />
              </button>
            ))}
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
            {editable && (
              <>
                <button onClick={() => openComposer('comment')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-black text-xs font-semibold hover:bg-gray-200" title="Pause and add a comment (C)">
                  <KindIcon kind="comment" /> Comment
                </button>
                <button onClick={() => openComposer('note')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/20 text-white text-xs font-semibold hover:border-white/40" title="Pause and add a note (N)">
                  <KindIcon kind="note" /> Note
                </button>
              </>
            )}
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

      {/* ── Annotations column ── */}
      <aside className="lg:w-[340px] xl:w-[380px] flex-shrink-0 flex flex-col bg-[#0b0b0b] border border-white/10 rounded-2xl overflow-hidden max-h-[60vh] lg:max-h-none">
        <div className="px-4 py-3 border-b border-white/10">
          <div className="flex items-center justify-between">
            <p className="text-white text-sm font-semibold">Annotations</p>
            <span className="text-gray-500 text-xs">{sorted.length}</span>
          </div>
          {sidebarNote && <div className="mt-1">{sidebarNote}</div>}
        </div>
        <div ref={listRef} className="flex-1 overflow-y-auto p-3 space-y-2">
          {sorted.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-10 px-4">
              {editable ? 'Pause the film and press Comment or Note to add the first annotation.' : 'No annotations yet.'}
            </p>
          ) : sorted.map((a) => {
            const isActive = activeId === a.id;
            const isCurrent = current === a.id;
            return (
              <div
                key={a.id}
                ref={(el) => { itemRefs.current[a.id] = el; }}
                onClick={() => focusAnnotation(a)}
                className={`rounded-xl border px-3 py-2.5 cursor-pointer transition-all duration-200 origin-center ${
                  isActive
                    ? 'scale-[1.04] border-white/60 bg-white/[0.09] shadow-lg'
                    : isCurrent
                      ? 'border-white/25 bg-white/[0.05]'
                      : 'border-white/[0.08] hover:border-white/20'
                }`}
              >
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-1.5 py-0.5 rounded bg-white/10 text-white tabular-nums font-medium">{formatTimestamp(a.t)}</span>
                  <span className={`inline-flex items-center gap-1 ${a.kind === 'comment' ? 'text-sky-300' : 'text-amber-300'}`}>
                    <KindIcon kind={a.kind} className="w-3 h-3" />
                    <span className="capitalize">{a.kind}</span>
                  </span>
                  {a.author && <span className="text-gray-600 truncate">· {a.author}</span>}
                </div>
                {editing?.id === a.id ? (
                  <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                    <textarea
                      autoFocus
                      value={editing.text}
                      onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                      rows={3}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-2.5 py-2 text-white text-sm focus:outline-none focus:border-white/30 resize-none"
                    />
                    <div className="flex justify-end gap-2 mt-1.5">
                      <button onClick={() => setEditing(null)} className="text-xs text-gray-400 hover:text-white px-2 py-1">Cancel</button>
                      <button
                        onClick={() => { if (editing.text.trim()) onEdit?.(a.id, editing.text.trim()); setEditing(null); }}
                        className="text-xs bg-white text-black font-semibold rounded-md px-3 py-1"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className={`text-white/90 leading-relaxed mt-1.5 whitespace-pre-wrap ${isActive ? 'text-[15px]' : 'text-sm'}`}>{a.text}</p>
                )}
                {editable && editing?.id !== a.id && (
                  <div className="flex gap-3 mt-1.5 text-[11px] text-gray-500" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => setEditing({ id: a.id, text: a.text })} className="hover:text-white">Edit</button>
                    <button onClick={() => { if (confirm('Delete this annotation?')) onDelete?.(a.id); }} className="hover:text-red-400">Delete</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
};

export default AnnotatedPlayer;
