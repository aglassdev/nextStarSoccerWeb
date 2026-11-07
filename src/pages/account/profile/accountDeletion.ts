import { Query } from 'appwrite';
import { databases, databaseId, collections } from '@/services/appwrite';

// The app's services/accountDeletionService.ts: an account can be deleted only
// with no outstanding or late bills and no unbilled check-ins this month;
// deleting removes the profile document.

const BILLS = collections.bills || 'bills';
const BILL_ITEMS = collections.billItems || 'bill_items';

const estNow = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));

async function hasOutstandingBills(userId: string) {
  try {
    const r = await databases.listDocuments(databaseId, BILLS, [
      Query.equal('userId', userId), Query.equal('status', ['pending', 'processing']), Query.limit(1),
    ]);
    return r.documents.length > 0;
  } catch {
    return true; // err on the side of caution, as the app does
  }
}

async function hasLateBills(userId: string) {
  try {
    const r = await databases.listDocuments(databaseId, BILLS, [
      Query.equal('userId', userId),
      Query.equal('status', ['pending', 'processing']),
      Query.lessThan('dueDate', new Date().toISOString()),
      Query.limit(1),
    ]);
    return r.documents.length > 0;
  } catch {
    return true;
  }
}

async function hasUnbilledCheckinsThisMonth(userId: string) {
  if (!collections.checkins) return false;
  try {
    const now = estNow();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const pad = (n: number) => String(n).padStart(2, '0');
    const start = `${y}-${pad(m)}-01`;
    const next = m === 12 ? `${y + 1}-01-01` : `${y}-${pad(m + 1)}-01`;
    const checkins = await databases.listDocuments(databaseId, collections.checkins, [
      Query.equal('userId', userId),
      Query.greaterThanEqual('eventDate', start),
      Query.lessThan('eventDate', next),
      Query.limit(100),
    ]);
    if (checkins.documents.length === 0) return false;

    // A check-in is billed to the player it was for, not whoever checked in.
    const playerFor = (c: any): string => c.onBehalfOfProxyId || c.onBehalfOfUserId || c.userId;
    const players = [...new Set(checkins.documents.map(playerFor).filter(Boolean))];
    if (players.length === 0) return true;

    const bills = await databases.listDocuments(databaseId, BILLS, [
      Query.equal('userId', players), Query.equal('month', `${y}-${pad(m)}`), Query.limit(100),
    ]);
    if (bills.documents.length === 0) return true;
    const owner = new Map<string, string>(bills.documents.map((b: any) => [b.$id, b.userId]));
    const items = await databases.listDocuments(databaseId, BILL_ITEMS, [
      Query.equal('billId', [...owner.keys()]), Query.limit(500),
    ]);
    const billed = new Map<string, Set<string>>();
    for (const it of items.documents as any[]) {
      const o = owner.get(it.billId);
      if (!o || !it.eventId) continue;
      if (!billed.has(o)) billed.set(o, new Set());
      billed.get(o)!.add(it.eventId);
    }
    return checkins.documents.some((c: any) => !billed.get(playerFor(c))?.has(c.eventID));
  } catch {
    return true;
  }
}

export async function canDeleteAccount(userId: string): Promise<{ canDelete: boolean; reason?: string }> {
  if (await hasOutstandingBills(userId)) {
    return { canDelete: false, reason: 'You have outstanding bills that must be paid before deleting your account.' };
  }
  if (await hasLateBills(userId)) {
    return { canDelete: false, reason: 'You have late bills that must be resolved before deleting your account.' };
  }
  if (await hasUnbilledCheckinsThisMonth(userId)) {
    return {
      canDelete: false,
      reason: "You have session check-ins from this month that haven't been billed yet. Please wait until next month's billing cycle.",
    };
  }
  return { canDelete: true };
}

export async function deleteProfileDocument(collectionId: string, documentId: string) {
  try {
    await databases.deleteDocument(databaseId, collectionId, documentId);
  } catch {
    throw new Error('Failed to delete account. Please try again later.');
  }
}
