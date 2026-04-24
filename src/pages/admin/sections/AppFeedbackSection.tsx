import { useState, useEffect } from 'react';
import { Query } from 'appwrite';
import { databases, databaseId, collections } from '../../../services/appwrite';

interface FeedbackDoc {
  $id: string;
  $createdAt: string;
  issue: string;
  description: string;
  userId?: string;
  userName?: string;
}

const AppFeedbackSection = () => {
  const [docs, setDocs] = useState<FeedbackDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => { fetchFeedback(); }, []);

  const fetchFeedback = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await databases.listDocuments(databaseId, collections.devSupport!, [
        Query.orderDesc('$createdAt'),
        Query.limit(1000),
      ]);
      setDocs(res.documents as unknown as FeedbackDoc[]);
    } catch (e) {
      console.error(e);
      setError('Failed to load feedback.');
    } finally {
      setLoading(false);
    }
  };

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const filtered = docs.filter(d => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      d.issue.toLowerCase().includes(q) ||
      d.description.toLowerCase().includes(q) ||
      (d.userId || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-white text-[15px] font-medium font-mono flex items-center gap-2">
            <span className="text-white/30">{'</'}</span>
            <span>App Feedback</span>
            <span className="text-white/30">{'>'}</span>
          </h2>
          <p className="text-white/30 text-[11px] font-mono mt-0.5">{loading ? '…' : `${docs.length} reports`}</p>
        </div>
        <button onClick={fetchFeedback} className="text-white/30 hover:text-white transition-colors text-xs font-mono">
          refresh
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search feedback…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg pl-9 pr-4 py-2 text-white text-[13px] font-mono placeholder-white/25 focus:outline-none focus:border-white/20"
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-px">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-[#131211] border border-white/[0.07] rounded-lg px-4 py-4 animate-pulse">
              <div className="h-3.5 w-48 bg-white/[0.08] rounded mb-2" />
              <div className="h-3 w-full bg-white/[0.04] rounded" />
            </div>
          ))}
        </div>
      ) : error ? (
        <p className="text-red-400 text-sm font-mono text-center py-10">{error}</p>
      ) : filtered.length === 0 ? (
        <p className="text-white/25 text-sm font-mono text-center py-10">
          {searchQuery ? 'no matches.' : 'no feedback yet.'}
        </p>
      ) : (
        <div className="space-y-px">
          {filtered.map((doc, idx) => {
            const isExpanded = expandedId === doc.$id;
            return (
              <div key={doc.$id} className="rounded-lg border border-white/[0.07] overflow-hidden">

                {/* Row */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : doc.$id)}
                  className="w-full flex items-start gap-4 px-4 py-3.5 text-left bg-[#131211] hover:bg-[#1a1917] transition-colors"
                >
                  {/* Index */}
                  <span className="text-white/20 text-[11px] font-mono flex-shrink-0 mt-0.5 w-5 text-right">
                    {String(idx + 1).padStart(2, '0')}
                  </span>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-[13px] font-medium leading-snug truncate">{doc.issue}</p>
                    {!isExpanded && (
                      <p className="text-white/40 text-[12px] mt-0.5 truncate font-mono">{doc.description}</p>
                    )}
                  </div>

                  {/* Meta */}
                  <div className="flex items-center gap-4 flex-shrink-0">
                    {doc.userId && (
                      <span className="text-white/25 text-[11px] font-mono hidden sm:block truncate max-w-[100px]">
                        {doc.userId.slice(0, 8)}…
                      </span>
                    )}
                    <span className="text-white/25 text-[11px] font-mono w-14 text-right">{fmtDate(doc.$createdAt)}</span>
                    <svg
                      className={`w-3.5 h-3.5 text-white/20 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Expanded */}
                {isExpanded && (
                  <div className="bg-[#0e0d0c] border-t border-white/[0.05] px-5 py-4">
                    <div className="flex items-start gap-6 mb-3 text-[11px] font-mono text-white/35 flex-wrap">
                      <span><span className="text-white/20">id </span>{doc.$id}</span>
                      {doc.userId && <span><span className="text-white/20">user </span>{doc.userId}</span>}
                      <span><span className="text-white/20">at </span>{new Date(doc.$createdAt).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                    </div>
                    <p className="text-white/80 text-[13px] leading-relaxed whitespace-pre-wrap">{doc.description}</p>
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

export default AppFeedbackSection;
