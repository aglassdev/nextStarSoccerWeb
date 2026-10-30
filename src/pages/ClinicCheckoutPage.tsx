import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Query } from 'appwrite';
import { useAuth } from '../contexts/AuthContext';
import { getStripe } from '../services/payment/stripeClient';
import {
  createPaymentIntent,
  listPaymentMethods,
  resolveUserStripeContext,
  SavedPaymentMethod,
} from '../services/payment/paymentApi';
import {
  registerClinic,
  paymentIntentIdFromSecret,
  getParentChildren,
  ClinicPlayerRef,
  GuestRegistration,
} from '../services/clinicRegistration';
import { databases, databaseId, collections } from '../services/appwrite';
import {
  visibleClinics as clinics,
  Clinic,
  ClinicDay,
  formatCents,
  isClinicDayOpen,
  isClinicOver,
  quoteClinic,
} from '../constants/clinicsData';
import { findClinicCode } from '../constants/discountCodes';

type Step = 'choose' | 'login' | 'guest-role' | 'pay';
type GuestRole = 'parent' | 'player';

interface DoneResult {
  players: string[];
  days: string[];
  email: string;
  pending: boolean;
  /** Paid by bank transfer that hasn't cleared yet. */
  bankProcessing: boolean;
}

// Payment-method tiles, same as the bill checkout: 2 rows of 4. Card-brand
// tiles all mean "pay by card" (the real brand comes from the card entry); the
// bank tile is Direct Debit (ACH).
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

interface Player extends ClinicPlayerRef {
  name: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

// Light inputs on the white sheet (the site runs in dark color-scheme).
const inputClass =
  'w-full rounded-xl border border-black/15 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-black/40 [color-scheme:light]';

// ── Checkout form (inside <Elements>) ─────────────────────────────────────────
const ClinicCheckoutForm = ({
  clinic,
  guestRole,
  onDone,
}: {
  clinic: Clinic;
  /** null = signed-in checkout */
  guestRole: GuestRole | null;
  onDone: (r: DoneResult) => void;
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const { user } = useAuth();
  const isGuest = guestRole !== null;

  // ── Signed-in account ──
  const [loadingAccount, setLoadingAccount] = useState(!isGuest);
  const [accountError, setAccountError] = useState('');
  const [stripeCustomerId, setStripeCustomerId] = useState<string | null>(null);
  const [userType, setUserType] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [children, setChildren] = useState<Player[]>([]);
  const [selectedChildIds, setSelectedChildIds] = useState<string[]>([]);
  const [savedMethods, setSavedMethods] = useState<SavedPaymentMethod[]>([]);
  // Player ids already signed up, per clinic day.
  const [registeredByDay, setRegisteredByDay] = useState<Record<string, string[]>>({});

  // ── Guest details ──
  const [guest, setGuest] = useState({
    parentFirstName: '',
    parentLastName: '',
    parentEmail: '',
    playerFirstName: '',
    playerLastName: '',
    playerBirthDate: '',
    playerEmail: '',
  });

  // ── Order ──
  const [selectedDays, setSelectedDays] = useState<string[]>(
    clinic.days.filter((d) => isClinicDayOpen(d)).map((d) => d.date),
  );
  const [promoInput, setPromoInput] = useState('');
  const [appliedCode, setAppliedCode] = useState('');
  const [couponError, setCouponError] = useState('');

  // Selection: '' (nothing chosen yet), a saved method id, 'card' (new card),
  // or 'ach' (pay by bank). Card entry only appears once a card tile is picked.
  const [selection, setSelection] = useState<string>('');
  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const [cardComplete, setCardComplete] = useState(false);
  const [cardError, setCardError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isGuest || !user) return;
    (async () => {
      try {
        const ctx = await resolveUserStripeContext(user.$id);
        setStripeCustomerId(ctx.stripeId);
        setUserType(ctx.userType);
        setProfile(ctx.profile);
        if (!ctx.userType) {
          setAccountError("We couldn't find a Next Star profile for this account.");
          return;
        }
        if (ctx.userType === 'coach') {
          setAccountError("Coach accounts can't register for clinics.");
          return;
        }
        if (ctx.userType === 'parent') {
          const kids = await getParentChildren(user.$id);
          setChildren(
            kids.map((k) => ({ kind: k.kind, id: k.id, name: `${k.firstName} ${k.lastName}`.trim() })),
          );
          if (kids.length === 1) setSelectedChildIds([kids[0].id]);
          if (kids.length === 0) {
            setAccountError('Add a player to your family in the Next Star app first, then come back to register them.');
          }
        }
        if (ctx.stripeId) {
          const methods = await listPaymentMethods(ctx.stripeId);
          setSavedMethods(methods);
          if (methods.length > 0) setSelection(methods[0].stripePaymentMethodId);
        }

        const signups = await databases.listDocuments(databaseId, collections.signups, [
          Query.equal('eventID', clinic.days.map((d) => d.eventId)),
          Query.equal('userId', user.$id),
          Query.limit(100),
        ]);
        const byDay: Record<string, string[]> = {};
        for (const day of clinic.days) {
          byDay[day.date] = (signups.documents as any[])
            .filter((s) => s.eventID === day.eventId)
            .map((s) => s.onBehalfOfProxyId || s.onBehalfOfUserId || (s.isProxySignup ? '' : s.userId))
            .filter(Boolean);
        }
        setRegisteredByDay(byDay);
      } catch (e: any) {
        setAccountError(e.message || 'Could not load your account.');
      } finally {
        setLoadingAccount(false);
      }
    })();
  }, [isGuest, user, clinic]);

