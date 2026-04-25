import { useState, useEffect, useCallback } from 'react';
import { Query } from 'appwrite';
import { databases, databaseId, collections, functions } from '../../../services/appwrite';

const SEND_INQUIRY_REPLY_FN = import.meta.env.VITE_APPWRITE_REPLY_FUNCTION_ID || '';

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
  trashedAt?: string;
}

type Tab = 'priority' | 'trash';

const TRASH_TTL_DAYS = 30;

const InquiriesSection = () => {
  const [allDocs, setAllDocs] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('priority');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replyModalId, setReplyModalId] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<'success' | 'error' | null>(null);
  const [filterUnread, setFilterUnread] = useState(false);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const fetchAndPurge = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await databases.listDocuments(databaseId, collections.websiteInquiries, [
        Query.orderDesc('$createdAt'),
        Query.limit(5000),
      ]);
      const docs = res.documents as Inquiry[];

      // Auto-purge items trashed > 30 days ago
      const now = Date.now();
      const toDelete = docs.filter(d => {
        if (!d.trashed || !d.trashedAt) return false;
        const age = (now - new Date(d.trashedAt).getTime()) / 86400000;
        return age >= TRASH_TTL_DAYS;
      });
      if (toDelete.length > 0) {
        await Promise.all(
          toDelete.map(d =>
            databases.deleteDocument(databaseId, collections.websiteInquiries, d.$id).catch(() => {})
          )
        );
      }

      const remaining = docs.filter(d => !toDelete.some(td => td.$id === d.$id));
      setAllDocs(remaining);
    } catch (e) {
      console.error(e);
      setError('Failed to load inquiries.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAndPurge(); }, [fetchAndPurge]);

  // ── Derived lists ─────────────────────────────────────────────────────────
  const active = allDocs.filter(d => !d.trashed);
  const trashed = allDocs.filter(d => d.trashed);
  const unreadCount = active.filter(i => !i.read).length;
  const trashCount = trashed.length;

  const filteredActive = active.filter(inq => {
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

  const filteredTrashed = trashed.filter(inq => {
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

  // ── Actions ───────────────────────────────────────────────────────────────
  const markRead = async (id: string) => {
    try {
      await databases.updateDocument(databaseId, collections.websiteInquiries, id, { read: true });
      setAllDocs(prev => prev.map(i => i.$id === id ? { ...i, read: true } : i));
    } catch { /* silent */ }
  };

  const handleExpand = (inq: Inquiry) => {
    if (expandedId === inq.$id) { setExpandedId(null); return; }
    setExpandedId(inq.$id);
    if (!inq.read) markRead(inq.$id);
  };

  const moveToTrash = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActioningId(id);
    try {
      await databases.updateDocument(databaseId, collections.websiteInquiries, id, {
        trashed: true,
        trashedAt: new Date().toISOString(),
      });
      setAllDocs(prev => prev.map(i =>
        i.$id === id ? { ...i, trashed: true, trashedAt: new Date().toISOString() } : i
      ));
      if (expandedId === id) setExpandedId(null);
    } catch { /* silent */ }
    setActioningId(null);
  };

  const restoreFromTrash = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActioningId(id);
    try {
      await databases.updateDocument(databaseId, collections.websiteInquiries, id, {
        trashed: false,
        trashedAt: null,
      });
      setAllDocs(prev => prev.map(i =>
        i.$id === id ? { ...i, trashed: false, trashedAt: undefined } : i
      ));
      if (expandedId === id) setExpandedId(null);
    } catch { /* silent */ }
    setActioningId(null);
  };

  const deletePermanently = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActioningId(id);
    try {
      await databases.deleteDocument(databaseId, collections.websiteInquiries, id);
      setAllDocs(prev => prev.filter(i => i.$id !== id));
      if (expandedId === id) setExpandedId(null);
    } catch { /* silent */ }
    setActioningId(null);
  };

  const emptyTrash = async () => {
    const ids = trashed.map(d => d.$id);
    await Promise.all(
      ids.map(id => databases.deleteDocument(databaseId, collections.websiteInquiries, id).catch(() => {}))
    );
    setAllDocs(prev => prev.filter(d => !d.trashed));
    setExpandedId(null);
  };

  const openReply = (inq: Inquiry, e: React.MouseEvent) => {
    e.stopPropagation();
    setReplyModalId(inq.$id);
    setReplyBody('');
    setSendResult(null);
  };

  const closeReplyModal = () => {
    setReplyModalId(null);
    setSendResult(null);
    setReplyBody('');
  };

  const sendReply = async (inq: Inquiry) => {
    if (!replyBody.trim()) return;
    setIsSending(true);
    setSendResult(null);
    try {
      const name = `${inq.firstName || ''} ${inq.lastName || ''}`.trim();
      const payload = JSON.stringify({
        toEmail: inq.email,
        toName: name || undefined,
        subject: inq.subject || '',
        originalMessage: inq.message || '',
        originalDate: inq.$createdAt,
        replyMessage: replyBody.trim(),
      });

      if (!SEND_INQUIRY_REPLY_FN) throw new Error('Reply function not configured — add VITE_APPWRITE_REPLY_FUNCTION_ID to Vercel env');

      const res = await functions.createExecution(SEND_INQUIRY_REPLY_FN, payload, false);
      let body: any = {};
      try { body = JSON.parse(res.responseBody || '{}'); } catch { /* non-JSON */ }

      if (res.status !== 'completed' || res.responseStatusCode !== 200 || !body.success)
        throw new Error(body.error || `HTTP ${res.responseStatusCode}`);

      setSendResult('success');
      if (!inq.read) markRead(inq.$id);
      setTimeout(() => closeReplyModal(), 1800);
    } catch (err) {
      console.error('sendReply error:', err);
      setSendResult('error');
    } finally {
      setIsSending(false);
    }
  };

  const openInGmail = (_inq: Inquiry) => {
    window.open('https://mail.google.com/mail/', '_blank');
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
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

  const daysUntilDelete = (trashedAt: string) => {
    const age = (Date.now() - new Date(trashedAt).getTime()) / 86400000;
    return Math.max(0, Math.ceil(TRASH_TTL_DAYS - age));
  };

  // ── Shared row renderer ───────────────────────────────────────────────────
  const renderRow = (inq: Inquiry, inTrash: boolean) => {
    const isExpanded = expandedId === inq.$id;
    const isRead = !!inq.read;
    const isActioning = actioningId === inq.$id;
    const name = `${inq.firstName || ''} ${inq.lastName || ''}`.trim() || 'Unknown';
    const initial = name[0]?.toUpperCase() || '?';
    const daysLeft = inTrash && inq.trashedAt ? daysUntilDelete(inq.trashedAt) : null;

    return (
      <div key={inq.$id} className="rounded-lg border border-white/[0.08] overflow-hidden">

        {/* Collapsed row — div so we can nest action buttons */}
        <div
          onClick={() => handleExpand(inq)}
          className={`flex items-center gap-4 px-4 py-3.5 cursor-pointer bg-[#1d1c21] hover:bg-[#242228] transition-all select-none ${isRead && !isExpanded && !inTrash ? 'opacity-60' : ''}`}
        >
          {/* Avatar */}
          <div className="w-8 h-8 rounded-full bg-white/[0.07] border border-white/[0.10] flex items-center justify-center flex-shrink-0">
            <span className="text-white text-[11px] font-medium">{initial}</span>
          </div>

          {/* Name + subject */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {!isRead && !inTrash && (
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
            {inTrash && daysLeft !== null ? (
              <span className="text-white/25 text-[11px]">
                {daysLeft === 0 ? 'Deletes today' : `${daysLeft}d left`}
              </span>
            ) : (
              <p className="text-white/30 text-[12px] max-w-[180px] truncate">{inq.message || ''}</p>
            )}
            <span className="text-white/25 text-[11px] w-14 text-right">{fmtDate(inq.$createdAt)}</span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
            {inTrash ? (
              <>
                {/* Restore */}
                <button
                  onClick={(e) => restoreFromTrash(inq.$id, e)}
                  disabled={isActioning}
                  title="Restore"
                  className="w-7 h-7 flex items-center justify-center rounded-md text-white/30 hover:text-white hover:bg-white/[0.08] transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                </button>
                {/* Delete permanently */}
                <button
                  onClick={(e) => deletePermanently(inq.$id, e)}
                  disabled={isActioning}
                  title="Delete permanently"
                  className="w-7 h-7 flex items-center justify-center rounded-md text-white/30 hover:text-red-400 hover:bg-red-400/[0.08] transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </>
            ) : (
              /* Trash */
              <button
                onClick={(e) => moveToTrash(inq.$id, e)}
                disabled={isActioning}
                title="Move to trash"
                className="w-7 h-7 flex items-center justify-center rounded-md text-white/20 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}

            {/* Chevron */}
            <svg
              className={`w-3.5 h-3.5 text-white/25 transition-transform duration-200 ml-1 ${isExpanded ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Expanded body */}
        {isExpanded && (
          <div className="bg-[#191820] px-5 py-4 border-t border-white/[0.06]">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="space-y-1 text-[12px] text-white/50">
                {inq.email && <p><span className="text-white/30">From:</span> {inq.email}</p>}
                {inq.subject && <p><span className="text-white/30">Subject:</span> {inq.subject}</p>}
                <p>
                  <span className="text-white/30">Received:</span>{' '}
                  {new Date(inq.$createdAt).toLocaleString('en-US', {
                    timeZone: 'America/New_York', month: 'short', day: 'numeric',
                    year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
                  })}
                </p>
                {inTrash && inq.trashedAt && (
                  <p>
                    <span className="text-white/30">Trashed:</span>{' '}
                    {new Date(inq.trashedAt).toLocaleString('en-US', {
                      timeZone: 'America/New_York', month: 'short', day: 'numeric',
                      year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
                    })}
                    {daysLeft !== null && (
                      <span className="ml-2 text-white/25">
                        — auto-deletes in {daysLeft === 0 ? 'less than a day' : `${daysLeft} day${daysLeft === 1 ? '' : 's'}`}
                      </span>
                    )}
                  </p>
                )}
              </div>
              {!inTrash && inq.email && (
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
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-white text-[15px] font-medium">Inquiries</h2>
        <button onClick={fetchAndPurge} className="text-white/30 hover:text-white transition-colors text-xs">
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-px mb-5 bg-white/[0.04] border border-white/[0.08] rounded-lg p-1 w-fit">
        <button
          onClick={() => { setTab('priority'); setExpandedId(null); setSearchQuery(''); setFilterUnread(false); }}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-[12px] font-medium transition-colors ${tab === 'priority' ? 'bg-white/[0.10] text-white' : 'text-white/40 hover:text-white'}`}
        >
          Priority
          {unreadCount > 0 && (
            <span className="bg-white text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
              {unreadCount}
            </span>
          )}
        </button>
        <button
          onClick={() => { setTab('trash'); setExpandedId(null); setSearchQuery(''); setFilterUnread(false); }}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-[12px] font-medium transition-colors ${tab === 'trash' ? 'bg-white/[0.10] text-white' : 'text-white/40 hover:text-white'}`}
        >
          Trash
          {trashCount > 0 && (
            <span className="bg-white/10 text-white/60 text-[10px] font-medium px-1.5 py-0.5 rounded-full leading-none">
              {trashCount}
            </span>
          )}
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
            placeholder={tab === 'trash' ? 'Search trash…' : 'Search inquiries…'}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg pl-9 pr-4 py-2 text-white text-[13px] placeholder-white/25 focus:outline-none focus:border-white/20"
          />
        </div>
        {tab === 'priority' && (
          <button
            onClick={() => setFilterUnread(v => !v)}
            className={`px-3 py-2 rounded-lg text-[12px] border transition-colors ${filterUnread ? 'bg-white/10 border-white/20 text-white' : 'border-white/[0.08] text-white/40 hover:text-white hover:bg-white/[0.05]'}`}
          >
            Unread only
          </button>
        )}
        {tab === 'trash' && trashCount > 0 && (
          <button
            onClick={emptyTrash}
            className="px-3 py-2 rounded-lg text-[12px] border border-red-500/20 text-red-400/60 hover:text-red-400 hover:border-red-500/40 hover:bg-red-400/[0.05] transition-colors"
          >
            Empty Trash
          </button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-5 h-5 border border-white/10 border-t-white/40 rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="text-red-400 text-sm text-center py-10">{error}</div>
      ) : tab === 'priority' ? (
        filteredActive.length === 0 ? (
          <div className="text-white/30 text-sm text-center py-10">
            {searchQuery || filterUnread ? 'No matching inquiries.' : 'No inquiries yet.'}
          </div>
        ) : (
          <div className="space-y-px">
            {filteredActive.map(inq => renderRow(inq, false))}
          </div>
        )
      ) : (
        filteredTrashed.length === 0 ? (
          <div className="text-white/30 text-sm text-center py-10">
            {searchQuery ? 'No matching items in trash.' : 'Trash is empty.'}
          </div>
        ) : (
          <>
            <p className="text-white/25 text-[11px] mb-3">
              Items are permanently deleted after {TRASH_TTL_DAYS} days.
            </p>
            <div className="space-y-px">
              {filteredTrashed.map(inq => renderRow(inq, true))}
            </div>
          </>
        )
      )}

      {/* Reply modal */}
      {replyModalId && (() => {
        const inq = allDocs.find(i => i.$id === replyModalId);
        if (!inq) return null;
        const canSend = !!replyBody.trim() && !!inq.email;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={closeReplyModal}>
            <div className="bg-[#1a1820] border border-white/[0.10] rounded-xl shadow-2xl w-full max-w-lg mx-4"
              onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
                <div>
                  <p className="text-white text-[13px] font-medium">
                    Reply to {`${inq.firstName || ''} ${inq.lastName || ''}`.trim()}
                  </p>
                  {inq.email && <p className="text-white/40 text-[12px] mt-0.5">{inq.email}</p>}
                </div>
                <button onClick={closeReplyModal} className="text-white/30 hover:text-white transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Body */}
              <div className="px-5 py-4 space-y-3">
                <div className="bg-white/[0.04] border border-white/[0.07] rounded-lg px-3 py-3">
                  <p className="text-white/30 text-[11px] uppercase tracking-widest mb-1.5">Original</p>
                  <p className="text-white/50 text-[12px] leading-relaxed line-clamp-3">{inq.message}</p>
                </div>
                <textarea
                  value={replyBody}
                  onChange={e => { setReplyBody(e.target.value); setSendResult(null); }}
                  placeholder="Type your reply…"
                  rows={5}
                  disabled={isSending}
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-4 py-3 text-white text-[13px] placeholder-white/25 focus:outline-none focus:border-white/20 resize-none disabled:opacity-50"
                />

                {/* Send result feedback */}
                {sendResult === 'success' && (
                  <div className="flex items-center gap-2 text-green-400 text-[12px]">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Reply sent successfully!
                  </div>
                )}
                {sendResult === 'error' && (
                  <div className="flex items-center gap-2 text-red-400 text-[12px]">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Failed to send. Try opening in Gmail instead.
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-5 pb-5 flex items-center justify-between gap-3">
                <button onClick={closeReplyModal}
                  className="text-[12px] text-white/40 hover:text-white transition-colors">
                  Cancel
                </button>
                <div className="flex items-center gap-2">
                  {/* Open in Gmail */}
                  <button
                    onClick={() => openInGmail(inq)}
                    disabled={!inq.email}
                    title="Open compose in Gmail"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/[0.10] bg-white/[0.05] text-white text-[12px] hover:bg-white/[0.10] transition-colors disabled:opacity-30"
                  >
                    {/* Gmail "G" icon */}
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                      <path d="M22 6C22 4.9 21.1 4 20 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6ZM20 6L12 11L4 6H20ZM20 18H4V8L12 13L20 8V18Z" fill="currentColor"/>
                    </svg>
                    Open in Gmail
                  </button>

                  {/* Send */}
                  <button
                    onClick={() => sendReply(inq)}
                    disabled={!canSend || isSending}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white text-black text-[12px] font-medium hover:bg-white/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isSending ? (
                      <>
                        <div className="w-3 h-3 border border-black/20 border-t-black/60 rounded-full animate-spin" />
                        Sending…
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                        Send
                      </>
                    )}
                  </button>
                </div>
              </div>

            </div>
          </div>
        );
      })()}

    </div>
  );
};

export default InquiriesSection;
