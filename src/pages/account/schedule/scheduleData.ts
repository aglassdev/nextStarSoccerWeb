import { Query } from 'appwrite';
import { databases, databaseId, collections, functions } from '@/services/appwrite';
import { googleCalendarService, isEventCancelled, EASTERN, type CalendarEvent } from '@/services/googleCalendar';
import { getParentChildren, type ParentChild } from '@/services/clinicRegistration';

// Data for My Schedule, worked out the way the app's MyScheduleScreen does it:
// the account's (or a parent's players') session signups plus any check-ins
// without a signup, each matched to its Google Calendar event, then split into
// Ongoing / Upcoming / Past in Eastern time.

const CALENDAR_FUNCTION_ID = '68c373b50026f961bdc4';
// The app notes Appwrite's default page size (25) silently drops sessions, so
// every list here asks for an explicit large page.
const PAGE = 1000;

export interface ScheduleEvent extends CalendarEvent {
  signupId: string;
  signupDate: string;
  signupTitle: string;
  signupType?: string;
  hasCheckin?: boolean;
}

export interface ScheduleData {
  upcoming: ScheduleEvent[];
  ongoing: ScheduleEvent[];
  past: ScheduleEvent[];
  /** Parents: event id → first names of the players going. */
  childNames: Record<string, string[]>;
  /** Parents: event id → ids of the players signed up (pre-selected when cancelling). */
  childSignupIds: Record<string, string[]>;
}

/** A signup or check-in row (the coach dashboard reads the same shape). */
export interface Row {
  $id: string;
  $createdAt?: string;
  eventID: string;
  eventTitle: string;
  eventDate: string;
  timestamp?: string;
  type?: string;
  calendarSource?: string;
  userId?: string;
  parentSignupId?: string | null;
  parentCheckinId?: string | null;
  onBehalfOfUserId?: string | null;
  onBehalfOfProxyId?: string | null;
}

// ---------------------------------------------------------------- time (Eastern)

const BARE_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HAS_ZONE = /(Z|[+-]\d{2}:?\d{2})$/i;

const partsFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: EASTERN, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
const easternParts = (d: Date) => {
  const p = Object.fromEntries(partsFmt.formatToParts(d).map((x) => [x.type, x.value]));
  return { key: `${p.year}-${p.month}-${p.day}`, hm: `${p.hour}:${p.minute}` };
};

/** The instant an event time refers to. Times without a zone are Eastern wall-clock times. */
export const toInstant = (iso: string): Date => {
  if (!iso) return new Date(NaN);
  if (HAS_ZONE.test(iso)) return new Date(iso);
  const [date, time = '00:00'] = iso.split('T');
  const hm = time.slice(0, 5);
  for (const off of ['-05:00', '-04:00']) {
    const d = new Date(`${date}T${hm}:00${off}`);
    const p = easternParts(d);
    if (p.key === date && p.hm === hm) return d;
  }
  return new Date(`${date}T${hm}:00-05:00`);
};

/** "2026-11-06": the Eastern calendar day an event falls on. */
export const dayKeyOf = (iso: string, dateOnly = false): string => {
  if (!iso) return '';
  if (dateOnly || BARE_DATE.test(iso) || !HAS_ZONE.test(iso)) return iso.slice(0, 10);
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : easternParts(d).key;
};

export const todayKey = () => easternParts(new Date()).key;

