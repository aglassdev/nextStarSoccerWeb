import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAccount } from './AccountContext';
import { AccountPageHeader, AccountSpinner } from './AccountLayout';
import ChatPane from './inbox/ChatPane';
import {
  ChatMessage,
  Conversation,
  NEW_CHAT_OPTIONS,
  NewChatOption,
  formatInboxDate,
  generateConversationId,
  getCoachDisplayName,
  groupConversations,
  knownCoachName,
  listClientMessages,
  previewText,
  subscribeToMessages,
  upsert,
} from './inbox/chatService';

// Account Center → Inbox: the app's client InboxScreen and ChatScreen. On a
// wide screen the conversation list and the open chat sit side by side; on a
// phone it is list → chat, as in the app.
//
// Routes: /account/inbox and /account/inbox/:conversationId. A New Chat opens
// /account/inbox/<new id>?new=admin|coach until its first message is sent.

const MD = '(min-width: 768px)';

const useIsDesktop = () => {
  const [desktop, setDesktop] = useState(() => typeof window !== 'undefined' && window.matchMedia(MD).matches);
  useEffect(() => {
    const mq = window.matchMedia(MD);
    const on = () => setDesktop(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return desktop;
};

/**
 * Height that takes an element from where it starts to the bottom of the
 * window. With `fit`, the layout's own bottom padding is kept in view too (so
 * the page doesn't scroll); otherwise `gap` is left below it.
 */
const useFillHeight = (ref: React.RefObject<HTMLElement>, enabled: boolean, gap: number, fit: boolean) => {
  const [height, setHeight] = useState<number | undefined>();
  useLayoutEffect(() => {
    if (!enabled) return setHeight(undefined);
    const measure = () => {
      const el = ref.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      const below = document.documentElement.scrollHeight - (top + el.offsetHeight);
      const reserve = fit && below >= 0 && below <= 120 ? Math.max(below, gap) : gap;
      setHeight(Math.max(420, window.innerHeight - top - reserve));
    };
    measure();
    const raf = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
    };
  }, [ref, enabled, gap, fit]);
  return height;
};

const Avatar = ({ letter, unread }: { letter: string; unread?: boolean }) => (
  <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 mr-3 ${unread === undefined ? 'bg-[#2A2A2A]' : unread ? 'bg-[#333]' : 'bg-[#1A1A1A]'}`}>
    <span className={`text-lg font-bold ${unread === false ? 'text-[#666]' : 'text-[#F4F2EE]'}`}>{letter}</span>
  </div>
);

const ConversationRow = ({ item, active, onOpen }: { item: Conversation; active: boolean; onOpen: () => void }) => {
  const unread = item.hasUnread;
  return (
    <button
      onClick={onOpen}
      aria-current={active ? 'true' : undefined}
      className={`w-full flex items-center text-left py-3.5 md:px-4 border-b border-[#222] transition-colors ${unread ? '' : 'opacity-75'} ${active ? 'bg-[#141414]' : 'hover:bg-white/[0.03]'}`}
    >
      <Avatar letter={item.otherPartyName.charAt(0).toUpperCase()} unread={unread} />
      <div className="flex-1 min-w-0 mr-2">
        <div className="flex items-center justify-between mb-0.5">
          <p className={`flex-1 min-w-0 mr-2 truncate text-[15px] ${unread ? 'text-[#F4F2EE] font-bold' : 'text-[#555]'}`}>{item.otherPartyName}</p>
          <p className={`text-xs flex-shrink-0 ${unread ? 'text-[#666]' : 'text-[#555]'}`}>{formatInboxDate(item.lastMessageTimestamp)}</p>
        </div>
        <p className={`text-[13px] truncate ${unread ? 'text-[#666]' : 'text-[#444]'}`}>{previewText(item.lastMessage)}</p>
      </div>
      {unread && (
        <span className="ml-1 w-[22px] h-[22px] rounded-full bg-[#F4F2EE] text-black text-[11px] font-bold flex items-center justify-center flex-shrink-0">
          {item.unreadCount}
        </span>
      )}
    </button>
  );
};

const NewChatPicker = ({ onPick, onClose }: { onPick: (o: NewChatOption) => void; onClose: () => void }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-5 bg-black/70" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label="New Chat" className="w-full max-w-md bg-[#1A1A1A] rounded-2xl p-5" onMouseDown={(e) => e.stopPropagation()}>
        <h3 className="text-[#F4F2EE] text-[22px] font-bold text-center">New Chat</h3>
        <p className="text-[#9ca3af] text-sm text-center mt-1 mb-3">Who would you like to message?</p>
        {NEW_CHAT_OPTIONS.map((option) => (
          <button
            key={option.key}
            onClick={() => onPick(option)}
            className="w-full flex items-center text-left py-3.5 border-b border-[#2A2A2A] rounded-md hover:bg-white/[0.03]"
          >
            <Avatar letter={option.label.charAt(0)} />
            <div className="flex-1 min-w-0 mr-2">
              <p className="text-[#F4F2EE] text-base font-bold mb-0.5">{option.label}</p>
              <p className="text-[#666] text-[13px] line-clamp-2">{option.description}</p>
            </div>
            <svg className="w-[18px] h-[18px] text-[#666] flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ))}
        <button onClick={onClose} className="w-full mt-4 py-3 text-[#9ca3af] text-[15px] font-medium hover:text-white">
          Cancel
        </button>
      </div>
    </div>
  );
};

const AccountInboxPage = () => {
  const { user } = useAuth();
  const { profile } = useAccount();
  const { conversationId } = useParams<{ conversationId: string }>();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const desktop = useIsDesktop();

  const [docs, setDocs] = useState<ChatMessage[] | null>(null);
  const [error, setError] = useState('');
  const [names, setNames] = useState<Record<string, string>>({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const userId = user?.$id || '';

  // The sender's name, from their profile as in the app.
  const sender = useMemo(() => {
    const [first = '', ...rest] = (user?.name || '').trim().split(' ');
    return {
      userId,
      firstName: String(profile?.firstName || first || '').trim().slice(0, 50),
      lastName: String(profile?.lastName || rest.join(' ') || '').trim().slice(0, 50),
    };
  }, [userId, user?.name, profile?.firstName, profile?.lastName]);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      setDocs(await listClientMessages(userId));
      setError('');
    } catch (e) {
      console.error('Error fetching conversations:', e);
      setError('Your messages could not be loaded.');
      setDocs((prev) => prev || []);
    }
  }, [userId]);

  // Load, then refresh whenever the tab comes back into focus (app: useFocusEffect)
  // and live while it's open.
  useEffect(() => {
    load();
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    const unsubscribe = subscribeToMessages((event, doc) => {
      if (doc.clientId !== userId) return;
      setDocs((prev) => (prev ? (event === 'delete' ? prev.filter((m) => m.$id !== doc.$id) : upsert(prev, doc)) : prev));
    });
    return () => {
      window.removeEventListener('focus', onFocus);
      unsubscribe();
    };
  }, [load, userId]);

  const conversations = useMemo(() => groupConversations(docs || [], names), [docs, names]);

  // Coaches outside the known list are looked up by name once.
  useEffect(() => {
    const missing = [...new Set(conversations.map((c) => c.coachId))].filter((id) => !knownCoachName(id) && !names[id]);
    missing.forEach((id) => getCoachDisplayName(id).then((name) => setNames((n) => ({ ...n, [id]: name }))));
  }, [conversations, names]);

  const onChanged = useCallback((changed: ChatMessage[]) => {
    setDocs((prev) => changed.reduce(upsert, prev || []));
  }, []);

  const newKey = search.get('new');
  const newChat = NEW_CHAT_OPTIONS.find((o) => o.key === newKey);
  const active = conversations.find((c) => c.conversationId === conversationId);

  const startChat = (option: NewChatOption) => {
    setPickerOpen(false);
    navigate(`/account/inbox/${generateConversationId()}?new=${option.key}`);
  };

  // Desktop: both panes fill the window. Phone: the list scrolls with the page,
  // and an open chat fills the window like the app's chat screen.
  const fill = useFillHeight(panelRef, desktop || !!conversationId, desktop ? 16 : 8, desktop);

  const newChatButton = (
    <button
      onClick={() => setPickerOpen(true)}
      className="hidden md:inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-black text-[15px] font-bold hover:bg-[#F4F2EE] transition-colors"
    >
      <span className="text-[22px] leading-[22px] font-bold">+</span>
      New Chat
    </button>
  );

  return (
    <div>
      <div className={conversationId ? 'hidden md:block' : ''}>
        <AccountPageHeader title="Inbox" right={newChatButton} />
      </div>

      <div
        ref={panelRef}
        style={{ height: fill }}
        className="flex min-h-0 bg-black md:border md:border-[#222] md:rounded-2xl md:overflow-hidden"
      >
        {/* Conversations */}
        <aside className={`${conversationId ? 'hidden md:flex' : 'flex'} w-full md:w-[340px] lg:w-[380px] flex-shrink-0 flex-col min-h-0 md:border-r md:border-[#222]`}>
          <div className={`flex-1 min-h-0 ${fill ? 'overflow-y-auto' : ''} pb-28 md:pb-2`}>
            {docs === null ? (
              <AccountSpinner />
            ) : conversations.length === 0 ? (
              <div className="flex items-center justify-center py-24 px-6">
                <p className="text-[#9ca3af] text-base text-center">{error || 'No conversations yet'}</p>
              </div>
            ) : (
              <>
                {error && <p className="px-4 py-2 text-red-400 text-xs">{error}</p>}
                {conversations.map((c) => (
                  <ConversationRow
                    key={c.conversationId}
                    item={c}
                    active={c.conversationId === conversationId}
                    onOpen={() => navigate(`/account/inbox/${c.conversationId}`)}
                  />
                ))}
              </>
            )}
          </div>
        </aside>

        {/* Open chat */}
        <section className={`${conversationId ? 'flex' : 'hidden md:flex'} flex-1 min-w-0 min-h-0 flex-col -mx-4 md:mx-0`}>
          {conversationId && userId ? (
            <ChatPane
              key={conversationId}
              conversationId={conversationId}
              conversation={active}
              newChat={active ? undefined : newChat}
              sender={sender}
              onChanged={onChanged}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
              <svg className="w-12 h-12 text-[#333]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5M21 12c0 4.418-4.03 8-9 8a9.9 9.9 0 0 1-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8Z" />
              </svg>
              <div>
                <p className="text-[#F4F2EE] text-base font-bold">Select a conversation</p>
                <p className="text-[#666] text-sm mt-1">Or start a new chat with the Admin or your coach.</p>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Floating New Chat button (phone list view, as in the app) */}
      {!conversationId && (
        <button
          onClick={() => setPickerOpen(true)}
          className="md:hidden fixed bottom-6 right-5 z-40 flex items-center gap-2 px-5 py-3.5 rounded-full bg-white text-black text-[15px] font-bold shadow-[0_4px_12px_rgba(0,0,0,0.5)]"
        >
          <span className="text-[22px] leading-[22px] font-bold">+</span>
          New Chat
        </button>
      )}

      {pickerOpen && <NewChatPicker onPick={startChat} onClose={() => setPickerOpen(false)} />}
    </div>
  );
};

export default AccountInboxPage;
