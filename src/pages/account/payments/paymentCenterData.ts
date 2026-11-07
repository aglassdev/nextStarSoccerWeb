import { Query } from 'appwrite';
import { databases, databaseId, collections } from '../../../services/appwrite';
import type { Bill } from '../../../services/payment/billingService';

// Read-only helpers for the Account Center's Payment Center, mirroring the
// app's PaymentCenterScreen. Nothing here charges, writes or changes amounts:
// bills, fees and payments still come from services/payment/*.

/** A row from the payments collection (one-off "prepaid" purchases). */
export interface PrepaidPayment {
  $id: string;
  name: string;
  userId: string;
  price: number; // dollars
  type: string;
  date?: string;
  weeks?: string[];
  paymentMethod?: string;
  $createdAt?: string;
}

/**
 * The signed-in user's prepaid payments, newest first — the app's
 * paymentService.getUserPayments filtered to type "prepaid". They make up the
 * Past list alongside paid bills. A failed lookup is just an empty list.
 */
export async function getPrepaidPayments(userId: string): Promise<PrepaidPayment[]> {
  if (!collections.payments) return [];
  try {
    const res = await databases.listDocuments(databaseId, collections.payments, [
      Query.equal('userId', userId),
      Query.orderDesc('$createdAt'),
      Query.limit(100),
    ]);
    return (res.documents as unknown as PrepaidPayment[]).filter((p) => p.type === 'prepaid');
  } catch (e) {
    console.error('Payment history lookup failed:', e);
    return [];
  }
}

/** "Monthly Bill, April 2026", or "Ava's Monthly Bill, April 2026" for a child's bill. */
export const centerBillTitle = (bill: Pick<Bill, 'monthName'>, childFirstName?: string | null): string => {
  const base = childFirstName ? `${childFirstName}'s Monthly Bill` : 'Monthly Bill';
  return bill.monthName ? `${base}, ${bill.monthName}` : base;
};

/** "April 1 - April 30" for a bill whose `month` is "YYYY-MM", or ''. */
export const billDateRange = (month?: string): string => {
  const m = month?.match(/^(\d{4})-(\d{1,2})/);
  if (!m) return '';
  const year = Number(m[1]);
  const monthIndex = Number(m[2]) - 1;
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  return `${fmt(new Date(year, monthIndex, 1))} - ${fmt(new Date(year, monthIndex + 1, 0))}`;
};

/** "April 3, 2026" in Eastern time. */
export const formatLongDate = (raw?: string): string => {
  if (!raw) return '';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' });
};

/** "Apr 3, 2026" in Eastern time (the app's paymentService.formatDate). */
export const formatShortDate = (raw?: string): string => {
  if (!raw) return '';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' });
};

// Same brand map as the app's getPaymentMethodIcon, plus Stripe's "diners".
const METHOD_ICONS: Record<string, string> = {
  visa: 'visa',
  mastercard: 'mastercard',
  'american express': 'amex',
  amex: 'amex',
  discover: 'discover',
  'diners club': 'dinersclub',
  dinersclub: 'dinersclub',
  diners: 'dinersclub',
  jcb: 'jcb',
  unionpay: 'unionpay',
  'apple pay': 'applepay',
  applepay: 'applepay',
  'google pay': 'gpay',
  googlepay: 'gpay',
  gpay: 'gpay',
};

/** The logo for a card brand / wallet, or null (bank transfers have none). */
export const paymentMethodIcon = (method?: string): string | null => {
  const key = METHOD_ICONS[(method || '').toLowerCase().trim()];
  return key ? `/assets/icons/payment/${key}.png` : null;
};

/** Readable name for a stored payment method (the app's formatPaymentMethod). */
export const paymentMethodName = (method?: string): string => {
  const m = (method || '').trim();
  switch (m.toLowerCase()) {
    case 'visa': return 'Visa';
    case 'mastercard': return 'Mastercard';
    case 'amex':
    case 'american express': return 'American Express';
    case 'discover': return 'Discover';
    case 'diners':
    case 'dinersclub': return 'Diners Club';
    case 'jcb': return 'JCB';
    case 'unionpay': return 'UnionPay';
    case 'applepay': return 'Apple Pay';
    case 'googlepay':
    case 'gpay': return 'Google Pay';
    default: return m ? m.charAt(0).toUpperCase() + m.slice(1) : '';
  }
};