export const keyToLocalDate = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** The card's "Nov 6 | 5:30 PM" (or "All Day"). */
export const formatCardDateTime = (e: CalendarEvent) => {
  const key = dayKeyOf(e.startDateTime, e.dateOnly);
  const date = key ? keyToLocalDate(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
  const time = e.dateOnly
    ? 'All Day'
    : toInstant(e.startDateTime).toLocaleTimeString('en-US', { timeZone: EASTERN, hour: 'numeric', minute: '2-digit', hour12: true });
  return { date, time };
};

export const formatClock = (iso: string) =>
  toInstant(iso).toLocaleTimeString('en-US', { timeZone: EASTERN, hour: 'numeric', minute: '2-digit', hour12: true });

/** "November 6th, 2026", as the app's event page heads it. */
export const formatDateWithOrdinal = (e: CalendarEvent) => {
  const key = dayKeyOf(e.startDateTime, e.dateOnly);
  if (!key) return '';
  const d = keyToLocalDate(key);
  const day = d.getDate();
  const ord = day === 1 || day === 21 || day === 31 ? 'st' : day === 2 || day === 22 ? 'nd' : day === 3 || day === 23 ? 'rd' : 'th';
  return `${d.toLocaleDateString('en-US', { month: 'long' })} ${day}${ord}, ${d.getFullYear()}`;
};

/** "Paul Torres Field, 123 Main St, ..." → "Paul Torres Field". */
export const locationName = (location?: string | null) => (location ? location.split(',')[0].trim() : null);

export const byStart = (a: CalendarEvent, b: CalendarEvent) => toInstant(a.startDateTime).getTime() - toInstant(b.startDateTime).getTime();

// ---------------------------------------------------------------- calendar + streak

export const sessionsByDay = (events: ScheduleEvent[]) => {
  const map = new Map<string, number>();
  for (const e of events) {
    const k = dayKeyOf(e.startDateTime, e.dateOnly);
    if (k) map.set(k, (map.get(k) || 0) + 1);
  }
  return map;
};

const shiftKey = (key: string, days: number) => {
  const d = keyToLocalDate(key);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Consecutive days with a past session, ending today or yesterday. */
export const calculateStreak = (past: ScheduleEvent[]) => {
  const days = new Set(past.map((e) => dayKeyOf(e.startDateTime, e.dateOnly)).filter(Boolean));
  const today = todayKey();
  let cursor: string;
  if (days.has(today)) cursor = today;
  else if (days.has(shiftKey(today, -1))) cursor = shiftKey(today, -1);
  else return { streak: 0, active: false };
  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor = shiftKey(cursor, -1);
  }
  return { streak, active: true };
};

// ---------------------------------------------------------------- Appwrite reads

const list = async (collectionId: string, queries: string[]): Promise<Row[]> =>
  (await databases.listDocuments(databaseId, collectionId, queries)).documents as unknown as Row[];

const uniqById = (rows: Row[]) => rows.filter((r, i, all) => all.findIndex((x) => x.$id === r.$id) === i);

/** The account's own signups plus ones a parent made for them (eventSignupsService.getUserSignups). */
async function getUserSignups(userId: string) {
  const [own, byParent] = await Promise.all([
    list(collections.signups, [Query.equal('userId', userId), Query.isNull('parentSignupId'), Query.orderDesc('eventDate'), Query.limit(PAGE)]),
    list(collections.signups, [Query.equal('onBehalfOfUserId', userId), Query.orderDesc('eventDate'), Query.limit(PAGE)]),
  ]);
  return uniqById([...own, ...byParent]);
}

/** A player's signups, made by the parent or (real accounts) by themselves (getChildSignups). */
async function getChildSignups(childId: string, kind: 'proxy' | 'real') {
  try {
    const reads = [
      list(collections.signups, [
        Query.equal(kind === 'proxy' ? 'onBehalfOfProxyId' : 'onBehalfOfUserId', childId),
        Query.orderDesc('eventDate'),
        Query.limit(PAGE),
      ]),
    ];
    if (kind === 'real') {
      reads.push(list(collections.signups, [Query.equal('userId', childId), Query.isNull('parentSignupId'), Query.orderDesc('eventDate'), Query.limit(PAGE)]));
    }
    return uniqById((await Promise.all(reads)).flat());
  } catch {
    return [];
  }
}

/** The account's own check-ins plus ones a parent made for them (getUserCheckins). */
async function getUserCheckins(userId: string) {
  const [own, byParent] = await Promise.all([
    list(collections.checkins, [Query.equal('userId', userId), Query.isNull('parentCheckinId'), Query.orderDesc('eventDate'), Query.limit(PAGE)]),
    list(collections.checkins, [Query.equal('onBehalfOfUserId', userId), Query.orderDesc('eventDate'), Query.limit(PAGE)]),
  ]);
  return uniqById([...own, ...byParent]);
}

async function getChildCheckins(childId: string, kind: 'proxy' | 'real') {
  try {
    return await list(collections.checkins, [
      Query.equal(kind === 'proxy' ? 'onBehalfOfProxyId' : 'onBehalfOfUserId', childId),
      Query.orderDesc('eventDate'),
      Query.limit(PAGE),
    ]);
  } catch {
    return [];
  }
}

/**
 * Whether the account manages players, as familyPermissionService.isParent
 * decides it (a parent account, or an active family relationship as parent),
 * and which players.
 */
export async function resolveFamily(
  userId: string,
  userType: string | null,
  contextChildren: ParentChild[],
): Promise<{ isParent: boolean; children: ParentChild[] }> {
  if (userType === 'parent') return { isParent: true, children: contextChildren };
  try {
    const rels = await list(collections.familyRelationships001, [Query.equal('parentUserId', userId), Query.equal('status', 'active'), Query.limit(1)]);
    if (rels.length > 0) return { isParent: true, children: await getParentChildren(userId).catch(() => []) };
  } catch {
    /* not a parent */
  }
  return { isParent: false, children: [] };
}

// ---------------------------------------------------------------- Google Calendar

const transformCalendarEvent = (raw: any): CalendarEvent => {
  let startDateTime = new Date().toISOString();
  let endDateTime = startDateTime;
  let dateOnly = false;
  if (raw.start?.dateTime) startDateTime = raw.start.dateTime;
  else if (raw.start?.date) { startDateTime = `${raw.start.date}T00:00:00`; dateOnly = true; }
  if (raw.end?.dateTime) endDateTime = raw.end.dateTime;
  else if (raw.end?.date) { endDateTime = `${raw.end.date}T23:59:59`; dateOnly = true; }
  return {
    id: raw.id,
    title: raw.summary || raw.title || 'Untitled Event',
    description: raw.description || undefined,
    location: raw.location || undefined,
    startDateTime,
    endDateTime,
    dateOnly,
  };
};

/** One event by id through the shared calendar function, as the app's googleCalendarService.getEventById. */
export async function getEventById(eventId: string, calendarSource?: string): Promise<CalendarEvent | null> {
  try {
    const calendarType = calendarSource === 'public' || calendarSource === 'private' ? calendarSource : undefined;
    const res = await functions.createExecution(
      CALENDAR_FUNCTION_ID,
      JSON.stringify({ service: 'google-calendar', action: 'getEventById', eventId, calendarType }),
      false,
    );
    if (res.status !== 'completed' || res.responseStatusCode !== 200) return null;
    const body = JSON.parse(res.responseBody);
    return body?.success && body.data ? transformCalendarEvent(body.data) : null;
  } catch {
    return null;
  }
}

async function eachLimited<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await fn(items[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

/**
 * Each signup's calendar event. The app asks the calendar function for every
 * event one by one; here the months the sessions fall in are read first (one
 * request per month, the same events) and only what's still missing — moved
 * or private events — is looked up by id, so a long history loads quickly and
 * stays under the function's rate limit.
 */
type EventRef = Pick<Row, 'eventID' | 'eventDate' | 'calendarSource'>;

export async function resolveEvents(rows: EventRef[]): Promise<Map<string, CalendarEvent>> {
  const found = new Map<string, CalendarEvent>();
  const fillMonths = async (subset: EventRef[], calendar: 'public' | 'private') => {
    const months = [...new Set(subset.map((r) => dayKeyOf(r.eventDate).slice(0, 7)).filter((m) => m.length === 7))];
    const lists = await Promise.all(
      months.map((ym) => {
        const [y, m] = ym.split('-').map(Number);
        return googleCalendarService.getEventsForMonth(y, m - 1, calendar).catch(() => [] as CalendarEvent[]);
      }),
    );
    for (const events of lists) for (const e of events) if (!found.has(e.id)) found.set(e.id, e);
  };

  await fillMonths(rows, 'public');
  let missing = rows.filter((r) => !found.has(r.eventID));
  if (missing.length) {
    await fillMonths(missing, 'private');
    missing = missing.filter((r) => !found.has(r.eventID));
  }
  await eachLimited(missing, 6, async (r) => {
    const e = await getEventById(r.eventID, r.calendarSource);
    if (e) found.set(r.eventID, e);
  });
  return found;
}

// ---------------------------------------------------------------- the schedule

export async function fetchSchedule(userId: string, isParent: boolean, children: ParentChild[]): Promise<ScheduleData> {
  let signups: Row[] = [];
  let checkins: Row[] = [];
  const names = new Map<string, string[]>();
  const ids = new Map<string, string[]>();
  const addTo = (map: Map<string, string[]>, key: string, value: string) => {
    const arr = map.get(key) || [];
    if (!arr.includes(value)) arr.push(value);
    map.set(key, arr);
  };

  if (isParent) {
    // Every player's signups; one row per event.
    const perChild = await Promise.all(children.map((c) => getChildSignups(c.id, c.kind)));
    const seen = new Set<string>();
    children.forEach((child, i) => {
      for (const s of perChild[i]) {
        addTo(names, s.eventID, child.firstName);
        addTo(ids, s.eventID, child.id);
        if (!seen.has(s.eventID)) {
          seen.add(s.eventID);
          signups.push(s);
        }
      }
    });

    // Check-ins: the parent's own, and each player's by every route the app tries.
    const [own, byThisParent, perChildCheckins, perChildDirect] = await Promise.all([
      getUserCheckins(userId),
      list(collections.checkins, [Query.equal('parentCheckinId', userId), Query.limit(PAGE)]).catch(() => [] as Row[]),
      Promise.all(children.map((c) => getChildCheckins(c.id, c.kind))),
      Promise.all(
        children.map((c) => list(collections.checkins, [Query.equal('userId', c.id), Query.limit(PAGE)]).catch(() => [] as Row[])),
      ),
    ]);
    checkins = [...own];
    children.forEach((child, i) => {
      const mine = uniqById([
        ...perChildCheckins[i],
        ...perChildDirect[i],
        ...byThisParent.filter((c) =>
          child.kind === 'real' ? c.onBehalfOfUserId === child.id : c.onBehalfOfProxyId === child.id,
        ),
      ]);
      for (const c of mine) addTo(names, c.eventID, child.firstName);
      checkins.push(...mine);
    });
  } else {
    // The account's own signups and check-ins (including ones a parent made for them).
    [signups, checkins] = await Promise.all([getUserSignups(userId), getUserCheckins(userId)]);
  }

  // A check-in with no signup (walk-in) still counts as a session.
  for (const c of checkins) {
    if (!signups.some((s) => s.eventID === c.eventID)) {
      signups.push({
        $id: c.$id,
        eventID: c.eventID,
        eventTitle: c.eventTitle,
        eventDate: c.eventDate,
        timestamp: c.$createdAt,
        calendarSource: c.calendarSource,
        type: 'bill',
      });
    }
  }

  const childNames = Object.fromEntries(names);
  const childSignupIds = Object.fromEntries(ids);
  if (signups.length === 0) return { upcoming: [], ongoing: [], past: [], childNames, childSignupIds };

  const unique = new Map<string, Row>();
  for (const s of signups) if (!unique.has(s.eventID)) unique.set(s.eventID, s);
  const rows = [...unique.values()];

  const details = await resolveEvents(rows);
  const events: ScheduleEvent[] = rows.map((s) => {
    const e = details.get(s.eventID);
    const base: CalendarEvent = e
      ? { ...e, id: s.eventID }
      : { id: s.eventID, title: s.eventTitle, startDateTime: s.eventDate, endDateTime: s.eventDate, dateOnly: false };
    return {
      ...base,
      signupId: s.$id,
      signupDate: s.timestamp || s.$createdAt || '',
      signupTitle: s.eventTitle,
      signupType: s.type || 'bill',
    };
  });

  // A cancelled session keeps its signups and stays listed (marked CANCELLED)
  // until it's over; its check-ins are removed (by the admin's Cancel Session
  // and the app) so nobody is billed, so it never shows under Past.
  const live = events.filter((e) => !isEventCancelled(e) || toInstant(e.endDateTime).getTime() >= Date.now());
  const checkedIn = new Set(checkins.map((c) => c.eventID));

  const now = Date.now();
  const today = todayKey();
  const upcoming: ScheduleEvent[] = [];
  const ongoing: ScheduleEvent[] = [];
  const pastAll: ScheduleEvent[] = [];

  for (const e of live) {
    const hasCheckin = checkedIn.has(e.id);
    if (e.dateOnly) {
      const k = dayKeyOf(e.startDateTime, true);
      if (k >= today) {
        if (hasCheckin && k === today) ongoing.push({ ...e, hasCheckin: true });
        else upcoming.push({ ...e, hasCheckin });
      } else pastAll.push({ ...e, hasCheckin });
    } else {
      const start = toInstant(e.startDateTime).getTime();
      const end = toInstant(e.endDateTime).getTime();
      if (end >= now) {
        if (start <= now && hasCheckin) ongoing.push({ ...e, hasCheckin: true });
        else upcoming.push({ ...e, hasCheckin });
      } else pastAll.push({ ...e, hasCheckin });
    }
  }

  // Past sessions count only if attended (checked in) or prepaid.
  const past = pastAll.filter((e) => !isEventCancelled(e) && (e.signupType === 'prepaid' || e.hasCheckin));

  upcoming.sort(byStart);
  ongoing.sort(byStart);
  past.sort((a, b) => byStart(b, a));
  return { upcoming, ongoing, past, childNames, childSignupIds };
}

// ---------------------------------------------------------------- cancelling

/** eventSignupsService.deleteEventSignup: the same ownership check, then delete. */
async function deleteEventSignup(signupId: string, requesterId: string) {
  const s = (await databases.getDocument(databaseId, collections.signups, signupId)) as unknown as Row;
  const canDelete =
    (s.userId === requesterId && !s.parentSignupId) || s.parentSignupId === requesterId || s.onBehalfOfUserId === requesterId;
  if (!canDelete) throw new Error('Permission denied: Cannot delete this signup');
  await databases.deleteDocument(databaseId, collections.signups, signupId);
}

/** A player cancelling their own signup (or one a parent made for them). */
export async function cancelOwnSignup(eventId: string, userId: string) {
  const own = (await getUserSignups(userId)).find((s) => s.eventID === eventId);
  if (own) return deleteEventSignup(own.$id, userId);
  const viaParent = (await getChildSignups(userId, 'real')).find((s) => s.eventID === eventId);
  if (viaParent) await deleteEventSignup(viaParent.$id, userId);
}

/** A parent cancelling the selected players' signups for one event. */
export async function cancelChildSignups(eventId: string, childIds: string[], children: ParentChild[], userId: string) {
  for (const id of childIds) {
    const child = children.find((c) => c.id === id);
    if (!child) continue;
    const signup = (await getChildSignups(child.id, child.kind)).find((s) => s.eventID === eventId);
    if (signup) await deleteEventSignup(signup.$id, userId);
  }
}

// ---------------------------------------------------------------- event details

/**
 * The coach line on the event page (EventDetailScreen.resolveCoachName):
 * coach sign-ups (head coach first) and check-ins, named from the Coaches
 * profiles; otherwise, for non-camp sessions, the calendar note.
 */
export async function resolveCoachName(event: CalendarEvent): Promise<string | null> {
  if (isEventCancelled(event)) return null;
  const isCamp = (event.title || '').toLowerCase().includes('camp');
  try {
    const nameById = new Map<string, string>();
    try {
      const coaches = await databases.listDocuments(databaseId, collections.coaches, [Query.limit(500)]);
      for (const c of coaches.documents as any[]) {
        const n = `${c.firstName || ''} ${c.lastName || ''}`.trim();
        if (c.userId && n) nameById.set(c.userId, n);
      }
    } catch {
      /* best effort */
    }
    const looksLikeName = (v: string) => !!v && v.includes(' ') && !/^[a-z0-9]{15,}$/i.test(v.replace(/\s/g, ''));
    const names: string[] = [];
    const addFrom = (doc: any) => {
      let name = (doc?.coachUserId && nameById.get(doc.coachUserId)) || '';
      if (!name && Array.isArray(doc?.coaches)) {
        name = doc.coaches.map((c: any) => (typeof c === 'string' ? c.trim() : '')).find(looksLikeName) || '';
      }
      if (name && !names.includes(name)) names.push(name);
    };
    const signups = await databases.listDocuments(databaseId, collections.coachSignups, [Query.equal('eventID', event.id), Query.limit(PAGE)]);
    [...signups.documents].sort((a: any, b: any) => (b.isHeadCoach ? 1 : 0) - (a.isHeadCoach ? 1 : 0)).forEach(addFrom);
    try {
      const checkins = await databases.listDocuments(databaseId, collections.coachCheckins, [Query.equal('eventID', event.id), Query.limit(PAGE)]);
      checkins.documents.forEach(addFrom);
    } catch {
      /* best effort */
    }
    if (names.length) return names.join(', ');
    if (!isCamp && (event.description || '').trim()) return event.description!.trim();
    return null;
  } catch {
    return null;
  }
}
