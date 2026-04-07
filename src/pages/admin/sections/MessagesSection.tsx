import { useState, useEffect } from 'react';
import { Query } from 'appwrite';
import { databases, functions, databaseId, collections } from '../../../services/appwrite';

const REPLY_FUNCTION_ID = import.meta.env.VITE_APPWRITE_REPLY_FUNCTION_ID || '';

type SourceTab = 'website' | 'app';
type FilterTab = 'unread' | 'read' | 'all' | 'trash';

interface InquiryRecord {
  $id: string;
  $createdAt: string;
  firstName: string;
  lastName: string;
  email?: string;
  subject: string;
  message: string;
  timestamp: string;
  read: boolean;
  trashed?: boolean;
  trashedAt?: string | null;
  // App message fields
  userId?: string;
  senderId?: string;
  recipientId?: string;
  messageType?: string;
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const MessagesSection = () => {
  const [websiteDocs, setWebsiteDocs] = useState<InquiryRecord[]>([]);
  const [appDocs, setAppDocs] = useState<InquiryRecord[]>([]);
  const [messages, setMessages] = useState<InquiryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sourceTab, setSourceTab] = useState<SourceTab>('website');
  const [filterTab, setFilterTab] = useState<FilterTab>('unread');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<InquiryRecord | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replySending, setReplySending] = useState(false);
  const [replyStatus, setReplyStatus] = useState<'idle' | 'sent' | 'error'>('idle');
  const [replyError, setReplyError] = useState('');

  useEffect(() => { fetchAll(); }, []);
  useEffect(() => { filterMessages(); }, [sourceTab, filterTab, websiteDocs, appDocs]);

  const fetchAll = async () => {
    setLoading(true);
    setError('');
    try {
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

      // Auto-delete website inquiries trashed > 30 days
      const now = Date.now();
      const webKept: InquiryRecord[] = [];
      for (const doc of webRes.documents as unknown as InquiryRecord[]) {
        if (doc.trashed && doc.trashedAt && now - new Date(doc.trashedAt).getTime() > THIRTY_DAYS_MS) {
          databases.deleteDocument(databaseId, collections.websiteInquiries, doc.$id).catch(() => {});
        } else {
          webKept.push(doc);
        }
      }

      setWebsiteDocs(webKept);
      setAppDocs(appRes.documents as unknown as InquiryRecord[]);
    } catch (err: any) {
      setError('Failed to load messages: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const filterMessages = () => {
    const docs = sourceTab === 'website' ? websiteDocs : appDocs;
    const notTrashed = docs.filter(d => !d.trashed);
    const trashed = docs.filter(d => d.trashed);

    switch (filterTab) {
      case 'unread': setMessages(notTrashed.filter(d => !d.read)); break;
      case 'read': setMessages(notTrashed.filter(d => d.read)); break;
      case 'all': setMessages(notTrashed); break;
      case 'trash': setMessages(trashed); break;
    }
  };

  const collectionId = sourceTab === 'website' ? collections.websiteInquiries : collections.messages;

  const markAsRead = async (id: string) => {
    try {
      await databases.updateDocument(databaseId, collectionId, id, { read: true });
      const setter = sourceTab === 'website' ? setWebsiteDocs : setAppDocs;
      setter(prev => prev.map(m => m.$id === id ? { ...m, read: true } : m));
    } catch { /* ignore */ }
  };

  const moveToTrash = async (id: string) => {
    if (sourceTab === 'app') return; // App messages don't support trash attributes
    try {
      const trashedAt = new Date().toISOString();
      await databases.updateDocument(databaseId, collectionId, id, { trashed: true, trashedAt });
      setWebsiteDocs(prev => prev.map(m => m.$id === id ? { ...m, trashed: true, trashedAt } : m));
      setExpandedId(null);
    } catch { /* ignore */ }
  };

  const restoreFromTrash = async (id: string) => {
    try {
      await databases.updateDocument(databaseId, collectionId, id, { trashed: false, trashedAt: null });
      setWebsiteDocs(prev => prev.map(m => m.$id === id ? { ...m, trashed: false, trashedAt: null } : m));
      setExpandedId(null);
    } catch { /* ignore */ }
  };

  const permanentDelete = async (id: string) => {
    try {
      await databases.deleteDocument(databaseId, collectionId, id);
      const setter = sourceTab === 'website' ? setWebsiteDocs : setAppDocs;
      setter(prev => prev.filter(m => m.$id !== id));
      setExpandedId(null);
    } catch { /* ignore */ }
  };

  const openReply = (msg: InquiryRecord) => {
    setReplyingTo(msg);
    setReplyText('');
    setReplyStatus('idle');
    setReplyError('');
  };

  const closeReply = () => {
    setReplyingTo(null);
    setReplyText('');
    setReplyStatus('idle');
    setReplyError('');
  };

  const sendReply = async () => {
    if (!replyingTo || !replyText.trim()) return;
    setReplySending(true);
    setReplyStatus('idle');
    setReplyError('');
    try {
      const payload = {
        toEmail: replyingTo.email,
        toName: `${replyingTo.firstName || ''} ${replyingTo.lastName || ''}`.trim(),
        subject: replyingTo.subject || 'Your Inquiry',
        originalMessage: replyingTo.message || '',
        originalDate: replyingTo.$createdAt,
        replyMessage: replyText.trim(),
      };
      const res = await functions.createExecution(
        REPLY_FUNCTION_ID,
        JSON.stringify(payload),
        false,
      );
      const body = JSON.parse(res.responseBody || '{}');
      if (res.status !== 'completed' || res.responseStatusCode !== 200 || !body.success) {
        throw new Error(body.error || 'Function failed');
      }
      setReplyStatus('sent');
    } catch (err: any) {
      setReplyStatus('error');
      setReplyError(err.message || 'Failed to send reply');
    } finally {
      setReplySending(false);
    }
  };

  const getName = (msg: InquiryRecord) =>
    `${msg.firstName || ''} ${msg.lastName || ''}`.trim() || 'Unknown';

  const webTrashCount = websiteDocs.filter(d => d.trashed).length;
  const isWebsite = sourceTab === 'website';
  const isTrash = filterTab === 'trash';

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-white mb-6">Messages</h2>

      {/* Row 1: Source tabs */}
      <div className="flex gap-1 mb-3 bg-gray-900 rounded-lg p-1 w-fit border border-gray-800">
        {([
          { key: 'website' as SourceTab, label: 'Website Inquiries' },
          { key: 'app' as SourceTab, label: 'App Inquiries' },
        ]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { setSourceTab(key); setExpandedId(null); setFilterTab('unread'); }}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              sourceTab === key ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Row 2: Filter tabs */}
      <div className="flex gap-1 mb-6 bg-gray-900/50 rounded-lg p-1 w-fit border border-gray-800/50">
        {([
          { key: 'unread' as FilterTab, label: 'Unread' },
          { key: 'read' as FilterTab, label: 'Read' },
          { key: 'all' as FilterTab, label: 'All' },
          ...(isWebsite ? [{ key: 'trash' as FilterTab, label: 'Trash' }] : []),
        ]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { setFilterTab(key); setExpandedId(null); }}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
              filterTab === key ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {label}
            {key === 'trash' && webTrashCount > 0 && (
              <span className="text-[10px] bg-gray-700 text-gray-300 rounded-full px-1.5 py-0.5">
                {webTrashCount}
              </span>
            )}
          </button>
        ))}
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
          {messages.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500">
              {isTrash ? 'Trash is empty' : `No ${filterTab} messages`}
            </div>
          ) : (
            messages.map(msg => {
              const name = getName(msg);
              const isExpanded = expandedId === msg.$id;

              return (
                <div key={msg.$id}>
                  <div
                    onClick={() => {
                      setExpandedId(isExpanded ? null : msg.$id);
                      if (!msg.read && !isTrash) markAsRead(msg.$id);
                    }}
                    className="px-4 py-4 hover:bg-gray-800/50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center flex-shrink-0">
                          <span className="text-gray-400 text-xs font-semibold">
                            {(msg.firstName?.[0] || '?').toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-medium truncate ${!msg.read && !isTrash ? 'text-white' : 'text-gray-400'}`}>
                              {name}
                            </span>
                            {!msg.read && !isTrash && (
                              <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-gray-600 text-xs truncate">{msg.email || msg.userId || ''}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-gray-600 text-xs">
                          {new Date(msg.$createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                        {isWebsite && !isTrash && (
                          <button
                            onClick={(e) => { e.stopPropagation(); moveToTrash(msg.$id); }}
                            className="text-gray-700 hover:text-red-400 transition-colors p-1"
                            title="Move to trash"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="mt-2 pl-11">
                      <p className={`text-sm truncate ${!msg.read && !isTrash ? 'text-gray-300' : 'text-gray-500'}`}>
                        {msg.subject || '(No subject)'}
                      </p>
                      <p className="text-gray-600 text-xs mt-0.5 truncate">{msg.message || ''}</p>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 bg-gray-800/20">
                      <div className="pt-3 pl-11 border-t border-gray-800">
                        <div className="flex flex-wrap gap-x-6 gap-y-1 mb-3">
                          <div>
                            <span className="text-gray-600 text-xs">First Name</span>
                            <p className="text-gray-300 text-sm">{msg.firstName || '—'}</p>
                          </div>
                          <div>
                            <span className="text-gray-600 text-xs">Last Name</span>
                            <p className="text-gray-300 text-sm">{msg.lastName || '—'}</p>
                          </div>
                          {msg.email && (
                            <div>
                              <span className="text-gray-600 text-xs">Email</span>
                              <p className="text-blue-400 text-sm">{msg.email}</p>
                            </div>
                          )}
                          <div>
                            <span className="text-gray-600 text-xs">Received</span>
                            <p className="text-gray-300 text-sm">
                              {new Date(msg.$createdAt).toLocaleString('en-US', {
                                month: 'short', day: 'numeric', year: 'numeric',
                                hour: 'numeric', minute: '2-digit', hour12: true,
                              })}
                            </p>
                          </div>
                          {isTrash && msg.trashedAt && (
                            <div>
                              <span className="text-gray-600 text-xs">Auto-deletes</span>
                              <p className="text-red-400 text-sm">
                                {new Date(new Date(msg.trashedAt).getTime() + THIRTY_DAYS_MS).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </p>
                            </div>
                          )}
                        </div>

                        <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed mb-4">
                          {msg.message || '(No message body)'}
                        </p>

                        <div className="flex items-center gap-3">
                          {isTrash ? (
                            <>
                              <button onClick={(e) => { e.stopPropagation(); restoreFromTrash(msg.$id); }}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-200 text-black text-sm font-medium rounded-lg transition-colors">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                                Restore
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); permanentDelete(msg.$id); }}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium rounded-lg transition-colors border border-red-500/20">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                Delete permanently
                              </button>
                            </>
                          ) : (
                            <>
                              {msg.email && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); openReply(msg); }}
                                  className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-200 text-black text-sm font-medium rounded-lg transition-colors">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10l9 6 9-6M21 10v8a2 2 0 01-2 2H5a2 2 0 01-2-2v-8" /></svg>
                                  Reply
                                </button>
                              )}
                              {isWebsite && (
                                <button onClick={(e) => { e.stopPropagation(); moveToTrash(msg.$id); }}
                                  className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium rounded-lg transition-colors border border-red-500/20">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                  Trash
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
      {/* ── Reply Modal ── */}
      {replyingTo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={closeReply} />
          <div className="relative w-full max-w-lg bg-[#111] border border-[#222] rounded-2xl shadow-2xl z-10 overflow-hidden">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e1e1e]">
              <div>
                <p className="text-white font-semibold text-sm">
                  Reply to {replyingTo.firstName} {replyingTo.lastName}
                </p>
                <p className="text-gray-500 text-xs mt-0.5">{replyingTo.email}</p>
              </div>
              <button onClick={closeReply} className="text-gray-600 hover:text-white transition-colors p-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Original message context */}
            <div className="px-6 pt-4">
              <p className="text-gray-600 text-xs uppercase tracking-wider font-medium mb-2">
                Re: {replyingTo.subject || '(No subject)'}
              </p>
              <div className="border-l-2 border-[#2a2a2a] pl-3 mb-4 max-h-24 overflow-y-auto">
                <p className="text-gray-600 text-xs leading-relaxed whitespace-pre-wrap">{replyingTo.message}</p>
              </div>
            </div>

            {/* Reply textarea */}
            <div className="px-6 pb-4">
              {replyStatus === 'sent' ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-3">
                    <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-white font-medium mb-1">Reply sent</p>
                  <p className="text-gray-500 text-sm">
                    Your message was delivered to {replyingTo.email}
                  </p>
                  <button onClick={closeReply} className="mt-5 px-6 py-2 bg-white hover:bg-gray-200 text-black text-sm font-medium rounded-lg transition-colors">
                    Done
                  </button>
                </div>
              ) : (
                <>
                  <textarea
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    placeholder="Write your reply…"
                    rows={6}
                    className="w-full px-4 py-3 bg-[#0d0d0d] border border-[#2a2a2a] rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none transition-colors"
                  />

                  {replyStatus === 'error' && (
                    <p className="mt-2 text-red-400 text-xs">{replyError}</p>
                  )}

                  <div className="flex items-center gap-3 mt-4">
                    <button
                      onClick={sendReply}
                      disabled={replySending || !replyText.trim()}
                      className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {replySending && (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      )}
                      {replySending ? 'Sending…' : 'Send Reply'}
                    </button>
                    <button onClick={closeReply} className="px-5 py-2.5 text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg transition-colors">
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessagesSection;
