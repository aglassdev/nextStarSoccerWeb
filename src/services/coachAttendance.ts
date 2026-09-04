import { Query } from "appwrite";
import { databases, databaseId, collections } from "./appwrite";
import {
  googleCalendarService,
  CalendarEvent,
  isEventCancelled,
  getEventCoachesFromDescription,
  buildCoachNameVocabulary,
} from "./googleCalendar";

export type CalType = "public" | "private";

// How a session was credited to a coach.
//  checkin  — a coach check-in document exists (most reliable)
//  signup   — only a signup exists, but attendance was taken that day, so the
//             missing check-in is the known check-in bug rather than an absence
//  calendar — parsed from the Google Calendar description (head-coach entered,
//             frequently inaccurate, kept as a separate statistic)
export type AttendanceVia = "checkin" | "signup" | "calendar";

export interface CoachSession {
  eventId: string;
  title: string;
  startDateTime: string;
  endDateTime: string;
  dateOnly?: boolean;
  via: AttendanceVia;
}

export interface CoachRow {
  key: string;
  name: string;
  userId?: string;
  inRoster: boolean;
  tracked: CoachSession[];
  calendar: CoachSession[];
}

export interface EventCoaches {
  tracked: { name: string; via: AttendanceVia }[];
  calendar: string[];
}

export interface CoachAttendanceData {
  coaches: CoachRow[];
  events: CalendarEvent[];
  coachesByEvent: Record<string, EventCoaches>;
  revenueByEvent: Record<string, number>;
  builtAt: string;
}

export const normalizeName = (name: string): string =>
  name.trim().toLowerCase().replace(/\s+/g, " ");

// Test/internal accounts kept out of attendance and payout reporting.
const HIDDEN_COACHES = new Set(["coach testing"]);

// The same person entered under different names, mostly in calendar
// descriptions. Keys are normalized; values are the name to merge into.
const COACH_ALIASES: Record<string, string> = {
  "coach kareem": "Karim Metwalli",
  "kareem metwalli": "Karim Metwalli",
};

export const isHiddenCoach = (name: string): boolean =>
  HIDDEN_COACHES.has(normalizeName(name));

// Resolves a name to the single identity it should be counted under.
export const canonicalCoachName = (name: string): string =>
  COACH_ALIASES[normalizeName(name)] ?? name.trim();

async function listAll(collectionId: string): Promise<any[]> {
  const out: any[] = [];
  let cursor: string | null = null;
  for (;;) {
    const queries = [Query.limit(100)];
    if (cursor) queries.push(Query.cursorAfter(cursor));
    const res: any = await databases.listDocuments(databaseId, collectionId, queries);
    out.push(...res.documents);
    if (res.documents.length < 100) break;
    cursor = res.documents[res.documents.length - 1].$id;
  }
  return out;
}

const safeList = (collectionId?: string): Promise<any[]> =>
  collectionId ? listAll(collectionId).catch(() => []) : Promise.resolve([]);

// Pulls both calendars across a ±12 month window, matching the player
// attendance manager's range.
async function loadEvents(): Promise<CalendarEvent[]> {
  const now = new Date();
  const ranges: { y: number; m: number }[] = [];
  for (let offset = -12; offset <= 12; offset++) {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    ranges.push({ y: d.getFullYear(), m: d.getMonth() });
  }
  const fetchAll = (type: CalType) =>
    Promise.all(
      ranges.map(r => googleCalendarService.getEventsForMonth(r.y, r.m, type).catch(() => []))
    ).then(arrs => arrs.flat());

  const [pub, priv] = await Promise.all([fetchAll("public"), fetchAll("private")]);
  const map = new Map<string, CalendarEvent>();
  for (const e of [...pub, ...priv]) if (!isEventCancelled(e)) map.set(e.id, e);
  return Array.from(map.values()).sort(
    (a, b) => Date.parse(a.startDateTime) - Date.parse(b.startDateTime)
  );
}

