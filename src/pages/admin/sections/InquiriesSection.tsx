import { useState, useEffect } from 'react';
import { Query } from 'appwrite';
import { databases, databaseId, collections } from '../../../services/appwrite';

interface Inquiry {
  $id: string;
  $createdAt: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  subject?: string;
  message?: string;
  read?: boolean;
  trashed?: boolean;
}

const InquiriesSection = () => {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replyModalId, setReplyModalId] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [filterUnread, setFilterUnread] = useState(false);

  useEffect(() => { fetchInquiries(); }, []);

  const fetchInquiries = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await databases.listDocuments(databaseId, collections.websiteInquiries, [
        Query.orderDesc('$createdAt'),
        Query.limit(5000),
      ]);
      const docs = (res.documents as Inquiry[]).filter(d => !d.trashed);
      setInquiries(docs);
    } catch (e) {
      console.error(e);
      setError('Failed to load inquiries.');
    } finally {
      setLoading(false);
    }
  };

  const markRead = async (id: string) => {
    try {
      await databases.updateDocument(databaseId, collections.websiteInquiries, id, { read: true });
      setInquiries(prev => prev.map(i => i.$id === id ? { ...i, read: true } : i));
    } catch { /* silent */ }
  };

  const handleExpand = (inq: Inquiry) => {
    if (expandedId === inq.$id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(inq.$id);
    if (!inq.read) markRead(inq.$id);
  };

  const openReply = (inq: Inquiry, e: React.MouseEvent) => {
    e.stopPropagation();
    setReplyModalId(inq.$id);
    setReplyBody('');
  };

  const buildMailtoHref = (inq: Inquiry) => {
    const to = inq.email || '';
    const name = `${inq.firstName || ''} ${inq.lastName || ''}`.trim() || 'there';
    const subject = encodeURIComponent(`Re: ${inq.subject || 'Your Inquiry'}`);
    const greeting = `Hi ${name},\n\n${replyBody}\n\nBest regards,\nNext Star Soccer\n\n────────────────────\nOriginal message:\n\n${inq.message || ''}`;
    const body = encodeURIComponent(greeting);
    return `mailto:${to}?subject=${subject}&body=${body}`;
  };

  const filteredInquiries = inquiries.filter(inq => {
    if (filterUnread && inq.read) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const name = `${inq.firstName || ''} ${inq.lastName || ''}`.toLowerCase();
    return (
      name.includes(q) ||
      (inq.email || '').toLowerCase().includes(q) ||
      (inq.subject || '').toLowerCase().includes(q) ||
      (inq.message || '').toLowerCase().includes(q)
    );
  });

  const unreadCount = inquiries.filter(i => !i.read).length;

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h2 className="text-white text-[15px] font-medium">Inquiries</h2>
          {unreadCount > 0 && (
            <span className="bg-white text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
              {unreadCount}
            </span>
          )}
        </div>
        <button onClick={fetchInquiries}
          className="text-white/30 hover:text-white transition-colors text-xs">
          Refresh
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search inquiries…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg pl-9 pr-4 py-2 text-white text-[13px] placeholder-white/25 focus:outline-none focus:border-white/20"
          />
        </div>
        <button
          onClick={() => setFilterUnread(v => !v)}
          className={`px-3 py-2 rounded-lg text-[12px] border transition-colors ${filterUnread ? 'bg-white/10 border-white/20 text-white' : 'border-white/[0.08] text-white/40 hover:text-white hover:bg-white/[0.05]'}`}
        >
          Unread only
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-5 h-5 border border-white/10 border-t-white/40 rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="text-red-400 text-sm text-center py-10">{error}</div>
      ) : filteredInquiries.length === 0 ? (
        <div className="text-white/30 text-sm text-center py-10">
          {searchQuery || filterUnread ? 'No matching inquiries.' : 'No inquiries yet.'}
        </div>
      ) : (
        <div className="space-y-px">
          {filteredInquiries.map(inq => {
            const isExpanded = expandedId === inq.$id;
            const isRead = !!inq.read;
            const name = `${inq.firstName || ''} ${inq.lastName || ''}`.trim() || 'Unknown';
            const initial = name[0]?.toUpperCase() || '?';

            return (
              <div key={inq.$id}
                className={`rounded-lg border border-white/[0.08] overflow-hidden transition-all duration-150 ${isRead ? 'opacity-60' : ''}`}
              >
                {/* Row */}
                <button
                  onClick={() => handleExpand(inq)}
                  className="w-full flex items-center gap-4 px-4 py-3.5 text-left bg-[#1d1c21] hover:bg-[#242228] transition-colors"
                >
                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full bg-white/[0.07] border border-white/[0.10] flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-[11px] font-medium">{initial}</span>
                  </div>

                  {/* Name + subject */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {!isRead && (
                        <div className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0" />
                      )}
                      <span className="text-white text-[13px] font-medium truncate">{name}</span>
                    </div>
                    <p className="text-white/50 text-[12px] mt-0.5 truncate">
                      {inq.subject || 'No subject'}{inq.email ? ` · ${inq.email}` : ''}
                    </p>
                  </div>

                  {/* Preview + date */}
                  <div className="hidden sm:flex items-center gap-6 flex-shrink-0">
                    <p className="text-white/30 text-[12px] max-w-[180px] truncate">
                      {inq.message || ''}
                    </p>
                    <span className="text-white/25 text-[11px] w-14 text-right">{fmtDate(inq.$createdAt)}</span>
                  </div>

                  {/* Chevron */}
                  <svg
                    className={`w-3.5 h-3.5 text-white/25 flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Expanded body */}
                {isExpanded && (
                  <div className="bg-[#191820] px-5 py-4 border-t border-white/[0.06]">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="space-y-1 text-[12px] text-white/50">
                        {inq.email && <p><span className="text-white/30">From:</span> {inq.email}</p>}
                        {inq.subject && <p><span className="text-white/30">Subject:</span> {inq.subject}</p>}
                        <p><span className="text-white/30">Received:</span> {new Date(inq.$createdAt).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}</p>
                      </div>
                      {inq.email && (
                        <button
                          onClick={(e) => openReply(inq, e)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/[0.07] border border-white/[0.10] text-white text-[12px] hover:bg-white/[0.12] transition-colors flex-shrink-0"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                          </svg>
                          Reply
                        </button>
                      )}
                    </div>
                    <p className="text-white/80 text-[13px] leading-relaxed whitespace-pre-wrap">
                      {inq.message || '(No message body)'}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Reply modal */}
      {replyModalId && (() => {
        const inq = inquiries.find(i => i.$id === replyModalId);
        if (!inq) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setReplyModalId(null)}>
            <div className="bg-[#1a1820] border border-white/[0.10] rounded-xl shadow-2xl w-full max-w-lg mx-4"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
                <div>
                  <p className="text-white text-[13px] font-medium">Reply to {`${inq.firstName || ''} ${inq.lastName || ''}`.trim()}</p>
                  {inq.email && <p className="text-white/40 text-[12px] mt-0.5">{inq.email}</p>}
                </div>
                <button onClick={() => setReplyModalId(null)} className="text-white/30 hover:text-white transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="px-5 py-4 space-y-3">
                {/* Original message preview */}
                <div className="bg-white/[0.04] border border-white/[0.07] rounded-lg px-3 py-3">
                  <p className="text-white/30 text-[11px] uppercase tracking-widest mb-1.5">Original</p>
                  <p className="text-white/50 text-[12px] leading-relaxed line-clamp-3">{inq.message}</p>
                </div>

                {/* Reply textarea */}
                <textarea
                  value={replyBody}
                  onChange={e => setReplyBody(e.target.value)}
                  placeholder="Type your reply…"
                  rows={5}
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-4 py-3 text-white text-[13px] placeholder-white/25 focus:outline-none focus:border-white/20 resize-none"
                />
              </div>

              <div className="px-5 pb-4 flex items-center justify-end gap-3">
                <button onClick={() => setReplyModalId(null)}
                  className="px-4 py-2 text-[12px] text-white/50 hover:text-white transition-colors">
                  Cancel
                </button>
                <a
                  href={buildMailtoHref(inq)}
                  onClick={() => setReplyModalId(null)}
                  className="px-4 py-2 rounded-lg bg-white text-black text-[12px] font-medium hover:bg-white/90 transition-colors"
                >
                  Open in Mail ↗
                </a>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
};

export default InquiriesSection;
