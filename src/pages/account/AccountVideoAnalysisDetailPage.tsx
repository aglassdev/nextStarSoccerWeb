import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AnnotatedPlayer from '../../components/analysis/AnnotatedPlayer';
import { AccountPageHeader, AccountSpinner } from './AccountLayout';
import {
  VideoAnalysis,
  formatDueDate,
  getAnalysis,
  getAnalysisUrls,
  parseAnnotations,
} from '../../services/videoAnalysis';

// One analysis, as the family sees it: the coach's video breakdown and the
// annotated game film (read-only) once it's ready; its progress before then.
const AccountVideoAnalysisDetailPage = () => {
  const { id = '' } = useParams<{ id: string }>();
  const [a, setA] = useState<VideoAnalysis | null>(null);
  const [urls, setUrls] = useState<{ film?: string; thumb?: string; recording?: string }>({});
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const doc = await getAnalysis(id);
        setA(doc);
        if (doc.filmFileId) setUrls((await getAnalysisUrls([doc.$id]))[doc.$id] || {});
      } catch (e: any) {
        setError(e?.code === 404 || e?.code === 401 ? 'We couldn’t find that analysis on your account.' : e?.message || 'Could not load the analysis.');
      }
    })();
  }, [id]);

  const back = <AccountPageHeader title={a?.playerName || 'Video Analysis'} back="/account/video-analysis" />;

  if (error) return <div className="space-y-4">{back}<p className="text-gray-400 text-sm">{error}</p></div>;
  if (!a) return <>{back}<AccountSpinner /></>;

  const done = a.status === 'completed';
  const annotations = parseAnnotations(a.annotations);

  return (
    <div className="space-y-6">
      <AccountPageHeader
        title={a.playerName}
        back="/account/video-analysis"
        right={
          <p className="text-[#888] text-sm">
            {a.coachName || a.preferredCoach}
            {done ? ` · ready ${formatDueDate(a.completedAt)}` : a.dueAt ? ` · due ${formatDueDate(a.dueAt)}` : ''}
          </p>
        }
      />

      {!done ? (
        <div className="bg-[#111] border border-white/10 rounded-2xl p-6">
          {a.status === 'awaiting_upload' ? (
            <p className="text-gray-300 text-sm">
              Upload your game film from <Link to="/account/video-analysis" className="text-white underline underline-offset-2">Video Analysis</Link> to get started.
            </p>
          ) : (
            <>
              <p className="text-white font-medium">Your coach is working on it</p>
              <p className="text-gray-400 text-sm mt-1">
                Your film analysis will be ready within 7 days, we will notify you when its ready
                {a.dueAt ? ` (by ${formatDueDate(a.dueAt)})` : ''}.
              </p>
              {a.filmName && <p className="text-gray-600 text-xs mt-3">Film: {a.filmName}</p>}
            </>
          )}
        </div>
      ) : (
        <>
          {urls.recording && (
            <section>
              <h3 className="text-white font-semibold text-lg mb-3">Your coach's breakdown</h3>
              <div className="bg-black border border-white/10 rounded-2xl overflow-hidden">
                <video src={urls.recording} controls playsInline preload="metadata" className="w-full max-h-[70vh] bg-black" />
              </div>
            </section>
          )}
          {a.summary && (
            <section className="bg-[#111] border border-white/10 rounded-2xl p-5">
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">Summary</p>
              <p className="text-white/90 text-sm leading-relaxed whitespace-pre-wrap">{a.summary}</p>
            </section>
          )}
          {urls.film && (
            <section>
              <h3 className="text-white font-semibold text-lg mb-3">Annotated film</h3>
              <AnnotatedPlayer src={urls.film} poster={urls.thumb} annotations={annotations} />
            </section>
          )}
        </>
      )}
    </div>
  );
};

export default AccountVideoAnalysisDetailPage;
