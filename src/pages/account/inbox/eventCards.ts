import { ID, Query } from 'appwrite';
import { parseISO } from 'date-fns';
import { databases, databaseId, collections } from '@/services/appwrite';
import { callCalendarFunction } from '@/services/calendarAdmin';
import { getParentChildren } from '@/services/clinicRegistration';
import { nowEstIso, type ChatMessage } from './chatService';

// Event cards in the chat (app: ChatScreen.tsx). A coach's proposal can be
// accepted, altered or rejected by the client. Accepting books it: the
// session goes on the calendar (the same Appwrite function the app calls) and
// the player is signed up (app: services/eventSignups.ts createEventSignup).

// Session types shown in chat event proposals.
export const CHAT_EVENT_TYPES = [
  'Individual Session',
  'Two Person Session',
  'Small Group Session',
  'Game Analysis',
  'Parent Consultation',
];
// Training sessions → stored in the private calendar as "Private Session".
const SESSION_EVENT_TYPES = ['Individual Session', 'Two Person Session', 'Small Group Session'];
// Analysis services → stored in the analysis calendar.
const ANALYSIS_EVENT_TYPES = ['Game Analysis', 'Parent Consultation'];
// Everything else happens somewhere, so it can't be booked without a location.
const LOCATION_OPTIONAL_TYPES = [...ANALYSIS_EVENT_TYPES, 'Player Report'];
export const needsLocation = (eventType?: string, location?: string) =>
  !LOCATION_OPTIONAL_TYPES.includes(eventType || '') && !(location || '').trim();

export const TIME_OPTIONS = (() => {
  const times: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      times.push(`${h12}:${m.toString().padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`);
    }
  }
  return times;
})();

export const parseTimeTo24h = (timeStr: string): string => {
  try {
    const parts = timeStr.trim().split(' ');
    const [hourStr, minuteStr] = parts[0].split(':');
    let hour = parseInt(hourStr);
    const ap = (parts[1] || '').toUpperCase();
    if (ap === 'PM' && hour !== 12) hour += 12;
    if (ap === 'AM' && hour === 12) hour = 0;
    return `${hour.toString().padStart(2, '0')}:${minuteStr || '00'}`;
  } catch {
    return '00:00';
  }
};

// Cards made in chat store the date as "2026-10-09"; requests sent from the
// "Request a Session" screens store display text ("Friday, October 9, 2026").
const MONTH_NAMES = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
export const toIsoDate = (dateStr?: string): string | null => {
  if (!dateStr) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr.slice(0, 10);
  const m = dateStr.match(/([A-Za-z]+)\s+(\d{1,2}),?\s*(\d{4})/);
  const month = m ? MONTH_NAMES.indexOf(m[1].toLowerCase()) : -1;
  if (!m || month < 0) return null;
  return `${m[3]}-${String(month + 1).padStart(2, '0')}-${m[2].padStart(2, '0')}`;
};

export const addMinutes = (hhmm: string, minutes: number): string => {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

const normName = (first?: string, last?: string) =>
  `${first || ''} ${last || ''}`.trim().toLowerCase().replace(/\s+/g, ' ');

export const to12h = (hhmm: string): string => {
  const [h, m] = hhmm.split(':').map(Number);
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

// Request cards name the player(s) on a "For: …" line. It is carried onto
// altered proposals so whoever accepts can sign them up.
export const getForLine = (text?: string): string => (text || '').match(/^For:\s*.+$/im)?.[0] || '';

export const formatDateDisplay = (dateStr: string): string => {
  if (!dateStr) return '';
  const [y, mo, d] = dateStr.split('-').map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });
};

// ── Signups (app: services/eventSignups.ts) ─────────────────────────────────────

const ROLE_COLLECTIONS = () =>
  [
    collections.parentUsers,
    collections.youthPlayers,
    collections.collegiatePlayers,
    collections.professionalPlayers,
    collections.coaches,
  ].filter(Boolean) as string[];

async function getUserDetails(userId: string): Promise<{ firstName: string; lastName: string }> {
  for (const collectionId of ROLE_COLLECTIONS()) {
    try {
      const r = await databases.listDocuments(databaseId, collectionId, [Query.equal('userId', userId), Query.limit(1)]);
      const doc: any = r.documents[0];
      if (doc) return { firstName: doc.firstName, lastName: doc.lastName };
    } catch {
      continue;
    }
  }
  throw new Error('User details not found in any collection');
}

