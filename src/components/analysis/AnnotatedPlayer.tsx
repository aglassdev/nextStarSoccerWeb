import { useCallback, useMemo, useRef, useState } from 'react';
import { Annotation, Moment, formatTimestamp } from '../../services/videoAnalysis';
import FilmPlayer, { FilmMarker, FilmPlayerHandle } from './FilmPlayer';

// The game film with its annotations: a large player on the left, the
// annotations in a column on the right, and a white dash on the timeline for
// each one. Clicking a dash (or an annotation) jumps the film there, scrolls
// the column to it and enlarges it. Coaches (editable) pause and add
// comments (shared with the family) or notes (private to coaches) at the
// current moment; families see the comments read-only. The moments the
// family marked before submitting show for the coach as blue dashes and
// read-only rows.

interface Props {
  src: string;
  poster?: string;
  annotations: Annotation[];
  /** The family's marked moments (coach view). */
  moments?: Moment[];
  editable?: boolean;
  onAdd?: (a: Pick<Annotation, 't' | 'kind' | 'text'>) => void;
  onEdit?: (id: string, text: string) => void;
  onDelete?: (id: string) => void;
  /** Shown under the column header (e.g. save status). */
  sidebarNote?: React.ReactNode;
}

type Row =
  | { key: string; t: number; type: 'annotation'; a: Annotation }
  | { key: string; t: number; type: 'moment'; m: Moment };

const KindIcon = ({ kind, className = 'w-3.5 h-3.5' }: { kind: Annotation['kind']; className?: string }) =>
  kind === 'comment' ? (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 10h8M8 14h5m-9 6l2.5-3H18a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v14z" />
    </svg>
  ) : (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="5" y="11" width="14" height="9" rx="2" strokeWidth={1.8} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 11V8a4 4 0 118 0v3" />
    </svg>
  );

export const FlagIcon = ({ className = 'w-3.5 h-3.5' }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 21V4m0 0h11l-2 4 2 4H5" />
  </svg>
);

