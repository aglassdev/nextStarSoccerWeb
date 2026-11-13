import { ID, Query } from 'appwrite';
import { databases, databaseId, collections, functions } from './appwrite';
import { normalizeName } from './coachAttendance';
import type { PayoutRow, SessionRow } from './coachPayouts';

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
  deductions: number;
  records: PayoutRecord[];
}

/** One line per coach with income or a payment on record, most owed first. */
export function coachBalances(rows: PayoutRow[], records: PayoutRecord[], adjustments: Adjustment[] = []): CoachBalance[] {
  const byKey = new Map<string, { coach: string; rows: PayoutRow[]; records: PayoutRecord[] }>();
  const entry = (name: string) => {
    const key = normalizeName(name);
    let e = byKey.get(key);
    if (!e) { e = { coach: name, rows: [], records: [] }; byKey.set(key, e); }
    return e;
  };
  for (const r of rows) entry(r.coach).rows.push(r);
  for (const rec of records) entry(rec.coach).records.push(rec);
  const deducted = new Map<string, number>();
  for (const a of adjustments) {
    entry(a.coach);
    deducted.set(normalizeName(a.coach), (deducted.get(normalizeName(a.coach)) || 0) + (a.amount || 0));
  }

  const out: CoachBalance[] = [];
  for (const { coach, rows: rs, records: recs } of byKey.values()) {
    // Deductions (late, no-show) come off what a coach earned
    const deductions = cents(deducted.get(normalizeName(coach)) || 0);
    const income = cents(rs.reduce((s, r) => s + (r.payment ?? 0), 0) - deductions);
    const expectedIncome = cents(rs.reduce((s, r) => s + (r.expectedPayment ?? r.payment ?? 0), 0) - deductions);
    const paidThrough = recs
      .filter(r => r.kind === 'paidThrough' && r.paidThrough)
      .map(r => r.paidThrough as string)
      .sort()
      .pop() ?? null;
    const lumpSums = recs.filter(r => r.kind === 'amount').reduce((s, r) => s + (r.amount || 0), 0);
    const through = (pick: (r: PayoutRow) => number) =>
      paidThrough ? rs.filter(r => easternDay(r.startDateTime) <= paidThrough).reduce((s, r) => s + pick(r), 0) : 0;
    // A deduction in a month that's paid through has already come off that pay
    const deductedThrough = paidThrough
      ? adjustments.filter(a => normalizeName(a.coach) === normalizeName(coach) && (a.date || `${a.month}-31`) <= paidThrough)
          .reduce((s, a) => s + (a.amount || 0), 0)
      : 0;
    const paid = cents(through(r => r.payment ?? 0) - deductedThrough + lumpSums);
    const expectedPaid = cents(through(r => r.expectedPayment ?? r.payment ?? 0) - deductedThrough + lumpSums);
    out.push({
      coach, sessions: rs.length, income, expectedIncome, paid,
      owed: cents(income - paid), expectedOwed: cents(expectedIncome - expectedPaid),
      paidThrough, lumpSums, deductions, records: recs,
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

// ── Deductions (late, no-show, other), per coach per month ───────────────────

export type AdjustmentReason = 'late' | 'noShow' | 'other';
export const REASON_LABELS: Record<AdjustmentReason, string> = { late: 'Late', noShow: 'No-show', other: 'Other' };

export interface Adjustment {
  $id: string;
  coach: string;
  month: string; // YYYY-MM
  amount: number;
  reason: AdjustmentReason;
  note?: string | null;
  date?: string | null; // YYYY-MM-DD
  recordedBy?: string | null;
}

export async function listAdjustments(): Promise<Adjustment[]> {
  const res = await databases.listDocuments(databaseId, collections.coachAdjustments, [Query.limit(1000)]);
  return res.documents as unknown as Adjustment[];
}
export async function addAdjustment(a: Omit<Adjustment, '$id'>): Promise<Adjustment> {
  return (await databases.createDocument(databaseId, collections.coachAdjustments, ID.unique(), a)) as unknown as Adjustment;
}
export const deleteAdjustment = (id: string) => databases.deleteDocument(databaseId, collections.coachAdjustments, id);

// ── Monthly statements (the coach-statements function) ───────────────────────

const GYAU = 'phillip gyau';
const monthOf = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(iso)).slice(0, 7);

export interface Statement {
  coach: string;
  kind: 'hourly' | 'share';
  month: string;
  sessions: Record<string, unknown>[];
  deductions: { reason: string; note?: string | null; date?: string | null; amount: number }[];
  total: number; // what the PDF shows as earned (Phillip: his collected share), after deductions
}

/** Every coach's statement for a month, from the same figures as the Coach view. */
export function statementsFor(month: string, rows: PayoutRow[], sessions: SessionRow[], adjustments: Adjustment[]): Statement[] {
  const sessionById = new Map(sessions.map(s => [s.id, s]));
  const byCoach = new Map<string, Statement>();
  const get = (coach: string, kind: Statement['kind']) => {
    const key = normalizeName(coach);
    let s = byCoach.get(key);
    if (!s) { s = { coach, kind, month, sessions: [], deductions: [], total: 0 }; byCoach.set(key, s); }
    return s;
  };
  for (const r of rows) {
    if (monthOf(r.startDateTime) !== month) continue;
    if (normalizeName(r.coach) === GYAU) {
      const s = sessionById.get(r.id.replace(/::phillip gyau$/, ''));
      if (!s) continue;
      get(r.coach, 'share').sessions.push({
        date: s.startDateTime, dateOnly: !!s.dateOnly, title: s.title, facility: s.facility, players: s.players ?? 0,
        gross: s.expectedRevenue, collected: s.revenue, coachCost: s.supportCost, facilityCost: s.facilityCost, otherCost: s.otherCost,
        attended: s.gyauAttended, expectedShare: s.expectedGyauShare, share: s.gyauShare,
      });
    } else {
      get(r.coach, 'hourly').sessions.push({
        date: r.startDateTime, dateOnly: !!r.dateOnly, title: r.sessionTitle, facility: r.facility, basis: r.basis, amount: r.payment ?? 0,
      });
    }
  }
  for (const a of adjustments) {
    if (a.month !== month) continue;
    get(a.coach, normalizeName(a.coach) === GYAU ? 'share' : 'hourly')
      .deductions.push({ reason: a.reason, note: a.note, date: a.date, amount: a.amount });
  }
  for (const s of byCoach.values()) {
    const earned = s.kind === 'share'
      ? s.sessions.reduce((t, x) => t + Number(x.share || 0), 0)
      : s.sessions.reduce((t, x) => t + Number(x.amount || 0), 0);
    s.total = cents(earned - s.deductions.reduce((t, d) => t + d.amount, 0));
  }
  return [...byCoach.values()].sort((a, b) => b.total - a.total || a.coach.localeCompare(b.coach));
}

export interface StatementLog { $id: string; $createdAt: string; coach: string; month: string; total?: number; email?: string; sentBy?: string }
export async function listStatementLog(month: string): Promise<StatementLog[]> {
  const res = await databases.listDocuments(databaseId, collections.coachStatements, [
    Query.equal('month', month), Query.orderDesc('$createdAt'), Query.limit(500),
  ]);
  return res.documents as unknown as StatementLog[];
}

async function statements<T>(payload: object): Promise<T> {
  const res = await functions.createExecution('coach-statements', JSON.stringify(payload), false);
  let body: any = {};
  try { body = JSON.parse(res.responseBody || '{}'); } catch { /* not JSON */ }
  if (res.status !== 'completed' || !body.success) throw new Error(body.error || "The statement couldn't be made. Try again.");
  return body as T;
}
const payloadOf = ({ total: _total, ...s }: Statement) => s;
export const previewStatement = (s: Statement) =>
  statements<{ pdf: string; fileName: string }>({ route: 'preview', statement: payloadOf(s) });
export const sendStatement = (s: Statement) =>
  statements<{ results: { coach: string; ok: boolean; email?: string; error?: string }[] }>({ route: 'send', statements: [payloadOf(s)] })
    .then(r => r.results[0]);
export const sendTestStatement = (s: Statement) =>
  statements<{ sentTo: string }>({ route: 'test', statement: payloadOf(s) }).then(r => r.sentTo);
