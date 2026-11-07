import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useAuth } from '../contexts/AuthContext';
import { getStripe } from '../services/payment/stripeClient';
import {
  createPaymentIntent,
  listPaymentMethods,
  resolveUserStripeContext,
  SavedPaymentMethod,
} from '../services/payment/paymentApi';
import { paymentIntentIdFromSecret, getParentChildren, ClinicPlayerRef } from '../services/clinicRegistration';
import { registerVideoAnalysis } from '../services/videoAnalysis';
import { ANALYSIS_COACHES, VIDEO_ANALYSIS, formatCents, quoteVideoAnalysis } from '../constants/videoAnalysis';
import { friendlyPaymentError } from '../services/payment/paymentErrors';
import { SIGN_IN_PATH } from '../constants/features';

// Video analysis checkout. Buyers need a Next Star account (the film is
// uploaded from it), so this page sits behind sign-in — there's no guest
// checkout. Otherwise it's the clinic checkout's flow and payment methods;
// the order is a number of analyses, each with its own player and preferred
// coach.

interface DoneResult {
  count: number;
  players: string[];
  email: string;
  pending: boolean;
  bankProcessing: boolean;
}

type MethodTile = { key: string; kind: 'card' } | { key: 'bank'; kind: 'ach' };
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

interface Player extends ClinicPlayerRef {
  name: string;
}

interface Item {
  /** A player id (parents), or '' for the player themselves. */
  playerId: string;
  coach: string;
}

const cardElementOptions = {
  style: {
    base: { color: '#1a1a1a', fontFamily: 'Inter, system-ui, sans-serif', fontSize: '16px', '::placeholder': { color: '#9ca3af' } },
    invalid: { color: '#dc2626' },
  },
};

const inputClass =
  'w-full rounded-xl border border-black/15 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-black/40 [color-scheme:light]';