async function isParentAccount(userId: string): Promise<boolean> {
  try {
    const r = await databases.listDocuments(databaseId, collections.parentUsers, [Query.equal('userId', userId), Query.limit(1)]);
    return r.documents.length > 0;
  } catch {
    return false;
  }
}

/** Overdue-balance gate (app: getPlayerBillingStatus; yellow and red both block a signup). */
async function overdueFor(playerId: string): Promise<{ amount: number; months: string[] } | null> {
  let ids = [playerId];
  try {
    const px = await databases.listDocuments(databaseId, collections.proxyChildren, [
      Query.or([Query.equal('proxyId', playerId), Query.equal('migratedToUserId', playerId)]),
      Query.limit(2),
    ]);
    for (const p of px.documents as any[]) ids.push(...[p.proxyId, p.$id, p.migratedToUserId].filter(Boolean));
    const byDoc: any = await databases.getDocument(databaseId, collections.proxyChildren, playerId).catch(() => null);
    if (byDoc) ids.push(...[byDoc.proxyId, byDoc.$id, byDoc.migratedToUserId].filter(Boolean));
  } catch {
    // no aliases
  }
  ids = [...new Set(ids)];
  try {
    const bills = await databases.listDocuments(databaseId, collections.bills, [
      Query.equal('userId', ids),
      Query.equal('status', ['pending', 'processing']),
      Query.limit(100),
    ]);
    const overdue = (bills.documents as any[]).filter(
      (b) =>
        b.visibility !== false &&
        !['paid', 'processing', 'cancelled'].includes(b.status) &&
        !!b.dueDate &&
        Date.now() > parseISO(b.dueDate).getTime(),
    );
    if (!overdue.length) return null;
    return {
      amount: overdue.reduce((s, b) => s + (b.totalAmount || 0), 0),
      months: [...new Set(overdue.map((b) => (b.monthName || '').split(' ')[0]).filter(Boolean))] as string[],
    };
  } catch {
    return null;
  }
}

interface OnBehalfOf {
  childId: string;
  childType: 'proxy' | 'real';
  firstName: string;
  lastName: string;
}

async function createEventSignup(eventID: string, eventTitle: string, eventDate: string, userId: string, onBehalfOf?: OnBehalfOf) {
  if (!eventID) throw new Error('Invalid eventID provided');
  if (!eventTitle) throw new Error('Invalid eventTitle provided');
  if (!eventDate) throw new Error('Invalid eventDate provided');
  if (!userId) throw new Error('User ID is required for signup');

  const overdue = await overdueFor(onBehalfOf?.childId || userId);
  if (overdue) {
    const months = overdue.months.length ? ` (${overdue.months.join(', ')})` : '';
    throw new Error(
      `There is an outstanding balance of $${overdue.amount}${months} on this account. Please settle it in the Payment Center to sign up for sessions.`,
    );
  }
  if (isNaN(parseISO(eventDate).getTime())) throw new Error('Invalid eventDate format - must be a valid date string');

  // Duplicate prevention.
  const dup = [Query.equal('eventID', eventID)];
  if (onBehalfOf) {
    dup.push(Query.equal(onBehalfOf.childType === 'proxy' ? 'onBehalfOfProxyId' : 'onBehalfOfUserId', onBehalfOf.childId));
  } else {
    dup.push(Query.equal('userId', userId), Query.equal('isProxySignup', false));
  }
  const existing = await databases.listDocuments(databaseId, collections.signups, [...dup, Query.limit(1)]);
  if (existing.documents.length > 0) return existing.documents[0];

  let data: Record<string, any>;
  if (onBehalfOf?.childType === 'proxy') {
    data = {
      eventID, eventTitle, eventDate, userId,
      firstName: onBehalfOf.firstName, lastName: onBehalfOf.lastName, type: 'bill',
      onBehalfOfProxyId: onBehalfOf.childId, isProxySignup: true, parentSignupId: userId,
    };
  } else if (onBehalfOf) {
    const details = await getUserDetails(onBehalfOf.childId).catch(() => ({ firstName: onBehalfOf.firstName, lastName: onBehalfOf.lastName }));
    data = {
      eventID, eventTitle, eventDate, userId,
      firstName: details.firstName, lastName: details.lastName, type: 'bill',
      onBehalfOfUserId: onBehalfOf.childId, isProxySignup: false, parentSignupId: userId,
    };
  } else {
    // Parent accounts may never sign themselves up.
    if (await isParentAccount(userId)) {
      throw new Error("Parent accounts can't sign up themselves. Add a player under My Family and sign them up instead.");
    }
    const details = await getUserDetails(userId);
    data = { eventID, eventTitle, eventDate, userId, firstName: details.firstName, lastName: details.lastName, type: 'bill', isProxySignup: false };
  }
  return databases.createDocument(databaseId, collections.signups, ID.unique(), data);
}

