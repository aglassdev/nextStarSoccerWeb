import { useState } from 'react';
import { CardElement, useElements, useStripe } from '@stripe/react-stripe-js';
import {
  attachPaymentMethod,
  createSetupIntent,
  createStripeCustomer,
  reportSetupIntentResult,
  resolveUserStripeContext,
  saveUserStripeId,
} from '../../services/payment/paymentApi';

// Adding a card or bank account on the /user portal, shared by the Payment
// Methods section and the required-payment-method modal. Must be used inside
// <Elements>.

export const CARD_ELEMENT_STYLE = {
  style: {
    base: {
      color: '#ffffff',
      fontFamily: 'inherit',
      fontSize: '15px',
      '::placeholder': { color: 'rgba(255,255,255,0.4)' },
    },
    invalid: { color: '#f87171', iconColor: '#f87171' },
  },
};

export type SaveResult =
  | { state: 'saved'; message: string; customerId: string }
  /** Saved but still being verified (small test deposit, or Stripe still checking). */
  | { state: 'verifying'; message: string; customerId: string; link?: { href: string; label: string } }
  | { state: 'canceled' }
  | { state: 'error'; message: string };

export function usePaymentMethodActions({ userId, userName, userEmail }: { userId: string; userName: string; userEmail: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [customerId, setCustomerId] = useState<string | null>(null);

  // A method can only be saved against a Stripe customer. Create one on demand
  // for the few accounts that have none, as the app does.
  const ensureCustomer = async (): Promise<string | null> => {
    if (customerId) return customerId;
    const ctx = await resolveUserStripeContext(userId);
    if (ctx.stripeId) {
      setCustomerId(ctx.stripeId);
      return ctx.stripeId;
    }
    const email = ctx.profile?.email || userEmail;
    if (!ctx.profile || !ctx.collectionId || !email) return null;
    const name =
      `${ctx.profile.firstName || ''} ${ctx.profile.lastName || ''}`.trim() ||
      userName ||
      'Next Star Player';
    const { stripeCustomerId } = await createStripeCustomer({
      email,
      name,
      userId,
      userType: ctx.userType || 'parent',
    });
    if (!stripeCustomerId) return null;
    await saveUserStripeId(ctx.collectionId, ctx.profile.$id, stripeCustomerId);
    setCustomerId(stripeCustomerId);
    return stripeCustomerId;
  };

  const saveCard = async (): Promise<SaveResult> => {
    if (!stripe || !elements) return { state: 'error', message: 'Payments are still loading. Try again in a moment.' };
    const card = elements.getElement(CardElement);
    if (!card) return { state: 'error', message: 'Enter your card details first.' };
    try {
      const cid = await ensureCustomer();
      if (!cid) throw new Error('Could not set up your payment account. Please try again.');
      const { error, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card,
        billing_details: { name: userName || undefined, email: userEmail || undefined },
      });
      if (error || !paymentMethod) throw new Error(error?.message || 'Could not read card details');
      await attachPaymentMethod(paymentMethod.id, cid);
      card.clear();
      return { state: 'saved', message: 'Card saved.', customerId: cid };
    } catch (e: any) {
      return { state: 'error', message: e?.message || 'Could not save card.' };
    }
  };

  const saveBank = async (): Promise<SaveResult> => {
    if (!stripe) return { state: 'error', message: 'Payments are still loading. Try again in a moment.' };

    // The outcome is recorded on the SetupIntent in Stripe, so a failed link
    // shows up there instead of vanishing.
    let cid: string | null = null;
    let setupIntentId = '';
    const report = (outcome: string, extra: { status?: string; error?: string } = {}) => {
      if (cid && setupIntentId) {
        reportSetupIntentResult(cid, setupIntentId, { platform: 'web', outcome, ...extra });
      }
    };

    try {
      cid = await ensureCustomer();
      if (!cid) throw new Error('Could not set up your payment account. Please try again.');

      // A SetupIntent is what makes the bank account reusable later.
      const created = await createSetupIntent(cid, ['us_bank_account']);
      const { clientSecret } = created;
      setupIntentId = created.setupIntentId;

      const collected = await stripe.collectBankAccountForSetup({
        clientSecret,
        params: {
          payment_method_type: 'us_bank_account',
          payment_method_data: {
            billing_details: { name: userName || 'Account holder', email: userEmail || undefined },
          },
        },
      });

      if (collected.error) {
        const canceled = /cancel/i.test(collected.error.message || '');
        report(canceled ? 'canceled' : 'failed', {
          error: `${collected.error.code || collected.error.type}: ${collected.error.message}`,
        });
        // Closing the bank sheet is a normal cancel, not an error to shout about.
        if (canceled) return { state: 'canceled' };
        throw new Error(collected.error.message);
      }

      // Closing Stripe's bank dialog without linking an account hands the
      // intent back untouched rather than as an error. Also a normal cancel.
      if (collected.setupIntent?.status === 'requires_payment_method') {
        report('canceled', { status: 'requires_payment_method' });
        return { state: 'canceled' };
      }

      // Collection leaves the intent needing confirmation — that final step
      // records the ACH mandate and attaches the method to the customer.
      let intent = collected.setupIntent;
      if (intent?.status === 'requires_confirmation') {
        const confirmed = await stripe.confirmUsBankAccountSetup(clientSecret);
        if (confirmed.error) {
          report('failed', {
            error: `${confirmed.error.code || confirmed.error.type}: ${confirmed.error.message}`,
          });
          throw new Error(confirmed.error.message);
        }
        intent = confirmed.setupIntent;
      }

      const status = intent?.status;
      report(status === 'succeeded' ? 'success' : `status ${status}`, { status: String(status) });
      if (status === 'succeeded') {
        return { state: 'saved', message: 'Bank account saved. You can use it at checkout.', customerId: cid };
      }

      // Accounts that can't be verified by logging in get a small test deposit
      // instead; Stripe saves the account once the customer confirms it.
      const micro =
        intent?.next_action?.type === 'verify_with_microdeposits'
          ? intent.next_action.verify_with_microdeposits
          : undefined;
      if (status === 'requires_action' && micro) {
        return {
          state: 'verifying',
          customerId: cid,
          message: 'Stripe is sending a small deposit to verify this account. It should arrive in 1–2 business days. Once it does, confirm it using the link Stripe emails you, and the account will be saved.',
          link: micro.hosted_verification_url
            ? { href: micro.hosted_verification_url, label: 'Open verification page' }
            : undefined,
        };
      }
      return { state: 'verifying', customerId: cid, message: "Stripe is still verifying this account. It will show up here once that's done." };
    } catch (e: any) {
      return { state: 'error', message: e?.message || 'Could not add bank account.' };
    }
  };

  return { customerId, setCustomerId, saveCard, saveBank };
}
