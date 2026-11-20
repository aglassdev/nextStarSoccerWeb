import { Query } from 'appwrite';
import { databases, databaseId, collections } from '@/services/appwrite';
import type { CalendarEvent } from '@/services/googleCalendar';
import { normalizeName } from '@/services/coachAttendance';
import { getExcludedEventIds } from '@/services/facilityCost';
import {
  GYAU_PAYOUT_START,
  gyauEligible,
  gyauEligibleWhenAttended,
  isMullinsOwnSession,
} from '@/services/coachPayouts';

// Coach+ is Phillip Gyau's coach dashboard: the normal coach pages plus a
// Coach+ page, an Attendance Manager over every session he takes a share of
// (camps and group sessions), decided by the same rules as Coach Payments.

/** Phillip's name as it may appear on his coach profile. */
const COACH_PLUS_NAMES = new Set(['phillip gyau', 'philip gyau']);

/** Accounts that also see Coach+, to preview it: amartyaglass. */
const COACH_PLUS_PREVIEW_USER_IDS = new Set(['mi363q40_q03mtr0sknh']);

export const hasCoachPlus = (userId: string | undefined, names: (string | null | undefined)[]) =>
  (!!userId && COACH_PLUS_PREVIEW_USER_IDS.has(userId)) ||
  names.some((n) => !!n && COACH_PLUS_NAMES.has(normalizeName(n)));

const SHARE_START_MS = Date.parse(GYAU_PAYOUT_START);

export interface CoachPlusScope {
  /** Sessions Phillip coached: a coach check-in or signup, or named in the calendar description. */
  attended: Set<string>;
  /** Sessions marked in the admin as cancelled or unattended, which nobody is paid for. */
  excluded: Set<string>;
}

/**
 * Whether a session is one Phillip takes a share of: group training on the
 * public calendar from the start of his share onward, camps and group sessions
 * (Fridays always), and a weekday-morning special when he coached it.
 */
export const isCoachPlusSession = (ev: CalendarEvent, calType: 'public' | 'private', scope: CoachPlusScope) => {
  if (calType !== 'public') return false;
  if (Date.parse(ev.startDateTime) < SHARE_START_MS) return false;
  if (isMullinsOwnSession(ev) || scope.excluded.has(ev.id)) return false;
  const attended = scope.attended.has(ev.id) || /\bgyau\b/i.test(ev.description || '');
  return attended ? gyauEligibleWhenAttended(ev) : gyauEligible(ev);
};

const listAll = async (collectionId: string, queries: string[]) => {
  const out: any[] = [];
  let cursor: string | null = null;
  for (;;) {
    const page = [...queries, Query.limit(1000)];
    if (cursor) page.push(Query.cursorAfter(cursor));
    const res = await databases.listDocuments(databaseId, collectionId, page);
    out.push(...res.documents);
    if (res.documents.length < 1000) break;
    cursor = res.documents[res.documents.length - 1].$id;
  }
  return out;
};

/** Phillip's coaching records and the excluded sessions, for isCoachPlusSession. */
export async function loadCoachPlusScope(): Promise<CoachPlusScope> {
  const [coaches, excluded] = await Promise.all([
    databases.listDocuments(databaseId, collections.coaches, [Query.equal('lastName', ['Gyau', 'gyau']), Query.limit(20)])
      .then((r) => r.documents as any[])
      .catch(() => []),
    getExcludedEventIds(),
  ]);
  const ids = [
    ...new Set(
      coaches
        .filter((c) => COACH_PLUS_NAMES.has(normalizeName(`${c.firstName || ''} ${c.lastName || ''}`)))
        .flatMap((c) => [c.userId, c.$id])
        .filter(Boolean),
    ),
  ];
  const attended = new Set<string>();
  if (ids.length) {
    const byCoach = [Query.equal('coachUserId', ids)];
    const [checkins, signups] = await Promise.all([
      listAll(collections.coachCheckins, byCoach).catch(() => []),
      listAll(collections.coachSignups, byCoach).catch(() => []),
    ]);
    for (const d of [...checkins, ...signups]) if (d.eventID) attended.add(d.eventID);
  }
  return { attended, excluded };
}
