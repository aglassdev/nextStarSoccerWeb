import { useCallback, useEffect, useRef, useState } from 'react';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { getStripe } from '../../services/payment/stripeClient';
import {
  SavedPaymentMethod,
  listPaymentMethods,
  createSetupIntent,
  attachPaymentMethod,
  detachPaymentMethod,
  resolveUserStripeContext,
  createStripeCustomer,
  saveUserStripeId,
  reportSetupIntentResult,
} from '../../services/payment/paymentApi';

// Saved payment methods management for the /user portal: list, add a card, add
// a bank account (ACH Direct Debit), remove. Deliberately uses CardElement
// rather than the Payment Element so no Apple Pay / Google Pay wallet buttons
// are ever shown on the website.

const CARD_ELEMENT_STYLE = {
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

const methodLabel = (m: SavedPaymentMethod) =>
  m.kind === 'bank'
    ? `${m.bankName || 'Bank account'} •••• ${m.last4}`
    : `${m.brand.toUpperCase()} •••• ${m.last4}`;

const methodSubLabel = (m: SavedPaymentMethod) =>
  m.kind === 'bank'
    ? `${m.accountType || 'checking'} · bank transfer`
    : `Expires ${String(m.expMonth).padStart(2, '0')}/${String(m.expYear).slice(-2)}`;

type Props = {
  userId: string;
  userName: string;
  userEmail: string;
  /** Called with the number of saved methods whenever the list changes. */
  onMethodsChange?: (count: number) => void;
  /** Called when the user starts adding a card or bank account. */
  onActivity?: () => void;
};

const Inner = ({ userId, userName, userEmail, onMethodsChange, onActivity }: Props) => {
  const stripe = useStripe();
  const elements = useElements();

  const [customerId, setCustomerId] = useState<string | null>(null);
  const [methods, setMethods] = useState<SavedPaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [showCardForm, setShowCardForm] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);
  const [message, setMessage] = useState<{
    kind: 'ok' | 'err';
    text: string;
    link?: { href: string; label: string };
  } | null>(null);

  // Held in refs so a parent passing inline callbacks doesn't re-trigger loading.
  const onMethodsChangeRef = useRef(onMethodsChange);
  onMethodsChangeRef.current = onMethodsChange;
  const onActivityRef = useRef(onActivity);
  onActivityRef.current = onActivity;

  const refresh = useCallback(async (cid: string) => {
    const list = await listPaymentMethods(cid);
    setMethods(list);
    onMethodsChangeRef.current?.(list.length);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const ctx = await resolveUserStripeContext(userId);
        setCustomerId(ctx.stripeId);
        if (ctx.stripeId) await refresh(ctx.stripeId);
      } catch (e) {
        console.error('Error loading payment methods:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId, refresh]);

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

  const addCard = async () => {
    if (!stripe || !elements) return;
    const card = elements.getElement(CardElement);
    if (!card) return;

    setBusy('card');
    setMessage(null);
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
      setShowCardForm(false);
      setCardComplete(false);
      await refresh(cid);
      setMessage({ kind: 'ok', text: 'Card saved.' });
    } catch (e: any) {
      setMessage({ kind: 'err', text: e?.message || 'Could not save card.' });
    } finally {
      setBusy(null);
    }
  };

  const addBankAccount = async () => {
    if (!stripe) return;
    onActivityRef.current?.();
    setBusy('bank');
    setMessage(null);

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
        if (canceled) return;
        throw new Error(collected.error.message);
      }

      // Closing Stripe's bank dialog without linking an account hands the
      // intent back untouched rather than as an error. Also a normal cancel.
      if (collected.setupIntent?.status === 'requires_payment_method') {
        report('canceled', { status: 'requires_payment_method' });
        return;
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

      // Accounts that can't be verified by logging in get a small test deposit
      // instead; Stripe saves the account once the customer confirms it.
      const micro =
        intent?.next_action?.type === 'verify_with_microdeposits'
          ? intent.next_action.verify_with_microdeposits
          : undefined;
      if (status === 'requires_action' && micro) {
        setMessage({
          kind: 'ok',
          text: 'Stripe is sending a small deposit to verify this account. It should arrive in 1–2 business days. Once it does, confirm it using the link Stripe emails you, and the account will be saved.',
          link: micro.hosted_verification_url
            ? { href: micro.hosted_verification_url, label: 'Open verification page' }
            : undefined,
        });
        return;
      }

      await refresh(cid);
      setMessage(
        status === 'succeeded'
          ? { kind: 'ok', text: 'Bank account saved. You can use it at checkout.' }
          : { kind: 'ok', text: "Stripe is still verifying this account. It will show up here once that's done." },
      );
    } catch (e: any) {
      setMessage({ kind: 'err', text: e?.message || 'Could not add bank account.' });
    } finally {
      setBusy(null);
    }
  };

  // Every account has to keep a method on file, so the last one can only be
  // removed once another has been added.
  const canRemove = methods.length > 1;

  const remove = async (m: SavedPaymentMethod) => {
    if (!customerId) return;
    if (!canRemove) {
      setMessage({ kind: 'err', text: 'Add another payment method before removing this one.' });
      return;
    }
    setBusy(m.stripePaymentMethodId);
    setMessage(null);
    // Drop the row straight away — we know what was removed, so waiting on a
    // full re-list just adds a round trip the user can feel. Restored on error.
    const previous = methods;
    setMethods((ms) => ms.filter((x) => x.stripePaymentMethodId !== m.stripePaymentMethodId));
    try {
      await detachPaymentMethod(m.stripePaymentMethodId);
      onMethodsChangeRef.current?.(previous.length - 1);
      setMessage({ kind: 'ok', text: 'Payment method removed.' });
    } catch (e: any) {
      setMethods(previous);
      setMessage({ kind: 'err', text: e?.message || 'Could not remove payment method.' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <h3 className="text-white font-semibold text-lg mb-4">Payment Methods</h3>

      {message && (
        <div
          className={`mb-4 px-4 py-3 rounded-lg text-sm border ${
            message.kind === 'ok'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}
        >
          {message.text}
          {message.link && (
            <a
              href={message.link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="block mt-2 underline underline-offset-2"
            >
              {message.link.label}
            </a>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-20">
          <div className="w-5 h-5 border-2 border-white/40 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {methods.length === 0 && (
              <p className="text-gray-400 text-sm">No saved payment methods yet.</p>
            )}
            {methods.map((m) => (
              <div
                key={m.stripePaymentMethodId}
                className="flex items-center justify-between gap-4 p-4 rounded-xl border border-white/15 bg-white/[0.03]"
              >
                <div className="min-w-0">
                  <p className="text-white text-sm font-medium truncate">{methodLabel(m)}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{methodSubLabel(m)}</p>
                </div>
                <button
                  onClick={() => remove(m)}
                  disabled={busy === m.stripePaymentMethodId || !canRemove}
                  title={canRemove ? undefined : 'Add another payment method before removing this one'}
                  className="text-xs text-gray-400 hover:text-red-400 border border-white/10 hover:border-red-400/40 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50 disabled:hover:text-gray-400 disabled:hover:border-white/10 disabled:cursor-not-allowed"
                >
                  {busy === m.stripePaymentMethodId ? 'Removing…' : 'Remove'}
                </button>
              </div>
            ))}
            {methods.length === 1 && (
              <p className="text-gray-500 text-xs">
                You need to keep at least one payment method on file. Add another one to remove this one.
              </p>
            )}
          </div>

          {showCardForm && (
            <div className="mt-4 p-4 rounded-xl border border-white/15 bg-white/[0.03]">
              <CardElement
                options={CARD_ELEMENT_STYLE}
                onChange={(e) => setCardComplete(e.complete)}
              />
              <div className="flex justify-end gap-3 mt-4">
                <button
                  onClick={() => { setShowCardForm(false); setCardComplete(false); }}
                  className="text-sm text-gray-400 hover:text-white px-4 py-2"
                >
                  Cancel
                </button>
                <button
                  onClick={addCard}
                  disabled={!cardComplete || busy === 'card'}
                  className="text-sm bg-white text-black font-semibold rounded-lg px-4 py-2 disabled:opacity-40"
                >
                  {busy === 'card' ? 'Saving…' : 'Save card'}
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3 mt-4">
            {!showCardForm && (
              <button
                onClick={() => { onActivityRef.current?.(); setShowCardForm(true); setMessage(null); }}
                disabled={!!busy}
                className="text-sm text-white border border-white/20 hover:border-white/50 rounded-lg px-4 py-2 transition-colors disabled:opacity-50"
              >
                + Add card
              </button>
            )}
            <button
              onClick={addBankAccount}
              disabled={!!busy}
              className="text-sm text-white border border-white/20 hover:border-white/50 rounded-lg px-4 py-2 transition-colors disabled:opacity-50"
            >
              {busy === 'bank' ? 'Opening bank…' : '+ Add bank account'}
            </button>
          </div>

          <p className="text-gray-500 text-xs mt-3">
            Bank accounts use ACH Direct Debit, and transfers take a few business days to clear. By
            adding a bank account, you authorize Next Star Soccer to debit it for amounts owed for
            Next Star Soccer services and products, including recurring monthly bills, under Next
            Star Soccer's terms, until you revoke this authorization. You can change or cancel it
            at any time with 30 days' notice to Next Star Soccer.
          </p>
        </>
      )}
    </div>
  );
};

const PaymentMethodsSection = (props: Props) => (
  <Elements stripe={getStripe()}>
    <Inner {...props} />
  </Elements>
);

export default PaymentMethodsSection;
