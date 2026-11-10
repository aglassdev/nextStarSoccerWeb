import { ID, Query } from 'appwrite';
import { databases, databaseId, collections } from '@/services/appwrite';
import { googleCalendarService, isEventCancelled, type CalendarEvent } from '@/services/googleCalendar';
import {
  byStart,
  dayKeyOf,
  getEventById,
  resolveEvents,
  todayKey,
  toInstant,
  type ScheduleEvent,
} from '../account/schedule/scheduleData';

// Data for the web coach dashboard, worked out as the app's CoachDashboardScreen,
// CoachEventDetailScreen and CoachEventDashboardScreen do: the coach's sessions
// (coach_signups plus check-ins without a signup), each matched to its Google
// Calendar event and split into Ongoing / Upcoming / Past; one session's
// coaches, players and notes; and the same writes (sign up, cancel, check in,
// session notes, a cancellation request).

const PAGE = 1000;
const NOTIFICATIONS = 'notifications_scheduled';
const COACH_CHECKIN_REMINDER = 'coach_checkin_reminder';
const SESSION_NOTES = 'session_notes';
const CANCELLATION_REQUESTS = 'event_cancellation_requests';
/** The app's head-coach rule: either of them is head coach when they sign up. */
const HEAD_COACHES = ['Paul Torres', 'Philip Gyau', 'Phillip Gyau'];
/** Ongoing runs from 30 minutes before a session to 15 minutes after it. */
const EARLY_MS = 30 * 60 * 1000;
const LATE_MS = 15 * 60 * 1000;

export interface CoachSession extends ScheduleEvent {
  isHeadCoach?: boolean;
  /** The coach has checked in to it. */
  coachCheckedIn?: boolean;
}

export interface CoachSchedule {
  upcoming: CoachSession[];
  ongoing: CoachSession[];
  past: CoachSession[];
}

interface CoachRow {
  $id: string;
  $createdAt?: string;
  eventID: string;
  eventTitle: string;
  eventDate: string;
  coachUserId?: string;
  coaches?: string[];
  isHeadCoach?: boolean;
}

const list = async <T>(collectionId: string, queries: string[]) =>
  (await databases.listDocuments(databaseId, collectionId, queries)).documents as unknown as T[];

const coachRows = (collectionId: string, uid: string) =>
  list<CoachRow>(collectionId, [Query.equal('coachUserId', uid), Query.orderDesc('eventDate'), Query.limit(PAGE)]);

/** "2026-11-23" in Eastern time, as the app stores eventDate. */
export const estDate = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

export async function fetchCoachSchedule(uid: string): Promise<CoachSchedule> {
  const [signups, checkins] = await Promise.all([coachRows(collections.coachSignups, uid), coachRows(collections.coachCheckins, uid)]);

  // One row per event; a check-in without a signup still counts as a session.
  const rows = new Map<string, CoachRow>();
  for (const s of signups) if (!rows.has(s.eventID)) rows.set(s.eventID, s);
  for (const c of checkins) if (!rows.has(c.eventID)) rows.set(c.eventID, c);
  if (rows.size === 0) return { upcoming: [], ongoing: [], past: [] };

  const checkedIn = new Set(checkins.map((c) => c.eventID));
  const details = await resolveEvents([...rows.values()]);
  const now = Date.now();
  const today = todayKey();
  const out: CoachSchedule = { upcoming: [], ongoing: [], past: [] };

  for (const r of rows.values()) {
    const e = details.get(r.eventID);
    const base: CalendarEvent = e
      ? { ...e, id: r.eventID }
      : { id: r.eventID, title: r.eventTitle, startDateTime: r.eventDate, endDateTime: r.eventDate, dateOnly: true };
    const session: CoachSession = {
      ...base,
      signupId: r.$id,
      signupDate: r.$createdAt || '',
      signupTitle: r.eventTitle,
      isHeadCoach: !!signups.find((s) => s.eventID === r.eventID)?.isHeadCoach,
      coachCheckedIn: checkedIn.has(r.eventID),
      hasCheckin: checkedIn.has(r.eventID),
    };

    if (session.dateOnly) {
      const k = dayKeyOf(session.startDateTime, true);
      if (k > today || (k === today && !session.coachCheckedIn)) out.upcoming.push(session);
      else if (k === today) out.ongoing.push(session);
      else out.past.push(session);
      continue;
    }
    const start = toInstant(session.startDateTime).getTime();
    const end = toInstant(session.endDateTime).getTime();
    if (now > end + LATE_MS) out.past.push(session);
    else if (now >= start - EARLY_MS) out.ongoing.push(session);
    else out.upcoming.push(session);
  }

  // A cancelled session drops off once it's over (the app also deletes its coach records then).
  out.past = out.past.filter((e) => !isEventCancelled(e));
  out.upcoming.sort(byStart);
  out.ongoing.sort(byStart);
  out.past.sort((a, b) => byStart(b, a));
  return out;
}

