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
  markBillAsPaid,
  formatAmount,
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

interface LoadedBill extends Bill {
  items: BillItem[];
  lateFee: number;
}

const cardElementOptions = {
  style: {
    base: {
      color: '#ffffff',
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '16px',
      '::placeholder': { color: '#6b7280' },
    },
    invalid: { color: '#f87171' },
  },
};

// ── Inner form (inside <Elements>) ─────────────────────────────────────────────
const CheckoutForm = ({
  bills,
  onPaid,
}: {
  bills: LoadedBill[];
  onPaid: () => void;
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const { user } = useAuth();

  const [savedMethods, setSavedMethods] = useState<SavedPaymentMethod[]>([]);
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null); // saved pm id, or null = new card
  const [useNewCard, setUseNewCard] = useState(true);
  const [stripeCustomerId, setStripeCustomerId] = useState<string | null>(null);
  const [userType, setUserType] = useState<string | null>(null);

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

  // ── Load payer's Stripe customer + saved methods ──
  useEffect(() => {
    if (!user) return;
    (async () => {
      const ctx = await resolveUserStripeContext(user.$id);
      setStripeCustomerId(ctx.stripeId);
      setUserType(ctx.userType);
      if (ctx.stripeId) {
        const methods = await listPaymentMethods(ctx.stripeId);
        setSavedMethods(methods);
        if (methods.length > 0) {
          setSelectedMethodId(methods[0].stripePaymentMethodId);
          setUseNewCard(false);
        }
      }
    })();
  }, [user]);

  const handlePay = async () => {
    if (!stripe || !elements || !user) return;
    setError('');
    setProcessing(true);
    try {
      // 1) Create the PaymentIntent server-side (amount in cents)
      const amountCents = Math.round(total * 100);
      const billIds = bills.map((b) => b.$id);
      const intentRes = await createPaymentIntent({
        amount: amountCents,
        currency: 'usd',
        metadata: {
          billId: billIds.join(','),
          billMonth: bills[0]?.monthName || '',
          itemCount: String(bills.reduce((s, b) => s + (b.items?.length || 0), 0)),
        },
        existingStripeCustomerId: stripeCustomerId || undefined,
        userInfo: {
          userId: user.$id,
          email: user.email,
          name: user.name,
          userType: userType || undefined,
        },
      });

      const clientSecret = intentRes.paymentIntent.client_secret;
      if (!clientSecret) throw new Error('Could not initialize payment.');

      // 2) Confirm the card payment client-side
      let confirmResult;
      let methodLabel = 'card';
      if (!useNewCard && selectedMethodId) {
        confirmResult = await stripe.confirmCardPayment(clientSecret, {
          payment_method: selectedMethodId,
        });
        const sm = savedMethods.find((m) => m.stripePaymentMethodId === selectedMethodId);
        methodLabel = sm?.brand || 'card';
      } else {
        const card = elements.getElement(CardElement);
        if (!card) throw new Error('Card details are incomplete.');
        confirmResult = await stripe.confirmCardPayment(clientSecret, {
          payment_method: {
            card,
            billing_details: { name: user.name, email: user.email },
          },
        });
        const brand = (confirmResult.paymentIntent?.payment_method as any)?.card?.brand;
        methodLabel = brand || 'card';
      }

      if (confirmResult.error) {
        throw new Error(confirmResult.error.message || 'Payment failed.');
      }

      const pi = confirmResult.paymentIntent;
      if (!pi || (pi.status !== 'succeeded' && pi.status !== 'processing')) {
        throw new Error('Payment was not completed. Please try again.');
      }

      // 3) Mark each bill paid + send a receipt (post-charge; failures don't block success UI)
      await Promise.all(
        bills.map(async (b) => {
          try {
            await markBillAsPaid(b.$id, methodLabel);
          } catch (e) {
            console.error('markBillAsPaid failed for', b.$id, e);
          }
          await sendPaymentReceipt(b.$id, user.$id);
        }),
      );

      onPaid();
    } catch (e: any) {
      setError(e.message || 'Something went wrong processing your payment.');
    } finally {
      setProcessing(false);
    }
  };

  const canPay =
    !!stripe && !processing && total > 0 && (useNewCard ? cardComplete : !!selectedMethodId);

  return (
    <div className="space-y-6">
      {/* Order summary */}
      <div className="bg-[#111] border border-white/10 rounded-2xl p-6">
        <h3 className="text-white font-semibold mb-4">
          {bills.length > 1 ? `${bills.length} Bills` : bills[0]?.monthName || 'Monthly Bill'}
        </h3>
        <div className="space-y-3 max-h-64 overflow-y-auto mb-4">
          {bills.map((b) => (
            <div key={b.$id}>
              <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">{b.monthName}</p>
              {b.items.map((item) => (
                <div key={item.$id} className="flex justify-between text-sm py-0.5">
                  <span className="text-gray-400 truncate mr-2">{item.eventTitle}</span>
                  <span className="text-gray-300 flex-shrink-0">{formatAmount(item.price)}</span>
                </div>
              ))}
              {b.lateFee > 0 && (
                <div className="flex justify-between text-sm py-0.5">
                  <span className="text-red-400">Late fee (10%)</span>
                  <span className="text-red-400">{formatAmount(b.lateFee)}</span>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="border-t border-white/10 pt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Subtotal</span>
            <span className="text-white">{formatAmount(baseAmount)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Processing fee (3%)</span>
            <span className="text-white">{formatAmount(processingFee)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold pt-2 border-t border-white/10">
            <span className="text-white">Total</span>
            <span className="text-white">{formatAmount(total)}</span>
          </div>
        </div>
      </div>

      {/* Payment method */}
      <div className="bg-[#111] border border-white/10 rounded-2xl p-6 space-y-4">
        <h3 className="text-white font-semibold">Payment Method</h3>

        {savedMethods.map((m) => (
          <button
            key={m.stripePaymentMethodId}
            onClick={() => { setSelectedMethodId(m.stripePaymentMethodId); setUseNewCard(false); }}
            className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 transition-colors ${
              !useNewCard && selectedMethodId === m.stripePaymentMethodId
                ? 'border-white bg-white/10'
                : 'border-white/10 hover:border-white/30'
            }`}
          >
            <span className="text-white text-sm capitalize">
              {m.brand} •••• {m.last4}
            </span>
            <span className="text-gray-500 text-xs">
              {String(m.expMonth).padStart(2, '0')}/{String(m.expYear).slice(-2)}
            </span>
          </button>
        ))}

        {/* New card option */}
        <button
          onClick={() => { setUseNewCard(true); setSelectedMethodId(null); }}
          className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${
            useNewCard ? 'border-white bg-white/10' : 'border-white/10 hover:border-white/30'
          }`}
        >
          <span className="text-white text-sm">Use a new card</span>
        </button>

        {useNewCard && (
          <div className="bg-[#0d0d0d] border border-white/10 rounded-xl px-4 py-3.5">
            <CardElement
              options={cardElementOptions}
              onChange={(e) => {
                setCardComplete(e.complete);
                setCardError(e.error?.message || '');
              }}
            />
          </div>
        )}
        {cardError && <p className="text-red-400 text-sm">{cardError}</p>}
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>
      )}

      <button
        onClick={handlePay}
        disabled={!canPay}
        className="w-full py-4 bg-white hover:bg-gray-200 text-black font-bold rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {processing ? (
          <>
            <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            Processing…
          </>
        ) : (
          `Pay ${formatAmount(total)}`
        )}
      </button>
      <p className="text-center text-gray-600 text-xs">
        Payments are securely processed by Stripe. A 3% processing fee applies.
      </p>
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
  const [success, setSuccess] = useState(false);

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
        // Guard: only allow paying bills that are still pending
        const payable = loaded.filter((b) => b.status === 'pending');
        if (payable.length === 0) {
          setError('These bills are no longer payable.');
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
    <div className="min-h-screen bg-black">
      <header className="border-b border-white/10">
        <div className="max-w-2xl mx-auto px-4 md:px-6 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate('/user/payments')}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-white font-bold text-lg">Checkout</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 md:px-6 py-8">
        {success ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-green-500/20 border border-green-500/40 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Payment Confirmed!</h2>
            <p className="text-gray-400 mb-8">Your bill payment has been successfully processed.</p>
            <button
              onClick={() => navigate('/user/payments')}
              className="px-8 py-3 bg-white hover:bg-gray-200 text-black font-semibold rounded-lg transition-colors"
            >
              Return to Portal
            </button>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-2 border-white/40 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="space-y-4">
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>
            <button
              onClick={() => navigate('/user/payments')}
              className="px-6 py-2 border border-white/10 hover:border-white/30 text-gray-300 rounded-lg transition-colors"
            >
              Back to Portal
            </button>
          </div>
        ) : (
          <Elements stripe={getStripe()}>
            <CheckoutForm bills={bills} onPaid={() => setSuccess(true)} />
          </Elements>
        )}
      </main>
    </div>
  );
};

export default CheckoutPage;
