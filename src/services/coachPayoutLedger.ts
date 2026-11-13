import { ID, Query } from 'appwrite';
import { databases, databaseId, collections, functions } from './appwrite';
import { normalizeName } from './coachAttendance';
import type { PayoutRow } from './coachPayouts';

// What each coach has been paid, against what the Coach Payments
// calculation says they've earned. Two kinds of record:
//  - "paidThrough": everything earned on sessions up to and including that
//    Eastern date is paid (the latest one counts).
//  - "amount": a lump sum paid, on top of any paid-through date.
// Admins only (the coach_payouts collection is readable and writable by the
// admin and superadmin labels).

export type PayoutKind = 'amount' | 'paidThrough';

export interface PayoutRecord {
  $id: string;
  $createdAt: string;
  coach: string;
  kind: PayoutKind;
  amount?: number | null;
  paidThrough?: string | null; // YYYY-MM-DD
  note?: string | null;
  recordedBy?: string | null;
  // Set on payments read from QuickBooks
  source?: 'quickbooks' | null;
  paidOn?: string | null; // YYYY-MM-DD
  externalId?: string | null;
}

export async function listPayoutRecords(): Promise<PayoutRecord[]> {
  const res = await databases.listDocuments(databaseId, collections.coachPayouts, [
    Query.orderDesc('$createdAt'), Query.limit(500),
  ]);
  return res.documents as unknown as PayoutRecord[];
}

export async function addPayoutRecord(record: Omit<PayoutRecord, '$id' | '$createdAt'>): Promise<PayoutRecord> {
  const doc = await databases.createDocument(databaseId, collections.coachPayouts, ID.unique(), record);
  return doc as unknown as PayoutRecord;
}

export const deletePayoutRecord = (id: string) =>
  databases.deleteDocument(databaseId, collections.coachPayouts, id);

// Every figure to the cent first, so what's shown adds up on the page.
const cents = (n: number) => Math.round(n * 100) / 100;

const easternDay = (iso: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(iso));

export interface CoachBalance {
  coach: string;
  sessions: number;
  // Earned on bills paid so far, and once every bill is paid. Only Gyau's
  // differ: hourly pay doesn't depend on what a session collected.
  income: number;
  expectedIncome: number;
  paid: number;
  owed: number;
  expectedOwed: number;
  paidThrough: string | null;
  lumpSums: number;
  records: PayoutRecord[];
}

/** One line per coach with income or a payment on record, most owed first. */
export function coachBalances(rows: PayoutRow[], records: PayoutRecord[]): CoachBalance[] {
  const byKey = new Map<string, { coach: string; rows: PayoutRow[]; records: PayoutRecord[] }>();
  const entry = (name: string) => {
    const key = normalizeName(name);
    let e = byKey.get(key);
    if (!e) { e = { coach: name, rows: [], records: [] }; byKey.set(key, e); }
    return e;
  };
  for (const r of rows) entry(r.coach).rows.push(r);
  for (const rec of records) entry(rec.coach).records.push(rec);

  const out: CoachBalance[] = [];
  for (const { coach, rows: rs, records: recs } of byKey.values()) {
    const income = cents(rs.reduce((s, r) => s + (r.payment ?? 0), 0));
    const expectedIncome = cents(rs.reduce((s, r) => s + (r.expectedPayment ?? r.payment ?? 0), 0));
    const paidThrough = recs
      .filter(r => r.kind === 'paidThrough' && r.paidThrough)
      .map(r => r.paidThrough as string)
      .sort()
      .pop() ?? null;
    const lumpSums = recs.filter(r => r.kind === 'amount').reduce((s, r) => s + (r.amount || 0), 0);
    const through = (pick: (r: PayoutRow) => number) =>
      paidThrough ? rs.filter(r => easternDay(r.startDateTime) <= paidThrough).reduce((s, r) => s + pick(r), 0) : 0;
    const paid = cents(through(r => r.payment ?? 0) + lumpSums);
    const expectedPaid = cents(through(r => r.expectedPayment ?? r.payment ?? 0) + lumpSums);
    out.push({
      coach, sessions: rs.length, income, expectedIncome, paid,
      owed: cents(income - paid), expectedOwed: cents(expectedIncome - expectedPaid),
      paidThrough, lumpSums, records: recs,
    });
  }
  return out.sort((a, b) => b.expectedOwed - a.expectedOwed || a.coach.localeCompare(b.coach));
}

// ── QuickBooks (the quickbooks-sync function) ────────────────────────────────

export interface QuickBooksStatus {
  configured: boolean;
  webhookReady: boolean;
  connected: boolean;
  companyName: string;
  lastSyncAt: string | null;
  lastResult: { at: string; recorded: number; removed: number; unmatched: Record<string, number>; full: boolean } | null;
  syncFrom: string;
}

async function quickbooks<T>(payload: object): Promise<T> {
  const res = await functions.createExecution('quickbooks-sync', JSON.stringify(payload), false);
  let body: any = {};
  try { body = JSON.parse(res.responseBody || '{}'); } catch { /* not JSON */ }
  if (res.status !== 'completed' || !body.success) throw new Error(body.error || "QuickBooks didn't respond. Try again.");
  return body as T;
}

export const quickbooksStatus = () => quickbooks<QuickBooksStatus>({ route: 'status' });
export const quickbooksAuthUrl = () => quickbooks<{ url: string }>({ route: 'authUrl' }).then(r => r.url);
export const quickbooksSync = (full = false) =>
  quickbooks<{ result: NonNullable<QuickBooksStatus['lastResult']> }>({ route: 'sync', full }).then(r => r.result);
export const quickbooksDisconnect = () => quickbooks<object>({ route: 'disconnect' });
