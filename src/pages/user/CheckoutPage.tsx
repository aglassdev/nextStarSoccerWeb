import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useAuth } from '../../contexts/AuthContext';
import { getStripe } from '../../services/payment/stripeClient';
import {
  Bill,
  BillItem,
  getBill,
  getBillItems,
  getBillOwnerFirstNames,
  markBillAsPaid,
  markBillProcessing,
  formatMoney,
  billTitle,
  calculateLateFee,
} from '../../services/payment/billingService';
import {
  createPaymentIntent,
  listPaymentMethods,
  sendPaymentReceipt,
  resolveUserStripeContext,
  SavedPaymentMethod,
} from '../../services/payment/paymentApi';

const PROCESSING_FEE_RATE = 0.03; // 3% processing fee (matches mobile app)

// Payment-method tiles, laid out as 2 rows of 4. Card-brand tiles are a
// decorative selector (picking any = "pay by card"; the real brand is detected
// from the card entry). The "bank" tile is the functional Direct Debit (ACH)
// choice. Order: top row Amex/Discover/Visa/Mastercard, bottom row Bank
// Transfer/JCB/Diners Club/UnionPay.
type MethodTile =
  | { key: string; kind: 'card' }
  | { key: 'bank'; kind: 'ach' };

const METHOD_TILES: MethodTile[] = [
  { key: 'amex', kind: 'card' },
  { key: 'discover', kind: 'card' },
  { key: 'visa', kind: 'card' },
  { key: 'mastercard', kind: 'card' },
  { key: 'bank', kind: 'ach' },
  { key: 'jcb', kind: 'card' },
  { key: 'dinersclub', kind: 'card' },
  { key: 'unionpay', kind: 'card' },
];

interface LoadedBill extends Bill {
  items: BillItem[];
  lateFee: number;
  childFirstName?: string;
}

const cardElementOptions = {
  style: {
    base: {
      color: '#1a1a1a',
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '16px',
      '::placeholder': { color: '#9ca3af' },
    },
    invalid: { color: '#dc2626' },
  },
};