const AnnotatedPlayer = ({ src, poster, annotations, moments = [], editable, onAdd, onEdit, onDelete, sidebarNote }: Props) => {
  const player = useRef<FilmPlayerHandle>(null);
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [time, setTime] = useState(0);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [composer, setComposer] = useState<{ kind: Annotation['kind']; t: number; text: string } | null>(null);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);

  const rows = useMemo<Row[]>(() => [
    ...annotations.map((a) => ({ key: `a:${a.id}`, t: a.t, type: 'annotation' as const, a })),
    ...moments.map((m) => ({ key: `m:${m.id}`, t: m.t, type: 'moment' as const, m })),
  ].sort((x, y) => x.t - y.t), [annotations, moments]);

  const markers = useMemo<FilmMarker[]>(() => rows.map((r) => ({
    id: r.key,
    t: r.t,
    title: r.type === 'annotation' ? r.a.text : `Moment: ${r.m.label}`,
    tone: r.type === 'moment' ? 'sky' : 'white',
  })), [rows]);

  const focusRow = useCallback((key: string, jump = true) => {
    setActiveKey(key);
    const row = rows.find((r) => r.key === key);
    if (jump && row) player.current?.seek(row.t);
    itemRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [rows]);

  const openComposer = useCallback((kind: Annotation['kind']) => {
    if (!player.current) return;
    player.current.pause();
    setComposer({ kind, t: player.current.currentTime(), text: '' });
  }, []);

  const saveComposer = () => {
    if (!composer || !composer.text.trim()) return;
    onAdd?.({ t: composer.t, kind: composer.kind, text: composer.text.trim() });
    setComposer(null);
  };

  const shortcuts = useMemo(
    () => (editable ? { c: () => openComposer('comment'), n: () => openComposer('note') } : undefined),
    [editable, openComposer],
  );

  // While the film plays, the most recent row it has passed is marked.
  const current = useMemo(() => {
    let last: Row | null = null;
    for (const r of rows) if (r.t <= time + 0.25) last = r;
    return last && time - last.t < 6 ? last.key : null;
  }, [rows, time]);

  const annotationCount = annotations.length;

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:h-[calc(100vh-11rem)] min-h-0">
      <FilmPlayer
        ref={player}
        src={src}
        poster={poster}
        markers={markers}
        activeId={activeKey}
        onMarkerClick={(key) => focusRow(key, false)}
        onTime={setTime}
        shortcuts={shortcuts}
        overlay={composer && (
          <div className="absolute inset-x-3 bottom-3 sm:inset-x-auto sm:right-3 sm:w-96 bg-[#141414]/95 backdrop-blur border border-white/15 rounded-xl p-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 text-white text-xs mb-2">
              <KindIcon kind={composer.kind} />
              <span className="font-medium capitalize">{composer.kind}</span>
              <span className="text-gray-500">at {formatTimestamp(composer.t)}</span>
              {composer.kind === 'note' && <span className="ml-auto text-amber-300/80">Only coaches see notes</span>}
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
              placeholder={composer.kind === 'comment' ? 'What should the player see here?' : 'A note for yourself…'}
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
        actions={editable && (
          <>
            <button onClick={() => openComposer('comment')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-black text-xs font-semibold hover:bg-gray-200" title="Pause and add a comment (C)">
              <KindIcon kind="comment" /> Comment
            </button>
            <button onClick={() => openComposer('note')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/20 text-white text-xs font-semibold hover:border-white/40" title="Pause and add a private note, only coaches see it (N)">
              <KindIcon kind="note" /> Note
            </button>
          </>
        )}
      />

      {/* ── Annotations column ── */}
      <aside className="lg:w-[340px] xl:w-[380px] flex-shrink-0 flex flex-col bg-[#0b0b0b] border border-white/10 rounded-2xl overflow-hidden max-h-[60vh] lg:max-h-none">
        <div className="px-4 py-3 border-b border-white/10">
          <div className="flex items-center justify-between">
            <p className="text-white text-sm font-semibold">Annotations</p>
            <span className="text-gray-500 text-xs">
              {annotationCount}
              {moments.length > 0 && <span className="text-[#7dd3fc]/80"> · {moments.length} marked by the family</span>}
            </span>
          </div>
          {sidebarNote && <div className="mt-1">{sidebarNote}</div>}
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {rows.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-10 px-4">
              {editable ? 'Pause the film and press Comment or Note to add the first annotation.' : 'No annotations yet.'}
            </p>
          ) : rows.map((r) => {
            const isActive = activeKey === r.key;
            const isCurrent = current === r.key;
            const box = `rounded-xl border px-3 py-2.5 cursor-pointer transition-all duration-200 origin-center ${
              isActive
                ? 'scale-[1.04] border-white/60 bg-white/[0.09] shadow-lg'
                : isCurrent
                  ? 'border-white/25 bg-white/[0.05]'
                  : 'border-white/[0.08] hover:border-white/20'
            }`;
            if (r.type === 'moment') {
              return (
                <div key={r.key} ref={(el) => { itemRefs.current[r.key] = el; }} onClick={() => focusRow(r.key)} className={box}>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-1.5 py-0.5 rounded bg-white/10 text-white tabular-nums font-medium">{formatTimestamp(r.t)}</span>
                    <span className="inline-flex items-center gap-1 text-[#7dd3fc]">
                      <FlagIcon className="w-3 h-3" /> Marked by the family
                    </span>
                  </div>
                  <p className={`text-white/90 leading-relaxed mt-1.5 ${isActive ? 'text-[15px]' : 'text-sm'}`}>{r.m.label}</p>
                </div>
              );
            }
            const a = r.a;
            return (
              <div key={r.key} ref={(el) => { itemRefs.current[r.key] = el; }} onClick={() => focusRow(r.key)} className={box}>
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-1.5 py-0.5 rounded bg-white/10 text-white tabular-nums font-medium">{formatTimestamp(a.t)}</span>
                  {a.kind === 'note' && (
                    <span className="inline-flex items-center gap-1 text-amber-300" title="Private: only coaches see notes">
                      <KindIcon kind="note" className="w-3 h-3" />
                      Note
                    </span>
                  )}
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
