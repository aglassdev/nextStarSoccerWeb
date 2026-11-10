import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ID, Query } from 'appwrite';
import { useAuth } from '../../contexts/AuthContext';
import { databases, databaseId, collections } from '../../services/appwrite';
import { useAccount } from '../account/AccountContext';
import { AccountPageHeader } from '../account/AccountLayout';
import { formatInboxDate, previewText } from '../account/inbox/chatService';

// Coach Dashboard → Inbox, as the app's CoachInboxScreen: session requests
// and chats routed to this coach (messages stamped with their coachId), with
// All / Unread / Read, and the chat beside the list on a wide screen. A request card can be
// accepted, changed or declined, with the same message writes as the app's
// chat. Requests never carry a location, so accepting sends the confirmed
// details back as a proposal; the session is booked on the calendar when the
// family accepts it in the app.

interface Msg {
  $id: string;
  conversationId: string;
  firstName?: string;
  lastName?: string;
  message?: string;
  userId?: string;
  clientId?: string;
  fromAdmin?: boolean;
  coachId?: string;
  timestamp?: string;
  read?: boolean;
  eventType?: string;
  eventDate?: string;
  eventLocation?: string;
  eventStartTime?: string;
  eventEndTime?: string;
  eventStatus?: 'proposed' | 'accepted' | 'rejected' | 'altered';
  $createdAt: string;
}

const EVENT_TYPES = ['Individual Session', 'Two Person Session', 'Small Group Session', 'Game Analysis', 'Parent Consultation', 'Player Report'];
const LOCATION_OPTIONAL = ['Game Analysis', 'Parent Consultation', 'Player Report'];
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

const when = (m: Msg) => Date.parse(m.timestamp || m.$createdAt) || 0;
const forLine = (text?: string) => (text || '').match(/^For:\s*.+$/im)?.[0] || '';

/** "Monday, November 9, 2026" / "Nov 9, 2026" / "2026-11-09" → "2026-11-09" */
const toIsoDate = (s?: string) => {
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/([A-Za-z]+)\s+(\d{1,2}),?\s*(\d{4})/);
  const month = m ? MONTHS.findIndex((x) => x.startsWith(m[1].toLowerCase().slice(0, 3))) : -1;
  return m && month >= 0 ? `${m[3]}-${String(month + 1).padStart(2, '0')}-${m[2].padStart(2, '0')}` : '';
};
/** "5:00 PM" → "17:00" */
const to24 = (s?: string) => {
  const m = (s || '').match(/(\d{1,2}):(\d{2})\s*([AP]M)?/i);
  if (!m) return '';
  let h = Number(m[1]) % 12;
  if (m[3]?.toUpperCase() === 'PM') h += 12;
  if (!m[3] && Number(m[1]) >= 12) h = Number(m[1]);
  return `${String(h).padStart(2, '0')}:${m[2]}`;
};
/** "17:00" → "5:00 PM" */
const to12 = (s: string) => {
  const [h, mm] = s.split(':').map(Number);
  return `${h % 12 || 12}:${String(mm).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};
const plusHour = (s: string) => {
  const [h, mm] = s.split(':').map(Number);
  return `${String((h + 1) % 24).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};
const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return y ? new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : iso;
};

const inputClass = 'w-full px-3 py-2 bg-[#1a1a1a] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20 [color-scheme:dark]';

type Filter = 'all' | 'unread' | 'read';

