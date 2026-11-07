import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ChatMessage,
  Conversation,
  NewChatOption,
  Sender,
  convIdOf,
  formatDateHeader,
  formatTime,
  getCoachDisplayName,
  getConversationMessages,
  markRead,
  msgTime,
  resolveThreadCoachId,
  respondToEventCard,
  sendReply,
  sortAsc,
  subscribeToMessages,
  upsert,
} from './chatService';
import {
  CHAT_EVENT_TYPES,
  addMinutes,
  bookAcceptedSession,
  formatDateDisplay,
  getForLine,
  needsLocation,
  parseTimeTo24h,
  to12h,
  toIsoDate,
} from './eventCards';
import EventFormModal, { EventFormValues } from './EventFormModal';

// The app's client ChatScreen: header with the coach's name (or "Admin"),
// day separators, bubbles (yours on the right in off-white, theirs on the left),
// event cards with Accept / Alter / Reject, and the message bar.

interface Props {
  conversationId: string;
  /** The inbox row, when the thread is in the list. */
  conversation?: Conversation;
  /** New Chat → Admin / Coach: nothing has been sent yet. */
  newChat?: NewChatOption;
  sender: Sender;
  /** Messages this pane wrote or marked read, so the inbox list stays in step. */
  onChanged: (docs: ChatMessage[]) => void;
}