/** Public group sessions in the next four weeks the coach can sign up to coach. */
export async function fetchOpenSessions(signedUp: Set<string>): Promise<{ events: CalendarEvent[]; coachCounts: Record<string, number> }> {
  const now = new Date();
  const months = [0, 1].map((i) => new Date(now.getFullYear(), now.getMonth() + i, 1));
  const lists = await Promise.all(
    months.map((d) => googleCalendarService.getEventsForMonth(d.getFullYear(), d.getMonth(), 'public').catch(() => [] as CalendarEvent[])),
  );
  const horizon = Date.now() + 28 * 86400000;
  const seen = new Set<string>();
  const events = lists
    .flat()
    .filter((e) => !seen.has(e.id) && seen.add(e.id))
    .filter((e) => toInstant(e.endDateTime).getTime() > Date.now() && toInstant(e.startDateTime).getTime() < horizon)
    .filter((e) => !isEventCancelled(e) && !signedUp.has(e.id))
    .sort(byStart);
  const coachCounts: Record<string, number> = {};
  if (events.length) {
    const all = await list<CoachRow>(collections.coachSignups, [Query.equal('eventID', events.map((e) => e.id).slice(0, 100)), Query.limit(PAGE)]);
    for (const s of all) coachCounts[s.eventID] = (coachCounts[s.eventID] || 0) + 1;
  }
  return { events, coachCounts };
}

// ---------------------------------------------------------------- one session

export interface SessionPerson {
  key: string;
  name: string;
  lastName: string;
}

export interface SessionCoach {
  userId: string;
  name: string;
  checkedIn: boolean;
  isHeadCoach: boolean;
}

export interface SessionNote {
  $id: string;
  content: string;
  $updatedAt: string;
}

export interface SessionDetail {
  event: CalendarEvent | null;
  coaches: SessionCoach[];
  /** Signed up, not checked in yet. */
  signedUp: SessionPerson[];
  checkedIn: SessionPerson[];
  note: SessionNote | null;
  /** This coach's signup for it, if any. */
  mySignup: CoachRow | null;
  myCheckin: boolean;
}

interface PlayerRow {
  $id: string;
  eventID: string;
  eventTitle?: string;
  eventDate?: string;
  calendarSource?: string;
  userId?: string;
  firstName?: string;
  lastName?: string;
  onBehalfOfUserId?: string | null;
  onBehalfOfProxyId?: string | null;
}

/** A player is their proxy id, else the account they're on, else the signing account (siblings stay apart). */
const personKey = (r: PlayerRow) => r.onBehalfOfProxyId || r.onBehalfOfUserId || r.userId || r.$id;
const byLast = (a: SessionPerson, b: SessionPerson) => a.lastName.localeCompare(b.lastName) || a.name.localeCompare(b.name);