const CoachInboxPage = () => {
  const { user } = useAuth();
  const { profile } = useAccount();
  const first = (profile?.firstName || user?.name?.split(' ')[0] || '').trim();
  const last = (profile?.lastName || user?.name?.split(' ').slice(1).join(' ') || '').trim();

  const [messages, setMessages] = useState<Msg[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [form, setForm] = useState<{ msg: Msg; mode: 'confirm' | 'alter'; type: string; date: string; start: string; end: string; location: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const threadRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const r = await databases.listDocuments(databaseId, collections.messages, [
        Query.equal('coachId', user.$id), Query.orderDesc('$createdAt'), Query.limit(1000),
      ]);
      setMessages(r.documents as any);
    } catch (e: any) {
      setError(e?.message || 'Could not load requests.');
      setMessages([]);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const threads = useMemo(() => {
    const by: Record<string, Msg[]> = {};
    for (const m of messages || []) (by[m.conversationId] ||= []).push(m);
    return Object.entries(by)
      .map(([id, list]) => {
        const sorted = [...list].sort((a, b) => when(a) - when(b));
        const client = sorted.find((m) => !m.fromAdmin);
        return {
          id,
          list: sorted,
          clientId: client?.clientId || client?.userId || sorted[0].clientId || '',
          name: `${client?.firstName || ''} ${client?.lastName || ''}`.trim() || 'Client',
          last: sorted[sorted.length - 1],
          pending: sorted.filter((m) => m.eventStatus === 'proposed' && !m.fromAdmin),
          unread: sorted.filter((m) => !m.fromAdmin && !m.read).length,
        };
      })
      .sort((a, b) => (b.pending.length ? 1 : 0) - (a.pending.length ? 1 : 0) || when(b.last) - when(a.last));
  }, [messages]);

  const thread = threads.find((t) => t.id === openId) || null;

  // Opening a thread marks the family's messages read, and scrolls to the latest.
  useEffect(() => {
    if (!thread) return;
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
    const unread = thread.list.filter((m) => !m.fromAdmin && !m.read);
    if (unread.length) {
      Promise.all(unread.map((m) => databases.updateDocument(databaseId, collections.messages, m.$id, { read: true }).catch(() => {})))
        .then(() => setMessages((prev) => (prev || []).map((m) => (unread.some((u) => u.$id === m.$id) ? { ...m, read: true } : m))));
    }
  }, [openId, thread?.list.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = async (data: Partial<Msg>) => {
    if (!user || !thread) return;
    const payload: Record<string, any> = {
      firstName: first,
      lastName: last,
      userId: user.$id,
      clientId: thread.clientId,
      fromAdmin: true,
      conversationId: thread.id,
      coachId: user.$id,
      timestamp: new Date().toISOString(),
      read: false,
      ...data,
    };
    Object.keys(payload).forEach((k) => (payload[k] === undefined || payload[k] === '') && k !== 'message' && delete payload[k]);
    return databases.createDocument(databaseId, collections.messages, ID.unique(), payload);
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      await load();
    } catch (e: any) {
      setError(e?.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const decline = (m: Msg) =>
    confirm('Decline this request?') &&
    run(async () => {
      await databases.updateDocument(databaseId, collections.messages, m.$id, { eventStatus: 'rejected' });
      await send({ message: 'Event Rejected' });
    });

  const openForm = (m: Msg, mode: 'confirm' | 'alter') => {
    const start = to24(m.eventStartTime);
    setForm({
      msg: m,
      mode,
      type: m.eventType || EVENT_TYPES[0],
      date: toIsoDate(m.eventDate),
      start,
      end: to24(m.eventEndTime) || (start ? plusHour(start) : ''),
      location: m.eventLocation || '',
    });
  };

  const sendForm = () => {
    if (!form) return;
    const needsLocation = !LOCATION_OPTIONAL.includes(form.type) && !form.location.trim();
    if (!form.date || !form.start || !form.end) return setError('Fill in the date and times.');
    if (needsLocation) return setError('Add the location.');
    run(async () => {
      await databases.updateDocument(databaseId, collections.messages, form.msg.$id, { eventStatus: 'altered' });
      await send({
        message: [
          form.mode === 'confirm' ? 'Please confirm the session details and location.' : `Altered Event Proposal: ${form.type}`,
          forLine(form.msg.message),
        ].filter(Boolean).join('\n'),
        eventType: form.type,
        eventDate: form.date,
        eventLocation: form.location.trim(),
        eventStartTime: to12(form.start),
        eventEndTime: to12(form.end),
        eventStatus: 'proposed',
      });
      setForm(null);
    });
  };

  const sendReply = () => {
    const text = reply.trim();
    if (!text) return;
    run(async () => {
      await send({ message: text });
      setReply('');
    });
  };

  const header = <AccountPageHeader title="Inbox" />;

  if (messages === null) {
    return (
      <div>
        {header}
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-white/40 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const shown = threads.filter((t) => (filter === 'unread' ? t.unread > 0 : filter === 'read' ? t.unread === 0 : true));
  const preview = (m: Msg) =>
    m.eventType && m.eventStatus
      ? m.eventStatus === 'altered' ? 'Sent an altered event proposal' : 'Sent an event proposal'
      : previewText(m.message || '');

  return (
    <div>
    {header}
    <div className="grid md:grid-cols-[340px_1fr] gap-4 md:h-[calc(100vh-15rem)] min-h-[480px]">
      {/* Conversations */}
      <aside className={`bg-[#0b0b0b] border border-white/10 rounded-2xl overflow-hidden flex flex-col ${thread ? 'hidden md:flex' : 'flex'}`}>
        <div role="tablist" aria-label="Show" className="px-3 py-3 border-b border-white/10 flex gap-1.5">
          {(['all', 'unread', 'read'] as Filter[]).map((f) => (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={`h-8 px-3.5 rounded-full text-[13px] capitalize border transition-colors ${
                filter === f ? 'bg-white text-black border-white font-semibold' : 'border-white/15 text-white/60 hover:text-white hover:border-white/35'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto">
          {shown.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-10 px-4">
              {filter === 'unread' ? 'No unread chats' : filter === 'read' ? 'No read chats' : 'No chats yet. Session requests that name you arrive here.'}
            </p>
          ) : shown.map((t) => (
            <button key={t.id} onClick={() => { setOpenId(t.id); setForm(null); }}
              className={`w-full text-left px-4 py-3.5 border-b border-white/[0.06] hover:bg-white/[0.04] flex items-start gap-3 ${openId === t.id ? 'bg-white/[0.06]' : ''}`}>
              <span className="w-10 h-10 rounded-full bg-white/10 text-white font-semibold flex items-center justify-center flex-shrink-0">
                {t.name[0]?.toUpperCase() || '?'}
              </span>
              <span className="flex-1 min-w-0">
                <span className="flex items-center justify-between gap-2">
                  <span className={`text-[15px] truncate ${t.unread ? 'text-white font-semibold' : 'text-white/85'}`}>{t.name}</span>
                  <span className="text-[#777] text-xs flex-shrink-0">{formatInboxDate(t.last.timestamp || t.last.$createdAt)}</span>
                </span>
                <span className="flex items-center justify-between gap-2 mt-0.5">
                  <span className="text-gray-500 text-[13px] truncate">{preview(t.last)}</span>
                  {t.unread > 0 ? (
                    <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-white text-black text-[11px] font-bold flex items-center justify-center flex-shrink-0">{t.unread}</span>
                  ) : t.pending.length > 0 ? (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-yellow-500/20 text-yellow-300 flex-shrink-0">Request</span>
                  ) : null}
                </span>
              </span>
            </button>
          ))}
        </div>
      </aside>

      {/* Conversation */}
      <section className={`bg-[#0b0b0b] border border-white/10 rounded-2xl overflow-hidden flex-col ${thread ? 'flex' : 'hidden md:flex'}`}>
        {!thread ? (
          <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">Choose a conversation</div>
        ) : (
          <>
            <div className="px-4 py-3 border-b border-white/10 flex items-center gap-3">
              <button onClick={() => setOpenId(null)} className="md:hidden text-gray-400" aria-label="Back">←</button>
              <p className="text-white text-sm font-semibold">{thread.name}</p>
            </div>
            <div ref={threadRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {thread.list.map((m) => {
                const mine = !!m.fromAdmin;
                const isCard = !!m.eventType && !!m.eventStatus;
                return (
                  <div key={m.$id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${mine ? 'bg-white text-black' : 'bg-white/[0.07] text-white'}`}>
                      {isCard ? (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold">{m.eventType}</p>
                            <span className={`text-[10px] uppercase tracking-wider ${mine ? 'text-black/50' : 'text-white/50'}`}>{m.eventStatus}</span>
                          </div>
                          <p className={`text-xs ${mine ? 'text-black/70' : 'text-white/70'}`}>
                            {m.eventDate ? fmtDate(toIsoDate(m.eventDate) || m.eventDate) : 'No date'}
                            {m.eventStartTime ? ` · ${m.eventStartTime}${m.eventEndTime ? `–${m.eventEndTime}` : ''}` : ''}
                            {m.eventLocation ? ` · ${m.eventLocation}` : ''}
                          </p>
                          {m.message && <p className="text-sm whitespace-pre-wrap">{m.message}</p>}
                          {!mine && m.eventStatus === 'proposed' && (
                            <div className="flex flex-wrap gap-2 pt-1.5">
                              <button disabled={busy} onClick={() => openForm(m, 'confirm')}
                                className="px-3 py-1.5 bg-white text-black text-xs font-semibold rounded-lg disabled:opacity-40">Accept</button>
                              <button disabled={busy} onClick={() => openForm(m, 'alter')}
                                className="px-3 py-1.5 border border-white/25 text-white text-xs font-semibold rounded-lg disabled:opacity-40">Suggest changes</button>
                              <button disabled={busy} onClick={() => decline(m)}
                                className="px-3 py-1.5 text-white/60 hover:text-red-300 text-xs disabled:opacity-40">Decline</button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap">{m.message}</p>
                      )}
                      <p className={`text-[10px] mt-1 ${mine ? 'text-black/40' : 'text-white/35'}`}>
                        {new Date(m.timestamp || m.$createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {form && (
              <div className="border-t border-white/10 p-4 space-y-3 bg-white/[0.02]">
                <p className="text-white text-sm font-semibold">
                  {form.mode === 'confirm' ? 'Confirm the details' : 'Suggest changes'}
                </p>
                <p className="text-gray-500 text-xs">
                  {form.mode === 'confirm'
                    ? 'This goes to the family to accept in the app; the session is booked on the calendar when they do.'
                    : 'The family sees your changes and can accept them in the app.'}
                </p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <select className={inputClass} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                    {EVENT_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                  <input type="date" className={inputClass} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                  <input type="time" className={inputClass} value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value, end: form.end || plusHour(e.target.value) })} />
                  <input type="time" className={inputClass} value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
                  <input className={`${inputClass} sm:col-span-2`} placeholder={LOCATION_OPTIONAL.includes(form.type) ? 'Location (optional)' : 'Location'}
                    value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setForm(null)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
                  <button onClick={sendForm} disabled={busy} className="px-5 py-2 bg-white text-black text-sm font-semibold rounded-lg disabled:opacity-40">
                    {busy ? 'Sending…' : 'Send to family'}
                  </button>
                </div>
              </div>
            )}

            {error && <p className="px-4 pb-2 text-red-400 text-xs">{error}</p>}
            <form className="border-t border-white/10 p-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); sendReply(); }}>
              <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Message"
                className="flex-1 px-4 py-2.5 bg-[#1a1a1a] border border-white/10 rounded-lg text-white text-sm focus:outline-none" />
              <button type="submit" disabled={busy || !reply.trim()} className="px-5 py-2.5 bg-white text-black text-sm font-semibold rounded-lg disabled:opacity-40">Send</button>
            </form>
          </>
        )}
      </section>
    </div>
    </div>
  );
};

export default CoachInboxPage;
