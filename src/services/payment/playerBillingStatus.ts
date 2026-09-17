import { Query, ID } from 'appwrite';
import { databases, databaseId, collections } from '../appwrite';
import { isBillOverdue, type Bill } from './billingService';

/**
 * Player billing standing, used to gate attendance check-ins.
 *
 *   white  — nothing overdue. Free to attend.
 *   yellow — has an overdue bill but has NOT yet used their one courtesy
 *            session. May attend once more; doing so burns the courtesy.
 *   red    — has an overdue bill AND already used the courtesy. Blocked.
 *
 * Mirrors services/playerBillingStatus.ts in the mobile app — the two must
 * agree, since a coach may check the same player in from either surface.
 */

const COURTESY_COLLECTION_ID = 'courtesy_sessions';

export type BillingStanding = 'white' | 'yellow' | 'red';

export interface PlayerBillingStatus {
  standing: BillingStanding;
  overdueAmount: number;
  overdueBillIds: string[];
  overdueMonths: string[];
  courtesyUsedAt?: string;
  courtesyEventId?: string;
}

export const SETTLED_STATUS: PlayerBillingStatus = {
  standing: 'white',
  overdueAmount: 0,
  overdueBillIds: [],
  overdueMonths: [],
};

/** Tailwind text colour per standing. The config remaps these to muted tones. */
export const standingTextClass = (s: BillingStanding): string =>
  s === 'red' ? 'text-red-400' : s === 'yellow' ? 'text-yellow-400' : 'text-white';

export function standingMessage(s: PlayerBillingStatus): string {
  const amt = `$${s.overdueAmount}`;
  const months = s.overdueMonths.length ? ` (${s.overdueMonths.join(', ')})` : '';
  if (s.standing === 'yellow') {
    return `Overdue balance of ${amt}${months}. Checking them in uses their one courtesy session.`;
  }
  if (s.standing === 'red') {
    return `Overdue balance of ${amt}${months}. Courtesy session already used — cannot be checked in until the balance is paid.`;
  }
  return '';
}

async function listAll(collectionId: string, extra: any[] = []): Promise<any[]> {
  const out: any[] = [];
  let cursor: string | null = null;
  // Appwrite pages at 100 and truncates silently without an explicit limit.
  for (;;) {
    const queries = [...extra, Query.limit(100)];
    if (cursor) queries.push(Query.cursorAfter(cursor));
    const page = await databases.listDocuments(databaseId, collectionId, queries);
    out.push(...page.documents);
    if (page.documents.length < 100) break;
    cursor = page.documents[page.documents.length - 1].$id;
  }
  return out;
}

/**
 * Build a playerId -> status map in a fixed number of queries.
 *
 * One bills fetch plus one pass, never a query per player: the roster is ~600
 * players and getUserBills() costs 3+ round trips each.
 */
export async function loadBillingStatusMap(): Promise<Map<string, PlayerBillingStatus>> {
  const map = new Map<string, PlayerBillingStatus>();

  const [bills, courtesy, proxies] = await Promise.all([
    listAll(collections.bills, [Query.equal('status', ['pending', 'processing'])]),
    listAll(COURTESY_COLLECTION_ID, [Query.isNull('clearedAt')]).catch(() => []),
    listAll(collections.proxyChildren).catch(() => []),
  ]);

  for (const bill of bills as Bill[]) {
    // Hidden bills are drafts a family cannot see or pay, so they must never
    // gate attendance.
    if ((bill as any).visibility === false) continue;
    if (!isBillOverdue(bill)) continue;
    const key = (bill as any).userId;
    if (!key) continue;
    const existing =
      map.get(key) ||
      ({
        standing: 'yellow',
        overdueAmount: 0,
        overdueBillIds: [],
        overdueMonths: [],
      } as PlayerBillingStatus);
    existing.overdueAmount += bill.totalAmount || 0;
    existing.overdueBillIds.push((bill as any).$id);
    const month = ((bill as any).monthName || '').split(' ')[0];
    if (month && !existing.overdueMonths.includes(month)) existing.overdueMonths.push(month);
    map.set(key, existing);
  }

  for (const c of courtesy as any[]) {
    const s = map.get(c.playerId);
    if (!s) continue; // settled since — record is stale, ignore it
    s.standing = 'red';
    s.courtesyUsedAt = c.usedAt;
    s.courtesyEventId = c.eventID;
  }

  // A proxy child has three non-interchangeable ids: $id (what web-created
  // signups/check-ins use), proxyId (what bills.userId uses), and
  // migratedToUserId. Register the status under all of them so a lookup by any
  // one succeeds — without this every proxy child renders white, and proxies
  // are the majority of the roster.
  for (const p of proxies as any[]) {
    const group = [p.proxyId, p.$id, p.migratedToUserId].filter(Boolean) as string[];
    const found = group.map((k) => map.get(k)).find(Boolean);
    if (!found) continue;
    for (const k of group) if (!map.has(k)) map.set(k, found);
  }

  return map;
}

/** Look a player up across every id the caller might be holding. */
export function statusFor(
  map: Map<string, PlayerBillingStatus>,
  ...ids: (string | undefined | null)[]
): PlayerBillingStatus {
  for (const id of ids) {
    if (!id) continue;
    const s = map.get(id);
    if (s) return s;
  }
  return SETTLED_STATUS;
}

/** Burn the player's courtesy session. Idempotent per player. */
export async function recordCourtesySession(params: {
  playerId: string;
  playerName?: string;
  eventID: string;
  eventTitle?: string;
  eventDate?: string;
  status: PlayerBillingStatus;
}): Promise<void> {
  const { playerId, playerName, eventID, eventTitle, eventDate, status } = params;
  if (!playerId || status.standing !== 'yellow') return;
  try {
    const existing = await databases.listDocuments(databaseId, COURTESY_COLLECTION_ID, [
      Query.equal('playerId', playerId),
      Query.isNull('clearedAt'),
      Query.limit(1),
    ]);
    if (existing.documents.length > 0) return;

    await databases.createDocument(databaseId, COURTESY_COLLECTION_ID, ID.unique(), {
      playerId,
      playerName: playerName || undefined,
      eventID,
      eventTitle: eventTitle || undefined,
      eventDate: eventDate || undefined,
      overdueBillIds: status.overdueBillIds.join(','),
      overdueAmount: Math.round(status.overdueAmount),
      usedAt: new Date().toISOString(),
    });
  } catch (err) {
    // Never let a courtesy-log failure block the check-in itself.
    console.error('Error recording courtesy session:', err);
  }
}
