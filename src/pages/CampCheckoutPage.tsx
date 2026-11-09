import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
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
import { CampGroup, CampQuote, quoteCamp, registerCamp } from '../services/campRegistration';
import { Camp, camps, campHasEnded } from '../constants/campsData';
import { formatCents } from '../constants/videoAnalysis';
import { friendlyPaymentError } from '../services/payment/paymentErrors';
import { PAYMENTS_PATH, SIGN_IN_PATH } from '../constants/features';

// Camp checkout (website). The app's FallCampScreen → CheckoutScreen flow:
// parents pick which of their players are coming, everyone picks the group
// (Youth or Pro/College), and it's the week price per player (the day rate
// for the days left once camp has started), scholarships and coupons applied,
// plus the 3% processing fee. An account is required, so this page sits behind
// sign-in like video analysis; there's no guest checkout. The register-clinic
// function quotes the price and, after payment, verifies it and writes the
// signups, so the website and the server can't disagree on the amount.

interface DoneResult {
  players: string[];
  group: string;
  dates: string;
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

const cardElementOptions = {
  style: {
    base: { color: '#1a1a1a', fontFamily: 'Inter, system-ui, sans-serif', fontSize: '16px', '::placeholder': { color: '#9ca3af' } },
    invalid: { color: '#dc2626' },
  },
};

const inputClass =
  'w-full rounded-xl border border-black/15 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-black/40 [color-scheme:light]';

const CheckoutForm = ({ camp, onDone }: { camp: Camp; onDone: (r: DoneResult) => void }) => {
  const stripe = useStripe();
  const elements = useElements();
  const { user } = useAuth();
  const campId = camp.checkoutId!;
  const groups = camp.sessions.filter((s) => s.key);

  const [loadingAccount, setLoadingAccount] = useState(true);
  const [accountError, setAccountError] = useState('');
  const [stripeCustomerId, setStripeCustomerId] = useState<string | null>(null);
  const [userType, setUserType] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [children, setChildren] = useState<Player[]>([]);
  const [savedMethods, setSavedMethods] = useState<SavedPaymentMethod[]>([]);

  const [chosen, setChosen] = useState<string[]>([]); // a parent's selected player ids
  const [group, setGroup] = useState<CampGroup | ''>('');
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState('');
  const [couponError, setCouponError] = useState('');
  const [applyingCoupon, setApplyingCoupon] = useState(false);

  const [quote, setQuote] = useState<CampQuote | null>(null);
  const [quoteKey, setQuoteKey] = useState('');
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const quoteSeq = useRef(0);

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
          setAccountError('Coaches are not allowed to register for camps.');
          return;
        }
        if (ctx.userType === 'parent') {
          const kids = await getParentChildren(user.$id);
          setChildren(kids.map((k) => ({ kind: k.kind, id: k.id, name: `${k.firstName} ${k.lastName}`.trim() })));
          if (kids.length === 1) setChosen([kids[0].id]);
          if (kids.length === 0) {
            setAccountError(
              "Parents can only register for camps once they've connected or set up their children's accounts. Add a player under My Family on your Dashboard, then come back.",
            );
          }
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

  /** Who's being registered, in the function's terms. */
  const players: ClinicPlayerRef[] = useMemo(
    () =>
      isParent
        ? children.filter((c) => chosen.includes(c.id)).map((c) => ({ kind: c.kind, id: c.id }))
        : userType && user
          ? [{ kind: 'self' as const, id: user.$id }]
          : [],
    [isParent, children, chosen, userType, user],
  );

  const key = JSON.stringify({ players, group, coupon });
  const ready = !accountError && !loadingAccount && players.length > 0 && !!group;

  // Price the order whenever it changes. Only the latest answer counts.
  useEffect(() => {
    if (!ready) {
      setQuote(null);
      setQuoteKey('');
      setQuoteError('');
      return;
    }
    const seq = ++quoteSeq.current;
    setQuoting(true);
    setQuoteError('');
    quoteCamp({ campId, sessionType: group as CampGroup, players, couponCode: coupon || undefined })
      .then((q) => {
        if (seq !== quoteSeq.current) return;
        setQuote(q);
        setQuoteKey(key);
      })
      .catch((e: any) => {
        if (seq !== quoteSeq.current) return;
        setQuote(null);
        setQuoteKey('');
        setQuoteError(e.message || "Couldn't price your registration.");
      })
      .finally(() => {
        if (seq === quoteSeq.current) setQuoting(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready]);

  const applyCoupon = async () => {
    const code = couponInput.trim();
    if (!code || !group || players.length === 0) return;
    setApplyingCoupon(true);
    setCouponError('');
    try {
      const q = await quoteCamp({ campId, sessionType: group, players, couponCode: code });
      if (q.discount <= 0) throw new Error("This coupon doesn't take anything off this registration.");
      setCoupon(q.couponCode || code.toUpperCase());
    } catch (e: any) {
      setCouponError(e.message || 'Invalid coupon code');
    } finally {
      setApplyingCoupon(false);
    }
  };

  const blocked = quote?.players.filter((p) => p.blocked) || [];
  const isCardMode = selection === 'card';
  const isAchMode = selection === 'ach';
  const noneSelected = selection === '';
  const quoteCurrent = !!quote && quoteKey === key && !quoting;
  const freeOrder = quoteCurrent && quote!.total === 0;
  const canPay =
    !!stripe && !processing && ready && quoteCurrent && blocked.length === 0 && !freeOrder &&
    !!selection && (isCardMode ? cardComplete : true);

  const handlePay = async () => {
    setError('');
    if (!stripe || !elements || !canPay || !user || !quote || !group) return;

    setProcessing(true);
    const contactEmail = user.email || '';
    const contactName = user.name || '';
    const amount = quote.total;
    const metadata = {
      product: 'camp',
      campId,
      campName: camp.name,
      pricingType: quote.fullWeek ? 'camp_full_week' : 'camp_days',
      weeks: camp.weekLabel || camp.heroDateRange,
      sessionType: group,
      playerCount: String(players.length),
    };
    const userInfo = { userId: user.$id, email: user.email, name: user.name, userType: userType || undefined };
    const appliedCoupon = quote.couponCode || undefined;

    // ── 1. Charge ──
    let paymentIntentId = '';
    let bankProcessing = false;
    try {
      const savedBank = !isCardMode && !isAchMode
        ? savedMethods.find((m) => m.stripePaymentMethodId === selection && m.kind === 'bank')
        : undefined;
      if (savedBank) {
        const res = await createPaymentIntent({
          amount, metadata, appliedCoupon,
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
          amount, metadata, appliedCoupon,
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
          amount, metadata, appliedCoupon,
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
        await registerCamp({ paymentIntentId, campId, sessionType: group, players, couponCode: appliedCoupon });
        registered = true;
      } catch (e) {
        console.error('Camp registration attempt failed:', e);
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      }
    }

    setProcessing(false);
    onDone({
      players: quote.players.map((p) => p.name),
      group: `${quote.session.label} · ${quote.session.time}`,
      dates: quote.fullWeek ? camp.weekLabel || camp.heroDateRange : quote.days.map((d) => d.label).join(', '),
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
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-700 text-sm">
          {accountError}
          {isParent && children.length === 0 && (
            <>
              {' '}
              <Link to="/account/family" className="underline underline-offset-2">Go to My Family</Link>
            </>
          )}
        </div>
      )}

      {/* Order */}
      <div className="bg-white border border-black/10 rounded-2xl p-6 shadow-sm">
        <h3 className="text-gray-900 font-semibold">{camp.name}</h3>
        <p className="text-gray-500 text-sm">
          {camp.weekLabel || camp.heroDateRange} · {camp.location.name}, {camp.location.city}
        </p>

        {!accountError && (
          <>
            {/* Players */}
            <div className="mt-5">
              <p className="text-gray-900 text-sm font-medium mb-2">{isParent ? 'Who is coming?' : 'Player'}</p>
              {isParent ? (
                <div className="space-y-2">
                  {children.map((c) => {
                    const on = chosen.includes(c.id);
                    const q = quote?.players.find((p) => p.id === c.id);
                    return (
                      <label
                        key={c.id}
                        className={`flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-colors ${
                          on ? 'border-black bg-black/5' : 'border-black/15 hover:border-black/40'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="w-4 h-4 accent-black"
                          checked={on}
                          disabled={processing}
                          onChange={() => setChosen((prev) => (on ? prev.filter((id) => id !== c.id) : [...prev, c.id]))}
                        />
                        <span className="flex-1 min-w-0">
                          <span className="block text-gray-900 text-sm">{c.name}</span>
                          {on && q?.blocked && <span className="block text-red-600 text-xs mt-0.5">{q.blocked}</span>}
                        </span>
                        {on && q && !q.blocked && quoteCurrent && (
                          <span className="text-gray-500 text-sm tabular-nums">{formatCents(q.priceCents)}</span>
                        )}
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-black/15 px-4 py-3">
                  <p className="text-gray-900 text-sm">{selfName}</p>
                  {quote?.players[0]?.blocked && <p className="text-red-600 text-xs mt-0.5">{quote.players[0].blocked}</p>}
                </div>
              )}
            </div>

            {/* Group */}
            <div className="mt-5">
              <p className="text-gray-900 text-sm font-medium mb-2">Group</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {groups.map((g) => (
                  <button
                    key={g.key}
                    type="button"
                    disabled={processing}
                    onClick={() => setGroup(g.key!)}
                    className={`text-left rounded-xl border px-4 py-3 transition-colors ${
                      group === g.key ? 'border-black bg-black/5' : 'border-black/15 hover:border-black/40'
                    }`}
                  >
                    <span className="block text-gray-900 text-sm font-medium">{g.label}</span>
                    <span className="block text-gray-500 text-xs mt-0.5">{g.time}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Coupon */}
            <div className="mt-5">
              {coupon ? (
                <div className="flex items-center justify-between rounded-xl border border-green-600/30 bg-green-500/5 px-4 py-2.5">
                  <span className="text-green-700 text-sm font-medium">{coupon} applied</span>
                  <button
                    type="button"
                    onClick={() => { setCoupon(''); setCouponInput(''); }}
                    disabled={processing}
                    className="text-gray-500 hover:text-gray-900 text-xs underline underline-offset-2"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    className={inputClass}
                    placeholder="Coupon code"
                    value={couponInput}
                    onChange={(e) => { setCouponInput(e.target.value); setCouponError(''); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') applyCoupon(); }}
                    disabled={processing}
                  />
                  <button
                    type="button"
                    onClick={applyCoupon}
                    disabled={!couponInput.trim() || !group || players.length === 0 || applyingCoupon || processing}
                    className="px-5 rounded-xl border border-black/15 text-gray-900 text-sm font-medium hover:border-black/40 disabled:opacity-40"
                  >
                    {applyingCoupon ? '…' : 'Apply'}
                  </button>
                </div>
              )}
              {couponError && <p className="text-red-600 text-xs mt-2">{couponError}</p>}
              {!coupon && couponInput.trim() && (!group || players.length === 0) && (
                <p className="text-gray-500 text-xs mt-2">Choose {players.length === 0 ? 'a player' : 'a group'} first.</p>
              )}
            </div>

            {/* Totals */}
            <div className="border-t border-black/10 pt-4 mt-5 space-y-2">
              {!ready ? (
                <p className="text-gray-500 text-sm">
                  {players.length === 0 ? 'Choose who is coming' : 'Choose a group'} to see your total.
                </p>
              ) : quoteError ? (
                <p className="text-red-600 text-sm">{quoteError}</p>
              ) : !quote ? (
                <p className="text-gray-500 text-sm">Pricing…</p>
              ) : (
                <div className={quoting ? 'opacity-50' : ''}>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">
                      {quote.fullWeek
                        ? `Full week × ${quote.players.length}`
                        : `${quote.days.length} day${quote.days.length === 1 ? '' : 's'} left × ${quote.players.length}`}
                    </span>
                    <span className="text-gray-900">{formatCents(quote.subtotal)}</span>
                  </div>
                  {quote.players.some((p) => p.scholarship === 'tier1' || p.scholarship === 'tier2') && (
                    <p className="text-gray-500 text-xs mt-1">Scholarship pricing applied.</p>
                  )}
                  {quote.discount > 0 && (
                    <div className="flex justify-between text-sm mt-2">
                      <span className="text-gray-500">Discount ({quote.couponCode})</span>
                      <span className="text-green-700">−{formatCents(quote.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm mt-2">
                    <span className="text-gray-500">Processing fee (3%)</span>
                    <span className="text-gray-900">{formatCents(quote.fee)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold pt-2 mt-2 border-t border-black/10">
                    <span className="text-gray-900">Total</span>
                    <span className="text-gray-900">{formatCents(quote.total)}</span>
                  </div>
                  {!quote.fullWeek && (
                    <p className="text-gray-500 text-xs mt-2">
                      Camp has started, so you pay the day rate for the days left: {quote.days.map((d) => d.label).join(', ')}.
                    </p>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {blocked.some((p) => p.blocked.includes('outstanding balance')) && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-800 text-sm">
          An outstanding balance has to be paid before registering.{' '}
          <Link to={PAYMENTS_PATH} className="underline underline-offset-2 font-medium">Go to the Payment Center</Link>
        </div>
      )}

      {freeOrder && (
        <div className="p-4 bg-black/5 border border-black/10 rounded-lg text-gray-700 text-sm">
          Your scholarship covers this camp, so there's nothing to pay. Contact us and we'll register you, or register in the Next Star app.
        </div>
      )}

      {/* Payment method */}
      {!accountError && (
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
      )}

      {error && <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-700 text-sm">{error}</div>}

      {!accountError && (
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
          ) : players.length === 0 ? (
            'Choose who is coming'
          ) : !group ? (
            'Choose a group'
          ) : !quoteCurrent ? (
            'Pricing…'
          ) : isAchMode ? (
            `Pay ${formatCents(quote!.total)} by bank`
          ) : (
            `Pay ${formatCents(quote!.total)}`
          )}
        </button>
      )}

      <div className="flex items-center justify-center gap-2 pt-1">
        <span className="text-gray-500 text-xs">Powered by</span>
        <img src="/assets/icons/payment/stripe.png" alt="Stripe" className="h-5 object-contain" />
      </div>
    </div>
  );
};

const CampCheckoutPage = () => {
  const navigate = useNavigate();
  const { campId } = useParams<{ campId: string }>();
  const { user, logout } = useAuth();
  const [done, setDone] = useState<DoneResult | null>(null);
  const camp = camps.find((c) => c.registerType === 'web' && c.checkoutId === campId);

  return (
    <div className="min-h-screen bg-[#F4F2EE]">
      <header className="border-b border-black/10">
        <div className="max-w-2xl mx-auto px-4 md:px-6 py-4 flex items-center gap-3">
          {!done && (
            <button
              onClick={() => navigate(camp ? `/services/camps/${camp.slug}` : '/services/camps')}
              className="text-gray-500 hover:text-gray-900 transition-colors"
              aria-label="Back"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <h1 className="text-gray-900 font-bold text-lg">{done ? 'Registered' : 'Checkout'}</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 md:px-6 py-8">
        {!camp ? (
          <div className="text-center py-16">
            <p className="text-gray-700 mb-6">This camp isn't open for registration on the website.</p>
            <Link to="/services/camps" className="px-8 py-3 bg-black text-white font-semibold rounded-lg">See camps</Link>
          </div>
        ) : campHasEnded(camp) ? (
          <div className="text-center py-16">
            <p className="text-gray-700 mb-6">Registration for the {camp.name} has closed.</p>
            <Link to="/services/camps" className="px-8 py-3 bg-black text-white font-semibold rounded-lg">See camps</Link>
          </div>
        ) : done ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-green-500/15 border border-green-600/40 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">You're registered</h2>
            <p className="text-gray-700 mb-1">{done.players.join(', ')}</p>
            <p className="text-gray-500 text-sm mb-6">
              {camp.name} · {done.group}
              <br />
              {done.dates} · {camp.location.name}
            </p>
            <p className="text-gray-600 text-sm mb-8 max-w-md mx-auto">
              {done.pending
                ? "We received your payment and are finishing your registration. If you don't get a confirmation email shortly, contact us and we'll sort it out."
                : `${done.bankProcessing ? 'Your bank transfer is processing and typically clears in 3–5 business days. ' : ''}A confirmation email is on its way to ${done.email}, and the sessions are on your schedule.`}
            </p>
            <button
              onClick={() => navigate('/account/schedule')}
              className="px-8 py-3 bg-black hover:bg-gray-900 text-white font-semibold rounded-lg transition-colors"
            >
              View your schedule
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
                    navigate(SIGN_IN_PATH, { state: { from: `/checkout/camp/${camp.checkoutId}` } });
                  }}
                  className="underline underline-offset-2 hover:text-gray-900"
                >
                  Not you?
                </button>
              </p>
            )}
            <Elements stripe={getStripe()}>
              <CheckoutForm camp={camp} onDone={setDone} />
            </Elements>
          </>
        )}
      </main>
    </div>
  );
};

export default CampCheckoutPage;