const BackArrow = () => (
  <svg className="w-[22px] h-[22px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);

const Spinner = ({ dark }: { dark?: boolean }) => (
  <span className={`inline-block w-4 h-4 border-2 rounded-full animate-spin ${dark ? 'border-black/40 border-t-transparent' : 'border-white/50 border-t-transparent'}`} />
);

const STATUS_BG: Record<string, string> = { accepted: 'bg-[#2E7D32]', rejected: 'bg-[#C62828]', altered: 'bg-[#F9A825]' };

const ChatPane = ({ conversationId, conversation, newChat, sender, onChanged }: Props) => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [headerName, setHeaderName] = useState(conversation?.otherPartyName?.trim() || newChat?.name || 'Admin');
  const [acceptingId, setAcceptingId] = useState('');
  const [alter, setAlter] = useState<{ msgId: string; initial: EventFormValues } | null>(null);
  const [sendingEvent, setSendingEvent] = useState(false);
  const [notice, setNotice] = useState<{ title: string; message: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // The service-side account this thread is routed to, stamped on every message sent here.
  const threadCoachIdRef = useRef<string | undefined>(conversation?.coachId || newChat?.coachId);
  const onChangedRef = useRef(onChanged);
  onChangedRef.current = onChanged;
  const me = sender.userId;

  const markSeen = useCallback(async (list: ChatMessage[]) => {
    const updated = await markRead(list);
    if (!updated.length) return;
    setMessages((prev) => (prev ? updated.reduce(upsert, prev) : prev));
    onChangedRef.current(updated);
  }, []);

  const fetchMessages = useCallback(
    async (opts: { markAsRead: boolean }) => {
      const msgs = sortAsc(await getConversationMessages(conversationId));
      // Someone else's thread (the URL is shareable): don't show or reply to it.
      if (msgs.some((m) => m.clientId && m.clientId !== me)) {
        setUnavailable(true);
        setMessages([]);
        return;
      }
      setMessages(msgs);
      if (!threadCoachIdRef.current && msgs.length > 0) {
        threadCoachIdRef.current = resolveThreadCoachId(msgs);
        getCoachDisplayName(threadCoachIdRef.current).then(setHeaderName);
      }
      if (opts.markAsRead) await markSeen(msgs);
    },
    [conversationId, me, markSeen],
  );

  // Open: load the thread, then mark the coach's messages read (not for a brand-new chat).
  const openedAsNewRef = useRef(!!newChat);
  useEffect(() => {
    fetchMessages({ markAsRead: !openedAsNewRef.current }).catch((e) => console.error('Error initializing chat:', e));
  }, [fetchMessages]);

  // The inbox row can arrive after the pane (opened from a link).
  useEffect(() => {
    if (conversation?.otherPartyName) setHeaderName(conversation.otherPartyName);
    if (!threadCoachIdRef.current && conversation?.coachId) threadCoachIdRef.current = conversation.coachId;
  }, [conversation?.otherPartyName, conversation?.coachId]);

  // Live updates while open, and a catch-up when the tab regains focus.
  useEffect(() => {
    const unsubscribe = subscribeToMessages((event, doc) => {
      if (doc.clientId !== me || convIdOf(doc) !== conversationId) return;
      setMessages((prev) => {
        if (!prev) return prev;
        return event === 'delete' ? prev.filter((m) => m.$id !== doc.$id) : sortAsc(upsert(prev, doc));
      });
      if (event === 'create' && doc.fromAdmin === true && !doc.read && document.visibilityState === 'visible') {
        markSeen([doc]);
      }
    });
    const onFocus = () => fetchMessages({ markAsRead: true }).catch(() => {});
    window.addEventListener('focus', onFocus);
    return () => {
      unsubscribe();
      window.removeEventListener('focus', onFocus);
    };
  }, [conversationId, me, fetchMessages, markSeen]);

  // Keep the latest message in view (app: scrollToEnd on content change and on layout).
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    const ro = new ResizeObserver(() => { el.scrollTop = el.scrollHeight; });
    ro.observe(el);
    return () => ro.disconnect();
  }, [messages]);

  // Auto-grow the message box up to 100px, as in the app.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 100)}px`;
  }, [text]);

  const afterWrite = async (created?: ChatMessage | null) => {
    if (created) onChangedRef.current([created]);
    await fetchMessages({ markAsRead: false });
  };

  const handleSend = async () => {
    const body = text.trim();
    if (!body || sending || unavailable) return;
    setSending(true);
    try {
      const created = await sendReply(conversationId, body, sender, threadCoachIdRef.current);
      setText('');
      if (newChat) navigate(`/account/inbox/${conversationId}`, { replace: true });
      await afterWrite(created);
    } catch (error) {
      console.error('Error sending message:', error);
      setNotice({ title: 'Error', message: 'Your message could not be sent. Please try again.' });
    } finally {
      setSending(false);
    }
  };

  const handleAccept = async (msg: ChatMessage) => {
    if (acceptingId) return;
    setAcceptingId(msg.$id);
    try {
      const created = await respondToEventCard(msg.$id, 'accepted', conversationId, sender, undefined, threadCoachIdRef.current);
      onChangedRef.current([{ ...msg, eventStatus: 'accepted' }, created]);
      const problems = await bookAcceptedSession(msg, messages || [], me);
      if (problems.length) {
        // Leave the details in the thread so the coach can finish the booking by hand.
        const note = await sendReply(
          conversationId,
          `Automatic note: the session was accepted, but there was a problem booking it.\n\n${problems.join('\n\n')}`,
          sender,
          threadCoachIdRef.current,
        ).catch(() => null);
        if (note) onChangedRef.current([note]);
        setNotice({
          title: 'Session accepted',
          message: 'There was a problem finishing the booking, so your coach has been sent the details to sort it out.',
        });
      }
      await afterWrite();
    } catch (error) {
      console.error('Error accepting event:', error);
      setNotice({ title: 'Error', message: 'Failed to accept event.' });
    } finally {
      setAcceptingId('');
    }
  };

  const handleReject = async (msg: ChatMessage) => {
    try {
      const created = await respondToEventCard(msg.$id, 'rejected', conversationId, sender, undefined, threadCoachIdRef.current);
      onChangedRef.current([{ ...msg, eventStatus: 'rejected' }]);
      await afterWrite(created);
    } catch (error) {
      console.error('Error rejecting event:', error);
      setNotice({ title: 'Error', message: 'Failed to reject event.' });
    }
  };

  const openAlter = (msg: ChatMessage) => {
    const start = msg.eventStartTime || '';
    const start24 = start ? parseTimeTo24h(start) : '';
    setAlter({
      msgId: msg.$id,
      initial: {
        eventType: msg.eventType || CHAT_EVENT_TYPES[0],
        eventDate: toIsoDate(msg.eventDate) || msg.eventDate || '',
        eventLocation: msg.eventLocation || '',
        eventStartTime: start,
        // Requests only carry a start time; sessions run an hour.
        eventEndTime: msg.eventEndTime || (start24 ? to12h(addMinutes(start24, 60)) : ''),
      },
    });
  };

  const handleSendAlter = async (v: EventFormValues) => {
    if (!alter) return;
    if (!v.eventType || !v.eventDate || needsLocation(v.eventType, v.eventLocation) || !v.eventStartTime || !v.eventEndTime) {
      const onlyLocation = v.eventType && v.eventDate && v.eventStartTime && v.eventEndTime;
      setNotice({ title: 'Missing Fields', message: onlyLocation ? 'Please enter the location.' : 'Please fill out all event details.' });
      return;
    }
    const original = (messages || []).find((m) => m.$id === alter.msgId);
    const message = [`Altered Event Proposal: ${v.eventType}`, getForLine(original?.message)].filter(Boolean).join('\n');
    setSendingEvent(true);
    try {
      const created = await respondToEventCard(alter.msgId, 'altered', conversationId, sender, { ...v, message }, threadCoachIdRef.current);
      if (original) onChangedRef.current([{ ...original, eventStatus: 'altered' }]);
      setAlter(null);
      await afterWrite(created);
    } catch (error) {
      console.error('Error altering event:', error);
      setNotice({ title: 'Error', message: 'Failed to send altered event.' });
    } finally {
      setSendingEvent(false);
    }
  };

  const renderEventCard = (item: ChatMessage, fromMe: boolean) => {
    const isProposed = item.eventStatus === 'proposed';
    const detail = `text-[13px] mb-[3px] ${fromMe ? 'text-[#333]' : 'text-[#ccc]'}`;
    const iso = toIsoDate(item.eventDate);
    return (
      <div className={`rounded-2xl p-3.5 mb-0.5 ${fromMe ? 'bg-[#F4F2EE]' : 'bg-[#2A2A2A]'}`} style={{ maxWidth: 'min(82%, 440px)' }}>
        <div className={`flex items-center gap-1.5 mb-2 ${fromMe ? 'text-black' : 'text-[#F4F2EE]'}`}>
          <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h1V3a1 1 0 0 1 1-1Zm13 8H4v9a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-9Z" /></svg>
          <p className="text-[15px] font-bold">{item.eventType || 'Event'}</p>
        </div>
        {item.eventDate && <p className={detail}>Date: {iso ? formatDateDisplay(iso) : item.eventDate}</p>}
        {item.eventLocation && <p className={detail}>Location: {item.eventLocation}</p>}
        {(item.eventStartTime || item.eventEndTime) && (
          <p className={detail}>
            {item.eventStartTime && item.eventEndTime
              ? `Time: ${item.eventStartTime} - ${item.eventEndTime}`
              : `Time: ${item.eventStartTime || item.eventEndTime}`}
          </p>
        )}
        {item.message && !item.message.startsWith('Event Proposal:') && (
          <p className={`${detail} mt-1 italic whitespace-pre-wrap break-words`}>{item.message}</p>
        )}
        {!isProposed && item.eventStatus && (
          <span className={`inline-block mt-2 px-2.5 py-1 rounded-[10px] text-white text-[11px] font-bold ${STATUS_BG[item.eventStatus] || 'bg-[#555]'}`}>
            {item.eventStatus.charAt(0).toUpperCase() + item.eventStatus.slice(1)}
          </span>
        )}
        {isProposed && !fromMe && (
          <div className="flex flex-wrap gap-2 mt-2.5">
            <button
              onClick={() => handleAccept(item)}
              disabled={!!acceptingId}
              className="min-w-[72px] px-3.5 py-[7px] rounded-[14px] bg-[#2E7D32] text-white text-xs font-bold flex items-center justify-center disabled:opacity-50 hover:brightness-110"
            >
              {acceptingId === item.$id ? <Spinner /> : 'Accept'}
            </button>
            <button
              onClick={() => openAlter(item)}
              disabled={!!acceptingId}
              className="px-3.5 py-[7px] rounded-[14px] bg-[#F9A825] text-black text-xs font-bold disabled:opacity-50 hover:brightness-110"
            >
              Alter
            </button>
            <button
              onClick={() => handleReject(item)}
              disabled={!!acceptingId}
              className="px-3.5 py-[7px] rounded-[14px] bg-[#C62828] text-white text-xs font-bold disabled:opacity-50 hover:brightness-110"
            >
              Reject
            </button>
          </div>
        )}
      </div>
    );
  };

  const canSend = !!text.trim() && !sending && !unavailable;

  return (
    <div className="flex flex-col h-full min-h-0 bg-black">
      {/* Header */}
      <div className="flex items-center px-4 py-3 border-b border-[#222] flex-shrink-0">
        <Link to="/account/inbox" aria-label="Back to inbox" className="md:hidden w-9 h-9 flex items-center text-white hover:text-gray-300">
          <BackArrow />
        </Link>
        <p className="flex-1 min-w-0 text-center text-[#F4F2EE] text-lg font-bold truncate md:px-9">{headerName}</p>
        <span className="md:hidden w-9" aria-hidden />
      </div>

      {/* Messages */}
      {messages === null ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-white/40 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : unavailable ? (
        <div className="flex-1 flex items-center justify-center px-6 text-center text-[#666] text-[15px]">This conversation isn't available.</div>
      ) : messages.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-[#666] text-[15px]">No messages yet</div>
      ) : (
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-3 md:px-6 pt-4 pb-3">
          {messages.map((item, index) => {
            const fromMe = item.fromAdmin !== true;
            const showDate = index === 0 || new Date(msgTime(item)).toDateString() !== new Date(msgTime(messages[index - 1])).toDateString();
            const isEventCard = !!(item.eventType && item.eventStatus);
            const ts = item.timestamp || item.$createdAt;
            return (
              <div key={item.$id}>
                {showDate && (
                  <div className="flex justify-center my-4">
                    <span className="px-3 py-1 rounded-[10px] bg-[#1A1A1A] text-[#666] text-xs">{formatDateHeader(ts)}</span>
                  </div>
                )}
                <div className={`flex mb-1.5 ${fromMe ? 'justify-end' : 'justify-start'}`}>
                  {isEventCard ? (
                    renderEventCard(item, fromMe)
                  ) : (
                    <div
                      className={`px-3.5 py-2.5 rounded-[18px] ${fromMe ? 'bg-[#F4F2EE] rounded-br-[4px]' : 'bg-[#2A2A2A] rounded-bl-[4px]'}`}
                      style={{ maxWidth: 'min(78%, 620px)' }}
                    >
                      <p className={`text-[15px] leading-[21px] whitespace-pre-wrap break-words ${fromMe ? 'text-black' : 'text-[#F4F2EE]'}`}>{item.message}</p>
                      <p className={`text-[10px] mt-1 text-right ${fromMe ? 'text-[#666]' : 'text-[#555]'}`}>{formatTime(ts)}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Input bar */}
      <form
        className="flex items-end gap-2 px-3 pt-2 pb-2 md:pb-3 border-t border-[#222] flex-shrink-0"
        onSubmit={(e) => { e.preventDefault(); handleSend(); }}
      >
        <textarea
          ref={inputRef}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Message..."
          maxLength={5000}
          disabled={unavailable}
          className="flex-1 min-w-0 resize-none bg-[#1A1A1A] rounded-[20px] px-4 py-2.5 text-[#F4F2EE] text-[15px] leading-[21px] placeholder:text-[#666] max-h-[100px] focus:outline-none focus-visible:ring-1 focus-visible:ring-white/20 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!canSend}
          aria-label="Send"
          className={`w-9 h-9 mb-[3px] rounded-full flex-shrink-0 flex items-center justify-center transition-colors ${canSend || sending ? 'bg-[#F4F2EE] hover:bg-white' : 'bg-[#2A2A2A] opacity-50'}`}
        >
          {sending ? (
            <Spinner dark />
          ) : (
            <svg className="w-[22px] h-[22px] text-black" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          )}
        </button>
      </form>

      {alter && (
        <EventFormModal
          title="Alter Event"
          initial={alter.initial}
          sending={sendingEvent}
          onCancel={() => setAlter(null)}
          onSend={handleSendAlter}
        />
      )}

      {notice && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-5 bg-black/70" onMouseDown={() => setNotice(null)}>
          <div role="alertdialog" aria-modal="true" className="w-full max-w-sm bg-[#1A1A1A] rounded-2xl p-5 text-center" onMouseDown={(e) => e.stopPropagation()}>
            <p className="text-[#F4F2EE] text-lg font-bold">{notice.title}</p>
            <p className="text-[#9ca3af] text-sm mt-2 whitespace-pre-wrap">{notice.message}</p>
            <button autoFocus onClick={() => setNotice(null)} className="mt-5 w-full py-3 rounded bg-[#F4F2EE] text-black text-[15px] font-bold hover:bg-white">
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatPane;
