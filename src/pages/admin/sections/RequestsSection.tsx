import { useState, useEffect } from 'react';
import { Query } from 'appwrite';
import { databases, databaseId, collections } from '../../../services/appwrite';

const REQUEST_TYPES = [
  'All',
  'Individual Session',
  'Two Person Session',
  'Small Group Session',
  'Large Group Session',
  'Game Analysis',
  'Player Report',
];

interface RequestRecord {
  $id: string;
  $createdAt: string;
  firstName: string;
  lastName: string;
  email?: string;
  subject: string;
  message: string;
  read?: boolean;
  trashed?: boolean;
  // messages collection fields
  userId?: string;
  senderId?: string;
  relatedRequestType?: string;
  relatedRequestId?: string;
  messageType?: string;
}

const RequestsSection = () => {
  const [allRequests, setAllRequests] = useState<RequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeType, setActiveType] = useState('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => { fetchRequests(); }, []);

  const fetchRequests = async () => {
    setLoading(true);
    setError('');
    try {
      // Fetch from both websiteInquiries and messages
      const [webRes, appRes] = await Promise.all([
        databases.listDocuments(databaseId, collections.websiteInquiries, [
          Query.orderDesc('$createdAt'), Query.limit(5000),
        ]).catch(() => ({ documents: [] })),
        collections.messages
          ? databases.listDocuments(databaseId, collections.messages, [
              Query.orderDesc('$createdAt'), Query.limit(5000),
            ]).catch(() => ({ documents: [] }))
          : { documents: [] },
      ]);

      // Filter to only request-type messages
      const requestSubjects = REQUEST_TYPES.slice(1).map(r => r.toLowerCase());

      const webFiltered = (webRes.documents as unknown as RequestRecord[]).filter(d => {
        if (d.trashed) return false;
        const subj = (d.subject || '').toLowerCase();
        return requestSubjects.some(r => subj.includes(r.replace(' session', '')));
      });

      const appFiltered = (appRes.documents as unknown as RequestRecord[]).filter(d => {
        const type = (d.relatedRequestType || d.subject || '').toLowerCase();
        return requestSubjects.some(r => type.includes(r.replace(' session', '')));
      });

      // Tag source
      const tagged = [
        ...webFiltered.map(d => ({ ...d, _source: 'website' as const })),
        ...appFiltered.map(d => ({ ...d, _source: 'app' as const })),
      ].sort((a, b) => new Date(b.$createdAt).getTime() - new Date(a.$createdAt).getTime());

      setAllRequests(tagged);
    } catch (err: any) {
      setError('Failed to load requests: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const getRequestType = (r: RequestRecord): string => {
    const text = (r.relatedRequestType || r.subject || '').toLowerCase();
    for (const rt of REQUEST_TYPES.slice(1)) {
      if (text.includes(rt.toLowerCase().replace(' session', ''))) return rt;
    }
    return 'Other';
  };

  const filtered = activeType === 'All'
    ? allRequests
    : allRequests.filter(r => getRequestType(r) === activeType);

  const counts = REQUEST_TYPES.slice(1).reduce((acc, rt) => {
    acc[rt] = allRequests.filter(r => getRequestType(r) === rt).length;
    return acc;
  }, {} as Record<string, number>);

  const getName = (r: RequestRecord) =>
    `${r.firstName || ''} ${r.lastName || ''}`.trim() || 'Unknown';

  const typeColor = (type: string) => {
    switch (type) {
      case 'Individual Session': return 'bg-blue-500/15 text-blue-400 border-blue-500/25';
      case 'Two Person Session': return 'bg-purple-500/15 text-purple-400 border-purple-500/25';
      case 'Small Group Session': return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25';
      case 'Large Group Session': return 'bg-amber-500/15 text-amber-400 border-amber-500/25';
      case 'Game Analysis': return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25';
      case 'Player Report': return 'bg-pink-500/15 text-pink-400 border-pink-500/25';
      default: return 'bg-gray-500/15 text-gray-400 border-gray-500/25';
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-white mb-2">Requests</h2>
      <p className="text-gray-500 text-sm mb-6">Session and analysis requests from all sources</p>

      {/* Type filter tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {REQUEST_TYPES.map(rt => {
          const isAll = rt === 'All';
          const count = isAll ? allRequests.length : (counts[rt] || 0);
          return (
            <button
              key={rt}
              onClick={() => { setActiveType(rt); setExpandedId(null); }}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 border ${
                activeType === rt
                  ? 'bg-white/10 text-white border-white/20'
                  : 'bg-[#0e0e0e] text-gray-500 border-[#1c1c1c] hover:text-gray-300 hover:border-[#2a2a2a]'
              }`}
            >
              {rt}
              <span className={`text-xs tabular-nums ${activeType === rt ? 'text-gray-400' : 'text-gray-700'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {loading && (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500 rounded-lg text-red-400 mb-4">{error}</div>
      )}

      {!loading && !error && (
        <div className="bg-gray-900 rounded-lg border border-gray-800 divide-y divide-gray-800">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500">
              No {activeType === 'All' ? '' : activeType.toLowerCase() + ' '}requests found
            </div>
          ) : (
            filtered.map(req => {
              const name = getName(req);
              const type = getRequestType(req);
              const isExpanded = expandedId === req.$id;
              const source = (req as any)._source;

              return (
                <div key={req.$id}>
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : req.$id)}
                    className="px-4 py-4 hover:bg-gray-800/50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center flex-shrink-0">
                          <span className="text-gray-400 text-xs font-semibold">
                            {(req.firstName?.[0] || '?').toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-white truncate">{name}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${typeColor(type)}`}>
                              {type}
                            </span>
                          </div>
                          <p className="text-gray-600 text-xs truncate">{req.email || req.userId || ''}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                          source === 'website' ? 'bg-blue-500/10 text-blue-400' : 'bg-emerald-500/10 text-emerald-400'
                        }`}>
                          {source === 'website' ? 'Web' : 'App'}
                        </span>
                        <span className="text-gray-600 text-xs">
                          {new Date(req.$createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2 pl-11">
                      <p className="text-gray-500 text-sm truncate">{req.subject || '(No subject)'}</p>
                      <p className="text-gray-600 text-xs mt-0.5 truncate">{req.message || ''}</p>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 bg-gray-800/20">
                      <div className="pt-3 pl-11 border-t border-gray-800">
                        <div className="flex flex-wrap gap-x-6 gap-y-1 mb-3">
                          <div>
                            <span className="text-gray-600 text-xs">Name</span>
                            <p className="text-gray-300 text-sm">{name}</p>
                          </div>
                          {req.email && (
                            <div>
                              <span className="text-gray-600 text-xs">Email</span>
                              <p className="text-blue-400 text-sm">{req.email}</p>
                            </div>
                          )}
                          <div>
                            <span className="text-gray-600 text-xs">Type</span>
                            <p className="text-gray-300 text-sm">{type}</p>
                          </div>
                          <div>
                            <span className="text-gray-600 text-xs">Source</span>
                            <p className="text-gray-300 text-sm">{source === 'website' ? 'Website' : 'App'}</p>
                          </div>
                          <div>
                            <span className="text-gray-600 text-xs">Received</span>
                            <p className="text-gray-300 text-sm">
                              {new Date(req.$createdAt).toLocaleString('en-US', {
                                month: 'short', day: 'numeric', year: 'numeric',
                                hour: 'numeric', minute: '2-digit', hour12: true,
                              })}
                            </p>
                          </div>
                        </div>

                        <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed mb-4">
                          {req.message || '(No message body)'}
                        </p>

                        {req.email && (
                          <a
                            href={`mailto:${req.email}?subject=${encodeURIComponent('Re: ' + (req.subject || 'Your Request'))}&body=${encodeURIComponent('\n\n\n────────────────────\nOriginal request from ' + name + ':\nType: ' + type + '\n\n' + (req.message || ''))}`}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-200 text-black text-sm font-medium rounded-lg transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10l9 6 9-6M21 10v8a2 2 0 01-2 2H5a2 2 0 01-2-2v-8" />
                            </svg>
                            Reply
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default RequestsSection;
