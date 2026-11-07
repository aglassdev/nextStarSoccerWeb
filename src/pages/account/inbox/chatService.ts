import { ID, Query } from 'appwrite';
import { formatInTimeZone } from 'date-fns-tz';
import { client, databases, databaseId, collections } from '@/services/appwrite';

// The client side of the app's chat (services/messageService.ts and
// constants/requestCoaches.ts), for the website's Inbox. Same collection,
// same document shape, same queries, so a thread started on the web shows up
// in the app and the staff inboxes exactly as if it had been sent from the app
// (the notify-new-messages function fires on the create either way).
//
// Message schema:
//   clientId  — the client (non-staff) user participating in the conversation.
//   fromAdmin — true if the staff side (admin or coach) sent it, false if the client did.
//   coachId   — the service-side account the thread is routed to.

// ── Chat routing (app: constants/requestCoaches.ts) ─────────────────────────────

/** Amartya Glass. Untagged (pre-routing) conversations also count as admin. */
export const ADMIN_CHAT_USER_ID = 'mi363q40_q03mtr0sknh';
/** Paul Torres. New Chat → Coach goes here. */
export const HEAD_COACH_CHAT_USER_ID = 'mi36bdeg_o704o948kfd';

/** Coaches a request can be routed to: displayed name → coach account userId. */
export const REQUEST_COACH_IDS: Record<string, string> = {
  'Paul Torres': HEAD_COACH_CHAT_USER_ID,
  'Ryan Machado': 'mnnz1jme_97ohhnndaz7',
  'Patrick Mullins': 'moedydh5_smvwfs7caxp',
};

export const routeForCoach = (coachName?: string | null): string =>
  (coachName && REQUEST_COACH_IDS[coachName.trim()]) || ADMIN_CHAT_USER_ID;

export const COACH_NAMES_BY_ID: Record<string, string> = Object.fromEntries(
  Object.entries(REQUEST_COACH_IDS).map(([name, id]) => [id, name]),
);

/** New Chat → who the conversation goes to (app: InboxScreen NEW_CHAT_OPTIONS). */
export const NEW_CHAT_OPTIONS = [
  {
    key: 'admin',
    label: 'Admin',
    description: 'Billing, account and general questions',
    coachId: ADMIN_CHAT_USER_ID,
    name: 'Admin',
  },
  {
    key: 'coach',
    label: 'Coach',
    description: `Training questions for ${COACH_NAMES_BY_ID[HEAD_COACH_CHAT_USER_ID]}`,
    coachId: HEAD_COACH_CHAT_USER_ID,
    name: COACH_NAMES_BY_ID[HEAD_COACH_CHAT_USER_ID],
  },
] as const;

export type NewChatOption = (typeof NEW_CHAT_OPTIONS)[number];

// ── Types ───────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  $id: string;
  $createdAt: string;
  message: string;
  clientId?: string;
  fromAdmin?: boolean;
  userId?: string;
  firstName?: string;
  lastName?: string;
  timestamp?: string;
  read?: boolean;
  conversationId?: string;
  coachId?: string;
  eventType?: string;
  eventDate?: string;
  eventLocation?: string;
  eventStartTime?: string;
  eventEndTime?: string;
  eventStatus?: string; // "proposed" | "accepted" | "rejected" | "altered"
}