// ── Accepting a proposal ────────────────────────────────────────────────────────

/**
 * After the card is marked accepted: put the session on the calendar and sign
 * up the player(s) it is for. Returns the problems to report (empty = booked).
 */
export async function bookAcceptedSession(msg: ChatMessage, thread: ChatMessage[], clientId: string): Promise<string[]> {
  const isSession = SESSION_EVENT_TYPES.includes(msg.eventType || '');
  const isAnalysis = ANALYSIS_EVENT_TYPES.includes(msg.eventType || '');
  const calendarType = isAnalysis ? 'analysis' : 'private';
  const calendarTitle = isSession ? 'Private Session' : msg.eventType || 'Session';

  const problems: string[] = [];
  const date = toIsoDate(msg.eventDate);
  const startTime = msg.eventStartTime ? parseTimeTo24h(msg.eventStartTime) : null;
  // Requests only carry a start time; sessions run an hour.
  const endTime = msg.eventEndTime ? parseTimeTo24h(msg.eventEndTime) : startTime ? addMinutes(startTime, 60) : null;

  let created: { id: string; startDateTime: string } | null = null;
  if (!date || !startTime || !endTime) {
    problems.push(
      `The date or time couldn't be read ("${msg.eventDate || '?'}, ${msg.eventStartTime || '?'}"), so it wasn't added to the calendar.`,
    );
  } else {
    try {
      const body = await callCalendarFunction('createEvent', {
        calendarType,
        eventData: {
          title: calendarTitle,
          location: msg.eventLocation || '',
          startDateTime: `${date}T${startTime}:00`,
          endDateTime: `${date}T${endTime}:00`,
          dateOnly: false,
        },
      });
      const raw = body.data || {};
      created = {
        id: raw.id || `event-${Date.now()}`,
        startDateTime: raw.start?.dateTime || (raw.start?.date ? `${raw.start.date}T00:00:00` : nowEstIso()),
      };
    } catch (e: any) {
      problems.push(`It couldn't be added to the calendar: ${e?.message || e}`);
    }
  }

  // A parent's request names the children ("For: Noah Yoseph"); parent
  // accounts can't be signed up themselves. A player's own request signs up the player.
  if (created) {
    try {
      const forLine = getForLine(msg.message) || [...thread].reverse().map((m) => getForLine(m.message)).find(Boolean) || '';
      const forNames = forLine
        .replace(/^For:\s*/i, '')
        .split(/\s*(?:,|&|\band\b)\s*/i)
        .map((n) => n.trim().toLowerCase().replace(/\s+/g, ' '))
        .filter(Boolean);
      const family = await getParentChildren(clientId).catch(() => []);

      if (family.length === 0) {
        await createEventSignup(created.id, calendarTitle, created.startDateTime, clientId);
      } else if (forNames.length === 0) {
        problems.push(
          "It's on the calendar, but no player was signed up: the request didn't name one of this family's children. Add them to the session from the calendar.",
        );
      } else {
        const unmatched: string[] = [];
        for (const forName of forNames) {
          const child = family.find((c) => normName(c.firstName, c.lastName) === forName);
          if (!child) {
            unmatched.push(forName);
            continue;
          }
          try {
            await createEventSignup(created.id, calendarTitle, created.startDateTime, clientId, {
              childId: child.id,
              childType: child.kind,
              firstName: child.firstName,
              lastName: child.lastName,
            });
          } catch (e: any) {
            problems.push(`It's on the calendar, but "${forName}" couldn't be signed up: ${e?.message || e}`);
          }
        }
        if (unmatched.length) {
          problems.push(
            `It's on the calendar, but couldn't match "${unmatched.join('", "')}" to one of this family's children. Add them to the session from the calendar.`,
          );
        }
      }
    } catch (e: any) {
      problems.push(`It's on the calendar, but the player couldn't be signed up: ${e?.message || e}`);
    }
  }
  return problems;
}