const CheckoutForm = ({ onDone }: { onDone: (r: DoneResult) => void }) => {
  const stripe = useStripe();
  const elements = useElements();
  const { user } = useAuth();

  const [loadingAccount, setLoadingAccount] = useState(true);
  const [accountError, setAccountError] = useState('');
  const [stripeCustomerId, setStripeCustomerId] = useState<string | null>(null);
  const [userType, setUserType] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [children, setChildren] = useState<Player[]>([]);
  const [savedMethods, setSavedMethods] = useState<SavedPaymentMethod[]>([]);

  const [items, setItems] = useState<Item[]>([{ playerId: '', coach: '' }]);

  const [selection, setSelection] = useState<string>('');
  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const [cardComplete, setCardComplete] = useState(false);
  const [cardError, setCardError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const ctx = await resolveUserStripeContext(user.$id);
        setStripeCustomerId(ctx.stripeId);
        setUserType(ctx.userType);
        setProfile(ctx.profile);
        if (!ctx.userType) {
          setAccountError("We couldn't find a Next Star profile for this account. Finish setting it up in the app first.");
          return;
        }
        if (ctx.userType === 'coach') {
          setAccountError("Coach accounts can't buy video analysis.");
          return;
        }
        if (ctx.userType === 'parent') {
          const kids = await getParentChildren(user.$id);
          setChildren(kids.map((k) => ({ kind: k.kind, id: k.id, name: `${k.firstName} ${k.lastName}`.trim() })));
          if (kids.length > 0) setItems((prev) => prev.map((it) => ({ ...it, playerId: it.playerId || kids[0].id })));
          else setAccountError('Add a player to your family first (Dashboard → My Family), then come back.');
        }
        if (ctx.stripeId) {
          const methods = await listPaymentMethods(ctx.stripeId);
          setSavedMethods(methods);
          if (methods.length > 0) setSelection(methods[0].stripePaymentMethodId);
        }
      } catch (e: any) {
        setAccountError(e.message || 'Could not load your account.');
      } finally {
        setLoadingAccount(false);
      }
    })();
  }, [user]);

  const isParent = userType === 'parent';
  const selfName = `${profile?.firstName || ''} ${profile?.lastName || ''}`.trim() || 'You';

  /** The player each analysis is for. */
  const resolved: Player[] = useMemo(
    () =>
      items.map((it) =>
        isParent
          ? children.find((c) => c.id === it.playerId) || { kind: 'proxy', id: '', name: '' }
          : { kind: 'self' as const, id: user?.$id || '', name: selfName },
      ),
    [items, isParent, children, user, selfName],
  );

  // New analyses start with the first one's player and coach.
  const setCount = (n: number) => {
    const count = Math.max(1, Math.min(VIDEO_ANALYSIS.maxCount, n));
    setItems((prev) =>
      count <= prev.length
        ? prev.slice(0, count)
        : [...prev, ...Array.from({ length: count - prev.length }, () => ({ ...prev[0] }))],
    );
  };
  // Choosing the first analysis's coach also fills any later ones left blank.
  const updateItem = (i: number, patch: Partial<Item>) =>
    setItems((prev) =>
      prev.map((it, j) =>
        j === i ? { ...it, ...patch } : i === 0 && patch.coach && !it.coach ? { ...it, coach: patch.coach } : it,
      ),
    );

  const price = quoteVideoAnalysis(items.length);

  const isCardMode = selection === 'card';
  const isAchMode = selection === 'ach';
  const noneSelected = selection === '';
  const itemsReady = items.every((it) => it.coach) && resolved.every((p) => p.id);
  const canPay =
    !!stripe && !processing && !accountError && !loadingAccount && itemsReady && !!selection && (isCardMode ? cardComplete : true);

  const handlePay = async () => {
    setError('');
    if (!stripe || !elements || !canPay || !user) return;

    setProcessing(true);
    const contactEmail = user.email || '';
    const contactName = user.name || '';
    const metadata = {
      product: 'video-analysis',
      analysisCount: String(items.length),
      pricingType: 'video_analysis',
      campName: VIDEO_ANALYSIS.name,
    };
    const userInfo = { userId: user.$id, email: user.email, name: user.name, userType: userType || undefined };

    // ── 1. Charge ──
    let paymentIntentId = '';
    let bankProcessing = false;
    try {
      const savedBank = !isCardMode && !isAchMode
        ? savedMethods.find((m) => m.stripePaymentMethodId === selection && m.kind === 'bank')
        : undefined;
      if (savedBank) {
        const res = await createPaymentIntent({
          amount: price.total, metadata,
          existingStripeCustomerId: stripeCustomerId || undefined,
          userInfo, paymentMethodId: savedBank.stripePaymentMethodId,
        });
        if (res.status !== 'succeeded' && res.status !== 'processing') {
          throw new Error('The bank transfer could not be completed. Please try another method.');
        }
        bankProcessing = res.status === 'processing';
        paymentIntentId = paymentIntentIdFromSecret(res.clientSecret);
      } else if (isAchMode) {
        const res = await createPaymentIntent({
          amount: price.total, metadata,
          existingStripeCustomerId: stripeCustomerId || undefined,
          userInfo,
        });
        if (!res.clientSecret) throw new Error('Could not initialize payment.');
        const collect = await (stripe as any).collectBankAccountForPayment({
          clientSecret: res.clientSecret,
          params: {
            payment_method_type: 'us_bank_account',
            payment_method_data: { billing_details: { name: contactName, email: contactEmail } },
          },
          expand: ['payment_method'],
        });
        if (collect.error) throw new Error(collect.error.message || 'Bank connection failed.');
        let intent = collect.paymentIntent;
        if (intent?.status === 'requires_confirmation') {
          const confirmed = await (stripe as any).confirmUsBankAccountPayment(res.clientSecret);
          if (confirmed.error) throw new Error(confirmed.error.message || 'Payment failed.');
          intent = confirmed.paymentIntent;
        }
        if (intent?.status === 'requires_payment_method') throw new Error('Bank account was not connected. Please try again.');
        if (intent?.status !== 'succeeded' && intent?.status !== 'processing') {
          throw new Error(
            'This bank account needs to be verified before it can be charged, which takes a few days. Please pay by card or connect a different bank.',
          );
        }
        bankProcessing = intent.status === 'processing';
        paymentIntentId = intent.id;
      } else {
        const res = await createPaymentIntent({
          amount: price.total, metadata,
          existingStripeCustomerId: stripeCustomerId || undefined,
          userInfo,
        });
        if (!res.clientSecret) throw new Error('Could not initialize payment.');
        let confirmResult;
        if (isCardMode) {
          const card = elements.getElement(CardElement);
          if (!card) throw new Error('Card details are incomplete.');
          confirmResult = await stripe.confirmCardPayment(res.clientSecret, {
            payment_method: { card, billing_details: { name: contactName, email: contactEmail } },
          });
        } else {
          confirmResult = await stripe.confirmCardPayment(res.clientSecret, { payment_method: selection });
        }
        if (confirmResult.error) throw new Error(confirmResult.error.message || 'Payment failed.');
        const pi = confirmResult.paymentIntent;
        if (!pi || (pi.status !== 'succeeded' && pi.status !== 'processing')) {
          throw new Error('Payment was not completed. Please try again.');
        }
        paymentIntentId = pi.id;
      }
    } catch (e: any) {
      setError(friendlyPaymentError(e.message, 'Something went wrong processing your payment.'));
      setProcessing(false);
      return;
    }

    // ── 2. Register (retried — the card has already been charged) ──
    let registered = false;
    for (let attempt = 0; attempt < 3 && !registered; attempt++) {
      try {
        await registerVideoAnalysis({
          paymentIntentId,
          items: items.map((it, i) => ({ coach: it.coach, player: { kind: resolved[i].kind, id: resolved[i].id } })),
        });
        registered = true;
      } catch (e) {
        console.error('Video analysis registration attempt failed:', e);
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      }
    }

    setProcessing(false);
    onDone({
      count: items.length,
      players: [...new Set(resolved.map((p) => p.name))],
      email: contactEmail,
      pending: !registered,
      bankProcessing,
    });
  };

  if (loadingAccount) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-8 h-8 border-2 border-black/30 border-t-black rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {accountError && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-700 text-sm">{accountError}</div>
      )}

      {/* Order */}
      <div className="bg-white border border-black/10 rounded-2xl p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 mb-1">
          <div>
            <h3 className="text-gray-900 font-semibold">{VIDEO_ANALYSIS.name}</h3>
            <p className="text-gray-500 text-sm">Annotated game film + your coach's video breakdown</p>
          </div>
          <div className="flex items-center rounded-xl border border-black/15 flex-shrink-0">
            <button type="button" onClick={() => setCount(items.length - 1)} disabled={items.length <= 1 || processing}
              className="w-9 h-9 text-gray-900 text-lg disabled:opacity-30" aria-label="One fewer">−</button>
            <span className="w-8 text-center text-gray-900 text-sm font-semibold tabular-nums">{items.length}</span>
            <button type="button" onClick={() => setCount(items.length + 1)} disabled={items.length >= VIDEO_ANALYSIS.maxCount || processing}
              className="w-9 h-9 text-gray-900 text-lg disabled:opacity-30" aria-label="One more">+</button>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {items.map((it, i) => (
            <div key={i} className="rounded-xl border border-black/10 p-4 space-y-3">
              <p className="text-gray-900 text-sm font-medium">Analysis {i + 1}</p>
              <div className={`grid gap-3 ${isParent ? 'sm:grid-cols-2' : ''}`}>
                {isParent && (
                  <label className="block">
                    <span className="text-gray-500 text-xs">Player</span>
                    <select className={`${inputClass} mt-1`} value={it.playerId} onChange={(e) => updateItem(i, { playerId: e.target.value })}>
                      {children.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </label>
                )}
                <label className="block">
                  <span className="text-gray-500 text-xs">Preferred coach</span>
                  <select className={`${inputClass} mt-1`} value={it.coach} onChange={(e) => updateItem(i, { coach: e.target.value })}>
                    <option value="">Choose a coach</option>
                    {ANALYSIS_COACHES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
              </div>
              {!isParent && <p className="text-gray-500 text-xs">For {resolved[i]?.name}</p>}
            </div>
          ))}
        </div>

        <p className="text-gray-500 text-xs mt-4">
          You'll upload each game from your Dashboard whenever you're ready. Live video-call and in-person analysis
          are requested in the Next Star app.
        </p>

        <div className="border-t border-black/10 pt-4 mt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Subtotal ({items.length} × ${VIDEO_ANALYSIS.pricePerAnalysis})</span>
            <span className="text-gray-900">{formatCents(price.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Processing fee (3%)</span>
            <span className="text-gray-900">{formatCents(price.fee)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold pt-2 border-t border-black/10">
            <span className="text-gray-900">Total</span>
            <span className="text-gray-900">{formatCents(price.total)}</span>
          </div>
        </div>
      </div>

      {/* Payment method */}
      <div className="bg-white border border-black/10 rounded-2xl p-6 space-y-4 shadow-sm">
        <h3 className="text-gray-900 font-semibold">Payment Method</h3>
        {savedMethods.map((m) => (
          <button
            key={m.stripePaymentMethodId}
            type="button"
            onClick={() => setSelection(m.stripePaymentMethodId)}
            className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 transition-colors ${
              selection === m.stripePaymentMethodId ? 'border-black bg-black/5' : 'border-black/15 hover:border-black/40'
            }`}
          >
            <span className="text-gray-900 text-sm capitalize">{m.brand} •••• {m.last4}</span>
            <span className="text-gray-500 text-xs">
              {m.kind === 'bank' ? 'Bank account' : `${String(m.expMonth).padStart(2, '0')}/${String(m.expYear).slice(-2)}`}
            </span>
          </button>
        ))}
        <div className="space-y-4">
          {[METHOD_TILES.slice(0, 4), METHOD_TILES.slice(4)].map((row, ri) => (
            <div key={ri} className="flex items-center justify-center gap-x-6 sm:gap-x-9">
              {row.map((tile) => {
                const active = tile.kind === 'ach' ? isAchMode : isCardMode && selectedBrand === tile.key;
                return (
                  <button
                    key={tile.key}
                    type="button"
                    onClick={() => (tile.kind === 'ach' ? setSelection('ach') : (setSelection('card'), setSelectedBrand(tile.key)))}
                    className={`flex items-center gap-2 transition-opacity ${noneSelected || active ? 'opacity-100' : 'opacity-40 hover:opacity-100'}`}
                    title={tile.kind === 'ach' ? 'Bank Transfer' : tile.key}
                  >
                    {tile.kind === 'ach' ? (
                      <>
                        <svg className="h-6 w-auto flex-shrink-0 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 21h18M4 10h16M5 10V7l7-4 7 4v3M6 10v8m4-8v8m4-8v8m4-8v8" />
                        </svg>
                        <span className="text-gray-900 text-base font-medium whitespace-nowrap">Bank Transfer</span>
                      </>
                    ) : (
                      <img src={`/assets/icons/payment/${tile.key}.png`} alt={tile.key} className="h-6 w-auto object-contain" />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        {isCardMode && (
          <div className="bg-[#F4F2EE] border border-black/15 rounded-xl px-4 py-3.5">
            <CardElement options={cardElementOptions} onChange={(e) => { setCardComplete(e.complete); setCardError(e.error?.message || ''); }} />
          </div>
        )}
        {cardError && <p className="text-red-600 text-sm">{cardError}</p>}
        {isAchMode && (
          <p className="text-gray-600 text-sm">
            You'll securely connect your bank to authorize this payment. Bank transfers typically clear in 3–5 business days.
          </p>
        )}
      </div>

      {error && <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-700 text-sm">{error}</div>}

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
        ) : !items.every((it) => it.coach) ? (
          'Choose a coach'
        ) : isAchMode ? (
          `Pay ${formatCents(price.total)} by bank`
        ) : (
          `Pay ${formatCents(price.total)}`
        )}
      </button>

      <div className="flex items-center justify-center gap-2 pt-1">
        <span className="text-gray-500 text-xs">Powered by</span>
        <img src="/assets/icons/payment/stripe.png" alt="Stripe" className="h-5 object-contain" />
      </div>
    </div>
  );
};

const VideoAnalysisCheckoutPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [done, setDone] = useState<DoneResult | null>(null);

  return (
    <div className="min-h-screen bg-[#F4F2EE]">
      <header className="border-b border-black/10">
        <div className="max-w-2xl mx-auto px-4 md:px-6 py-4 flex items-center gap-3">
          {!done && (
            <button onClick={() => navigate('/services/video-analysis')} className="text-gray-500 hover:text-gray-900 transition-colors" aria-label="Back">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <h1 className="text-gray-900 font-bold text-lg">{done ? 'Confirmed' : 'Checkout'}</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 md:px-6 py-8">
        {done ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-green-500/15 border border-green-600/40 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {done.count > 1 ? `${done.count} analyses purchased` : 'Analysis purchased'}
            </h2>
            <p className="text-gray-700 mb-4">{done.players.join(', ')}</p>
            <p className="text-gray-900 font-medium mb-6 max-w-md mx-auto">
              Your film analysis will be ready within 7 days of uploading your video, we will notify you when it's ready.
            </p>
            <div className="text-gray-600 text-sm mb-8 max-w-md mx-auto space-y-2">
              <p>Next step: upload your game film from Video Analysis on your Dashboard.</p>
              <p>
                {done.pending
                  ? "We received your payment and are finishing your order. If you don't get a confirmation email shortly, contact us and we'll sort it out."
                  : `${done.bankProcessing ? 'Your bank transfer is processing and typically clears in 3–5 business days. ' : ''}A confirmation email is on its way to ${done.email}.`}
              </p>
            </div>
            <button
              onClick={() => navigate('/account/video-analysis')}
              className="px-8 py-3 bg-black hover:bg-gray-900 text-white font-semibold rounded-lg transition-colors"
            >
              Upload your film
            </button>
          </div>
        ) : (
          <>
            {user && (
              <p className="text-gray-500 text-sm mb-4">
                Signed in as {user.email}.{' '}
                <button
                  onClick={async () => {
                    await logout();
                    navigate(SIGN_IN_PATH, { state: { from: '/checkout/video-analysis' } });
                  }}
                  className="underline underline-offset-2 hover:text-gray-900"
                >
                  Not you?
                </button>
              </p>
            )}
            <Elements stripe={getStripe()}>
              <CheckoutForm onDone={setDone} />
            </Elements>
          </>
        )}
      </main>
    </div>
  );
};

export default VideoAnalysisCheckoutPage;
