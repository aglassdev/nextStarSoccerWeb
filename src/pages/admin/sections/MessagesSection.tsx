import { useState, useEffect, useRef } from 'react';
import { Query, ID } from 'appwrite';
import { databases, databaseId, collections } from '../../../services/appwrite';
import { createCalendarEvent } from '../../../services/calendarAdmin';

// ── Accepting a session request ───────────────────────────────────────────────
// Requests from the app's "Request a Session" screens store the date as text
// ("Friday, October 9, 2026") and send only a start time; event cards made in
// the app's chat store "2026-10-09". Accepting has to turn either into a real
// calendar event and a signup for the player it's for.
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const SESSION_TYPES = ['Individual Session', 'Two Person Session', 'Small Group Session'];
const ANALYSIS_TYPES = ['Game Analysis', 'Parent Consultation'];

const toIsoDate = (s?: string): string | null => {
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/([A-Za-z]+)\s+(\d{1,2}),?\s*(\d{4})/);
  const month = m ? MONTHS.indexOf(m[1].toLowerCase()) : -1;
  if (!m || month < 0) return null;
  return `${m[3]}-${String(month + 1).padStart(2, '0')}-${m[2].padStart(2, '0')}`;
};

const to24h = (t?: string): string | null => {
  const m = String(t || '').trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!m) return null;
  let h = Number(m[1]);
  const ap = (m[3] || '').toUpperCase();
  if (ap === 'PM' && h !== 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${m[2] || '00'}`;
};

const addHour = (hhmm: string) => `${String((Number(hhmm.slice(0, 2)) + 1) % 24).padStart(2, '0')}${hhmm.slice(2)}`;
const normName = (f?: string, l?: string) => `${f || ''} ${l || ''}`.trim().toLowerCase().replace(/\s+/g, ' ');

async function findPlayer(userId: string): Promise<any | null> {
  for (const col of [collections.youthPlayers, collections.collegiatePlayers, collections.professionalPlayers]) {
    if (!col) continue;
    const r = await databases.listDocuments(databaseId, col, [Query.equal('userId', userId), Query.limit(1)]);
    if (r.documents[0]) return r.documents[0];
  }
  return null;
}

// Creates the calendar event and the player's signup for an accepted request.
// Returns what went wrong (shown to the admin), or null when everything worked.
async function createAcceptedSession(msg: ChatMsg): Promise<string | null> {
  const date = toIsoDate(msg.eventDate);
  const start = to24h(msg.eventStartTime);
  const end = msg.eventEndTime ? to24h(msg.eventEndTime) : start ? addHour(start) : null; // sessions run an hour
  if (!date || !start || !end) {
    return `The date or time couldn't be read ("${msg.eventDate || '?'}, ${msg.eventStartTime || '?'}"), so it wasn't added to the calendar.`;
  }
  const title = SESSION_TYPES.includes(msg.eventType || '') ? 'Private Session' : (msg.eventType || 'Session');
  let ev: any;
  try {
    const body = await createCalendarEvent(ANALYSIS_TYPES.includes(msg.eventType || '') ? 'analysis' : 'private', {
      title, location: msg.eventLocation || '', description: '',
      startDateTime: `${date}T${start}:00`, endDateTime: `${date}T${end}:00`,
    } as any);
    ev = body.data;
  } catch (e: any) {
    return `It couldn't be added to the calendar: ${e?.message || e}`;
  }
  if (!collections.signups || !ev?.id) return null;

  // A parent's request names the child ("For: Noah Yoseph"); parents can't be
  // signed up themselves. A player's own request signs up the player.
  const requester = msg.clientId || '';
  const forName = ((msg.message || '').match(/For:\s*(.+)/i)?.[1] || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const base = { eventID: ev.id, eventTitle: title, eventDate: ev.start?.dateTime || `${date}T${start}:00`, type: 'bill' };
  try {
    const proxies = collections.proxyChildren
      ? (await databases.listDocuments(databaseId, collections.proxyChildren, [Query.equal('parentUserId', requester), Query.limit(50)])).documents as any[]
      : [];
    const links = collections.familyRelationships001
      ? (await databases.listDocuments(databaseId, collections.familyRelationships001, [Query.equal('parentUserId', requester), Query.equal('status', 'active'), Query.limit(50)])).documents as any[]
      : [];
    const proxy = forName ? proxies.find(p => normName(p.firstName, p.lastName) === forName) : undefined;
    if (proxy) {
      await databases.createDocument(databaseId, collections.signups, ID.unique(), {
        ...base, firstName: proxy.firstName, lastName: proxy.lastName,
        userId: requester, onBehalfOfUserId: null, onBehalfOfProxyId: proxy.proxyId, isProxySignup: true, parentSignupId: requester,
      });
      return null;
    }
    for (const link of links.filter(l => l.childUserId)) {
      const kid = await findPlayer(link.childUserId);
      if (kid && forName && normName(kid.firstName, kid.lastName) === forName) {
        await databases.createDocument(databaseId, collections.signups, ID.unique(), {
          ...base, firstName: kid.firstName, lastName: kid.lastName,
          userId: requester, onBehalfOfUserId: link.childUserId, onBehalfOfProxyId: null, isProxySignup: false, parentSignupId: requester,
        });
        return null;
      }
    }
    if (proxies.length || links.length) {
      return `It's on the calendar, but no player was signed up: couldn't match ${forName ? `"${forName}"` : 'the request'} to one of this family's children. Add them in the Event Assistant.`;
    }
    const player = await findPlayer(requester);
    if (!player) return "It's on the calendar, but no player was signed up: the requester has no player profile or children on file.";
    await databases.createDocument(databaseId, collections.signups, ID.unique(), {
      ...base, firstName: player.firstName, lastName: player.lastName,
      userId: requester, onBehalfOfUserId: null, onBehalfOfProxyId: null, isProxySignup: false,
    });
    return null;
  } catch (e: any) {
    return `It's on the calendar, but the player couldn't be signed up: ${e?.message || e}`;
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface WebConversation {
  conversationId: string;
  clientId: string;
  clientName: string;
  lastMessage: string;
  lastTimestamp: string;
  lastFromAdmin: boolean; // true = admin sent last (dim), false = client sent last (bright)
  unreadCount: number;
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

interface UserSuggestion { userId: string; name: string; type: string; }

// ── Helpers ───────────────────────────────────────────────────────────────────
function genConvId() {
  return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function fmtAgo(ts: string) {
  const d = new Date(ts); const now = Date.now();
  const diff = Math.floor((now - d.getTime()) / 86400000);
  if (diff === 0) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  if (diff === 1) return 'Yesterday';
  if (diff <= 7) return `${diff}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtDateHeader(ts: string) {
  const d = new Date(ts);
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function fmtTime(ts: string) {
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

// Names live in whichever profile collection the client signed up through.
// Look every client up at once: one query per collection (in batches of 100
// ids, Appwrite's cap) all in parallel, instead of one client at a time. With
// ~120 conversations that was ~160 requests back to back and over 20 seconds.
// Names are kept for the session so reopening Chats doesn't ask again.
const nameCache = new Map<string, string>();

async function resolveClientNames(clientIds: string[]): Promise<Map<string, string>> {
  const missing = [...new Set(clientIds)].filter(id => id && id !== 'admin' && !nameCache.has(id));
  if (missing.length) {
    const colls = [
      collections.parentUsers, collections.youthPlayers,
      collections.collegiatePlayers, collections.professionalPlayers,
    ].filter(Boolean) as string[];
    // Earlier collections win, matching the order the old lookup tried them in.
    const found = await Promise.all(colls.map(async c => {
      const names = new Map<string, string>();
      for (let i = 0; i < missing.length; i += 100) {
        try {
          const r = await databases.listDocuments(databaseId, c, [
            Query.equal('userId', missing.slice(i, i + 100)),
            Query.select(['userId', 'firstName', 'lastName']),
            Query.limit(1000),
          ]);
          for (const d of r.documents as any[]) {
            const n = `${d.firstName || ''} ${d.lastName || ''}`.trim();
            if (n && !names.has(d.userId)) names.set(d.userId, n);
          }
        } catch { /* leave these unresolved */ }
      }
      return names;
    }));
    for (const id of missing) {
      const hit = found.find(m => m.has(id));
      if (hit) nameCache.set(id, hit.get(id)!);
    }
  }
  return nameCache;
}

async function buildConversations(docs: any[]): Promise<WebConversation[]> {
  const map = new Map<string, any[]>();
  for (const m of docs) {
    const cid = m.conversationId || m.$id;
    if (!map.has(cid)) map.set(cid, []);
    map.get(cid)!.push(m);
  }

  const result: WebConversation[] = [];
  for (const [convId, msgs] of map) {
    msgs.sort((a, b) =>
      new Date(b.timestamp || b.$createdAt).getTime() -
      new Date(a.timestamp || a.$createdAt).getTime()
    );
    const latest = msgs[0];
    const clientId =
      msgs.find((m: any) => m.clientId)?.clientId ||
      msgs.find((m: any) => m.userId && m.userId !== 'admin')?.userId || '';

    result.push({
      conversationId: convId,
      clientId,
      clientName: 'Unknown',
      lastMessage: latest.message || '',
      lastTimestamp: latest.timestamp || latest.$createdAt,
      lastFromAdmin: latest.fromAdmin === true,
      unreadCount: msgs.filter((m: any) => !m.read && m.fromAdmin === false).length,
    });
  }

  const names = await resolveClientNames(result.map(c => c.clientId));
  for (const c of result) c.clientName = names.get(c.clientId) || 'Unknown';

  result.sort((a, b) =>
    new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime()
  );
  return result;
}

// The last list loaded, shown straight away when Chats is reopened while a
// fresh copy loads behind it.
let cachedConversations: WebConversation[] | null = null;

// ── Event card bubble ─────────────────────────────────────────────────────────
const EventBubble = ({ msg, fromMe, onAccept, onReject, accepting }: {
  msg: ChatMsg; fromMe: boolean;
  onAccept: () => void; onReject: () => void; accepting: boolean;
}) => {
  const statusColors: Record<string, string> = {
    accepted: 'bg-green-700/80 text-white',
    rejected: 'bg-red-800/80 text-white',
    altered: 'bg-yellow-600/80 text-black',
  };
  const isProposed = msg.eventStatus === 'proposed';
  const showActions = isProposed && !fromMe;

  return (
    <div className={`max-w-[68%] rounded-2xl p-4 ${fromMe ? 'bg-[#f4f2ee] text-black rounded-br-sm' : 'bg-[#2a2a2a] text-[#f4f2ee] rounded-bl-sm'}`}>
      <div className="flex items-center gap-2 mb-2">
        <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className="text-sm font-semibold">{msg.eventType || 'Event'}</span>
      </div>
      {msg.eventDate && <p className={`text-xs mb-1 ${fromMe ? 'text-black/60' : 'text-white/60'}`}>Date: {msg.eventDate}</p>}
      {msg.eventLocation && <p className={`text-xs mb-1 ${fromMe ? 'text-black/60' : 'text-white/60'}`}>Location: {msg.eventLocation}</p>}
      {(msg.eventStartTime || msg.eventEndTime) && (
        <p className={`text-xs mb-1 ${fromMe ? 'text-black/60' : 'text-white/60'}`}>
          Time: {msg.eventStartTime}{msg.eventEndTime ? ` – ${msg.eventEndTime}` : ''}
        </p>
      )}
      {msg.eventStatus && msg.eventStatus !== 'proposed' && (
        <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-2 ${statusColors[msg.eventStatus] || 'bg-white/10 text-white'}`}>
          {msg.eventStatus.charAt(0).toUpperCase() + msg.eventStatus.slice(1)}
        </span>
      )}
      {showActions && (
        <div className="flex gap-2 mt-3">
          <button onClick={onAccept} disabled={accepting}
            className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-40">
            Accept
          </button>
          <button onClick={onReject} disabled={accepting}
            className="px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-40">
            Reject
          </button>
        </div>
      )}
      <p className={`text-[10px] mt-2 text-right ${fromMe ? 'text-black/30' : 'text-white/25'}`}>{fmtTime(msg.timestamp)}</p>
    </div>
  );
};