export interface Conversation {
  conversationId: string;
  lastMessage: string;
  lastMessageTimestamp: string;
  otherPartyName: string;
  otherPartyId: string; // "admin" or the coach's userId
  unreadCount: number;
  hasUnread: boolean;
  coachId: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

const EST = 'America/New_York';
const MESSAGES = () => collections.messages as string;

/** The app stamps `timestamp` as an Eastern ISO string with offset. */
export const nowEstIso = () => formatInTimeZone(new Date(), EST, "yyyy-MM-dd'T'HH:mm:ss.SSSXXX");

export const msgTime = (m: Pick<ChatMessage, 'timestamp' | '$createdAt'>) =>
  new Date(m.timestamp || m.$createdAt).getTime();

export const convIdOf = (m: ChatMessage) => m.conversationId || m.$id;

export const generateConversationId = () =>
  `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export const sortAsc = (list: ChatMessage[]) => [...list].sort((a, b) => msgTime(a) - msgTime(b));

/** Insert or replace a message by $id. */
export const upsert = (list: ChatMessage[], doc: ChatMessage) => {
  const i = list.findIndex((m) => m.$id === doc.$id);
  if (i === -1) return [...list, doc];
  const next = [...list];
  next[i] = { ...next[i], ...doc };
  return next;
};

// ── Writes ──────────────────────────────────────────────────────────────────────

async function createMessage(data: Record<string, any>): Promise<ChatMessage> {
  const payload: Record<string, any> = {
    ...data,
    timestamp: nowEstIso(),
    read: data.read ?? false,
    conversationId: data.conversationId || generateConversationId(),
  };
  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined || payload[key] === null) delete payload[key];
  });
  return (await databases.createDocument(databaseId, MESSAGES(), ID.unique(), payload)) as unknown as ChatMessage;
}

export interface Sender {
  userId: string;
  firstName: string;
  lastName: string;
}

/** A plain text reply from the client (app: MessageService.sendReply with fromAdmin=false). */
export const sendReply = (conversationId: string, message: string, sender: Sender, coachId?: string) =>
  createMessage({
    firstName: sender.firstName,
    lastName: sender.lastName,
    message,
    userId: sender.userId,
    clientId: sender.userId,
    fromAdmin: false,
    conversationId,
    coachId,
  });

export interface AlteredDetails {
  eventType: string;
  eventDate: string;
  eventLocation: string;
  eventStartTime: string;
  eventEndTime: string;
  message?: string;
}

/** App: MessageService.respondToEventCard, from the client side. */
export async function respondToEventCard(
  eventMessageId: string,
  response: 'accepted' | 'rejected' | 'altered',
  conversationId: string,
  sender: Sender,
  alteredDetails?: AlteredDetails,
  coachId?: string,
): Promise<ChatMessage> {
  await databases.updateDocument(databaseId, MESSAGES(), eventMessageId, { eventStatus: response });
  const base = {
    firstName: sender.firstName,
    lastName: sender.lastName,
    userId: sender.userId,
    clientId: sender.userId,
    fromAdmin: false,
    conversationId,
    coachId,
  };
  if (response === 'altered' && alteredDetails) {
    return createMessage({
      ...base,
      message: alteredDetails.message || `Altered Event Proposal: ${alteredDetails.eventType}`,
      eventType: alteredDetails.eventType,
      eventDate: alteredDetails.eventDate,
      eventLocation: alteredDetails.eventLocation,
      eventStartTime: alteredDetails.eventStartTime,
      eventEndTime: alteredDetails.eventEndTime,
      eventStatus: 'proposed',
    });
  }
  return createMessage({ ...base, message: response === 'accepted' ? 'Event Accepted' : 'Event Rejected' });
}

/** Mark the staff side's unread messages read (app: markConversationAsRead, reader = client). */
export async function markRead(messages: ChatMessage[]): Promise<ChatMessage[]> {
  const unread = messages.filter((m) => !m.read && m.fromAdmin === true);
  await Promise.all(
    unread.map((m) => databases.updateDocument(databaseId, MESSAGES(), m.$id, { read: true }).catch(() => null)),
  );
  return unread.map((m) => ({ ...m, read: true }));
}

// ── Reads ───────────────────────────────────────────────────────────────────────

/** Every message in the client's conversations (app: getConversationsForUser). */
export async function listClientMessages(userId: string): Promise<ChatMessage[]> {
  const res = await databases.listDocuments(databaseId, MESSAGES(), [
    Query.equal('clientId', userId),
    Query.orderDesc('timestamp'),
    Query.limit(1000),
  ]);
  return res.documents as unknown as ChatMessage[];
}

/** One conversation, oldest first (app: getConversationMessages). */
export async function getConversationMessages(conversationId: string): Promise<ChatMessage[]> {
  try {
    const res = await databases.listDocuments(databaseId, MESSAGES(), [
      Query.equal('conversationId', conversationId),
      Query.orderAsc('timestamp'),
      Query.limit(500),
    ]);
    if (res.documents.length === 0) {
      // Legacy: conversationId might be the $id of the first message.
      try {
        return [(await databases.getDocument(databaseId, MESSAGES(), conversationId)) as unknown as ChatMessage];
      } catch {
        return [];
      }
    }
    return res.documents as unknown as ChatMessage[];
  } catch (error) {
    console.error('Error fetching conversation messages:', error);
    return [];
  }
}

/**
 * Which service-side account a conversation belongs to: the `coachId` stamped
 * on its messages; else the coach named in a request card; else the admin.
 */
export function resolveThreadCoachId(messages: ChatMessage[]): string {
  const tagged = messages.find((m) => m.coachId)?.coachId;
  if (tagged) return tagged;
  for (const m of sortAsc(messages)) {
    if (!m.eventType || m.fromAdmin === true) continue;
    const named = (m.message || '').match(/^(?:Preferred )?Coach:\s*(.+)$/im)?.[1];
    if (named) return routeForCoach(named);
  }
  return ADMIN_CHAT_USER_ID;
}

/** The name a client sees for a thread's service side, when it is known without a lookup. */
export const knownCoachName = (coachId?: string): string | null =>
  !coachId || coachId === ADMIN_CHAT_USER_ID ? 'Admin' : COACH_NAMES_BY_ID[coachId] || null;

const nameCache = new Map<string, Promise<string>>();

/** "Admin", or the coach's name (app: getCoachDisplayName). */
export function getCoachDisplayName(coachId?: string): Promise<string> {
  const known = knownCoachName(coachId);
  if (known) return Promise.resolve(known);
  const id = coachId as string;
  if (!nameCache.has(id)) {
    nameCache.set(
      id,
      databases
        .listDocuments(databaseId, collections.coaches, [Query.equal('userId', id), Query.limit(1)])
        .then((r) => {
          const doc: any = r.documents[0];
          return `${doc?.firstName || ''} ${doc?.lastName || ''}`.trim() || 'Coach';
        })
        .catch(() => 'Coach'),
    );
  }
  return nameCache.get(id)!;
}

/** Group a client's messages into conversations, newest first (app: groupByConversation, client view). */
export function groupConversations(docs: ChatMessage[], names: Record<string, string>): Conversation[] {
  const byConv = new Map<string, ChatMessage[]>();
  for (const m of docs) {
    const cid = convIdOf(m);
    if (!byConv.has(cid)) byConv.set(cid, []);
    byConv.get(cid)!.push(m);
  }
  const out: Conversation[] = [];
  for (const [conversationId, list] of byConv) {
    const messages = [...list].sort((a, b) => msgTime(b) - msgTime(a));
    const latest = messages[0];
    const coachId = resolveThreadCoachId(messages);
    const unreadCount = messages.filter((m) => !m.read && m.fromAdmin === true).length;
    out.push({
      conversationId,
      lastMessage: latest.message || '',
      lastMessageTimestamp: latest.timestamp || latest.$createdAt,
      otherPartyName: knownCoachName(coachId) || names[coachId] || 'Coach',
      otherPartyId: coachId === ADMIN_CHAT_USER_ID ? 'admin' : coachId,
      unreadCount,
      hasUnread: unreadCount > 0,
      coachId,
    });
  }
  return out.sort((a, b) => new Date(b.lastMessageTimestamp).getTime() - new Date(a.lastMessageTimestamp).getTime());
}

// ── Realtime ────────────────────────────────────────────────────────────────────

export type MessageEvent = 'create' | 'update' | 'delete';

/**
 * Live message changes. The app has no realtime (it refreshes on focus and
 * relies on push notifications); on the web this stands in for both. The
 * collection is readable by every signed-in user, so callers must filter to
 * their own clientId.
 */
export function subscribeToMessages(onEvent: (event: MessageEvent, doc: ChatMessage) => void): () => void {
  if (!databaseId || !collections.messages) return () => {};
  try {
    return client.subscribe<ChatMessage>(
      `databases.${databaseId}.collections.${collections.messages}.documents`,
      (res) => {
        const ev = res.events.find((e) => /\.(create|update|delete)$/.test(e));
        if (!ev || !res.payload) return;
        onEvent(ev.slice(ev.lastIndexOf('.') + 1) as MessageEvent, res.payload);
      },
    );
  } catch (e) {
    console.warn('Realtime unavailable for messages:', e);
    return () => {};
  }
}

// ── Display ─────────────────────────────────────────────────────────────────────

/** Inbox row preview (app: renderConversationItem). */
export function previewText(lastMessage: string): string {
  const text = lastMessage.startsWith('Event Proposal:')
    ? 'Sent an event proposal'
    : lastMessage.startsWith('Altered Event Proposal:')
      ? 'Sent an altered event proposal'
      : lastMessage;
  return text.length > 80 ? text.substring(0, 80) + '...' : text;
}

const DAY = 1000 * 60 * 60 * 24;

/** Inbox row date, in Eastern time (app: InboxScreen formatDate). */
export function formatInboxDate(dateString: string): string {
  const date = new Date(dateString);
  const diffDays = Math.floor((Date.now() - date.getTime()) / DAY);
  if (diffDays === 0) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: EST });
  }
  if (diffDays === 1) return 'Yesterday';
  if (diffDays <= 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: EST });
}

/** Bubble time (app: ChatScreen formatTime). */
export const formatTime = (dateString: string) =>
  new Date(dateString).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

/** Day separator (app: ChatScreen formatDateHeader). */
export function formatDateHeader(dateString: string): string {
  const date = new Date(dateString);
  const diffDays = Math.floor((Date.now() - date.getTime()) / DAY);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}
