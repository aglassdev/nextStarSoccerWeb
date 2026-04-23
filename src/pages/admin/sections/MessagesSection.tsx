import { useState, useEffect, useRef } from 'react';
import { Query, ID } from 'appwrite';
import { databases, functions, databaseId, collections } from '../../../services/appwrite';

const REPLY_FUNCTION_ID = import.meta.env.VITE_APPWRITE_REPLY_FUNCTION_ID || '';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

type MainTab = 'inquiries' | 'chats';

// ── Shared types ──────────────────────────────────────────────────────────────
interface InquiryRecord {
  $id: string; $createdAt: string;
  firstName: string; lastName: string;
  email?: string; subject: string; message: string;
  timestamp: string; read: boolean;
  trashed?: boolean; trashedAt?: string | null;
}

interface WebConversation {
  conversationId: string;
  clientId: string;
  clientName: string;
  lastMessage: string;
  lastTimestamp: string;
  unreadCount: number;
  hasUnread: boolean;
}

interface ChatMsg {
  $id: string;
  conversationId: string;
  clientId: string;
  fromAdmin: boolean;
  firstName: string;
  lastName: string;
  message: string;
  timestamp: string;
  read: boolean;
  eventType?: string;
  eventDate?: string;
  eventLocation?: string;
  eventStartTime?: string;
  eventEndTime?: string;
  eventStatus?: string;
}

