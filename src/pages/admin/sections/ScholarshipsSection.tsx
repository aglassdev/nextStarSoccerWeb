import { useState, useEffect } from 'react';
import { Query } from 'appwrite';
import { databases, databaseId, collections, buckets } from '../../../services/appwrite';

// ── Types ─────────────────────────────────────────────────────────────────────
interface ScholarshipDoc {
  $id: string;
  $createdAt: string;
  applicantFirstName: string;
  applicantLastName: string;
  applicantEmail?: string;
  applicantPhone?: string;
  applicantAddress?: string;
  applicantCity?: string;
  applicantState?: string;
  applicantZip?: string;
  applicantDOB?: string;
  playerFirstName: string;
  playerLastName: string;
  playerDOB?: string;
  playerGrade?: string;
  playerSchool?: string;
  playerPosition?: string;
  trainingHistory?: string;
  householdSize?: string;
  annualHouseholdIncome?: string;
  employmentStatus?: string;
  receivesAssistance?: string;
  assistanceDetails?: string;
  requestedAid?: string;
  personalStatement?: string;
  referralSource?: string;
  coachReference?: string;
  documentFileIds?: string;   // 'type:fileId,type:fileId'
  status?: string;
  submittedAt?: string;
  clubTeam?: string;
  incomeEarners?: string;
  dependants?: string;
}

interface ParsedFile {
  type: string;
  fileId: string;
  label: string;
}

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

// ── Helpers ───────────────────────────────────────────────────────────────────
const DOC_LABELS: Record<string, string> = {
  w2: 'W-2',
  tax_return: 'Tax Return',
  pay_stub: 'Pay Stub',
  bank_statement: 'Bank Statement',
  other: 'Document',
};

function parseFileIds(raw?: string): ParsedFile[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map(part => {
      const idx = part.indexOf(':');
      if (idx === -1) return null;
      const type = part.slice(0, idx).trim();
      const fileId = part.slice(idx + 1).trim();
      if (!fileId) return null;
      return { type, fileId, label: DOC_LABELS[type] ?? type.replace(/_/g, ' ') };
    })
    .filter(Boolean) as ParsedFile[];
}

function fileViewUrl(fileId: string): string {
  const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1';
  const project = import.meta.env.VITE_APPWRITE_PROJECT_ID || '';
  return `${endpoint}/storage/buckets/${buckets.scholarshipDocuments}/files/${fileId}/view?project=${project}`;
}

function fmtDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Status badge ──────────────────────────────────────────────────────────────
const StatusBadge = ({ status }: { status?: string }) => {
  const map: Record<string, string> = {
    pending:  'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
    approved: 'bg-green-500/15 text-green-400 border-green-500/25',
    rejected: 'bg-red-500/15 text-red-400 border-red-500/25',
  };
  const s = (status || 'pending').toLowerCase();
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium border capitalize ${map[s] || 'bg-white/[0.06] text-white/40 border-white/10'}`}>
      {s}
    </span>
  );
};

// ── Document icon ─────────────────────────────────────────────────────────────
const DocIcon = ({ file, onClick }: { file: ParsedFile; onClick: () => void }) => (
  <button
    onClick={onClick}
    title={`Open ${file.label}`}
    className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/[0.04] border border-white/[0.07] hover:bg-white/[0.08] hover:border-white/[0.15] transition-all group w-[76px]"
  >
    {/* PDF icon */}
    <div className="relative w-9 h-10 flex-shrink-0">
      <svg viewBox="0 0 36 44" fill="none" className="w-full h-full">
        <path d="M4 0h20l12 12v28a4 4 0 01-4 4H4a4 4 0 01-4-4V4a4 4 0 014-4z" fill="#1E1E1E" />
        <path d="M24 0l12 12H28a4 4 0 01-4-4V0z" fill="#2A2A2A" />
        <rect x="6" y="20" width="24" height="2.5" rx="1.25" fill="#EF4444" opacity="0.9" />
        <rect x="6" y="25" width="20" height="2" rx="1" fill="#555" />
        <rect x="6" y="30" width="16" height="2" rx="1" fill="#555" />
      </svg>
    </div>
    <span className="text-[10px] text-white/50 group-hover:text-white/80 transition-colors text-center leading-tight w-full truncate">
      {file.label}
    </span>
  </button>
);

// ── File Viewer Modal ─────────────────────────────────────────────────────────
const FileViewerModal = ({ file, onClose }: { file: ParsedFile; onClose: () => void }) => {
  const url = fileViewUrl(file.fileId);
  const [mode, setMode] = useState<'iframe' | 'image'>('iframe');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-[#141214] border border-white/[0.08] rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden"
        style={{ maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07] flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-white font-medium text-sm">{file.label}</span>
            <span className="text-white/30 text-xs font-mono">{file.fileId.slice(0, 12)}…</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Toggle PDF/image fallback */}
            <button
              onClick={() => setMode(m => m === 'iframe' ? 'image' : 'iframe')}
              className="text-white/40 hover:text-white text-xs border border-white/[0.10] px-2.5 py-1 rounded-lg transition-colors"
            >
              {mode === 'iframe' ? 'Try as image' : 'Try as PDF'}
            </button>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/40 hover:text-white text-xs border border-white/[0.10] px-2.5 py-1 rounded-lg transition-colors"
            >
              Open in new tab ↗
            </a>
            <button onClick={onClose} className="text-white/40 hover:text-white transition-colors p-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Viewer */}
        <div className="flex-1 min-h-0 bg-black/40 overflow-auto">
          {mode === 'iframe' ? (
            <iframe
              src={url}
              className="w-full h-full"
              style={{ minHeight: '70vh', border: 'none' }}
              title={file.label}
            />
          ) : (
            <div className="flex items-center justify-center p-6 min-h-[70vh]">
              <img
                src={url}
                alt={file.label}
                className="max-w-full max-h-[65vh] object-contain rounded-lg"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Application Card ──────────────────────────────────────────────────────────
const ApplicationCard = ({
  app,
  onStatusChange,
}: {
  app: ScholarshipDoc;
  onStatusChange: (id: string, status: string) => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const [viewingFile, setViewingFile] = useState<ParsedFile | null>(null);
  const [updating, setUpdating] = useState(false);

  const files = parseFileIds(app.documentFileIds);
  const applicantName = `${app.applicantFirstName} ${app.applicantLastName}`.trim();
  const playerName    = `${app.playerFirstName} ${app.playerLastName}`.trim();

  const updateStatus = async (status: string) => {
    setUpdating(true);
    try {
      await databases.updateDocument(databaseId, collections.scholarshipApplications, app.$id, { status });
      onStatusChange(app.$id, status);
    } catch (e) { console.error(e); }
    finally { setUpdating(false); }
  };

  return (
    <>
      <div className="rounded-xl border border-white/[0.07] bg-[#131211] overflow-hidden">
        {/* Top row */}
        <div
          className="flex items-start gap-4 px-5 py-4 cursor-pointer hover:bg-white/[0.02] transition-colors select-none"
          onClick={() => setExpanded(e => !e)}
        >
          {/* Avatar */}
          <div className="w-9 h-9 rounded-full bg-white/[0.07] border border-white/[0.09] flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-white/60 text-sm font-medium">{(app.playerFirstName[0] || '?').toUpperCase()}</span>
          </div>

          {/* Names */}
          <div className="flex-1 min-w-0">
            <p className="text-white text-[14px] font-medium leading-snug">{playerName}</p>
            <p className="text-white/40 text-[12px] mt-0.5">
              Applied by {applicantName}
              {app.playerGrade ? ` · Grade ${app.playerGrade}` : ''}
              {app.playerSchool ? ` · ${app.playerSchool}` : ''}
            </p>
          </div>

          {/* Right meta */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="hidden sm:flex flex-col items-end gap-1">
              <span className="text-white/30 text-[11px]">{fmtDate(app.submittedAt || app.$createdAt)}</span>
              <span className="text-white/25 text-[11px]">{app.annualHouseholdIncome || '—'}</span>
            </div>
            <StatusBadge status={app.status} />
            <svg
              className={`w-3.5 h-3.5 text-white/20 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Expanded detail */}
        {expanded && (
          <div className="border-t border-white/[0.06] px-5 py-5 space-y-5">

            {/* 3-column info grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Applicant */}
              <div className="space-y-2">
                <p className="text-white/25 text-[10px] uppercase tracking-widest font-mono">Applicant</p>
                <InfoLine label="Name"    value={applicantName} />
                <InfoLine label="Email"   value={app.applicantEmail} />
                <InfoLine label="Phone"   value={app.applicantPhone} />
                <InfoLine label="Address" value={[app.applicantAddress, app.applicantCity, app.applicantState, app.applicantZip].filter(Boolean).join(', ')} />
              </div>

              {/* Player */}
              <div className="space-y-2">
                <p className="text-white/25 text-[10px] uppercase tracking-widest font-mono">Player</p>
                <InfoLine label="Name"     value={playerName} />
                <InfoLine label="DOB"      value={fmtDate(app.playerDOB)} />
                <InfoLine label="Grade"    value={app.playerGrade} />
                <InfoLine label="School"   value={app.playerSchool} />
                <InfoLine label="Position" value={app.playerPosition} />
                <InfoLine label="Club"     value={app.clubTeam} />
              </div>

              {/* Financials */}
              <div className="space-y-2">
                <p className="text-white/25 text-[10px] uppercase tracking-widest font-mono">Financials</p>
                <InfoLine label="Income"       value={app.annualHouseholdIncome} />
                <InfoLine label="Household"    value={app.householdSize ? `${app.householdSize} people` : undefined} />
                <InfoLine label="Earners"      value={app.incomeEarners} />
                <InfoLine label="Dependants"   value={app.dependants} />
                <InfoLine label="Employment"   value={app.employmentStatus} />
                <InfoLine label="Assistance"   value={app.receivesAssistance === 'yes' ? app.assistanceDetails || 'Yes' : 'No'} />
                <InfoLine label="Requested"    value={app.requestedAid} />
              </div>
            </div>

            {/* Training history */}
            {app.trainingHistory && (
              <div>
                <p className="text-white/25 text-[10px] uppercase tracking-widest font-mono mb-1.5">Training History</p>
                <p className="text-white/70 text-[13px] leading-relaxed">{app.trainingHistory}</p>
              </div>
            )}

            {/* Personal statement */}
            {app.personalStatement && (
              <div>
                <p className="text-white/25 text-[10px] uppercase tracking-widest font-mono mb-1.5">Personal Statement</p>
                <p className="text-white/70 text-[13px] leading-relaxed whitespace-pre-wrap">{app.personalStatement}</p>
              </div>
            )}

            {/* Coach reference */}
            {app.coachReference && (
              <div>
                <p className="text-white/25 text-[10px] uppercase tracking-widest font-mono mb-1.5">Coach Reference</p>
                <p className="text-white/70 text-[13px]">{app.coachReference}</p>
              </div>
            )}

            {/* Documents */}
            {files.length > 0 && (
              <div>
                <p className="text-white/25 text-[10px] uppercase tracking-widest font-mono mb-2.5">Documents</p>
                <div className="flex flex-wrap gap-2">
                  {files.map(f => (
                    <DocIcon key={f.fileId} file={f} onClick={() => setViewingFile(f)} />
                  ))}
                </div>
              </div>
            )}

            {/* Status actions */}
            <div className="flex items-center justify-between pt-2 border-t border-white/[0.05]">
              <div className="flex items-center gap-2">
                <span className="text-white/30 text-[11px] font-mono">Status:</span>
                <StatusBadge status={app.status} />
              </div>
              <div className="flex items-center gap-2">
                {app.status !== 'approved' && (
                  <button
                    onClick={() => updateStatus('approved')}
                    disabled={updating}
                    className="px-3 py-1.5 rounded-lg text-[12px] font-medium bg-green-500/15 text-green-400 border border-green-500/25 hover:bg-green-500/25 transition-colors disabled:opacity-40"
                  >
                    Approve
                  </button>
                )}
                {app.status !== 'rejected' && (
                  <button
                    onClick={() => updateStatus('rejected')}
                    disabled={updating}
                    className="px-3 py-1.5 rounded-lg text-[12px] font-medium bg-red-500/15 text-red-400 border border-red-500/25 hover:bg-red-500/25 transition-colors disabled:opacity-40"
                  >
                    Reject
                  </button>
                )}
                {app.status !== 'pending' && (
                  <button
                    onClick={() => updateStatus('pending')}
                    disabled={updating}
                    className="px-3 py-1.5 rounded-lg text-[12px] font-medium bg-white/[0.06] text-white/50 border border-white/[0.10] hover:bg-white/[0.10] transition-colors disabled:opacity-40"
                  >
                    Reset to Pending
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {viewingFile && (
        <FileViewerModal file={viewingFile} onClose={() => setViewingFile(null)} />
      )}
    </>
  );
};

const InfoLine = ({ label, value }: { label: string; value?: string | null }) => {
  if (!value || value.trim() === '' || value === '—') return null;
  return (
    <div className="flex gap-1.5">
      <span className="text-white/30 text-[11px] flex-shrink-0 w-20">{label}</span>
      <span className="text-white/70 text-[11px] break-words">{value}</span>
    </div>
  );
};

// ── Main Section ──────────────────────────────────────────────────────────────
const ScholarshipsSection = () => {
  const [apps, setApps]       = useState<ScholarshipDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState<StatusFilter>('all');

  useEffect(() => { fetchApps(); }, []);

  const fetchApps = async () => {
    setLoading(true); setError('');
    try {
      const res = await databases.listDocuments(databaseId, collections.scholarshipApplications, [
        Query.orderDesc('$createdAt'),
        Query.limit(500),
      ]);
      setApps(res.documents as unknown as ScholarshipDoc[]);
    } catch (e: any) {
      setError('Failed to load applications: ' + (e.message || 'Unknown error'));
    } finally { setLoading(false); }
  };

  const handleStatusChange = (id: string, status: string) => {
    setApps(prev => prev.map(a => a.$id === id ? { ...a, status } : a));
  };

  const filtered = apps.filter(a => {
    const matchesFilter = filter === 'all' || (a.status || 'pending').toLowerCase() === filter;
    if (!matchesFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      `${a.playerFirstName} ${a.playerLastName}`.toLowerCase().includes(q) ||
      `${a.applicantFirstName} ${a.applicantLastName}`.toLowerCase().includes(q) ||
      (a.applicantEmail || '').toLowerCase().includes(q)
    );
  });

  const counts = {
    all:      apps.length,
    pending:  apps.filter(a => !a.status || a.status === 'pending').length,
    approved: apps.filter(a => a.status === 'approved').length,
    rejected: apps.filter(a => a.status === 'rejected').length,
  };

  return (
    <div className="p-6 max-w-4xl">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-white text-xl font-semibold">Scholarship Applications</h2>
          <p className="text-white/30 text-xs mt-0.5 font-mono">
            {loading ? '…' : `${counts.pending} pending · ${counts.approved} approved · ${counts.rejected} rejected`}
          </p>
        </div>
        <button onClick={fetchApps} className="text-white/30 hover:text-white text-xs font-mono transition-colors">
          refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {(['all', 'pending', 'approved', 'rejected'] as StatusFilter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors capitalize ${
              filter === f ? 'bg-white text-black' : 'bg-white/[0.06] text-white/50 hover:bg-white/10 hover:text-white'
            }`}
          >
            {f} {f !== 'all' && <span className="opacity-60">({counts[f]})</span>}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search by player or applicant name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg pl-9 pr-4 py-2 text-white text-[13px] placeholder-white/25 focus:outline-none focus:border-white/20"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-px">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-[#131211] border border-white/[0.07] rounded-xl px-5 py-4 animate-pulse">
              <div className="h-4 w-40 bg-white/[0.07] rounded mb-2" />
              <div className="h-3 w-64 bg-white/[0.04] rounded" />
            </div>
          ))}
        </div>
      ) : error ? (
        <p className="text-red-400 text-sm text-center py-10">{error}</p>
      ) : filtered.length === 0 ? (
        <p className="text-white/25 text-sm text-center py-10">
          {search || filter !== 'all' ? 'No matching applications.' : 'No scholarship applications yet.'}
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map(app => (
            <ApplicationCard key={app.$id} app={app} onStatusChange={handleStatusChange} />
          ))}
        </div>
      )}
    </div>
  );
};

export default ScholarshipsSection;