export async function fetchSessionDetail(eventId: string, uid: string, known?: CalendarEvent | null): Promise<SessionDetail> {
  const byEvent = [Query.equal('eventID', eventId), Query.limit(PAGE)];
  const [coachSignups, coachCheckins, signups, checkins, notes] = await Promise.all([
    list<CoachRow>(collections.coachSignups, byEvent),
    list<CoachRow>(collections.coachCheckins, byEvent),
    list<PlayerRow>(collections.signups, byEvent),
    list<PlayerRow>(collections.checkins, byEvent),
    list<SessionNote>(SESSION_NOTES, [Query.equal('eventID', eventId), Query.orderDesc('$createdAt'), Query.limit(1)]).catch(() => []),
  ]);

  let event = known ?? null;
  if (!event) {
    const ref = coachSignups[0] || coachCheckins[0] || signups[0] || checkins[0];
    const found = ref ? await resolveEvents([{ eventID: eventId, eventDate: ref.eventDate || '', calendarSource: (ref as PlayerRow).calendarSource }]) : null;
    event = found?.get(eventId) ?? (await getEventById(eventId));
    if (!event && ref) {
      event = { id: eventId, title: ref.eventTitle || 'Untitled Event', startDateTime: ref.eventDate || '', endDateTime: ref.eventDate || '', dateOnly: true };
    }
  }

  // Coaches who signed up, and any who checked in without signing up.
  const coachIn = new Set(coachCheckins.map((c) => c.coachUserId));
  const coachMap = new Map<string, SessionCoach>();
  for (const r of [...coachSignups, ...coachCheckins]) {
    const id = r.coachUserId || r.$id;
    const prev = coachMap.get(id);
    coachMap.set(id, {
      userId: id,
      name: prev?.name || r.coaches?.[0] || 'Coach',
      checkedIn: coachIn.has(id),
      isHeadCoach: !!prev?.isHeadCoach || (coachSignups.includes(r) && !!r.isHeadCoach),
    });
  }
  const coaches = [...coachMap.values()].sort((a, b) => Number(b.isHeadCoach) - Number(a.isHeadCoach) || a.name.localeCompare(b.name));

  const person = (r: PlayerRow): SessionPerson => ({
    key: personKey(r),
    name: `${r.firstName || ''} ${r.lastName || ''}`.trim() || 'Player',
    lastName: r.lastName || '',
  });
  const inKeys = new Set(checkins.map(personKey));
  const uniq = (rows: PlayerRow[]) => [...new Map(rows.map((r) => [personKey(r), person(r)])).values()];

  return {
    event,
    coaches,
    signedUp: uniq(signups.filter((s) => !inKeys.has(personKey(s)))).sort(byLast),
    checkedIn: uniq(checkins).sort(byLast),
    note: notes[0] ?? null,
    mySignup: coachSignups.find((s) => s.coachUserId === uid) ?? null,
    myCheckin: coachIn.has(uid),
  };
}

// ---------------------------------------------------------------- writes

/** Sign up to coach (the app's head-coach rule and check-in reminder). */
export async function signUpToCoach(ev: CalendarEvent, uid: string, coachName: string) {
  const existing = await list<CoachRow>(collections.coachSignups, [Query.equal('eventID', ev.id), Query.limit(PAGE)]);
  const headSignedUp = existing.some((d) => (d.coaches || []).some((c) => HEAD_COACHES.includes(c)));
  const isHead = HEAD_COACHES.includes(coachName);
  if (isHead) {
    for (const d of existing) await databases.updateDocument(databaseId, collections.coachSignups, d.$id, { isHeadCoach: false });
  }
  const doc = await databases.createDocument(databaseId, collections.coachSignups, ID.unique(), {
    eventID: ev.id,
    eventTitle: ev.title,
    eventDate: estDate(ev.startDateTime),
    coachUserId: uid,
    coaches: [coachName],
    isHeadCoach: isHead || !headSignedUp,
  });

  // A reminder to take attendance when the session starts.
  if (toInstant(ev.startDateTime).getTime() > Date.now()) {
    const pending = await list<any>(NOTIFICATIONS, [
      Query.equal('eventId', ev.id), Query.equal('notificationType', COACH_CHECKIN_REMINDER), Query.limit(50),
    ]).catch(() => []);
    if (!pending.some((d) => (d.userIds || []).includes(uid))) {
      await databases.createDocument(databaseId, NOTIFICATIONS, ID.unique(), {
        signupId: doc.$id,
        userIds: [uid],
        eventId: ev.id,
        eventTitle: ev.title || 'Event',
        eventDate: ev.startDateTime,
        eventType: 'coach',
        notificationType: COACH_CHECKIN_REMINDER,
        sendAt: toInstant(ev.startDateTime).toISOString(),
        title: 'Check-ins are open',
        body: `${ev.title || 'Your session'} is starting — take attendance now.`,
        screen: 'CoachEventDashboard',
        status: 'pending',
        createdAt: new Date().toISOString(),
      }).catch(() => {});
    }
  }
}