interface UserSuggestion {
  userId: string;
  name: string;
  collectionType: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function generateConversationId() {
  return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function fmtTimestamp(ts: string) {
  const d = new Date(ts);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays <= 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtDateHeader(ts: string) {
  const d = new Date(ts);
  const diffDays = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function fmtTime(ts: string) {
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

// Resolve a clientId → display name by searching across role collections
async function resolveUserName(clientId: string): Promise<string> {
  if (!clientId || clientId === 'admin') return 'Unknown User';
  const colls = [
    collections.parentUsers,
    collections.youthPlayers,
    collections.collegiatePlayers,
    collections.professionalPlayers,
  ].filter(Boolean) as string[];

  for (const collId of colls) {
    try {
      const res = await databases.listDocuments(databaseId, collId, [
        Query.equal('userId', clientId), Query.limit(1),
      ]);
      if (res.documents.length > 0) {
        const d = res.documents[0] as any;
        const name = `${d.firstName || ''} ${d.lastName || ''}`.trim();
        if (name) return name;
      }
    } catch { /* try next */ }
  }
  return 'Unknown User';
}

// Group raw message documents into conversation objects (admin perspective)
async function groupIntoConversations(docs: any[]): Promise<WebConversation[]> {
  const byConv = new Map<string, any[]>();
  for (const msg of docs) {
    const cid = msg.conversationId || msg.$id;
    if (!byConv.has(cid)) byConv.set(cid, []);
    byConv.get(cid)!.push(msg);
  }

  const result: WebConversation[] = [];
  for (const [convId, msgs] of byConv) {
    msgs.sort((a, b) =>
      new Date(b.timestamp || b.$createdAt).getTime() -
      new Date(a.timestamp || a.$createdAt).getTime()
    );
    const latest = msgs[0];
    const clientId =
      msgs.find((m: any) => m.clientId)?.clientId ||
      msgs.find((m: any) => m.userId && m.userId !== 'admin')?.userId || '';

    const unreadCount = msgs.filter((m: any) => !m.read && m.fromAdmin === false).length;
    const clientName = clientId ? await resolveUserName(clientId) : 'Unknown';

    result.push({
      conversationId: convId,
      clientId,
      clientName,
      lastMessage: latest.message || '',
      lastTimestamp: latest.timestamp || latest.$createdAt,
      unreadCount,
      hasUnread: unreadCount > 0,
    });
  }

  result.sort((a, b) =>
    new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime()
  );
  return result;
}

// ── Event card (chat) ─────────────────────────────────────────────────────────
const EventCard = ({
  msg, fromMe, onAccept, onReject, accepting,
}: {
  msg: ChatMsg; fromMe: boolean;
  onAccept: () => void; onReject: () => void; accepting: boolean;
}) => {
  const isProposed = msg.eventStatus === 'proposed';
  const showActions = isProposed && !fromMe; // client sent a proposal → admin can respond

  const statusColor: Record<string, string> = {
    accepted: 'bg-green-700 text-white',
    rejected: 'bg-red-700 text-white',
    altered: 'bg-yellow-600 text-black',
    proposed: 'bg-white/20 text-white',
  };

  return (
    <div className={`max-w-[70%] rounded-2xl p-4 ${fromMe ? 'bg-white text-black' : 'bg-[#2A2A2A] text-[#f4f2ee]'}`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className="text-sm font-semibold">{msg.eventType || 'Event'}</span>
      </div>
      {msg.eventDate && (
        <p className={`text-xs mb-1 ${fromMe ? 'text-gray-600' : 'text-[#ccc]'}`}>Date: {msg.eventDate}</p>
      )}
      {msg.eventLocation && (
        <p className={`text-xs mb-1 ${fromMe ? 'text-gray-600' : 'text-[#ccc]'}`}>Location: {msg.eventLocation}</p>
      )}
      {(msg.eventStartTime || msg.eventEndTime) && (
        <p className={`text-xs mb-1 ${fromMe ? 'text-gray-600' : 'text-[#ccc]'}`}>
          Time: {msg.eventStartTime}{msg.eventEndTime ? ` – ${msg.eventEndTime}` : ''}
        </p>
      )}
      {/* Status badge */}
      {msg.eventStatus && msg.eventStatus !== 'proposed' && (
        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-2 ${statusColor[msg.eventStatus] || 'bg-white/10 text-white'}`}>
          {msg.eventStatus.charAt(0).toUpperCase() + msg.eventStatus.slice(1)}
        </span>
      )}
      {/* Actions (when client proposed, admin can accept/reject) */}
      {showActions && (
        <div className="flex gap-2 mt-3">
          <button
            onClick={onAccept} disabled={accepting}
            className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50">
            Accept
          </button>
          <button
            onClick={onReject} disabled={accepting}
            className="px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50">
            Reject
          </button>
        </div>
      )}
      <p className={`text-[10px] mt-2 text-right ${fromMe ? 'text-gray-400' : 'text-[#555]'}`}>{fmtTime(msg.timestamp)}</p>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
const MessagesSection = () => {
  const [mainTab, setMainTab] = useState<MainTab>('inquiries');

  // ── Inquiries state ──
  const [inquiries, setInquiries] = useState<InquiryRecord[]>([]);
  const [inqLoading, setInqLoading] = useState(true);
  const [inqError, setInqError] = useState('');
  const [expandedInqId, setExpandedInqId] = useState<string | null>(null);
  const [inqSearch, setInqSearch] = useState('');

  // Reply modal state
  const [replyingTo, setReplyingTo] = useState<InquiryRecord | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replySending, setReplySending] = useState(false);
  const [replyStatus, setReplyStatus] = useState<'idle' | 'sent' | 'error'>('idle');
  const [replyError, setReplyError] = useState('');

  // ── Chats state ──
  const [conversations, setConversations] = useState<WebConversation[]>([]);
  const [convLoading, setConvLoading] = useState(false);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [selectedConv, setSelectedConv] = useState<WebConversation | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [msgInput, setMsgInput] = useState('');
  const [msgSending, setMsgSending] = useState(false);
  const [acceptingEventId, setAcceptingEventId] = useState('');
  const [convSearch, setConvSearch] = useState('');

  // New chat state
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState('');
  const [newChatSuggestions, setNewChatSuggestions] = useState<UserSuggestion[]>([]);
  const [newChatSearching, setNewChatSearching] = useState(false);
  const [pendingNewChat, setPendingNewChat] = useState<{ conversationId: string; clientId: string; clientName: string } | null>(null);

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const newChatTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Load inquiries ──
  useEffect(() => {
    if (mainTab === 'inquiries') fetchInquiries();
    if (mainTab === 'chats' && conversations.length === 0) fetchConversations();
  }, [mainTab]);

  const fetchInquiries = async () => {
    setInqLoading(true); setInqError('');
    try {
      const res = await databases.listDocuments(databaseId, collections.websiteInquiries, [
        Query.orderDesc('$createdAt'), Query.limit(5000),
      ]);
      const now = Date.now();
      const kept: InquiryRecord[] = [];
      for (const doc of res.documents as unknown as InquiryRecord[]) {
        if (doc.trashed && doc.trashedAt && now - new Date(doc.trashedAt).getTime() > THIRTY_DAYS_MS) {
          databases.deleteDocument(databaseId, collections.websiteInquiries, doc.$id).catch(() => {});
        } else if (!doc.trashed) {
          kept.push(doc);
        }
      }
      setInquiries(kept);
    } catch (err: any) {
      setInqError('Failed to load inquiries: ' + (err.message || 'Unknown error'));
    } finally { setInqLoading(false); }
  };

  // ── Load conversations ──
  const fetchConversations = async () => {
    if (!collections.messages) return;
    setConvLoading(true);
    try {
      // Paginate all messages
      const all: any[] = [];
      let offset = 0;
      while (true) {
        const page = await databases.listDocuments(databaseId, collections.messages, [
          Query.orderDesc('timestamp'), Query.limit(500), Query.offset(offset),
        ]);
        all.push(...page.documents);
        if (page.documents.length < 500) break;
        offset += 500;
      }
      const convos = await groupIntoConversations(all);
      setConversations(convos);
    } catch { /* ignore */ }
    finally { setConvLoading(false); }
  };

  // ── Load chat messages for a conversation ──
  const loadChat = async (convId: string) => {
    if (!collections.messages) return;
    setChatLoading(true);
    try {
      const res = await databases.listDocuments(databaseId, collections.messages, [
        Query.equal('conversationId', convId), Query.orderAsc('timestamp'), Query.limit(500),
      ]);
      const msgs = res.documents as unknown as ChatMsg[];
      setChatMessages(msgs);
      // Mark client messages as read
      const unread = msgs.filter(m => !m.read && m.fromAdmin === false);
      await Promise.all(unread.map(m =>
        databases.updateDocument(databaseId, collections.messages!, m.$id, { read: true }).catch(() => {})
      ));
      // Update unread count in list
      setConversations(prev => prev.map(c =>
        c.conversationId === convId ? { ...c, unreadCount: 0, hasUnread: false } : c
      ));
    } catch { /* ignore */ }
    finally { setChatLoading(false); }
  };

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // ── Select a conversation ──
  const selectConversation = (conv: WebConversation) => {
    setSelectedConvId(conv.conversationId);
    setSelectedConv(conv);
    setPendingNewChat(null);
    loadChat(conv.conversationId);
  };

  // ── Send a chat message ──
  const sendChatMessage = async () => {
    if (!msgInput.trim() || msgSending) return;
    const text = msgInput.trim();
    const convId = selectedConvId || pendingNewChat?.conversationId;
    const clientId = selectedConv?.clientId || pendingNewChat?.clientId;
    if (!convId || !clientId || !collections.messages) return;

    setMsgSending(true);
    try {
      const doc = await databases.createDocument(databaseId, collections.messages, ID.unique(), {
        message: text,
        fromAdmin: true,
        firstName: 'Admin',
        lastName: '',
        userId: 'admin',
        clientId,
        conversationId: convId,
        timestamp: new Date().toISOString(),
        read: false,
      });

      const newMsg: ChatMsg = {
        $id: doc.$id,
        conversationId: convId,
        clientId,
        fromAdmin: true,
        firstName: 'Admin',
        lastName: '',
        message: text,
        timestamp: (doc as any).timestamp || new Date().toISOString(),
        read: false,
      };

      setChatMessages(prev => [...prev, newMsg]);
      setMsgInput('');

      // If this was a new chat, move it to real conversations
      if (pendingNewChat) {
        const newConv: WebConversation = {
          conversationId: convId,
          clientId: pendingNewChat.clientId,
          clientName: pendingNewChat.clientName,
          lastMessage: text,
          lastTimestamp: newMsg.timestamp,
          unreadCount: 0,
          hasUnread: false,
        };
        setConversations(prev => [newConv, ...prev]);
        setSelectedConv(newConv);
        setSelectedConvId(convId);
        setPendingNewChat(null);
      } else {
        // Update last message in list
        setConversations(prev => prev.map(c =>
          c.conversationId === convId
            ? { ...c, lastMessage: text, lastTimestamp: newMsg.timestamp }
            : c
        ));
      }
    } catch { /* ignore */ }
    finally { setMsgSending(false); }
  };

  // ── Event card actions (admin responding to client-proposed event) ──
  const handleAcceptEvent = async (msg: ChatMsg) => {
    if (acceptingEventId || !collections.messages) return;
    setAcceptingEventId(msg.$id);
    try {
      await databases.updateDocument(databaseId, collections.messages, msg.$id, { eventStatus: 'accepted' });
      const reply = await databases.createDocument(databaseId, collections.messages, ID.unique(), {
        message: 'Event Accepted', fromAdmin: true,
        firstName: 'Admin', lastName: '', userId: 'admin',
        clientId: msg.clientId, conversationId: msg.conversationId,
        timestamp: new Date().toISOString(), read: false,
      });
      setChatMessages(prev => [
        ...prev.map(m => m.$id === msg.$id ? { ...m, eventStatus: 'accepted' } : m),
        { ...(reply as any), fromAdmin: true },
      ]);
    } catch { /* ignore */ }
    finally { setAcceptingEventId(''); }
  };

  const handleRejectEvent = async (msg: ChatMsg) => {
    if (acceptingEventId || !collections.messages) return;
    setAcceptingEventId(msg.$id);
    try {
      await databases.updateDocument(databaseId, collections.messages, msg.$id, { eventStatus: 'rejected' });
      const reply = await databases.createDocument(databaseId, collections.messages, ID.unique(), {
        message: 'Event Rejected', fromAdmin: true,
        firstName: 'Admin', lastName: '', userId: 'admin',
        clientId: msg.clientId, conversationId: msg.conversationId,
        timestamp: new Date().toISOString(), read: false,
      });
      setChatMessages(prev => [
        ...prev.map(m => m.$id === msg.$id ? { ...m, eventStatus: 'rejected' } : m),
        { ...(reply as any), fromAdmin: true },
      ]);
    } catch { /* ignore */ }
    finally { setAcceptingEventId(''); }
  };

  // ── New chat user search ──
  const searchUsers = async (q: string) => {
    if (q.length < 2) { setNewChatSuggestions([]); return; }
    setNewChatSearching(true);
    try {
      const ql = q.toLowerCase();
      const colDefs: [string, string][] = [
        ['Parent', collections.parentUsers],
        ['Youth', collections.youthPlayers],
        ['Collegiate', collections.collegiatePlayers],
        ['Professional', collections.professionalPlayers],
      ].filter(([, c]) => !!c) as [string, string][];

      const results: UserSuggestion[] = [];
      await Promise.all(colDefs.map(async ([type, collId]) => {
        try {
          const res = await databases.listDocuments(databaseId, collId, [Query.limit(200)]);
          for (const d of res.documents as any[]) {
            const name = `${d.firstName || ''} ${d.lastName || ''}`.trim();
            if (name.toLowerCase().includes(ql) && d.userId) {
              results.push({ userId: d.userId, name, collectionType: type });
            }
          }
        } catch { /* ignore */ }
      }));
      setNewChatSuggestions(results.slice(0, 8));
    } catch { /* ignore */ }
    finally { setNewChatSearching(false); }
  };

  const startNewChat = (user: UserSuggestion) => {
    const convId = generateConversationId();
    setPendingNewChat({ conversationId: convId, clientId: user.userId, clientName: user.name });
    setSelectedConvId(convId);
    setSelectedConv(null);
    setChatMessages([]);
    setNewChatOpen(false);
    setNewChatSearch('');
    setNewChatSuggestions([]);
  };

  // ── Inquiry helpers ──
  const markInqRead = async (id: string) => {
    try {
      await databases.updateDocument(databaseId, collections.websiteInquiries, id, { read: true });
      setInquiries(prev => prev.map(m => m.$id === id ? { ...m, read: true } : m));
    } catch { /* ignore */ }
  };

  const trashInq = async (id: string) => {
    try {
      const trashedAt = new Date().toISOString();
      await databases.updateDocument(databaseId, collections.websiteInquiries, id, { trashed: true, trashedAt });
      setInquiries(prev => prev.filter(m => m.$id !== id));
      if (expandedInqId === id) setExpandedInqId(null);
    } catch { /* ignore */ }
  };

  const sendReply = async () => {
    if (!replyingTo || !replyText.trim()) return;
    if (!REPLY_FUNCTION_ID) { setReplyStatus('error'); setReplyError('Reply function not configured.'); return; }
    setReplySending(true); setReplyStatus('idle');
    try {
      const payload = {
        toEmail: replyingTo.email,
        toName: `${replyingTo.firstName || ''} ${replyingTo.lastName || ''}`.trim(),
        subject: replyingTo.subject || 'Your Inquiry',
        originalMessage: replyingTo.message || '',
        originalDate: replyingTo.$createdAt,
        replyMessage: replyText.trim(),
      };
      const res = await functions.createExecution(REPLY_FUNCTION_ID, JSON.stringify(payload), false);
      let body: any = {};
      try { body = JSON.parse(res.responseBody || '{}'); } catch { /* non-JSON */ }
      if (res.status !== 'completed' || res.responseStatusCode !== 200 || !body.success)
        throw new Error(body.error || `HTTP ${res.responseStatusCode}`);
      setReplyStatus('sent');
    } catch (err: any) {
      setReplyStatus('error');
      setReplyError(err.message || 'Failed to send reply');
    } finally { setReplySending(false); }
  };

  const closeReply = () => {
    setReplyingTo(null); setReplyText(''); setReplyStatus('idle'); setReplyError('');
  };

  // ── Filtered inquiries ──
  const filteredInquiries = inquiries.filter(i => {
    if (!inqSearch) return true;
    const q = inqSearch.toLowerCase();
    return (
      `${i.firstName} ${i.lastName}`.toLowerCase().includes(q) ||
      (i.email || '').toLowerCase().includes(q) ||
      (i.subject || '').toLowerCase().includes(q)
    );
  });

  const filteredConversations = conversations.filter(c =>
    !convSearch || c.clientName.toLowerCase().includes(convSearch.toLowerCase())
  );

  // ── Date-header grouping for chat ──
  const shouldShowDateHeader = (idx: number) => {
    if (idx === 0) return true;
    const cur = new Date(chatMessages[idx].timestamp).toDateString();
    const prev = new Date(chatMessages[idx - 1].timestamp).toDateString();
    return cur !== prev;
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">

      {/* ── Page header + tabs ── */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4 flex-shrink-0">
        <h2 className="text-2xl font-bold text-white">Messages</h2>
        <div className="flex gap-1 bg-white/[0.05] rounded-lg p-1 border border-white/[0.08]">
          {(['inquiries', 'chats'] as MainTab[]).map(tab => (
            <button key={tab}
              onClick={() => setMainTab(tab)}
              className={`px-5 py-2 rounded-md text-sm font-medium transition-colors capitalize ${
                mainTab === tab ? 'bg-white text-black' : 'text-white/40 hover:text-white/70'
              }`}>
              {tab === 'inquiries' ? 'Inquiries' : 'Chats'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Inquiries tab ── */}
      {mainTab === 'inquiries' && (
        <div className="flex-1 overflow-y-auto px-6 pb-6">

          {/* Search */}
          <input type="text" placeholder="Search inquiries…" value={inqSearch}
            onChange={e => setInqSearch(e.target.value)}
            className="w-full max-w-sm px-4 py-2 mb-4 bg-[#1d1c21] border border-white/10 rounded-lg text-white text-sm placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-white/20" />

          {inqLoading && (
            <div className="flex items-center justify-center h-48">
              <div className="w-6 h-6 border border-white/10 border-t-white/40 rounded-full animate-spin" />
            </div>
          )}
          {inqError && <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{inqError}</div>}

          {!inqLoading && !inqError && (
            <div className="bg-[#1d1c21] rounded-xl border border-white/[0.08] divide-y divide-white/[0.05]">
              {filteredInquiries.length === 0 ? (
                <p className="px-4 py-8 text-center text-white/20 text-sm">No inquiries</p>
              ) : filteredInquiries.map(inq => {
                const isExpanded = expandedInqId === inq.$id;
                const isRead = inq.read;

                return (
                  <div key={inq.$id}>
                    {/* Row */}
                    <div
                      onClick={() => {
                        setExpandedInqId(isExpanded ? null : inq.$id);
                        if (!isRead) markInqRead(inq.$id);
                      }}
                      className={`px-4 py-4 cursor-pointer transition-colors hover:bg-white/[0.02] ${isRead ? 'opacity-40 hover:opacity-60' : ''}`}>
                      <div className="flex items-start gap-3">
                        {/* Avatar */}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          isRead ? 'bg-white/[0.05]' : 'bg-white/[0.10]'
                        }`}>
                          <span className={`text-xs font-semibold ${isRead ? 'text-white/30' : 'text-white'}`}>
                            {(inq.firstName?.[0] || '?').toUpperCase()}
                          </span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`text-sm truncate ${isRead ? 'text-white/40' : 'text-white font-semibold'}`}>
                                {`${inq.firstName || ''} ${inq.lastName || ''}`.trim() || 'Unknown'}
                              </span>
                              {!isRead && <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />}
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className={`text-xs ${isRead ? 'text-white/20' : 'text-white/40'}`}>
                                {new Date(inq.$createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </span>
                              <button
                                onClick={e => { e.stopPropagation(); trashInq(inq.$id); }}
                                className="text-white/10 hover:text-red-400 transition-colors p-0.5">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                          <p className={`text-xs mt-0.5 truncate ${isRead ? 'text-white/20' : 'text-white/60'}`}>
                            {inq.email || '—'}
                          </p>
                          <p className={`text-sm mt-1 truncate ${isRead ? 'text-white/20' : 'text-white/70 font-medium'}`}>
                            {inq.subject || '(No subject)'}
                          </p>
                          {!isExpanded && (
                            <p className={`text-xs mt-0.5 truncate ${isRead ? 'text-white/15' : 'text-white/30'}`}>
                              {inq.message}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expanded body */}
                    {isExpanded && (
                      <div className="px-4 pb-4 bg-white/[0.015]">
                        <div className="ml-11 pt-3 border-t border-white/[0.06]">
                          <p className="text-white text-sm leading-relaxed whitespace-pre-wrap mb-4">{inq.message}</p>
                          <div className="flex gap-2">
                            {inq.email && (
                              <button
                                onClick={() => { setReplyingTo(inq); setReplyText(''); setReplyStatus('idle'); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-white/90 text-black text-xs font-medium rounded-lg transition-colors">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10l9 6 9-6M21 10v8a2 2 0 01-2 2H5a2 2 0 01-2-2v-8" />
                                </svg>
                                Reply
                              </button>
                            )}
                            <button
                              onClick={() => trashInq(inq.$id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium rounded-lg border border-red-500/20 transition-colors">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Trash
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Chats tab ── */}
      {mainTab === 'chats' && (
        <div className="flex flex-1 overflow-hidden border-t border-white/[0.06]">

          {/* ── Left panel: conversation list ── */}
          <div className="w-72 flex-shrink-0 flex flex-col border-r border-white/[0.06] bg-black/20">

            {/* Search + New Chat */}
            <div className="p-3 space-y-2 flex-shrink-0">
              <input
                type="text" placeholder="Search chats…" value={convSearch}
                onChange={e => setConvSearch(e.target.value)}
                className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-white text-sm placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-white/20" />
              <button
                onClick={() => setNewChatOpen(true)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white hover:bg-white/90 text-black text-sm font-semibold rounded-lg transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                New Chat
              </button>
            </div>

            {/* Conversation list */}
            <div className="flex-1 overflow-y-auto">
              {convLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="w-5 h-5 border border-white/10 border-t-white/40 rounded-full animate-spin" />
                </div>
              ) : filteredConversations.length === 0 && !pendingNewChat ? (
                <p className="px-4 py-8 text-center text-white/20 text-xs">No conversations</p>
              ) : (
                <>
                  {/* Pending new chat appears first */}
                  {pendingNewChat && (
                    <div
                      onClick={() => {
                        setSelectedConvId(pendingNewChat.conversationId);
                        setSelectedConv(null);
                        setChatMessages([]);
                      }}
                      className={`flex items-center gap-3 px-3 py-3.5 cursor-pointer transition-colors border-b border-white/[0.04] ${
                        selectedConvId === pendingNewChat.conversationId ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'
                      }`}>
                      <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-sm font-semibold">
                          {pendingNewChat.clientName[0]?.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-semibold truncate">{pendingNewChat.clientName}</p>
                        <p className="text-white/30 text-xs">New conversation</p>
                      </div>
                    </div>
                  )}

                  {filteredConversations.map(conv => {
                    const isSelected = selectedConvId === conv.conversationId;
                    const preview = conv.lastMessage.startsWith('Event Proposal:')
                      ? '📅 Sent an event proposal'
                      : conv.lastMessage.startsWith('Altered Event Proposal:')
                        ? '📅 Sent an altered event proposal'
                        : conv.lastMessage;

                    return (
                      <div key={conv.conversationId}
                        onClick={() => selectConversation(conv)}
                        className={`flex items-center gap-3 px-3 py-3.5 cursor-pointer transition-colors border-b border-white/[0.04] ${
                          isSelected ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'
                        } ${!conv.hasUnread ? 'opacity-60' : ''}`}>
                        {/* Avatar */}
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                          conv.hasUnread ? 'bg-white/[0.12]' : 'bg-white/[0.05]'
                        }`}>
                          <span className={`text-sm font-semibold ${conv.hasUnread ? 'text-white' : 'text-white/40'}`}>
                            {conv.clientName[0]?.toUpperCase()}
                          </span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className={`text-sm truncate ${conv.hasUnread ? 'text-white font-semibold' : 'text-white/50'}`}>
                              {conv.clientName}
                            </span>
                            <span className="text-[10px] text-white/30 flex-shrink-0">
                              {fmtTimestamp(conv.lastTimestamp)}
                            </span>
                          </div>
                          <p className={`text-xs truncate mt-0.5 ${conv.hasUnread ? 'text-white/50' : 'text-white/25'}`}>
                            {preview}
                          </p>
                        </div>

                        {conv.hasUnread && (
                          <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center flex-shrink-0">
                            <span className="text-black text-[10px] font-bold">{conv.unreadCount}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>

          {/* ── Right panel: chat view ── */}
          <div className="flex-1 flex flex-col min-w-0 bg-black">
            {!selectedConvId && !pendingNewChat ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-white/20 text-sm">Select a conversation</p>
              </div>
            ) : (
              <>
                {/* Chat header */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.08] flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-sm font-semibold">
                      {(selectedConv?.clientName || pendingNewChat?.clientName || '?')[0]?.toUpperCase()}
                    </span>
                  </div>
                  <span className="text-white font-semibold text-sm">
                    {selectedConv?.clientName || pendingNewChat?.clientName || 'New Chat'}
                  </span>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
                  {chatLoading ? (
                    <div className="flex items-center justify-center h-32">
                      <div className="w-5 h-5 border border-white/10 border-t-white/40 rounded-full animate-spin" />
                    </div>
                  ) : chatMessages.length === 0 ? (
                    <div className="flex items-center justify-center h-32">
                      <p className="text-white/20 text-sm">No messages yet</p>
                    </div>
                  ) : (
                    chatMessages.map((msg, idx) => {
                      const fromMe = msg.fromAdmin === true; // admin messages appear on right
                      const isEventCard = !!(msg.eventType && msg.eventStatus);
                      const showDate = shouldShowDateHeader(idx);

                      return (
                        <div key={msg.$id}>
                          {/* Date separator */}
                          {showDate && (
                            <div className="flex items-center justify-center my-4">
                              <span className="text-white/25 text-[11px] bg-white/[0.05] px-3 py-1 rounded-full">
                                {fmtDateHeader(msg.timestamp)}
                              </span>
                            </div>
                          )}

                          {/* Bubble row */}
                          <div className={`flex mb-1.5 ${fromMe ? 'justify-end' : 'justify-start'}`}>
                            {isEventCard ? (
                              <EventCard
                                msg={msg} fromMe={fromMe}
                                onAccept={() => handleAcceptEvent(msg)}
                                onReject={() => handleRejectEvent(msg)}
                                accepting={acceptingEventId === msg.$id}
                              />
                            ) : (
                              <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl ${
                                fromMe
                                  ? 'bg-[#f4f2ee] text-black rounded-br-sm'
                                  : 'bg-[#2a2a2a] text-[#f4f2ee] rounded-bl-sm'
                              }`}>
                                <p className="text-sm leading-relaxed">{msg.message}</p>
                                <p className={`text-[10px] mt-1 text-right ${fromMe ? 'text-black/40' : 'text-white/30'}`}>
                                  {fmtTime(msg.timestamp)}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={chatBottomRef} />
                </div>

                {/* Input bar */}
                <div className="flex items-end gap-2 px-4 py-3 border-t border-white/[0.08] flex-shrink-0">
                  <textarea
                    value={msgInput}
                    onChange={e => setMsgInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }
                    }}
                    placeholder="Message…"
                    rows={1}
                    className="flex-1 px-4 py-2.5 bg-[#1a1a1a] rounded-2xl text-white text-sm placeholder-white/25 focus:outline-none resize-none max-h-28"
                    style={{ minHeight: '40px' }}
                  />
                  <button
                    onClick={sendChatMessage}
                    disabled={!msgInput.trim() || msgSending}
                    className="w-9 h-9 rounded-full bg-[#f4f2ee] hover:bg-white flex items-center justify-center flex-shrink-0 transition-colors disabled:opacity-30 disabled:bg-[#2a2a2a]">
                    {msgSending ? (
                      <div className="w-3.5 h-3.5 border border-black/30 border-t-black rounded-full animate-spin" />
                    ) : (
                      <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                      </svg>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── New Chat modal ── */}
      {newChatOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setNewChatOpen(false)} />
          <div className="relative w-full max-w-md bg-[#111] border border-white/10 rounded-2xl shadow-2xl z-10 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
              <p className="text-white font-semibold text-sm">New Chat</p>
              <button onClick={() => setNewChatOpen(false)} className="text-white/30 hover:text-white transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5">
              <input
                autoFocus
                type="text"
                placeholder="Search by name…"
                value={newChatSearch}
                onChange={e => {
                  setNewChatSearch(e.target.value);
                  if (newChatTimerRef.current) clearTimeout(newChatTimerRef.current);
                  newChatTimerRef.current = setTimeout(() => searchUsers(e.target.value), 300);
                }}
                className="w-full px-4 py-2.5 bg-white/[0.05] border border-white/10 rounded-xl text-white text-sm placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-white/20"
              />

              <div className="mt-3 space-y-1 max-h-64 overflow-y-auto">
                {newChatSearching && (
                  <div className="flex items-center justify-center py-6">
                    <div className="w-5 h-5 border border-white/10 border-t-white/40 rounded-full animate-spin" />
                  </div>
                )}
                {!newChatSearching && newChatSearch.length >= 2 && newChatSuggestions.length === 0 && (
                  <p className="text-white/25 text-sm text-center py-6">No users found</p>
                )}
                {newChatSuggestions.map(user => (
                  <button
                    key={user.userId}
                    onClick={() => startNewChat(user)}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/[0.06] transition-colors text-left">
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs font-semibold">{user.name[0]?.toUpperCase()}</span>
                    </div>
                    <div>
                      <p className="text-white text-sm">{user.name}</p>
                      <p className="text-white/30 text-[11px]">{user.collectionType}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Reply modal (Inquiries) ── */}
      {replyingTo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={closeReply} />
          <div className="relative w-full max-w-lg bg-[#111] border border-white/10 rounded-2xl shadow-2xl z-10 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08]">
              <div>
                <p className="text-white font-semibold text-sm">Reply to {replyingTo.firstName} {replyingTo.lastName}</p>
                <p className="text-white/40 text-xs mt-0.5">{replyingTo.email}</p>
              </div>
              <button onClick={closeReply} className="text-white/30 hover:text-white transition-colors p-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 pt-4">
              <p className="text-white/30 text-xs uppercase tracking-wider mb-2">Re: {replyingTo.subject || '(No subject)'}</p>
              <div className="border-l-2 border-white/[0.08] pl-3 mb-4 max-h-20 overflow-y-auto">
                <p className="text-white/30 text-xs leading-relaxed whitespace-pre-wrap">{replyingTo.message}</p>
              </div>
            </div>
            <div className="px-6 pb-6">
              {replyStatus === 'sent' ? (
                <div className="flex flex-col items-center py-8">
                  <div className="w-10 h-10 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-3">
                    <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-white font-medium mb-1">Reply sent</p>
                  <p className="text-white/40 text-sm">Delivered to {replyingTo.email}</p>
                  <button onClick={closeReply} className="mt-5 px-6 py-2 bg-white hover:bg-white/90 text-black text-sm font-medium rounded-lg transition-colors">Done</button>
                </div>
              ) : (
                <>
                  <textarea
                    value={replyText} onChange={e => setReplyText(e.target.value)}
                    placeholder="Write your reply…" rows={5}
                    className="w-full px-4 py-3 bg-black/40 border border-white/[0.08] rounded-xl text-white text-sm placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-white/20 resize-none" />
                  {replyStatus === 'error' && <p className="mt-2 text-red-400 text-xs">{replyError}</p>}
                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={sendReply} disabled={replySending || !replyText.trim()}
                      className="flex-1 py-2.5 bg-white hover:bg-white/90 text-black text-sm font-semibold rounded-lg transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
                      {replySending && <div className="w-3.5 h-3.5 border border-black/30 border-t-black rounded-full animate-spin" />}
                      {replySending ? 'Sending…' : 'Send Reply'}
                    </button>
                    <button onClick={closeReply} className="px-5 py-2.5 text-sm text-white/40 hover:text-white border border-white/10 hover:border-white/20 rounded-lg transition-colors">
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
