import type { BlockedBankAccount } from './paymentApi';

/**
 * Plain-language payment messages — same wording as the app's
 * utils/paymentErrors.ts. Stripe's mandate error is what a family sees when a
 * saved bank account has been blocked (closed, frozen…) and so has no active
 * debit authorization left.
 */

const BLOCKED_REASONS: Record<string, string> = {
  bank_account_closed: 'the bank reported it closed',
  bank_account_frozen: 'the bank reported it frozen',
  bank_account_restricted: 'the bank restricted it',
  bank_account_invalid_details: 'the account details were invalid',
  bank_account_unusable: "the bank can't accept debits from it",
  debit_not_authorized: 'the bank refused the debit',
};

/** The message to show for a failed payment; Stripe's own text otherwise. */
export function friendlyPaymentError(message: string | undefined, fallback: string): string {
  const m = message || '';
  if (/mandate/i.test(m)) {
    return 'This bank account can no longer be used for payments. Please add a card or a different bank account and try again.';
  }
  return m || fallback;
}

/** Explains why a saved bank account no longer shows up, or '' if none. */
export function blockedBankNotice(blocked: BlockedBankAccount[] | undefined): string {
  if (!blocked || blocked.length === 0) return '';
  return blocked
    .map((b) => {
      const name = `${b.bank_name || 'bank'} account${b.last4 ? ` ending ${b.last4}` : ''}`;
      const why = BLOCKED_REASONS[b.reason || ''] || 'the bank stopped accepting debits from it';
      return `Your ${name} can no longer be used because ${why}.`;
    })
    .concat('Please add a card or a different bank account.')
    .join(' ');
}
