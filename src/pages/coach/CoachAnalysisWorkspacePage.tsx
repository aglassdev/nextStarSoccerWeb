import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AnnotatedPlayer from '../../components/analysis/AnnotatedPlayer';
import AnalysisRecorder from '../../components/analysis/AnalysisRecorder';
import { useAccount } from '../account/AccountContext';
import {
  Annotation,
  VideoAnalysis,
  completeAnalysis,
  formatBytes,
  formatDueDate,
  getAnalysis,
  getAnalysisUrls,
  getCoachNotes,
  parseAnnotations,
  parseGameMarks,
  parseMoments,
  saveCoachNotes,
  updateAnalysis,
} from '../../services/videoAnalysis';

// A coach's workspace for one analysis: the film with the annotation column,
// the recorded breakdown, a written summary, and "mark complete" (which shares
// it with the family and emails them). Comments are saved on the analysis
// (the family sees them); notes go to a separate coach-only collection.

const newId = () => Math.random().toString(36).slice(2, 10);
const shared = (list: Annotation[]) => list.filter((x) => x.kind !== 'note');
const privateNotes = (list: Annotation[]) => list.filter((x) => x.kind === 'note');

const CoachAnalysisWorkspacePage = () => {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAccount();
  const author = `${profile?.firstName || ''} ${profile?.lastName || ''}`.trim();

  const [a, setA] = useState<VideoAnalysis | null>(null);
  const [urls, setUrls] = useState<{ film?: string; thumb?: string; recording?: string }>({});
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [summary, setSummary] = useState('');
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved');
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState('');
  const saving = useRef<Promise<void>>(Promise.resolve());

  const loadUrls = useCallback(async (docId: string) => {
    setUrls((await getAnalysisUrls([docId]))[docId] || {});
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [doc, notes] = await Promise.all([getAnalysis(id), getCoachNotes(id)]);
        setA(doc);
        setAnnotations([...parseAnnotations(doc.annotations), ...notes]);
        setSummary(doc.summary || '');
        await loadUrls(doc.$id);
      } catch (e: any) {
        setError(e?.message || 'Could not load this analysis.');
      }
    })();
  }, [id, loadUrls]);

  // Saves run one after another so a quick edit never lands before an earlier one.
  const queue = useCallback((write: () => Promise<void>) => {
    setSaveState('saving');
    saving.current = saving.current.then(async () => {
      try {
        await write();
        setSaveState('saved');
      } catch {
        setSaveState('error');
      }
    });
  }, []);

  const persist = useCallback((data: Partial<Omit<VideoAnalysis, '$id'>>) => {
    if (!a) return;
    queue(async () => {
      const startReview = a.status === 'submitted' ? { status: 'in_review' as const } : {};
      setA(await updateAnalysis(a.$id, { ...data, ...startReview }));
    });
  }, [a, queue]);

  // Only the side that changed is written: comments to the analysis, notes to the private doc.
  const commit = (next: Annotation[]) => {
    if (!a) return;
    const prev = annotations;
    setAnnotations(next);
    if (JSON.stringify(shared(next)) !== JSON.stringify(shared(prev))) {
      persist({ annotations: JSON.stringify(shared(next)) });
    }
    if (JSON.stringify(privateNotes(next)) !== JSON.stringify(privateNotes(prev))) {
      queue(() => saveCoachNotes(a.$id, privateNotes(next)));
    }
  };

  // Summary saves a moment after typing stops.
  useEffect(() => {
    if (!a || summary === (a.summary || '')) return;
    const t = window.setTimeout(() => persist({ summary }), 900);
    return () => clearTimeout(t);
  }, [summary]); // eslint-disable-line react-hooks/exhaustive-deps

  // Comments alone are enough; the recording and summary are extras. Notes
  // don't count: the family never sees them.
  const hasShared = !!a?.recordingFileId || shared(annotations).length > 0 || !!summary.trim();

  const complete = async () => {
    if (!a) return;
    if (!hasShared) return setError('Add at least one comment to the film first.');
    if (!confirm(`Send this analysis to ${a.purchaserName || 'the family'}? They'll get an email that it's ready.`)) return;
    setCompleting(true);
    setError('');
    try {
      await saving.current;
      await completeAnalysis(a.$id);
      navigate('/coach');
    } catch (e: any) {
      setError(e?.message || 'Could not complete the analysis.');
      setCompleting(false);
    }
  };

  if (error && !a) {
    return (
      <div className="space-y-4">
        <Link to="/coach" className="text-gray-400 hover:text-white text-sm">← Video Analysis</Link>
        <p className="text-gray-400 text-sm">{error}</p>
      </div>
    );
  }
  if (!a) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-white/40 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const done = a.status === 'completed';
  const savedNote = (
    <p className={`text-[11px] ${saveState === 'error' ? 'text-red-400' : 'text-gray-500'}`}>
      {saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Not saved — check your connection' : 'All changes saved'}
    </p>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link to="/coach" className="text-gray-500 hover:text-white text-xs">← Video Analysis</Link>
          <h2 className="text-xl md:text-2xl font-bold text-white mt-1 truncate">{a.playerName}</h2>
          <p className="text-gray-500 text-sm mt-0.5">
            {a.purchaserName && a.purchaserName !== a.playerName ? `${a.purchaserName} · ` : ''}
            {done ? `Completed ${formatDueDate(a.completedAt)}` : `Due ${formatDueDate(a.dueAt)}`}
            {a.filmSize ? ` · ${formatBytes(a.filmSize)}` : ''}
          </p>
        </div>
        {!done && (
          <button onClick={complete} disabled={completing || !hasShared}
            className="px-5 py-2.5 bg-white hover:bg-gray-200 text-black text-sm font-semibold rounded-lg disabled:opacity-40">
            {completing ? 'Sending…' : 'Mark complete & notify family'}
          </button>
        )}
        {done && <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">Sent to family</span>}
      </div>

      {a.playerNotes && (
        <div className="bg-[#111] border border-white/10 rounded-xl px-4 py-3">
          <p className="text-gray-500 text-[11px] uppercase tracking-wider">From the family</p>
          <p className="text-white/90 text-sm mt-1 whitespace-pre-wrap">{a.playerNotes}</p>
        </div>
      )}
      {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>}

      {urls.film ? (
        <AnnotatedPlayer
          src={urls.film}
          poster={urls.thumb}
          annotations={annotations}
          moments={parseMoments(a.moments)}
          gameMarks={parseGameMarks(a.gameMarks)}
          editable={!done}
          sidebarNote={!done ? savedNote : undefined}
          onAdd={(x) => commit([...annotations, { ...x, id: newId(), createdAt: new Date().toISOString(), author }])}
          onEdit={(aid, text) => commit(annotations.map((x) => (x.id === aid ? { ...x, text } : x)))}
          onDelete={(aid) => commit(annotations.filter((x) => x.id !== aid))}
        />
      ) : (
        <div className="h-64 flex items-center justify-center bg-[#0b0b0b] border border-white/10 rounded-2xl">
          <div className="w-8 h-8 border-2 border-white/40 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <section className="bg-[#0b0b0b] border border-white/10 rounded-2xl p-5">
          <p className="text-white font-semibold text-sm mb-1">Video breakdown</p>
          <p className="text-gray-500 text-xs mb-4">The family watches this alongside the annotated film.</p>
          {done ? (
            urls.recording ? <video src={urls.recording} controls playsInline preload="metadata" className="w-full max-h-72 bg-black rounded-xl" /> : <p className="text-gray-500 text-sm">No recording.</p>
          ) : (
            <AnalysisRecorder
              existingUrl={urls.recording}
              onSaved={async (fileId) => {
                persist({ recordingFileId: fileId });
                await saving.current;
                await loadUrls(a.$id);
              }}
            />
          )}
        </section>
        <section className="bg-[#0b0b0b] border border-white/10 rounded-2xl p-5 flex flex-col">
          <p className="text-white font-semibold text-sm mb-1">Summary</p>
          <p className="text-gray-500 text-xs mb-3">A few lines the family reads first: strengths, what to work on, next steps.</p>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            disabled={done}
            rows={6}
            className="flex-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30 resize-none disabled:opacity-60"
          />
        </section>
      </div>
    </div>
  );
};

export default CoachAnalysisWorkspacePage;
