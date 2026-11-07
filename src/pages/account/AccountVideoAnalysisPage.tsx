import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useAccount } from './AccountContext';
import { AccountPageHeader, AccountSpinner } from './AccountLayout';
import {
  VideoAnalysis,
  AnalysisUrls,
  CLIENT_STATUS,
  attachFilm,
  captureThumbnail,
  claimGuestAnalyses,
  formatBytes,
  formatLongDate,
  getAnalysisUrls,
  listMyAnalyses,
  analysisTitle,
  numberAnalyses,
  uploadToFilmBucket,
} from '../../services/videoAnalysis';
import { VIDEO_ANALYSIS } from '../../constants/videoAnalysis';
import type { ClinicPlayerRef } from '../../services/clinicRegistration';

// Account Center → Video Analysis. Every analysis bought is a card; the ones
// still waiting for game film are the to-dos, uploaded whenever the family
// is ready (one game per analysis).

const claimedThisSession = new Set<string>();

const UploadPanel = ({ analysis, onClose, onDone }: { analysis: VideoAnalysis; onClose: () => void; onDone: () => void }) => {
  const { userType, children } = useAccount();
  const isParent = userType === 'parent';
  const [file, setFile] = useState<File | null>(null);
  const [playerId, setPlayerId] = useState(analysis.playerKind !== 'guest' ? analysis.playerId : children[0]?.id || '');
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const uploading = progress !== null;

  // Leaving mid-upload loses it, so warn.
  useEffect(() => {
    if (!uploading) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [uploading]);

  const pick = (f: File | undefined | null) => {
    setError('');
    if (!f) return;
    if (!/\.(mp4|mov|m4v|webm)$/i.test(f.name) && !f.type.startsWith('video/')) {
      return setError('Choose a video file (MP4, MOV, M4V or WebM).');
    }
    if (f.size > VIDEO_ANALYSIS.maxFileBytes) return setError('That file is over 5 GB. Export a smaller version or trim it to the game.');
    setFile(f);
  };

  const upload = async () => {
    if (!file) return;
    setError('');
    setProgress(0);
    try {
      const [thumb, film] = await Promise.all([
        captureThumbnail(file),
        uploadToFilmBucket(file, (p) => setProgress(p * 0.97)),
      ]);
      const thumbFile = thumb ? await uploadToFilmBucket(thumb).catch(() => null) : null;
      let player: ClinicPlayerRef | undefined;
      if (isParent) {
        const c = children.find((x) => x.id === playerId);
        if (c) player = { kind: c.kind, id: c.id };
      }
      await attachFilm({ analysisId: analysis.$id, fileId: film.$id, thumbFileId: thumbFile?.$id, player });
      setProgress(1);
      onDone();
    } catch (e: any) {
      setError(e?.message || 'The upload failed. Check your connection and try again.');
      setProgress(null);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40" onClick={uploading ? undefined : onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-lg bg-[#111] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <h3 className="text-white font-semibold text-lg">Upload game film</h3>
            {!uploading && (
              <button onClick={onClose} className="text-gray-500 hover:text-white" aria-label="Close">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>
          <div className="px-6 py-5 space-y-4">
            {isParent && children.length > 0 && (
              <label className="block">
                <span className="block text-gray-500 text-xs mb-1">Player</span>
                <select value={playerId} onChange={(e) => setPlayerId(e.target.value)} disabled={uploading}
                  className="w-full px-4 py-2.5 bg-[#1a1a1a] border border-white/10 rounded-lg text-white text-sm focus:outline-none">
                  {children.map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
                </select>
              </label>
            )}

            <label
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files?.[0]); }}
              className={`block border border-dashed rounded-xl px-4 py-8 text-center cursor-pointer transition-colors ${
                dragging ? 'border-white/60 bg-white/[0.05]' : 'border-white/20 hover:border-white/40'
              } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
            >
              <input type="file" accept={VIDEO_ANALYSIS.acceptedTypes} className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
              {file ? (
                <>
                  <p className="text-white text-sm font-medium truncate">{file.name}</p>
                  <p className="text-gray-500 text-xs mt-1">{formatBytes(file.size)} · click to choose a different file</p>
                </>
              ) : (
                <>
                  <p className="text-white text-sm font-medium">Drop your game film here, or click to choose it</p>
                  <p className="text-gray-500 text-xs mt-1">MP4 or MOV, up to 5 GB. One full game per analysis.</p>
                </>
              )}
            </label>

            <p className="text-gray-500 text-xs leading-relaxed">
              Next you'll add notes for your coach and mark the moments you want analyzed.
            </p>

            {uploading && (
              <div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full bg-white transition-[width] duration-300" style={{ width: `${Math.round(progress! * 100)}%` }} />
                </div>
                <p className="text-gray-400 text-xs mt-2">
                  Uploading {Math.round(progress! * 100)}% · keep this tab open until it finishes.
                </p>
              </div>
            )}
            {error && <p className="text-red-400 text-sm">{error}</p>}
          </div>
          <div className="px-6 py-4 border-t border-white/10 flex justify-end gap-3">
            {!uploading && (
              <button onClick={onClose} className="px-5 py-2 text-sm text-gray-400 hover:text-white border border-white/10 hover:border-white/30 rounded-lg">
                Cancel
              </button>
            )}
            <button onClick={upload} disabled={!file || uploading}
              className="px-6 py-2 text-sm bg-white hover:bg-gray-200 text-black font-semibold rounded-lg disabled:opacity-40">
              {uploading ? 'Uploading…' : 'Upload film'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

const AnalysisCard = ({ a, n, thumb, film, onUpload }: { a: VideoAnalysis; n: number; thumb?: string; film?: string; onUpload: () => void }) => {
  const body = (
    <>
      <div className="relative aspect-video bg-white/[0.04] flex items-center justify-center overflow-hidden">
        {thumb ? (
          <img src={thumb} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : film ? (
          <video src={`${film}#t=1`} preload="metadata" muted playsInline className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <svg className="w-8 h-8 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.55-2.28A1 1 0 0121 8.62v6.76a1 1 0 01-1.45.9L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        )}
      </div>
      <div className="px-6 py-5">
        <p className="text-white text-xl font-medium truncate">{analysisTitle(a, n)}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[#888]">
          <span>Status: <span className="text-white">{CLIENT_STATUS[a.status]}</span></span>
          <span className="text-[#444]">|</span>
          <span>Coach: <span className="text-white">{a.coachName || a.preferredCoach}</span></span>
          {a.filmUploadedAt && (
            <>
              <span className="text-[#444]">|</span>
              <span>{formatLongDate(a.filmUploadedAt)}</span>
            </>
          )}
        </div>
        {a.status === 'awaiting_upload' && (
          <button onClick={onUpload} className="mt-4 w-full py-3 bg-[#F4F2EE] hover:bg-white text-black text-sm font-semibold rounded-xl">
            Upload your film
          </button>
        )}
        {a.status === 'uploaded' && (
          <span className="mt-4 block w-full py-3 bg-[#F4F2EE] group-hover:bg-white text-black text-sm font-semibold rounded-xl text-center">
            Mark moments &amp; submit
          </span>
        )}
      </div>
    </>
  );
  const cls = 'group block bg-[#111] border border-[#222] rounded-2xl overflow-hidden hover:border-[#3a3a3a] transition-colors text-left';
  return a.status === 'awaiting_upload'
    ? <div className={cls}>{body}</div>
    : <Link to={`/account/video-analysis/${a.$id}`} state={{ n }} className={cls}>{body}</Link>;
};

const AccountVideoAnalysisPage = () => {
  const { user } = useAuth();
  const [analyses, setAnalyses] = useState<VideoAnalysis[] | null>(null);
  const [urls, setUrls] = useState<AnalysisUrls>({});
  const [uploadFor, setUploadFor] = useState<VideoAnalysis | null>(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const load = useCallback(async () => {
    if (!user) return;
    try {
      if (!claimedThisSession.has(user.$id)) {
        claimedThisSession.add(user.$id);
        await claimGuestAnalyses().catch(() => {});
      }
      const list = await listMyAnalyses(user.$id);
      setAnalyses(list);
      // Films uploaded from the app have no preview image; their first frame is shown instead.
      const withThumbs = list.filter((a) => a.thumbFileId).map((a) => a.$id);
      const filmOnly = list.filter((a) => !a.thumbFileId && a.filmFileId).map((a) => a.$id);
      Promise.all([getAnalysisUrls(withThumbs, false), getAnalysisUrls(filmOnly, true)])
        .then(([x, y]) => setUrls({ ...x, ...y }))
        .catch(() => {});
    } catch (e: any) {
      setError(e?.message || 'Could not load your analyses.');
      setAnalyses([]);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const numbers = useMemo(() => numberAnalyses(analyses || []), [analyses]);

  const groups = useMemo(() => {
    const list = analyses || [];
    return [
      { title: 'To do', items: list.filter((a) => a.status === 'awaiting_upload' || a.status === 'uploaded') },
      { title: 'With your coach', items: list.filter((a) => a.status === 'submitted' || a.status === 'in_review') },
      { title: 'Ready', items: list.filter((a) => a.status === 'completed') },
    ].filter((g) => g.items.length > 0);
  }, [analyses]);

  if (analyses === null) return <><AccountPageHeader title="Video Analysis" /><AccountSpinner /></>;

  return (
    <div className="space-y-8">
      <AccountPageHeader title="Video Analysis" />
      {error && <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>}

      {analyses.length === 0 ? (
        <div className="bg-[#111] border border-[#222] rounded-2xl p-10 text-center">
          <p className="text-white font-medium">No video analysis yet</p>
          <p className="text-gray-500 text-sm mt-1 max-w-md mx-auto">
            Video analyses you buy show up here, ready for you to upload your game film.
          </p>
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.title}>
            <h3 className="text-white font-semibold text-lg mb-3">
              {g.title} <span className="text-gray-600 font-normal text-sm">{g.items.length}</span>
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              {g.items.map((a) => (
                <AnalysisCard key={a.$id} a={a} n={numbers[a.$id]} thumb={urls[a.$id]?.thumb} film={urls[a.$id]?.film} onUpload={() => setUploadFor(a)} />
              ))}
            </div>
          </section>
        ))
      )}

      {uploadFor && (
        <UploadPanel
          analysis={uploadFor}
          onClose={() => setUploadFor(null)}
          onDone={() => {
            const a = uploadFor;
            setUploadFor(null);
            navigate(`/account/video-analysis/${a.$id}`, { state: { n: numbers[a.$id] } });
          }}
        />
      )}
    </div>
  );
};

export default AccountVideoAnalysisPage;