// ── Inner form (inside <Elements>) ─────────────────────────────────────────────
const CheckoutForm = ({
  bills,
  onPaid,
  onProcessing,
}: {
  bills: LoadedBill[];
  onPaid: () => void;
  onProcessing: () => void;
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const { user } = useAuth();

  const [savedMethods, setSavedMethods] = useState<SavedPaymentMethod[]>([]);
  const [stripeCustomerId, setStripeCustomerId] = useState<string | null>(null);
  const [userType, setUserType] = useState<string | null>(null);

  // Selection: a saved method id, 'card' (new card), or 'ach' (direct debit)
  const [selection, setSelection] = useState<string>('card');
  const [selectedBrand, setSelectedBrand] = useState<string>('visa');

  const [cardComplete, setCardComplete] = useState(false);
  const [cardError, setCardError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  // ── Money math ──
  const subtotal = useMemo(() => bills.reduce((s, b) => s + b.totalAmount, 0), [bills]);
  const lateFeeTotal = useMemo(() => bills.reduce((s, b) => s + b.lateFee, 0), [bills]);
  const baseAmount = subtotal + lateFeeTotal;
  const processingFee = useMemo(() => Math.round(baseAmount * PROCESSING_FEE_RATE * 100) / 100, [baseAmount]);
  const total = baseAmount + processingFee;

  useEffect(() => {
    if (!user) return;
    (async () => {
      const ctx = await resolveUserStripeContext(user.$id);
      setStripeCustomerId(ctx.stripeId);
      setUserType(ctx.userType);
      if (ctx.stripeId) {
        const methods = await listPaymentMethods(ctx.stripeId);
        setSavedMethods(methods);
        if (methods.length > 0) setSelection(methods[0].stripePaymentMethodId);
      }
    })();
  }, [user]);

  const isCardMode = selection === 'card';
  const isAchMode = selection === 'ach';
  const isSavedMode = !isCardMode && !isAchMode;

  const createIntent = async () => {
    if (!user) throw new Error('Not signed in.');
    const amountCents = Math.round(total * 100);
    const billIds = bills.map((b) => b.$id);
    const res = await createPaymentIntent({
      amount: amountCents,
      currency: 'usd',
      metadata: {
        billId: billIds.join(','),
        billMonth: bills[0]?.monthName || '',
        itemCount: String(bills.reduce((s, b) => s + (b.items?.length || 0), 0)),
      },
      existingStripeCustomerId: stripeCustomerId || undefined,
      userInfo: { userId: user.$id, email: user.email, name: user.name, userType: userType || undefined },
    });
    const clientSecret = res.paymentIntent.client_secret;
    if (!clientSecret) throw new Error('Could not initialize payment.');
    return clientSecret;
  };

  const settlePaid = async (methodLabel: string) => {
    await Promise.all(
      bills.map(async (b) => {
        try { await markBillAsPaid(b.$id, methodLabel); } catch (e) { console.error(e); }
        await sendPaymentReceipt(b.$id, user!.$id);
      }),
    );
  };

  const handlePay = async () => {
    if (!stripe || !elements || !user) return;
    setError('');
    setProcessing(true);
    try {
      const clientSecret = await createIntent();

      // ── ACH / Direct Debit ──────────────────────────────────────────────────
      if (isAchMode) {
        const collect = await (stripe as any).collectBankAccountForPayment({
          clientSecret,
          params: {
            payment_method_type: 'us_bank_account',
            payment_method_data: {
              billing_details: { name: user.name, email: user.email },
            },
          },
          expand: ['payment_method'],
        });
        if (collect.error) throw new Error(collect.error.message || 'Bank connection failed.');

        let intent = collect.paymentIntent;
        if (intent?.status === 'requires_confirmation') {
          const confirmed = await (stripe as any).confirmUsBankAccountPayment(clientSecret);
          if (confirmed.error) throw new Error(confirmed.error.message || 'Payment failed.');
          intent = confirmed.paymentIntent;
        }

        if (intent?.status === 'succeeded') {
          await settlePaid('bank transfer');
          onPaid();
        } else if (intent?.status === 'processing') {
          await Promise.all(bills.map((b) => markBillProcessing(b.$id, 'bank transfer').catch(() => {})));
          onProcessing();
        } else if (intent?.status === 'requires_payment_method') {
          throw new Error('Bank account was not confirmed. Please try again.');
        } else {
          onProcessing();
        }
        return;
      }

      // ── Card (saved or new) ─────────────────────────────────────────────────
      let confirmResult;
      let methodLabel = 'card';
      if (isSavedMode) {
        confirmResult = await stripe.confirmCardPayment(clientSecret, { payment_method: selection });
        methodLabel = savedMethods.find((m) => m.stripePaymentMethodId === selection)?.brand || 'card';
      } else {
        const card = elements.getElement(CardElement);
        if (!card) throw new Error('Card details are incomplete.');
        confirmResult = await stripe.confirmCardPayment(clientSecret, {
          payment_method: { card, billing_details: { name: user.name, email: user.email } },
        });
        methodLabel = (confirmResult.paymentIntent?.payment_method as any)?.card?.brand || 'card';
      }

      if (confirmResult.error) throw new Error(confirmResult.error.message || 'Payment failed.');
      const pi = confirmResult.paymentIntent;
      if (!pi || (pi.status !== 'succeeded' && pi.status !== 'processing')) {
        throw new Error('Payment was not completed. Please try again.');
      }

      await settlePaid(methodLabel);
      onPaid();
    } catch (e: any) {
      setError(e.message || 'Something went wrong processing your payment.');
    } finally {
      setProcessing(false);
    }
  };

  const canPay =
    !!stripe && !processing && total > 0 && (isCardMode ? cardComplete : true);

  const payLabel = isAchMode ? `Pay USD ${formatMoney(total)} by bank` : `Pay USD ${formatMoney(total)}`;

  const brandChip = (active: boolean) =>
    `flex items-center justify-center rounded-lg border p-2 h-14 transition-colors ${
      active ? 'border-black bg-black/5' : 'border-black/15 hover:border-black/40 bg-white'
    }`;

  return (
    <div className="space-y-6">
      {/* Order summary */}
      <div className="bg-white border border-black/10 rounded-2xl p-6 shadow-sm">
        <h3 className="text-gray-900 font-semibold mb-4">
          {bills.length > 1 ? `${bills.length} Bills` : billTitle(bills[0]?.monthName, bills[0]?.childFirstName)}
        </h3>
        <div className="space-y-3 max-h-64 overflow-y-auto mb-4">
          {bills.map((b) => (
            <div key={b.$id}>
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">
                {billTitle(b.monthName, b.childFirstName)}
              </p>
              {b.items.map((item) => (
                <div key={item.$id} className="flex justify-between text-sm py-0.5">
                  <span className="text-gray-500 truncate mr-2">{item.eventTitle}</span>
                  <span className="text-gray-700 flex-shrink-0">{formatMoney(item.price)}</span>
                </div>
              ))}
              {b.lateFee > 0 && (
                <div className="flex justify-between text-sm py-0.5">
                  <span className="text-red-600">Late fee (10%)</span>
                  <span className="text-red-600">{formatMoney(b.lateFee)}</span>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="border-t border-black/10 pt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Subtotal</span>
            <span className="text-gray-900">{formatMoney(baseAmount)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Processing fee (3%)</span>
            <span className="text-gray-900">{formatMoney(processingFee)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold pt-2 border-t border-black/10">
            <span className="text-gray-900">Total</span>
            <span className="text-gray-900">USD {formatMoney(total)}</span>
          </div>
        </div>
      </div>

      {/* Payment method */}
      <div className="bg-white border border-black/10 rounded-2xl p-6 space-y-4 shadow-sm">
        <h3 className="text-gray-900 font-semibold">Payment Method</h3>

        {/* Saved methods */}
        {savedMethods.map((m) => (
          <button
            key={m.stripePaymentMethodId}
            onClick={() => setSelection(m.stripePaymentMethodId)}
            className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 transition-colors ${
              selection === m.stripePaymentMethodId ? 'border-black bg-black/5' : 'border-black/15 hover:border-black/40'
            }`}
          >
            <span className="text-gray-900 text-sm capitalize">{m.brand} •••• {m.last4}</span>
            <span className="text-gray-500 text-xs">
              {String(m.expMonth).padStart(2, '0')}/{String(m.expYear).slice(-2)}
            </span>
          </button>
        ))}

        {/* Payment-method tiles — 2 rows of 4, uniform icon height */}
        <div className="grid grid-cols-4 gap-2">
          {METHOD_TILES.map((tile) => {
            const active =
              tile.kind === 'ach' ? isAchMode : isCardMode && selectedBrand === tile.key;
            return (
              <button
                key={tile.key}
                onClick={() =>
                  tile.kind === 'ach'
                    ? setSelection('ach')
                    : (setSelection('card'), setSelectedBrand(tile.key))
                }
                className={brandChip(active)}
                title={tile.kind === 'ach' ? 'Bank Transfer' : tile.key}
              >
                {tile.kind === 'ach' ? (
                  <span className="flex flex-col items-center gap-1">
                    <svg className="h-6 w-auto text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M3 21h18M4 10h16M5 10V7l7-4 7 4v3M6 10v8m4-8v8m4-8v8m4-8v8" />
                    </svg>
                    <span className="text-gray-900 text-[10px] font-medium leading-none">Bank Transfer</span>
                  </span>
                ) : (
                  <img
                    src={`/assets/icons/payment/${tile.key}.png`}
                    alt={tile.key}
                    className="h-6 w-auto object-contain"
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Card entry */}
        {isCardMode && (
          <div className="bg-[#F4F2EE] border border-black/15 rounded-xl px-4 py-3.5">
            <CardElement
              options={cardElementOptions}
              onChange={(e) => { setCardComplete(e.complete); setCardError(e.error?.message || ''); }}
            />
          </div>
        )}
        {cardError && <p className="text-red-600 text-sm">{cardError}</p>}

        {isAchMode && (
          <p className="text-gray-600 text-sm">
            You'll securely connect your bank to authorize this payment. Bank transfers typically
            clear in 3–5 business days; your bill is marked paid once it settles.
          </p>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      <button
        onClick={handlePay}
        disabled={!canPay}
        className="w-full py-4 bg-black hover:bg-gray-900 text-white font-bold rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {processing ? (
          <>
            <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            Processing…
          </>
        ) : (
          payLabel
        )}
      </button>

      {/* Powered by Stripe */}
      <div className="flex items-center justify-center gap-2 pt-1">
        <span className="text-gray-500 text-xs">Powered by</span>
        <img src="/assets/icons/payment/stripe.png" alt="Stripe" className="h-5 object-contain" />
      </div>
    </div>
  );
};

// ── Outer page ──────────────────────────────────────────────────────────────────
const CheckoutPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, initialized } = useAuth();

  const billIds: string[] = (location.state as any)?.billIds || [];

  const [bills, setBills] = useState<LoadedBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [result, setResult] = useState<'none' | 'paid' | 'processing'>('none');

  useEffect(() => {
    if (initialized && !user) navigate('/user', { replace: true });
  }, [initialized, user, navigate]);

  useEffect(() => {
    if (!billIds.length) {
      navigate('/user/payments', { replace: true });
      return;
    }
    (async () => {
      setLoading(true);
      setError('');
      try {
        const loaded = await Promise.all(
          billIds.map(async (id) => {
            const bill = await getBill(id);
            const items = await getBillItems(id);
            return { ...bill, items, lateFee: calculateLateFee(bill) } as LoadedBill;
          }),
        );
        const payable = loaded.filter((b) => b.status === 'pending');
        if (payable.length === 0) setError('These bills are no longer payable.');

        // Attach child first names (for parent-viewed bills)
        if (user && payable.length) {
          const names = await getBillOwnerFirstNames(payable, user.$id);
          payable.forEach((b) => { b.childFirstName = names[b.$id]; });
        }
        setBills(payable);
      } catch (e: any) {
        setError(e.message || 'Failed to load bills.');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-[#F4F2EE]">
      <header className="border-b border-black/10">
        <div className="max-w-2xl mx-auto px-4 md:px-6 py-4 flex items-center gap-3">
          <button onClick={() => navigate('/user/payments')} className="text-gray-500 hover:text-gray-900 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-gray-900 font-bold text-lg">Checkout</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 md:px-6 py-8">
        {result === 'paid' || result === 'processing' ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-green-500/15 border border-green-600/40 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {result === 'paid' ? 'Payment Confirmed!' : 'Bank Payment Submitted'}
            </h2>
            <p className="text-gray-600 mb-8">
              {result === 'paid'
                ? 'Your bill payment has been successfully processed.'
                : 'Your bank transfer is processing and typically clears in 3–5 business days. Your bill will be marked paid once the transfer settles.'}
            </p>
            <button
              onClick={() => navigate('/user/payments')}
              className="px-8 py-3 bg-black hover:bg-gray-900 text-white font-semibold rounded-lg transition-colors"
            >
              Return to Portal
            </button>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-2 border-black/30 border-t-black rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="space-y-4">
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-700 text-sm">{error}</div>
            <button
              onClick={() => navigate('/user/payments')}
              className="px-6 py-2 border border-black/15 hover:border-black/40 text-gray-700 rounded-lg transition-colors"
            >
              Back to Portal
            </button>
          </div>
        ) : (
          <Elements stripe={getStripe()}>
            <CheckoutForm
              bills={bills}
              onPaid={() => setResult('paid')}
              onProcessing={() => setResult('processing')}
            />
          </Elements>
        )}
      </main>
    </div>
  );
};

export default CheckoutPage;
