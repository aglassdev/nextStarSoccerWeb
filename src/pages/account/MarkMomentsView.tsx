import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import FilmPlayer, { FilmMarker, FilmPlayerHandle } from '../../components/analysis/FilmPlayer';
import { FlagIcon } from '../../components/analysis/AnnotatedPlayer';
import { AccountPageHeader } from './AccountLayout';
import {
  Moment,
  VideoAnalysis,
  formatTimestamp,
  nextMomentName,
  parseMoments,
  saveAnalysisDraft,
  submitAnalysis,
} from '../../services/videoAnalysis';

// Right after the film uploads, before the coach gets it: the family watches
// their film, adds notes for the coach (jersey number and so on) and marks
// the moments they want analysed. Each "Mark Moment" drops a blue dash on the
// timeline with a default name (Moment 1, Moment 2…) they can rename. Drafts
// save as they go; Submit (top right) sends it all to the coach. Submitting
// with no moments asks them to confirm first.

const newId = () => Math.random().toString(36).slice(2, 10);

interface Props {
  analysis: VideoAnalysis;
  title: string;
  film: string;
  poster?: string;
  onSubmitted: (a: VideoAnalysis) => void;
}

const MarkMomentsView = ({ analysis, title, film, poster, onSubmitted }: Props) => {
  const player = useRef<FilmPlayerHandle>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [notes, setNotes] = useState(analysis.playerNotes || '');
  const [moments, setMoments] = useState<Moment[]>(() => parseMoments(analysis.moments));
  const [time, setTime] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [naming, setNaming] = useState<{ id: string; text: string } | null>(null);
  const [saveState, setSaveState] = useState<'saved' | 'pending' | 'saving' | 'error'>('saved');
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const saving = useRef<Promise<void>>(Promise.resolve());
  const firstRender = useRef(true);
  const submittingRef = useRef(false);

  const sorted = useMemo(() => [...moments].sort((a, b) => a.t - b.t), [moments]);
  const markers = useMemo<FilmMarker[]>(() => sorted.map((m) => ({ id: m.id, t: m.t, title: m.label, tone: 'sky' })), [sorted]);

  // Drafts save a moment after the last change.
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    setSaveState('pending');
    const t = window.setTimeout(() => {
      if (submittingRef.current) return;
      setSaveState('saving');
      const draft = { notes: notes.trim(), moments };
      saving.current = saving.current.then(async () => {
        try {
          await saveAnalysisDraft(analysis.$id, draft);
          setSaveState('saved');
        } catch {
          setSaveState('error');
        }
      });
    }, 1000);
    return () => clearTimeout(t);
  }, [notes, moments, analysis.$id]);

  // Don't lose unsaved changes by leaving.
  useEffect(() => {
    if (saveState === 'saved') return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [saveState]);

  const mark = useCallback(() => {
    if (!player.current) return;
    player.current.pause();
    const m: Moment = { id: newId(), t: Math.round(player.current.currentTime() * 10) / 10, label: '' };
    setMoments((list) => {
      m.label = nextMomentName(list);
      return [...list, m];
    });
    setActiveId(m.id);
    setNaming({ id: m.id, text: '' });
  }, []);

  const rename = (id: string, label: string) =>
    setMoments((list) => list.map((m) => (m.id === id ? { ...m, label } : m)));

  // Closing the little box keeps the default name unless they typed one.
  const finishNaming = () => {
    if (naming && naming.text.trim()) rename(naming.id, naming.text.trim());
    setNaming(null);
  };

  const remove = (id: string) => {
    setMoments((list) => list.filter((m) => m.id !== id));
    if (naming?.id === id) setNaming(null);
  };

  const focus = (m: Moment) => {
    setActiveId(m.id);
    player.current?.seek(m.t);
  };

  const shortcuts = useMemo(() => ({ m: mark }), [mark]);

  // The row the film is on (the last moment it passed, within a few seconds).
  const current = useMemo(() => {
    let last: Moment | null = null;
    for (const m of sorted) if (m.t <= time + 0.25) last = m;
    return last && time - last.t < 6 ? last.id : null;
  }, [sorted, time]);

  useEffect(() => {
    if (activeId) rowRefs.current[activeId]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activeId, moments.length]);

  const submit = async () => {
    setConfirmEmpty(false);
    setSubmitting(true);
    submittingRef.current = true;
    setError('');
    try {
      await saving.current;
      const { analysis: updated } = await submitAnalysis(analysis.$id, {
        notes: notes.trim(),
        moments: moments.map((m) => ({ ...m, label: m.label.trim() || 'Moment' })),
      });
      setSaveState('saved');
      onSubmitted(updated);
    } catch (e: any) {
      setError(e?.message || 'Could not submit. Check your connection and try again.');
      setSubmitting(false);
      submittingRef.current = false;
    }
  };

  const onSubmitClick = () => {
    finishNaming();
    if (moments.length === 0) setConfirmEmpty(true);
    else submit();
  };

  const namingMoment = naming && moments.find((m) => m.id === naming.id);

  return (
    <div>
      <AccountPageHeader
        title={title}
        back="/account/video-analysis"
        right={
          <div className="flex items-center gap-4">
            <span className={`text-xs ${saveState === 'error' ? 'text-red-400' : 'text-[#666]'}`}>
              {saveState === 'saving' || saveState === 'pending' ? 'Saving…' : saveState === 'error' ? 'Not saved, check your connection' : 'Draft saved'}
            </span>
            <button
              onClick={onSubmitClick}
              disabled={submitting}
              className="px-6 py-2.5 bg-[#F4F2EE] hover:bg-white text-black text-sm font-semibold rounded-xl disabled:opacity-50"
            >
              {submitting ? 'Submitting…' : 'Submit'}
            </button>
          </div>
        }
      />
      {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>}

      <div className="flex flex-col lg:flex-row gap-4 lg:h-[calc(100vh-12rem)] min-h-0">
        <FilmPlayer
          ref={player}
          src={film}
          poster={poster}
          markers={markers}
          activeId={activeId}
          onMarkerClick={setActiveId}
          onTime={setTime}
          shortcuts={naming ? undefined : shortcuts}
          overlay={namingMoment && (
            <div
              className="absolute left-1/2 bottom-4 -translate-x-1/2 w-[min(22rem,calc(100%-1.5rem))] bg-[#141414]/95 backdrop-blur border border-white/15 rounded-xl p-3 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 text-xs mb-2">
                <FlagIcon className="w-3.5 h-3.5 text-[#7dd3fc]" />
                <span className="text-white font-medium">Moment marked</span>
                <span className="text-gray-500 tabular-nums">at {formatTimestamp(namingMoment.t)}</span>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); finishNaming(); }} className="flex gap-2">
                <input
                  autoFocus
                  value={naming.text}
                  onChange={(e) => setNaming({ ...naming, text: e.target.value })}
                  onKeyDown={(e) => { if (e.key === 'Escape') finishNaming(); }}
                  placeholder={namingMoment.label}
                  maxLength={120}
                  className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/40 focus:outline-none focus:border-white/30"
                />
                <button type="submit" className="px-4 py-2 text-xs bg-white text-black font-semibold rounded-lg">Done</button>
              </form>
            </div>
          )}
          actions={
            <button
              onClick={mark}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-black text-xs font-semibold hover:bg-gray-200"
              title="Pause and mark this moment (M)"
            >
              <FlagIcon /> Mark Moment
            </button>
          }
        />

        <aside className="lg:w-[340px] xl:w-[380px] flex-shrink-0 flex flex-col gap-4 min-h-0">
          <section className="bg-[#0b0b0b] border border-white/10 rounded-2xl p-4">
            <label className="block">
              <span className="block text-white text-sm font-semibold mb-1">Notes for your coach</span>
              <span className="block text-gray-500 text-xs mb-3">Jersey number and color, position, and anything you want your coach to focus on.</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="e.g. #10, white jersey, left wing"
                className="w-full px-3 py-2.5 bg-black/40 border border-white/10 rounded-lg text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-white/30 resize-none"
              />
            </label>
          </section>

          <section className="flex-1 min-h-[16rem] flex flex-col bg-[#0b0b0b] border border-white/10 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10">
              <div className="flex items-center justify-between">
                <p className="text-white text-sm font-semibold">Mark Moments</p>
                <span className="text-gray-500 text-xs">{moments.length}</span>
              </div>
              <p className="text-gray-400 text-xs mt-1 leading-relaxed">
                Please mark any and all moments you would like the coach to analyze. Pause on a moment and press Mark Moment.
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {sorted.length === 0 ? (
                <div className="text-center py-10 px-4">
                  <FlagIcon className="w-6 h-6 text-white/20 mx-auto" />
                  <p className="text-gray-500 text-sm mt-2">No moments marked yet.</p>
                </div>
              ) : sorted.map((m) => {
                const active = activeId === m.id;
                return (
                  <div
                    key={m.id}
                    ref={(el) => { rowRefs.current[m.id] = el; }}
                    className={`group flex items-center gap-2 rounded-xl border px-2.5 py-2 transition-colors ${
                      active ? 'border-white/50 bg-white/[0.08]' : current === m.id ? 'border-white/25 bg-white/[0.04]' : 'border-white/[0.08] hover:border-white/20'
                    }`}
                  >
                    <button
                      onClick={() => focus(m)}
                      className="px-1.5 py-0.5 rounded bg-[#7dd3fc]/15 text-[#bae6fd] text-xs tabular-nums font-medium hover:bg-[#7dd3fc]/25 flex-shrink-0"
                      title="Go to this moment"
                    >
                      {formatTimestamp(m.t)}
                    </button>
                    <input
                      value={m.label}
                      onChange={(e) => rename(m.id, e.target.value)}
                      onFocus={() => setActiveId(m.id)}
                      onBlur={(e) => { if (!e.target.value.trim()) rename(m.id, nextMomentName(moments.filter((x) => x.id !== m.id))); }}
                      maxLength={120}
                      aria-label="Moment name"
                      className="flex-1 min-w-0 bg-transparent text-white text-sm px-1.5 py-1 rounded-md border border-transparent hover:border-white/10 focus:border-white/30 focus:outline-none"
                    />
                    <button
                      onClick={() => remove(m.id)}
                      className="text-gray-600 hover:text-red-400 p-1 flex-shrink-0"
                      aria-label={`Remove ${m.label}`}
                      title="Remove"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        </aside>
      </div>

      {confirmEmpty && (
        <>
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40" onClick={() => setConfirmEmpty(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div role="alertdialog" aria-modal="true" aria-labelledby="no-moments-title"
              className="pointer-events-auto w-full max-w-md bg-[#111] border border-white/10 rounded-2xl shadow-2xl p-6">
              <h3 id="no-moments-title" className="text-white font-semibold text-lg">No moments marked</h3>
              <p className="text-gray-400 text-sm mt-2 leading-relaxed">
                If you don't mark any game moments, the coach may miss moments you'd like reviewed and the lead time may be longer.
              </p>
              <div className="flex justify-end gap-3 mt-6">
                <button autoFocus onClick={() => setConfirmEmpty(false)}
                  className="px-5 py-2 text-sm text-white border border-white/15 hover:border-white/40 rounded-lg">
                  Cancel
                </button>
                <button onClick={submit}
                  className="px-5 py-2 text-sm bg-[#F4F2EE] hover:bg-white text-black font-semibold rounded-lg">
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default MarkMomentsView;