export async function buildCoachAttendance(): Promise<CoachAttendanceData> {
  const [coachDocs, signups, checkins, playerCheckins, billItems, events] = await Promise.all([
    safeList(collections.coaches),
    safeList(collections.coachSignups),
    safeList(collections.coachCheckins),
    safeList(collections.checkins),
    safeList(collections.billItems),
    loadEvents(),
  ]);

  const eventById = new Map(events.map(e => [e.id, e]));

  // An event counts as "attendance taken" if anyone was marked present that day.
  // Coach signups on such events are credited despite the missing check-in doc.
  const attendanceTaken = new Set<string>();
  for (const c of playerCheckins) if (c.eventID) attendanceTaken.add(c.eventID);
  for (const c of checkins) if (c.eventID) attendanceTaken.add(c.eventID);

  const nameByUserId = new Map<string, string>();
  const coachRows = new Map<string, CoachRow>();

  const ensureRow = (rawName: string, userId?: string, inRoster = false): CoachRow => {
    const name = canonicalCoachName(rawName);
    const key = normalizeName(name);
    let row = coachRows.get(key);
    if (!row) {
      row = { key, name, userId, inRoster, tracked: [], calendar: [] };
      coachRows.set(key, row);
    }
    if (userId && !row.userId) row.userId = userId;
    if (inRoster) { row.inRoster = true; row.name = name; }
    return row;
  };

  for (const doc of coachDocs) {
    const name = `${doc.firstName ?? ""} ${doc.lastName ?? ""}`.trim();
    if (!name || isHiddenCoach(name)) continue;
    if (doc.userId) nameByUserId.set(doc.userId, name);
    ensureRow(name, doc.userId, true);
  }

  const coachesByEvent: Record<string, EventCoaches> = {};
  const ensureEvent = (eventId: string): EventCoaches => {
    if (!coachesByEvent[eventId]) coachesByEvent[eventId] = { tracked: [], calendar: [] };
    return coachesByEvent[eventId];
  };

  const creditedPairs = new Set<string>();
  const credit = (doc: any, via: AttendanceVia) => {
    const name = nameByUserId.get(doc.coachUserId);
    if (!name || !doc.eventID || isHiddenCoach(name)) return;
    const pair = `${doc.eventID}::${doc.coachUserId}`;
    if (creditedPairs.has(pair)) return;
    creditedPairs.add(pair);

    const ev = eventById.get(doc.eventID);
    const row = ensureRow(name, doc.coachUserId, true);
    row.tracked.push({
      eventId: doc.eventID,
      title: ev?.title || doc.eventTitle || "Untitled session",
      startDateTime: ev?.startDateTime || doc.eventDate,
      endDateTime: ev?.endDateTime || doc.eventDate,
      dateOnly: ev?.dateOnly,
      via,
    });
    ensureEvent(doc.eventID).tracked.push({ name, via });
  };

  // Check-ins first so they win over a rescued signup for the same pair.
  for (const doc of checkins) credit(doc, "checkin");
  for (const doc of signups) {
    if (attendanceTaken.has(doc.eventID)) credit(doc, "signup");
  }

  // Calendar-description coaches, tracked as a separate statistic.
  const roster = coachDocs
    .map((d: any) => `${d.firstName ?? ""} ${d.lastName ?? ""}`.trim())
    .filter((n: string) => n && !isHiddenCoach(n));
  const vocab = buildCoachNameVocabulary(events, roster);
  for (const ev of events) {
    const names = getEventCoachesFromDescription(ev, vocab);
    if (names.length === 0) continue;
    const slot = ensureEvent(ev.id);
    for (const rawName of names) {
      if (isHiddenCoach(rawName)) continue;
      const row = ensureRow(rawName);
      if (row.calendar.some(s => s.eventId === ev.id)) continue;
      row.calendar.push({
        eventId: ev.id,
        title: ev.title,
        startDateTime: ev.startDateTime,
        endDateTime: ev.endDateTime,
        dateOnly: ev.dateOnly,
        via: "calendar",
      });
      slot.calendar.push(row.name);
    }
  }

  const revenueByEvent: Record<string, number> = {};
  for (const item of billItems) {
    if (!item.eventId) continue;
    revenueByEvent[item.eventId] = (revenueByEvent[item.eventId] || 0) + (item.price || 0);
  }

  const sortByDate = (a: CoachSession, b: CoachSession) =>
    Date.parse(b.startDateTime) - Date.parse(a.startDateTime);
  const coaches = Array.from(coachRows.values());
  for (const row of coaches) {
    row.tracked.sort(sortByDate);
    row.calendar.sort(sortByDate);
  }
  coaches.sort(
    (a, b) =>
      b.tracked.length - a.tracked.length ||
      b.calendar.length - a.calendar.length ||
      a.name.localeCompare(b.name)
  );

  return { coaches, events, coachesByEvent, revenueByEvent, builtAt: new Date().toISOString() };
}
