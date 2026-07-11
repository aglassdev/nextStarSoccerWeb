import { Query } from 'appwrite';
import { databases, databaseId, collections } from '../appwrite';

// ── Types (mirror the mobile app's billing model) ──────────────────────────────
export interface Bill {
  $id: string;
  userId: string; // the player the bill is for (never the parent)
  month?: string;
  year?: number;
  monthName?: string;
  itemCount?: number;
  totalAmount: number;
  // "processing" = an async bank transfer (ACH) submitted but not yet settled
  status: 'pending' | 'paid' | 'processing' | 'cancelled' | string;
  dueDate: string;
  paidAt?: string;
  paymentMethod?: string;
  coupon?: boolean;
  couponValue?: number;
  visibility?: boolean;
  $createdAt?: string;
  $updatedAt?: string;
}

export interface BillItem {
  $id: string;
  billId: string;
  eventId?: string;
  eventTitle: string;
  eventDate?: string;
  price: number;
  priceId?: string;
  calendarSource?: 'public' | 'private';
}

// ── Date helpers (America/New_York) ────────────────────────────────────────────
const nowMs = () => Date.now();

export const formatBillDate = (dateString?: string): string => {
  if (!dateString) return '—';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/New_York',
  }).format(d);
};

export const formatAmount = (amount: number): string => `$${Number(amount || 0).toFixed(2)}`;

