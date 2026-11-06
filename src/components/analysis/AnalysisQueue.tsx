import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Query } from 'appwrite';
import { databases, databaseId, collections } from '../../services/appwrite';
import {
  VideoAnalysis,
  AnalysisUrls,
  assignCoach,
  formatDueDate,
  getAnalysisUrls,
  listAnalysesForStaff,
} from '../../services/videoAnalysis';

// The coach dashboard's home: every analysis as a card with the film's first
// frame, the client and the due date. Coaches see what's assigned to them;
// admins see everything and can assign a coach.

type Tab = 'review' | 'waiting' | 'done';

const TABS: { key: Tab; label: string }[] = [
  { key: 'review', label: 'To review' },
  { key: 'waiting', label: 'Waiting for film' },
  { key: 'done', label: 'Completed' },
];

const inTab = (a: VideoAnalysis, tab: Tab) =>
  tab === 'review' ? a.status === 'submitted' || a.status === 'in_review'
    : tab === 'waiting' ? a.status === 'awaiting_upload'
      : a.status === 'completed';

const dueTone = (iso?: string) => {
  if (!iso) return 'text-gray-500';
  const days = (Date.parse(iso) - Date.now()) / 86400000;
  return days < 0 ? 'text-red-400' : days < 2 ? 'text-yellow-300' : 'text-gray-400';
};

const AnalysisQueue = ({ coachUserId, admin }: { coachUserId?: string; admin?: boolean }) => {
  const [list, setList] = useState<VideoAnalysis[] | null>(null);
  const [urls, setUrls] = useState<AnalysisUrls>({});
  const [tab, setTab] = useState<Tab>('review');
  const [coaches, setCoaches] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const docs = await listAnalysesForStaff(admin ? undefined : coachUserId);
      setList(docs);
      // Films uploaded from the app have no preview image; their first frame is shown instead.
      const withThumb = docs.filter((a) => a.thumbFileId).map((a) => a.$id);
      const filmOnly = docs.filter((a) => !a.thumbFileId && a.filmFileId).map((a) => a.$id);
      Promise.all([getAnalysisUrls(withThumb, false), getAnalysisUrls(filmOnly, true)])
        .then(([a, b]) => setUrls({ ...a, ...b }))
        .catch(() => {});
    } catch (e: any) {
      setError(e?.message || 'Could not load analyses.');
      setList([]);
    }
  }, [admin, coachUserId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!admin) return;
    databases
      .listDocuments(databaseId, collections.coaches, [Query.limit(200)])
      .then((r) =>
        setCoaches(
          (r.documents as any[])
            .filter((c) => !String(c.$id).startsWith('noauth_'))
            .map((c) => ({ id: c.$id, name: `${c.firstName || ''} ${c.lastName || ''}`.trim() }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        ),
      )
      .catch(() => {});
  }, [admin]);

  const counts = useMemo(
    () => Object.fromEntries(TABS.map((t) => [t.key, (list || []).filter((a) => inTab(a, t.key)).length])) as Record<Tab, number>,
    [list],
  );
  const shown = useMemo(() => {
    const items = (list || []).filter((a) => inTab(a, tab));
    return tab === 'review'
      ? items.sort((a, b) => Date.parse(a.dueAt || '') - Date.parse(b.dueAt || ''))
      : items;
  }, [list, tab]);

  const reassign = async (a: VideoAnalysis, coachId: string) => {
    try {
      const { analysis } = await assignCoach(a.$id, coachId);
      setList((prev) => (prev || []).map((x) => (x.$id === a.$id ? analysis : x)));
    } catch (e: any) {
      alert(e?.message || 'Could not assign the coach.');
    }
  };

  if (list === null) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-8 h-8 border-2 border-white/40 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-1 border-b border-white/10">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-2.5 text-sm border-b-2 -mb-px transition-colors ${
              tab === t.key ? 'border-white text-white' : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.label} <span className="text-gray-600">{counts[t.key]}</span>
          </button>
        ))}
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}

      {shown.length === 0 ? (
        <p className="text-gray-500 text-sm py-10 text-center">
          {tab === 'review' ? 'Nothing to review right now.' : tab === 'waiting' ? 'No analyses waiting for film.' : 'No completed analyses yet.'}
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {shown.map((a) => {
            const thumb = urls[a.$id]?.thumb;
            const film = urls[a.$id]?.film;
            const card = (
              <>
                <div className="relative aspect-video bg-white/[0.04] overflow-hidden">
                  {thumb ? (
                    <img src={thumb} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  ) : film ? (
                    <video src={`${film}#t=1`} preload="metadata" muted playsInline className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-white/20 text-xs">
                      {a.filmFileId ? 'No preview' : 'No film yet'}
                    </div>
                  )}
                  {a.filmFileId && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                      <div className="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center">
                        <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                      </div>
                    </div>
                  )}
                  {a.status === 'in_review' && (
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/80 text-white">In progress</span>
                  )}
                </div>
                <div className="p-4">
                  <p className="text-white font-medium truncate">{a.playerName}</p>
                  <p className="text-gray-500 text-xs mt-0.5 truncate">
                    {a.purchaserName && a.purchaserName !== a.playerName ? `Client: ${a.purchaserName}` : a.purchaserEmail}
                  </p>
                  <p className={`text-xs mt-2 ${a.status === 'completed' ? 'text-green-400' : dueTone(a.dueAt)}`}>
                    {a.status === 'completed'
                      ? `Completed ${formatDueDate(a.completedAt)}`
                      : a.dueAt
                        ? `Due ${formatDueDate(a.dueAt)}`
                        : `Bought ${formatDueDate(a.purchasedAt || (a as any).$createdAt)}`}
                  </p>
                </div>
              </>
            );
            return (
              <div key={a.$id} className="group bg-[#111] border border-white/10 rounded-xl overflow-hidden hover:border-white/25 transition-colors">
                {a.filmFileId ? <Link to={`/coach/analysis/${a.$id}`} className="block">{card}</Link> : card}
                {admin && (
                  <div className="px-4 pb-4 -mt-1">
                    <select
                      value={a.coachUserId || ''}
                      onChange={(e) => reassign(a, e.target.value)}
                      className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none"
                    >
                      <option value="">Unassigned (asked for {a.preferredCoach})</option>
                      {coaches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AnalysisQueue;