/** Cancel coaching a session: the coach's signups for it and their pending reminder. */
export async function cancelCoaching(eventId: string, uid: string) {
  const rows = await list<CoachRow>(collections.coachSignups, [Query.equal('eventID', eventId), Query.equal('coachUserId', uid), Query.limit(20)]);
  for (const d of rows) await databases.deleteDocument(databaseId, collections.coachSignups, d.$id);
  const reminders = await list<any>(NOTIFICATIONS, [
    Query.equal('eventId', eventId), Query.equal('notificationType', COACH_CHECKIN_REMINDER), Query.limit(50),
  ]).catch(() => []);
  for (const d of reminders) {
    if (d.status === 'pending' && (d.userIds || []).includes(uid)) {
      await databases.deleteDocument(databaseId, NOTIFICATIONS, d.$id).catch(() => {});
    }
  }
}

/** The coach's own check-in (open from 30 minutes before a session until it ends). */
export async function coachCheckIn(ev: CalendarEvent, uid: string, coachName: string) {
  const existing = await list<CoachRow>(collections.coachCheckins, [Query.equal('eventID', ev.id), Query.equal('coachUserId', uid), Query.limit(1)]);
  if (existing.length) return;
  await databases.createDocument(databaseId, collections.coachCheckins, ID.unique(), {
    eventID: ev.id,
    eventTitle: ev.title || 'Untitled Event',
    eventDate: ev.dateOnly ? ev.startDateTime.slice(0, 10) : estDate(ev.startDateTime),
    coachUserId: uid,
    coaches: [coachName],
  });
}

export const canCoachCheckIn = (ev: CalendarEvent) => {
  if (ev.dateOnly) return dayKeyOf(ev.startDateTime, true) === todayKey();
  const now = Date.now();
  return now >= toInstant(ev.startDateTime).getTime() - EARLY_MS && now <= toInstant(ev.endDateTime).getTime();
};

/** The session's notes: one shared note per session, as in the app. */
export async function saveSessionNote(ev: CalendarEvent, note: SessionNote | null, content: string, uid: string, coachName: string) {
  if (note) return (await databases.updateDocument(databaseId, SESSION_NOTES, note.$id, { content })) as unknown as SessionNote;
  const start = toInstant(ev.startDateTime);
  const hm = ev.dateOnly ? '00:00' : start.toLocaleTimeString('en-GB', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false });
  return (await databases.createDocument(databaseId, SESSION_NOTES, ID.unique(), {
    content,
    sessionTime: hm,
    sessionDate: ev.dateOnly ? ev.startDateTime.slice(0, 10) : estDate(ev.startDateTime),
    eventID: ev.id,
    coachUserId: uid,
    coachName,
  })) as unknown as SessionNote;
}

/** Ask an admin to cancel the session (the calendar event itself isn't changed). */
export async function requestCancellation(ev: CalendarEvent, uid: string, coachName: string) {
  await databases.createDocument(databaseId, CANCELLATION_REQUESTS, ID.unique(), {
    eventID: ev.id,
    eventTitle: ev.title || 'Untitled Event',
    eventDate: ev.startDateTime,
    requestedBy: uid,
    requestedByName: coachName,
    status: 'pending',
    requestedAt: new Date().toISOString(),
  });
}