// Format a bill item's eventDate for display. Handles both date-only
// ("2026-04-03") and full ISO ("2026-04-03T10:00:00-04:00") strings, using the
// date portion directly to avoid timezone day-shifts.
export const formatSessionDate = (raw?: string): string => {
  if (!raw) return '';
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  const d = new Date(raw);
  return isNaN(d.getTime())
    ? raw
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// Money with no currency symbol (no "$" anywhere in the portal UI).
export const formatMoney = (amount: number): string => Number(amount || 0).toFixed(2);

// Build a title like "April 2026 Monthly Bill", or "Ava's April 2026 Monthly Bill"
// when the bill belongs to a child (childFirstName provided).
export const billTitle = (monthName: string | undefined, childFirstName?: string | null): string => {
  const base = `${monthName || 'Monthly'} Monthly Bill`;
  return childFirstName ? `${childFirstName}'s ${base}` : base;
};

// A bill is overdue if it's still pending (not paid/processing) and past its due date.
export const isBillOverdue = (bill: Bill): boolean => {
  if (bill.status === 'paid' || bill.status === 'processing' || bill.status === 'cancelled') return false;
  const due = Date.parse(bill.dueDate);
  return !isNaN(due) && nowMs() > due;
};

// 10% late fee on overdue bills.
export const calculateLateFee = (bill: Bill): number => {
  if (!isBillOverdue(bill)) return 0;
  return bill.totalAmount * 0.1;
};

// ── Fetch all bills a user can access ───────────────────────────────────────────
// Ports billingService.getUserBills: direct ownership + billAccess membership +
// bills owned by any of the parent's children.
export async function getUserBills(userId: string): Promise<Bill[]> {
  const billMap = new Map<string, Bill>();

  // 1) Bills directly owned by this user
  try {
    const direct = await databases.listDocuments(databaseId, collections.bills, [
      Query.equal('userId', userId),
      Query.limit(100),
    ]);
    for (const doc of direct.documents as any[]) billMap.set(doc.$id, doc as Bill);
  } catch (e) {
    console.error('getUserBills direct lookup failed:', e);
  }

  // 2) Bills accessible via the billAccess collection (parent viewing child's bill)
  try {
    const access = await databases.listDocuments(databaseId, collections.billAccess, [
      Query.contains('userIds', userId),
      Query.limit(100),
    ]);
    for (const rec of access.documents as any[]) {
      if (!billMap.has(rec.billId)) {
        try {
          const bill = (await databases.getDocument(databaseId, collections.bills, rec.billId)) as any;
          billMap.set(bill.$id, bill as Bill);
        } catch { /* bill may have been deleted */ }
      }
    }
  } catch { /* billAccess optional */ }

  // 3) Bills owned by each of the user's children (family relationships)
  try {
    const childIds = new Set<string>();
    const rels = await databases.listDocuments(databaseId, collections.familyRelationships001, [
      Query.equal('parentUserId', userId),
      Query.limit(200),
    ]);
    for (const rel of rels.documents as any[]) {
      if (rel.childUserId) childIds.add(rel.childUserId);
      if (rel.childProxyId) childIds.add(rel.childProxyId);
    }
    for (const childId of childIds) {
      try {
        const childBills = await databases.listDocuments(databaseId, collections.bills, [
          Query.equal('userId', childId),
          Query.limit(100),
        ]);
        for (const doc of childBills.documents as any[]) {
          if (!billMap.has(doc.$id)) billMap.set(doc.$id, doc as Bill);
        }
      } catch { /* skip child */ }
    }
  } catch { /* relationships optional */ }

  // Hidden bills (visibility === false) must never be shown or paid.
  return Array.from(billMap.values()).filter((b) => (b as any).visibility !== false);
}

// ── Resolve first names for bills owned by someone other than the viewer ───────
// Used so a parent sees "Ava's April 2026 Monthly Bill". Returns a map of
// billId → child first name (only for bills whose userId !== currentUserId).
export async function getBillOwnerFirstNames(
  bills: Bill[],
  currentUserId: string,
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  const idToBills = new Map<string, string[]>();
  for (const b of bills) {
    if (!b.userId || b.userId === currentUserId) continue;
    if (!idToBills.has(b.userId)) idToBills.set(b.userId, []);
    idToBills.get(b.userId)!.push(b.$id);
  }
  if (idToBills.size === 0) return result;

  const playerCollections = [
    collections.youthPlayers,
    collections.collegiatePlayers,
    collections.professionalPlayers,
    collections.parentUsers,
  ].filter(Boolean) as string[];

  for (const ownerId of idToBills.keys()) {
    let firstName: string | null = null;

    for (const colId of playerCollections) {
      try {
        const res = await databases.listDocuments(databaseId, colId, [
          Query.equal('userId', ownerId),
          Query.limit(1),
        ]);
        if (res.documents.length > 0) {
          firstName = (res.documents[0] as any).firstName || null;
          break;
        }
      } catch { /* keep looking */ }
    }

    // Proxy children: bills store proxyId or $id as userId
    if (!firstName && collections.proxyChildren) {
      try {
        const res = await databases.listDocuments(databaseId, collections.proxyChildren, [
          Query.equal('proxyId', ownerId),
          Query.limit(1),
        ]);
        if (res.documents.length > 0) firstName = (res.documents[0] as any).firstName || null;
      } catch { /* ignore */ }
      if (!firstName) {
        try {
          const doc = (await databases.getDocument(databaseId, collections.proxyChildren, ownerId)) as any;
          firstName = doc?.firstName || null;
        } catch { /* ignore */ }
      }
    }

    if (firstName) {
      for (const billId of idToBills.get(ownerId)!) result[billId] = firstName;
    }
  }

  return result;
}

// ── Fetch the line items for a bill ─────────────────────────────────────────────
export async function getBillItems(billId: string): Promise<BillItem[]> {
  try {
    const res = await databases.listDocuments(databaseId, collections.billItems, [
      Query.equal('billId', billId),
      Query.orderAsc('eventDate'),
      Query.limit(200),
    ]);
    return res.documents as unknown as BillItem[];
  } catch (e) {
    console.error(`getBillItems failed for ${billId}:`, e);
    return [];
  }
}

export async function getBill(billId: string): Promise<Bill> {
  const doc = await databases.getDocument(databaseId, collections.bills, billId);
  return doc as unknown as Bill;
}

// ── Mark a bill as paid (applies late fee if overdue) ──────────────────────────
export async function markBillAsPaid(billId: string, paymentMethod: string): Promise<Bill> {
  const paidAt = new Date().toISOString();
  const bill = await getBill(billId);
  const lateFee = calculateLateFee(bill);
  const finalAmount = bill.totalAmount + lateFee;

  const updated = await databases.updateDocument(databaseId, collections.bills, billId, {
    status: 'paid',
    paidAt,
    paymentMethod,
    ...(lateFee > 0 ? { totalAmount: finalAmount } : {}),
  });
  return updated as unknown as Bill;
}

// ── Mark a bill as processing (ACH submitted, awaiting settlement) ─────────────
export async function markBillProcessing(billId: string, paymentMethod: string): Promise<Bill> {
  const updated = await databases.updateDocument(databaseId, collections.bills, billId, {
    status: 'processing',
    paymentMethod,
  });
  return updated as unknown as Bill;
}
