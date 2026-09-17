import { useCallback, useEffect, useState } from 'react';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { getStripe } from '../../services/payment/stripeClient';
import {
  SavedPaymentMethod,
  listPaymentMethods,
  createSetupIntent,
  attachPaymentMethod,
  detachPaymentMethod,
  resolveUserStripeContext,
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

const Inner = ({ userId, userName, userEmail }: { userId: string; userName: string; userEmail: string }) => {
  const stripe = useStripe();
  const elements = useElements();

  const [customerId, setCustomerId] = useState<string | null>(null);
  const [methods, setMethods] = useState<SavedPaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [showCardForm, setShowCardForm] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const refresh = useCallback(async (cid: string) => {
    setMethods(await listPaymentMethods(cid));
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

  const addCard = async () => {
    if (!stripe || !elements || !customerId) return;
    const card = elements.getElement(CardElement);
    if (!card) return;

    setBusy('card');
    setMessage(null);
    try {
      const { error, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card,
        billing_details: { name: userName || undefined, email: userEmail || undefined },
      });
      if (error || !paymentMethod) throw new Error(error?.message || 'Could not read card details');

      await attachPaymentMethod(paymentMethod.id, customerId);
      card.clear();
      setShowCardForm(false);
      setCardComplete(false);
      await refresh(customerId);
      setMessage({ kind: 'ok', text: 'Card saved.' });
    } catch (e: any) {
      setMessage({ kind: 'err', text: e?.message || 'Could not save card.' });
    } finally {
      setBusy(null);
    }
  };

  const addBankAccount = async () => {
    if (!stripe || !customerId) return;
    setBusy('bank');
    setMessage(null);
    try {
      // A SetupIntent is what makes the bank account reusable later.
      const { clientSecret } = await createSetupIntent(customerId, ['us_bank_account']);

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
        // Closing the bank sheet is a normal cancel, not an error to shout about.
        if (/cancel/i.test(collected.error.message || '')) return;
        throw new Error(collected.error.message);
      }

      // Collection leaves the intent needing confirmation — that final step
      // records the ACH mandate and attaches the method to the customer.
      if (collected.setupIntent?.status === 'requires_confirmation') {
        const confirmed = await stripe.confirmUsBankAccountSetup(clientSecret);
        if (confirmed.error) throw new Error(confirmed.error.message);
      }

      await refresh(customerId);
      setMessage({ kind: 'ok', text: 'Bank account saved. You can use it at checkout.' });
    } catch (e: any) {
      setMessage({ kind: 'err', text: e?.message || 'Could not add bank account.' });
    } finally {
      setBusy(null);
    }
  };

  const remove = async (m: SavedPaymentMethod) => {
    if (!customerId) return;
    setBusy(m.stripePaymentMethodId);
    setMessage(null);
    try {
      await detachPaymentMethod(m.stripePaymentMethodId);
      await refresh(customerId);
      setMessage({ kind: 'ok', text: 'Payment method removed.' });
    } catch (e: any) {
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
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-20">
          <div className="w-5 h-5 border-2 border-white/40 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !customerId ? (
        <p className="text-gray-400 text-sm">
          No payment account yet — it is created the first time you pay a bill.
        </p>
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
                  disabled={busy === m.stripePaymentMethodId}
                  className="text-xs text-gray-400 hover:text-red-400 border border-white/10 hover:border-red-400/40 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
                >
                  {busy === m.stripePaymentMethodId ? 'Removing…' : 'Remove'}
                </button>
              </div>
            ))}
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
                onClick={() => { setShowCardForm(true); setMessage(null); }}
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
            Bank accounts use ACH Direct Debit. Transfers take a few business days to clear.
          </p>
        </>
      )}
    </div>
  );
};

const PaymentMethodsSection = (props: { userId: string; userName: string; userEmail: string }) => (
  <Elements stripe={getStripe()}>
    <Inner {...props} />
  </Elements>
);

export default PaymentMethodsSection;