// ── Main ──────────────────────────────────────────────────────────────────────
const MessagesSection = () => {
  const [conversations, setConversations] = useState<WebConversation[]>(cachedConversations ?? []);
  const [convLoading, setConvLoading] = useState(!cachedConversations);
  const [convSearch, setConvSearch] = useState('');

  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [selectedConv, setSelectedConv] = useState<WebConversation | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  const [msgInput, setMsgInput] = useState('');
  const [msgSending, setMsgSending] = useState(false);
  const [acceptingId, setAcceptingId] = useState('');

  // New chat
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState('');
  const [newChatResults, setNewChatResults] = useState<UserSuggestion[]>([]);
  const [newChatSearching, setNewChatSearching] = useState(false);
  const [pendingChat, setPendingChat] = useState<{ conversationId: string; clientId: string; clientName: string } | null>(null);

  const threadRef = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { fetchConversations(); }, []);
  // Keep the remembered list in step with reads and sends made here.
  useEffect(() => { if (cachedConversations) cachedConversations = conversations; }, [conversations]);

  const fetchConversations = async () => {
    if (!collections.messages) { setConvLoading(false); return; }
    if (!cachedConversations) setConvLoading(true);
    try {
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
      cachedConversations = await buildConversations(all);
      setConversations(cachedConversations);
    } catch { /* ignore */ }
    finally { setConvLoading(false); }
  };

  const loadChat = async (convId: string) => {
    if (!collections.messages) return;
    setChatLoading(true);
    try {
      const res = await databases.listDocuments(databaseId, collections.messages, [
        Query.equal('conversationId', convId), Query.orderAsc('timestamp'), Query.limit(500),
      ]);
      const msgs = res.documents as unknown as ChatMsg[];
      setChatMessages(msgs);
      // Mark unread client messages as read in the background; the thread
      // shows without waiting for those saves.
      const unread = msgs.filter(m => !m.read && m.fromAdmin === false);
      unread.forEach(m =>
        databases.updateDocument(databaseId, collections.messages!, m.$id, { read: true }).catch(() => {})
      );
      if (unread.length) {
        setConversations(prev => prev.map(c =>
          c.conversationId === convId ? { ...c, unreadCount: 0 } : c
        ));
      }
    } catch { /* ignore */ }
    finally { setChatLoading(false); }
  };

  // Keep the thread on its newest message. Opening a chat jumps straight there
  // once the spinner gives way to the messages; a new message glides in.
  // Scrolling the thread itself (not scrollIntoView) leaves the page alone.
  const scrolledConv = useRef<string | null>(null);
  useEffect(() => {
    const el = threadRef.current;
    if (!el || chatLoading) return;
    const opened = scrolledConv.current !== selectedConvId;
    scrolledConv.current = selectedConvId;
    el.scrollTo({ top: el.scrollHeight, behavior: opened ? 'auto' : 'smooth' });
  }, [chatMessages, chatLoading, selectedConvId]);

  const selectConv = (conv: WebConversation) => {
    setSelectedConvId(conv.conversationId);
    setSelectedConv(conv);
    setPendingChat(null);
    loadChat(conv.conversationId);
  };

  const sendMessage = async () => {
    if (!msgInput.trim() || msgSending) return;
    const text = msgInput.trim();
    const convId = selectedConvId || pendingChat?.conversationId;
    const clientId = selectedConv?.clientId || pendingChat?.clientId;
    if (!convId || !clientId || !collections.messages) return;

    setMsgSending(true);
    setMsgInput('');
    try {
      const doc = await databases.createDocument(databaseId, collections.messages, ID.unique(), {
        message: text, fromAdmin: true,
        firstName: 'Admin', lastName: '',
        userId: 'admin', clientId,
        conversationId: convId,
        timestamp: new Date().toISOString(),
        read: false,
      });

      const newMsg: ChatMsg = {
        $id: doc.$id, conversationId: convId, clientId,
        fromAdmin: true, firstName: 'Admin', lastName: '',
        message: text, timestamp: (doc as any).timestamp || new Date().toISOString(), read: false,
      };
      setChatMessages(prev => [...prev, newMsg]);

      if (pendingChat) {
        const newConv: WebConversation = {
          conversationId: convId, clientId: pendingChat.clientId,
          clientName: pendingChat.clientName, lastMessage: text,
          lastTimestamp: newMsg.timestamp, lastFromAdmin: true, unreadCount: 0,
        };
        setConversations(prev => [newConv, ...prev]);
        setSelectedConv(newConv);
        setSelectedConvId(convId);
        setPendingChat(null);
      } else {
        setConversations(prev => prev.map(c =>
          c.conversationId === convId
            ? { ...c, lastMessage: text, lastTimestamp: newMsg.timestamp, lastFromAdmin: true }
            : c
        ));
      }
    } catch { /* ignore */ }
    finally { setMsgSending(false); }
  };

  const acceptEvent = async (msg: ChatMsg) => {
    if (acceptingId || !collections.messages) return;
    setAcceptingId(msg.$id);
    try {
      await databases.updateDocument(databaseId, collections.messages, msg.$id, { eventStatus: 'accepted' });
      const doc = await databases.createDocument(databaseId, collections.messages, ID.unique(), {
        message: 'Event Accepted', fromAdmin: true,
        firstName: 'Admin', lastName: '', userId: 'admin',
        clientId: msg.clientId, conversationId: msg.conversationId,
        timestamp: new Date().toISOString(), read: false,
      });
      setChatMessages(prev => [
        ...prev.map(m => m.$id === msg.$id ? { ...m, eventStatus: 'accepted' } : m),
        { ...(doc as any), fromAdmin: true },
      ]);
      const problem = await createAcceptedSession(msg);
      if (problem) window.alert(`Event accepted, but there's a problem:\n\n${problem}`);
    } catch { /* ignore */ }
    finally { setAcceptingId(''); }
  };

  const rejectEvent = async (msg: ChatMsg) => {
    if (acceptingId || !collections.messages) return;
    setAcceptingId(msg.$id);
    try {
      await databases.updateDocument(databaseId, collections.messages, msg.$id, { eventStatus: 'rejected' });
      const doc = await databases.createDocument(databaseId, collections.messages, ID.unique(), {
        message: 'Event Rejected', fromAdmin: true,
        firstName: 'Admin', lastName: '', userId: 'admin',
        clientId: msg.clientId, conversationId: msg.conversationId,
        timestamp: new Date().toISOString(), read: false,
      });
      setChatMessages(prev => [
        ...prev.map(m => m.$id === msg.$id ? { ...m, eventStatus: 'rejected' } : m),
        { ...(doc as any), fromAdmin: true },
      ]);
    } catch { /* ignore */ }
    finally { setAcceptingId(''); }
  };

  // New chat search
  const searchUsers = async (q: string) => {
    if (q.length < 2) { setNewChatResults([]); return; }
    setNewChatSearching(true);
    try {
      const ql = q.toLowerCase();
      const defs: [string, string][] = ([
        ['Parent', collections.parentUsers],
        ['Youth', collections.youthPlayers],
        ['Collegiate', collections.collegiatePlayers],
        ['Professional', collections.professionalPlayers],
      ] as [string, string | undefined][]).filter((p): p is [string, string] => !!p[1]);

      const out: UserSuggestion[] = [];
      await Promise.all(defs.map(async ([type, collId]) => {
        try {
          const r = await databases.listDocuments(databaseId, collId, [Query.limit(200)]);
          for (const d of r.documents as any[]) {
            const name = `${d.firstName || ''} ${d.lastName || ''}`.trim();
            if (name.toLowerCase().includes(ql) && d.userId)
              out.push({ userId: d.userId, name, type });
          }
        } catch { /* ignore */ }
      }));
      setNewChatResults(out.slice(0, 8));
    } catch { /* ignore */ }
    finally { setNewChatSearching(false); }
  };

  const startNewChat = (user: UserSuggestion) => {
    const convId = genConvId();
    setPendingChat({ conversationId: convId, clientId: user.userId, clientName: user.name });
    setSelectedConvId(convId);
    setSelectedConv(null);
    setChatMessages([]);
    setNewChatOpen(false);
    setNewChatSearch('');
    setNewChatResults([]);
  };

  // Filtered list
  const filtered = conversations.filter(c =>
    !convSearch || c.clientName.toLowerCase().includes(convSearch.toLowerCase())
  );

  const showDateHeader = (idx: number) => {
    if (idx === 0) return true;
    return new Date(chatMessages[idx].timestamp).toDateString() !==
      new Date(chatMessages[idx - 1].timestamp).toDateString();
  };

  const chatName = selectedConv?.clientName || pendingChat?.clientName;

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Left: conversation list ── */}
      <div className="w-[272px] flex-shrink-0 flex flex-col border-r border-white/[0.06] bg-black/10">

        {/* Search + new chat */}
        <div className="p-3 space-y-2 flex-shrink-0 border-b border-white/[0.06]">
          <input type="text" placeholder="Search…" value={convSearch}
            onChange={e => setConvSearch(e.target.value)}
            className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.07] rounded-lg text-white text-sm placeholder-white/20 focus:outline-none" />
          <button onClick={() => setNewChatOpen(true)}
            className="w-full flex items-center justify-center gap-1.5 py-2 bg-white hover:bg-white/90 text-black text-[13px] font-semibold rounded-lg transition-colors">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Chat
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {convLoading ? (
            <div className="flex items-center justify-center h-24">
              <div className="w-4 h-4 border border-white/10 border-t-white/40 rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {pendingChat && (
                <div
                  onClick={() => { setSelectedConvId(pendingChat.conversationId); setSelectedConv(null); setChatMessages([]); }}
                  className={`flex items-center gap-3 px-3 py-3 cursor-pointer border-b border-white/[0.04] transition-colors ${
                    selectedConvId === pendingChat.conversationId ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'
                  }`}>
                  <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-sm font-semibold">{pendingChat.clientName[0]?.toUpperCase()}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-white text-sm font-semibold truncate">{pendingChat.clientName}</p>
                    <p className="text-white/30 text-xs">New conversation</p>
                  </div>
                </div>
              )}

              {filtered.length === 0 && !pendingChat && (
                <p className="px-4 py-8 text-center text-white/20 text-xs">No conversations</p>
              )}

              {filtered.map(conv => {
                const isSelected = selectedConvId === conv.conversationId;
                // dim = admin sent last (waiting on client). bright = client sent last (needs response)
                const isDim = conv.lastFromAdmin;
                const preview = conv.lastMessage.startsWith('Event Proposal:')
                  ? '📅 Event proposal'
                  : conv.lastMessage.startsWith('Altered Event Proposal:')
                    ? '📅 Altered proposal'
                    : conv.lastMessage;

                return (
                  <div key={conv.conversationId}
                    onClick={() => selectConv(conv)}
                    className={`flex items-center gap-3 px-3 py-3 cursor-pointer border-b border-white/[0.04] transition-colors ${
                      isSelected ? 'bg-white/[0.08]' : 'hover:bg-white/[0.04]'
                    } ${isDim ? 'opacity-50' : ''}`}>

                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isDim ? 'bg-white/[0.05]' : 'bg-white/[0.12]'
                    }`}>
                      <span className={`text-sm font-semibold ${isDim ? 'text-white/40' : 'text-white'}`}>
                        {conv.clientName[0]?.toUpperCase()}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className={`text-sm truncate ${isDim ? 'text-white/50' : 'text-white font-semibold'}`}>
                          {conv.clientName}
                        </span>
                        <span className="text-[10px] text-white/25 flex-shrink-0">{fmtAgo(conv.lastTimestamp)}</span>
                      </div>
                      <p className={`text-xs truncate mt-0.5 ${isDim ? 'text-white/25' : 'text-white/50'}`}>{preview}</p>
                    </div>

                    {/* Badge: only when client sent last (unread) */}
                    {!isDim && conv.unreadCount > 0 && (
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

      {/* ── Right: chat view ── */}
      <div className="flex-1 flex flex-col min-w-0 bg-black">
        {!selectedConvId && !pendingChat ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-white/15 text-sm">Select a conversation</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/[0.07] flex-shrink-0 bg-[#0d0b09]">
              <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-semibold">{chatName?.[0]?.toUpperCase()}</span>
              </div>
              <span className="text-white text-sm font-semibold">{chatName || 'New Chat'}</span>
            </div>

            {/* Messages */}
            <div ref={threadRef} className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-1">
              {chatLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="w-5 h-5 border border-white/10 border-t-white/40 rounded-full animate-spin" />
                </div>
              ) : chatMessages.length === 0 ? (
                <div className="flex items-center justify-center h-32">
                  <p className="text-white/15 text-sm">No messages yet</p>
                </div>
              ) : chatMessages.map((msg, idx) => {
                const fromMe = msg.fromAdmin === true;
                const isEvent = !!(msg.eventType && msg.eventStatus);

                return (
                  <div key={msg.$id}>
                    {showDateHeader(idx) && (
                      <div className="flex justify-center my-4">
                        <span className="text-white/20 text-[11px] bg-white/[0.04] px-3 py-1 rounded-full">
                          {fmtDateHeader(msg.timestamp)}
                        </span>
                      </div>
                    )}
                    <div className={`flex mb-1.5 ${fromMe ? 'justify-end' : 'justify-start'}`}>
                      {isEvent ? (
                        <EventBubble msg={msg} fromMe={fromMe}
                          onAccept={() => acceptEvent(msg)}
                          onReject={() => rejectEvent(msg)}
                          accepting={acceptingId === msg.$id} />
                      ) : (
                        <div className={`max-w-[68%] px-4 py-2.5 rounded-2xl ${
                          fromMe
                            ? 'bg-[#f4f2ee] text-black rounded-br-sm'
                            : 'bg-[#2a2a2a] text-[#f4f2ee] rounded-bl-sm'
                        }`}>
                          <p className="text-sm leading-relaxed">{msg.message}</p>
                          <p className={`text-[10px] mt-1 text-right ${fromMe ? 'text-black/30' : 'text-white/25'}`}>
                            {fmtTime(msg.timestamp)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Input */}
            <div className="flex items-end gap-2 px-4 py-3 border-t border-white/[0.07] flex-shrink-0 bg-[#0d0b09]">
              <textarea
                value={msgInput}
                onChange={e => setMsgInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="Message…"
                rows={1}
                className="flex-1 px-4 py-2.5 bg-[#1a1a1a] rounded-2xl text-white text-sm placeholder-white/20 focus:outline-none resize-none max-h-28 border border-white/[0.06]"
                style={{ minHeight: '40px' }}
              />
              <button onClick={sendMessage} disabled={!msgInput.trim() || msgSending}
                className="w-9 h-9 rounded-full bg-[#f4f2ee] hover:bg-white flex items-center justify-center flex-shrink-0 transition-colors disabled:opacity-25 disabled:bg-[#2a2a2a]">
                {msgSending
                  ? <div className="w-3.5 h-3.5 border border-black/30 border-t-black rounded-full animate-spin" />
                  : <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                }
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── New chat modal ── */}
      {newChatOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setNewChatOpen(false)} />
          <div className="relative w-full max-w-sm bg-[#111] border border-white/10 rounded-2xl shadow-2xl z-10">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
              <p className="text-white font-semibold text-sm">New Chat</p>
              <button onClick={() => setNewChatOpen(false)} className="text-white/25 hover:text-white transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              <input autoFocus type="text" placeholder="Search by name…"
                value={newChatSearch}
                onChange={e => {
                  setNewChatSearch(e.target.value);
                  if (searchTimer.current) clearTimeout(searchTimer.current);
                  searchTimer.current = setTimeout(() => searchUsers(e.target.value), 300);
                }}
                className="w-full px-4 py-2.5 bg-white/[0.05] border border-white/[0.08] rounded-xl text-white text-sm placeholder-white/20 focus:outline-none" />
              <div className="mt-3 space-y-1 max-h-56 overflow-y-auto">
                {newChatSearching && (
                  <div className="flex justify-center py-5">
                    <div className="w-4 h-4 border border-white/10 border-t-white/40 rounded-full animate-spin" />
                  </div>
                )}
                {!newChatSearching && newChatSearch.length >= 2 && newChatResults.length === 0 && (
                  <p className="text-white/20 text-sm text-center py-5">No users found</p>
                )}
                {newChatResults.map(u => (
                  <button key={u.userId} onClick={() => startNewChat(u)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.06] transition-colors text-left">
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs font-semibold">{u.name[0]?.toUpperCase()}</span>
                    </div>
                    <div>
                      <p className="text-white text-sm">{u.name}</p>
                      <p className="text-white/30 text-[11px]">{u.type}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessagesSection;