  // Who is being registered.
  const players: Player[] = useMemo(() => {
    if (isGuest) {
      const name = `${guest.playerFirstName} ${guest.playerLastName}`.trim();
      return [{ kind: 'self', id: 'guest', name: name || 'Player' }];
    }
    if (userType === 'parent') return children.filter((c) => selectedChildIds.includes(c.id));
    if (user && userType) {
      const name = `${profile?.firstName || ''} ${profile?.lastName || ''}`.trim();
      return [{ kind: 'self', id: user.$id, name: name || 'You' }];
    }
    return [];
  }, [isGuest, guest, userType, children, selectedChildIds, user, profile]);

  const alreadyRegistered = (day: ClinicDay) =>
    players.filter((p) => (registeredByDay[day.date] || []).includes(p.id)).map((p) => p.name);
  const isDaySelectable = (day: ClinicDay) => isClinicDayOpen(day) && alreadyRegistered(day).length === 0;

  // Drop a day once a newly selected player turns out to be signed up for it.
  useEffect(() => {
    setSelectedDays((prev) => prev.filter((d) => {
      const day = clinic.days.find((x) => x.date === d);
      return day ? isDaySelectable(day) : false;
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players.length, registeredByDay]);

  const price = quoteClinic(clinic, selectedDays.length, players.length, appliedCode);

  const toggleDay = (day: ClinicDay) => {
    if (!isDaySelectable(day)) return;
    setSelectedDays((prev) =>
      prev.includes(day.date) ? prev.filter((d) => d !== day.date) : [...prev, day.date].sort(),
    );
  };

  const applyPromoCode = () => {
    const code = findClinicCode(promoInput, clinic.id);
    if (!code) {
      setCouponError("That code isn't valid for this clinic.");
      return;
    }
    setAppliedCode(code.code);
    setCouponError('');
  };

  const guestProblem = (): string => {
    if (!isGuest) return '';
    if (guestRole === 'parent') {
      if (!guest.parentFirstName.trim() || !guest.parentLastName.trim()) return 'Enter your first and last name.';
      if (!EMAIL_RE.test(guest.parentEmail.trim())) return 'Enter a valid email address.';
    }
    if (!guest.playerFirstName.trim() || !guest.playerLastName.trim()) return "Enter the player's first and last name.";
    if (!guest.playerBirthDate || new Date(guest.playerBirthDate) >= new Date()) return "Enter the player's birthdate.";
    if (guestRole === 'player' && !EMAIL_RE.test(guest.playerEmail.trim())) return 'Enter a valid email address.';
    return '';
  };

  const isCardMode = selection === 'card';
  const isAchMode = selection === 'ach';
  const noneSelected = selection === '';
  const canPay =
    !!stripe &&
    !processing &&
    !accountError &&
    !loadingAccount &&
    players.length > 0 &&
    selectedDays.length > 0 &&
    !!selection &&
    (isCardMode ? cardComplete : true);

  const handlePay = async () => {
    setError('');
    const problem = guestProblem();
    if (problem) {
      setError(problem);
      return;
    }
    if (!stripe || !elements || !canPay) return;

    setProcessing(true);
    const days = [...selectedDays].sort();
    const contactEmail = isGuest
      ? (guestRole === 'parent' ? guest.parentEmail : guest.playerEmail).trim().toLowerCase()
      : user?.email || '';
    const contactName = isGuest
      ? guestRole === 'parent'
        ? `${guest.parentFirstName} ${guest.parentLastName}`.trim()
        : `${guest.playerFirstName} ${guest.playerLastName}`.trim()
      : user?.name || '';
    const metadata = {
      clinicId: clinic.id,
      clinicDays: days.join(','),
      playerCount: String(players.length),
      pricingType: 'clinic',
      campName: clinic.name,
      ...(isGuest ? { guestCheckout: 'true' } : {}),
    };
    const userInfo = isGuest
      ? { userId: '', email: contactEmail, name: contactName, userType: 'guest' }
      : { userId: user!.$id, email: user!.email, name: user!.name, userType: userType || undefined };

    // ── 1. Charge ────────────────────────────────────────────────────────────
    let paymentIntentId = '';
    let bankProcessing = false;
    try {
      const savedBank = !isCardMode && !isAchMode
        ? savedMethods.find((m) => m.stripePaymentMethodId === selection && m.kind === 'bank')
        : undefined;

      if (savedBank) {
        // stripe.js can't confirm a saved bank account; the backend does.
        const res = await createPaymentIntent({
          amount: price.total,
          metadata,
          appliedCoupon: appliedCode || undefined,
          existingStripeCustomerId: stripeCustomerId || undefined,
          userInfo,
          paymentMethodId: savedBank.stripePaymentMethodId,
        });
        if (res.status !== 'succeeded' && res.status !== 'processing') {
          throw new Error('The bank transfer could not be completed. Please try another method.');
        }
        bankProcessing = res.status === 'processing';
        paymentIntentId = paymentIntentIdFromSecret(res.clientSecret);
      } else if (isAchMode) {
        // Pay by bank: Stripe's bank-connection dialog, then confirm.
        const res = await createPaymentIntent({
          amount: price.total,
          metadata,
          appliedCoupon: appliedCode || undefined,
          existingStripeCustomerId: isGuest ? undefined : stripeCustomerId || undefined,
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
        if (intent?.status === 'requires_payment_method') {
          // The dialog was closed without connecting a bank.
          throw new Error('Bank account was not connected. Please try again.');
        }
        if (intent?.status !== 'succeeded' && intent?.status !== 'processing') {
          // e.g. a bank that needs micro-deposit verification first.
          throw new Error(
            "This bank account needs to be verified before it can be charged, which takes a few days. Please pay by card or connect a different bank.",
          );
        }
        bankProcessing = intent.status === 'processing';
        paymentIntentId = intent.id;
      } else {
        const res = await createPaymentIntent({
          amount: price.total,
          metadata,
          appliedCoupon: appliedCode || undefined,
          existingStripeCustomerId: isGuest ? undefined : stripeCustomerId || undefined,
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
      setError(e.message || 'Something went wrong processing your payment.');
      setProcessing(false);
      return;
    }

    // ── 2. Register (retried — the card has already been charged) ───────────
    const guestPayload: GuestRegistration | undefined = isGuest
      ? {
          role: guestRole!,
          playerFirstName: guest.playerFirstName.trim(),
          playerLastName: guest.playerLastName.trim(),
          playerBirthDate: guest.playerBirthDate,
          ...(guestRole === 'parent'
            ? {
                parentFirstName: guest.parentFirstName.trim(),
                parentLastName: guest.parentLastName.trim(),
                parentEmail: contactEmail,
              }
            : { playerEmail: contactEmail }),
        }
      : undefined;
    let registered = false;
    for (let attempt = 0; attempt < 3 && !registered; attempt++) {
      try {
        await registerClinic({
          paymentIntentId,
          clinicId: clinic.id,
          days,
          couponCode: appliedCode || undefined,
          ...(isGuest ? { guest: guestPayload } : { players: players.map(({ kind, id }) => ({ kind, id })) }),
        });
        registered = true;
      } catch (e) {
        console.error('Clinic registration attempt failed:', e);
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      }
    }

    setProcessing(false);
    onDone({
      players: players.map((p) => p.name),
      days: days.map((d) => clinic.days.find((x) => x.date === d)?.label || d),
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

      {/* Player(s) */}
      <div className="bg-white border border-black/10 rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-gray-900 font-semibold">
          {isGuest ? (guestRole === 'parent' ? 'Your Details' : 'Player Details') : 'Player'}
        </h3>

        {isGuest ? (
          <div className="space-y-3">
            {guestRole === 'parent' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <input className={inputClass} placeholder="First name" autoComplete="given-name"
                    value={guest.parentFirstName} onChange={(e) => setGuest({ ...guest, parentFirstName: e.target.value })} />
                  <input className={inputClass} placeholder="Last name" autoComplete="family-name"
                    value={guest.parentLastName} onChange={(e) => setGuest({ ...guest, parentLastName: e.target.value })} />
                </div>
                <input className={inputClass} type="email" placeholder="Email" autoComplete="email"
                  value={guest.parentEmail} onChange={(e) => setGuest({ ...guest, parentEmail: e.target.value })} />
                <p className="text-gray-900 text-sm font-medium pt-3">Player</p>
              </>
            )}
            <div className="grid grid-cols-2 gap-3">
              <input className={inputClass} placeholder="Player first name"
                value={guest.playerFirstName} onChange={(e) => setGuest({ ...guest, playerFirstName: e.target.value })} />
              <input className={inputClass} placeholder="Player last name"
                value={guest.playerLastName} onChange={(e) => setGuest({ ...guest, playerLastName: e.target.value })} />
            </div>
            <label className="block">
              <span className="text-gray-500 text-xs">Birthdate</span>
              <input className={`${inputClass} mt-1`} type="date"
                value={guest.playerBirthDate} onChange={(e) => setGuest({ ...guest, playerBirthDate: e.target.value })} />
            </label>
            {guestRole === 'player' && (
              <input className={inputClass} type="email" placeholder="Email" autoComplete="email"
                value={guest.playerEmail} onChange={(e) => setGuest({ ...guest, playerEmail: e.target.value })} />
            )}
          </div>
        ) : userType === 'parent' ? (
          <div className="space-y-2">
            <p className="text-gray-500 text-sm">Who's coming?</p>
            {children.map((c) => {
              const checked = selectedChildIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() =>
                    setSelectedChildIds((prev) => (checked ? prev.filter((id) => id !== c.id) : [...prev, c.id]))
                  }
                  className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 transition-colors ${
                    checked ? 'border-black bg-black/5' : 'border-black/15 hover:border-black/40'
                  }`}
                >
                  <span className="text-gray-900 text-sm">{c.name}</span>
                  <span className={`w-5 h-5 rounded border-2 flex items-center justify-center ${checked ? 'bg-black border-black' : 'border-black/40'}`}>
                    {checked && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-gray-700 text-sm">{players[0]?.name}</p>
        )}
      </div>

      {/* Order summary */}
      <div className="bg-white border border-black/10 rounded-2xl p-6 shadow-sm">
        <h3 className="text-gray-900 font-semibold mb-1">{clinic.name}</h3>
        <p className="text-gray-500 text-sm mb-4">{clinic.location.name} · {clinic.location.city}</p>

        <p className="text-gray-900 text-sm font-medium mb-2">Select days</p>
        <div className="space-y-2 mb-4">
          {clinic.days.map((day) => {
            const selectable = isDaySelectable(day);
            const checked = selectedDays.includes(day.date);
            const taken = alreadyRegistered(day);
            return (
              <button
                key={day.date}
                type="button"
                onClick={() => toggleDay(day)}
                disabled={!selectable}
                className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  checked ? 'border-black bg-black/5' : 'border-black/15 hover:border-black/40'
                }`}
              >
                <span>
                  <span className="block text-gray-900 text-sm">{day.label}</span>
                  <span className="block text-gray-500 text-xs mt-0.5">
                    {taken.length > 0
                      ? `Already registered: ${taken.join(', ')}`
                      : !isClinicDayOpen(day)
                        ? 'This day has passed'
                        : `$${clinic.pricePerPlayerPerDay} per player`}
                  </span>
                </span>
                <span className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${checked ? 'bg-black border-black' : 'border-black/40'}`}>
                  {checked && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        <div className="border-t border-black/10 pt-4 pb-4">
          {appliedCode ? (
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 text-green-700 text-sm font-medium underline underline-offset-4">
                {findClinicCode(appliedCode, clinic.id)?.label || appliedCode}
              </p>
              <button
                type="button"
                onClick={() => { setAppliedCode(''); setPromoInput(''); }}
                disabled={processing}
                className="text-gray-500 hover:text-gray-900 text-sm flex-shrink-0 disabled:opacity-40"
              >
                Remove
              </button>
            </div>
          ) : (
            <form
              className="flex gap-2 [color-scheme:light]"
              onSubmit={(e) => { e.preventDefault(); applyPromoCode(); }}
            >
              <input
                type="text"
                value={promoInput}
                onChange={(e) => { setPromoInput(e.target.value.toUpperCase()); if (couponError) setCouponError(''); }}
                placeholder="Promo code"
                aria-label="Promo code"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                className="flex-1 min-w-0 rounded-xl border border-black/15 bg-white px-4 py-2.5 text-sm tracking-wider text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-black/40"
              />
              <button
                type="submit"
                disabled={!promoInput.trim() || processing}
                className="px-4 py-2.5 rounded-xl border border-black/15 bg-white text-sm font-medium text-gray-900 hover:border-black/40 transition-colors disabled:opacity-40"
              >
                Apply
              </button>
            </form>
          )}
          {couponError && <p className="text-red-600 text-sm mt-2">{couponError}</p>}
        </div>

        <div className="border-t border-black/10 pt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">
              Subtotal ({selectedDays.length} {selectedDays.length === 1 ? 'day' : 'days'} × {players.length}{' '}
              {players.length === 1 ? 'player' : 'players'})
            </span>
            <span className="text-gray-900">{formatCents(price.subtotal)}</span>
          </div>
          {price.discount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-green-700">Discount ({price.couponCode})</span>
              <span className="text-green-700">-{formatCents(price.discount)}</span>
            </div>
          )}
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

        {/* Payment-method icons — 2 rows of 4, Bank Transfer first on the
            second row (same as the bill checkout). */}
        <div className="space-y-4">
          {[METHOD_TILES.slice(0, 4), METHOD_TILES.slice(4)].map((row, ri) => (
            <div key={ri} className="flex items-center justify-center gap-x-6 sm:gap-x-9">
              {row.map((tile) => {
                const active =
                  tile.kind === 'ach' ? isAchMode : isCardMode && selectedBrand === tile.key;
                return (
                  <button
                    key={tile.key}
                    type="button"
                    onClick={() =>
                      tile.kind === 'ach'
                        ? setSelection('ach')
                        : (setSelection('card'), setSelectedBrand(tile.key))
                    }
                    className={`flex items-center gap-2 transition-opacity ${noneSelected || active ? 'opacity-100' : 'opacity-40 hover:opacity-100'}`}
                    title={tile.kind === 'ach' ? 'Bank Transfer' : tile.key}
                  >
                    {tile.kind === 'ach' ? (
                      <>
                        <svg className="h-6 w-auto flex-shrink-0 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M3 21h18M4 10h16M5 10V7l7-4 7 4v3M6 10v8m4-8v8m4-8v8m4-8v8" />
                        </svg>
                        <span className="text-gray-900 text-base font-medium whitespace-nowrap">Bank Transfer</span>
                      </>
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
          ))}
        </div>

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
            clear in 3–5 business days; you're registered as soon as the transfer is submitted.
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
        ) : selectedDays.length === 0 ? (
          'Select a day'
        ) : isAchMode ? (
          `Pay ${formatCents(price.total)} by bank`
        ) : (
          `Pay ${formatCents(price.total)}`
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

// ── Entry choice buttons ───────────────────────────────────────────────────────
const ChoiceButton = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full bg-white border border-black/10 rounded-2xl px-6 py-5 shadow-sm hover:border-black/40 transition-colors text-gray-900 font-semibold text-center"
  >
    {label}
  </button>
);

// ── Outer page ─────────────────────────────────────────────────────────────────
const ClinicCheckoutPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, initialized, login, logout, loading } = useAuth();
  const clinic = clinics.find((c) => c.slug === slug);

  const [step, setStep] = useState<Step>('choose');
  const [guestRole, setGuestRole] = useState<GuestRole | null>(null);
  const [done, setDone] = useState<DoneResult | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Signed in already → straight to paying.
  useEffect(() => {
    if (initialized && user && guestRole === null) setStep('pay');
  }, [initialized, user, guestRole]);

  const back = () => {
    if (step === 'login' || step === 'guest-role') setStep('choose');
    else if (step === 'pay' && guestRole) { setGuestRole(null); setStep('guest-role'); }
    else navigate(`/services/clinics/${slug}`);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      await login(email.trim(), password);
      setStep('pay');
    } catch (err: any) {
      setLoginError(err.message || 'Failed to sign in');
    }
  };

  const title = done ? 'Confirmed' : 'Checkout';

  return (
    <div className="min-h-screen bg-[#F4F2EE]">
      <header className="border-b border-black/10">
        <div className="max-w-2xl mx-auto px-4 md:px-6 py-4 flex items-center gap-3">
          {!done && (
            <button onClick={back} className="text-gray-500 hover:text-gray-900 transition-colors" aria-label="Back">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <h1 className="text-gray-900 font-bold text-lg">{title}</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 md:px-6 py-8">
        {!clinic ? (
          <p className="text-gray-600">Clinic not found.</p>
        ) : isClinicOver(clinic) && !done ? (
          <p className="text-gray-600">Registration for this clinic has closed.</p>
        ) : done ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-green-500/15 border border-green-600/40 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">You're registered!</h2>
            <p className="text-gray-700 mb-1">{done.players.join(', ')}</p>
            <p className="text-gray-500 text-sm mb-6">{done.days.join(' · ')} · {clinic.timeText} · {clinic.location.name}</p>
            <p className="text-gray-600 text-sm mb-8 max-w-md mx-auto">
              {done.pending
                ? "We received your payment and are finishing your registration. If you don't get a confirmation email shortly, contact us and we'll sort it out."
                : `${done.bankProcessing ? 'Your bank transfer is processing and typically clears in 3–5 business days. ' : ''}A confirmation email is on its way to ${done.email}.`}
            </p>
            <button
              onClick={() => navigate(`/services/clinics/${clinic.slug}`)}
              className="px-8 py-3 bg-black hover:bg-gray-900 text-white font-semibold rounded-lg transition-colors"
            >
              Back to the Clinic
            </button>
          </div>
        ) : !initialized ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-2 border-black/30 border-t-black rounded-full animate-spin" />
          </div>
        ) : step === 'choose' ? (
          <div className="space-y-4">
            <ChoiceButton label="Log in to your Next Star account" onClick={() => setStep('login')} />
            <ChoiceButton label="Continue as Guest" onClick={() => setStep('guest-role')} />
          </div>
        ) : step === 'login' ? (
          <div className="bg-white border border-black/10 rounded-2xl p-6 shadow-sm">
            <h3 className="text-gray-900 font-semibold mb-4">Log in</h3>
            {loginError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-700 text-sm">{loginError}</div>
            )}
            <form onSubmit={handleLogin} className="space-y-3">
              <input className={inputClass} type="email" placeholder="Email" autoComplete="email"
                value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} />
              <input className={inputClass} type="password" placeholder="Password" autoComplete="current-password"
                value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} />
              <button
                type="submit"
                disabled={loading || !email || !password}
                className="w-full py-3 bg-black hover:bg-gray-900 text-white font-semibold rounded-xl transition-colors disabled:opacity-40"
              >
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>
            <p className="text-gray-500 text-xs mt-4">Use the same email and password as the Next Star Soccer app.</p>
          </div>
        ) : step === 'guest-role' ? (
          <div className="space-y-4">
            <p className="text-gray-900 font-semibold">Who's checking out?</p>
            <ChoiceButton label="I'm a parent" onClick={() => { setGuestRole('parent'); setStep('pay'); }} />
            <ChoiceButton label="I'm a player" onClick={() => { setGuestRole('player'); setStep('pay'); }} />
          </div>
        ) : (
          <>
            {user && !guestRole && (
              <p className="text-gray-500 text-sm mb-4">
                Signed in as {user.email}.{' '}
                <button
                  onClick={async () => { await logout(); setStep('choose'); }}
                  className="underline underline-offset-2 hover:text-gray-900"
                >
                  Not you?
                </button>
              </p>
            )}
            <Elements stripe={getStripe()}>
              <ClinicCheckoutForm clinic={clinic} guestRole={guestRole} onDone={setDone} />
            </Elements>
          </>
        )}
      </main>
    </div>
  );
};

export default ClinicCheckoutPage;
