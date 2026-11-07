import { useCallback, useEffect, useRef, useState } from 'react';
import { Elements, CardElement } from '@stripe/react-stripe-js';
import { getStripe } from '../../../services/payment/stripeClient';
import {
  SavedPaymentMethod,
  listPaymentMethodsDetailed,
  detachPaymentMethod,
  resolveUserStripeContext,
} from '../../../services/payment/paymentApi';
import { blockedBankNotice } from '../../../services/payment/paymentErrors';
import { usePaymentMethodActions } from '../../user/usePaymentMethodActions';
import { paymentMethodIcon } from './paymentCenterData';

// The app's Payment Methods screen, as a panel of the Payment Center: light
// cards for each saved card or bank account, then Add Card / Add Bank Account.
// Saving and removing use the same calls and rules as the /user portal's
// PaymentMethodsSection (usePaymentMethodActions, detach, keep one on file) —
// only the presentation follows the app. Cards are entered with Stripe's
// CardElement, so no Apple Pay / Google Pay buttons appear on the website.

type Props = {
  userId: string;
  userName: string;
  userEmail: string;
  /** Called with the number of saved methods whenever the list changes. */
  onMethodsChange?: (count: number) => void;
};

// CardElement on the app's light add-card sheet: dark text, grey placeholder.
const LIGHT_CARD_ELEMENT = {
  style: {
    base: {
      color: '#000000',
      fontFamily: 'inherit',
      fontSize: '15px',
      '::placeholder': { color: '#999999' },
    },
    invalid: { color: '#FF4444', iconColor: '#FF4444' },
  },
};

// The app's "Select Card Type" rows and logo widths.
const CARD_TYPE_ROWS: { id: string; name: string; width: number }[][] = [
  [
    { id: 'discover', name: 'Discover', width: 130 },
    { id: 'mastercard', name: 'Mastercard', width: 35 },
    { id: 'visa', name: 'Visa', width: 68 },
  ],
  [
    { id: 'jcb', name: 'JCB', width: 29 },
    { id: 'unionpay', name: 'UnionPay', width: 35 },
    { id: 'dinersclub', name: 'Diners Club', width: 85 },
    { id: 'amex', name: 'American Express', width: 79 },
  ],
];

const BANK_AUTHORIZATION =
  "By clicking Agree, you authorize Next Star Soccer to debit the bank account you link for amounts owed for Next Star Soccer services and products, including recurring monthly bills, under Next Star Soccer's terms, until you revoke this authorization. You can change or cancel it at any time with 30 days' notice to Next Star Soccer.";

/** As in the app: a card is "Card #n", a bank account is its bank's name. */
const methodName = (m: SavedPaymentMethod, index: number) =>
  m.kind === 'bank' ? m.bankName || 'Bank account' : `Card #${index + 1}`;

const capitalize = (s: string) => s.replace(/^./, (c) => c.toUpperCase());

const PlusIcon = () => (
  <svg className="w-6 h-6 mr-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14M5 12h14" />
  </svg>
);

/** Dark confirmation dialog in the app's autopay-modal style. */
const DarkDialog = ({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[420px] rounded-2xl border border-[#222] bg-[#111] p-6"
      >
        <h3 className="text-white text-xl font-medium mb-3">{title}</h3>
        {children}
      </div>
    </div>
  );
};

const primaryBtn =
  'flex-1 min-h-[48px] rounded-[10px] bg-[#F4F2EE] hover:bg-white px-3 py-3.5 text-sm font-medium text-black transition-colors disabled:opacity-40';
const cancelBtn = 'flex-1 rounded-[10px] py-3 text-sm font-medium text-white hover:bg-white/5 transition-colors';

const Inner = ({ userId, userName, userEmail, onMethodsChange }: Props) => {
  const { customerId, setCustomerId, saveCard, saveBank } = usePaymentMethodActions({ userId, userName, userEmail });
  const [methods, setMethods] = useState<SavedPaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  // Why a saved bank no longer appears (Stripe blocked it), or ''.
  const [blockedText, setBlockedText] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    kind: 'ok' | 'err';
    text: string;
    link?: { href: string; label: string };
  } | null>(null);

  // Add-card sheet
  const [addOpen, setAddOpen] = useState(false);
  const [cardType, setCardType] = useState('');
  const [cardComplete, setCardComplete] = useState(false);
  const [cardError, setCardError] = useState('');
  // Dialogs
  const [bankAuthOpen, setBankAuthOpen] = useState(false);
  const [toRemove, setToRemove] = useState<{ method: SavedPaymentMethod; name: string } | null>(null);
  const [keepOneOpen, setKeepOneOpen] = useState(false);

  // Held in refs so a parent passing inline callbacks doesn't re-trigger loading.
  const onMethodsChangeRef = useRef(onMethodsChange);
  onMethodsChangeRef.current = onMethodsChange;

  const refresh = useCallback(async (cid: string) => {
    const { methods: list, blocked } = await listPaymentMethodsDetailed(cid);
    setMethods(list);
    setBlockedText(blockedBankNotice(blocked));
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

  const openAdd = () => {
    setMessage(null);
    setCardType('');
    setCardComplete(false);
    setCardError('');
    setAddOpen(true);
  };
  const closeAdd = useCallback(() => {
    if (busy === 'card') return;
    setAddOpen(false);
    setCardType('');
    setCardComplete(false);
    setCardError('');
  }, [busy]);

  const addCard = async () => {
    setBusy('card');
    setMessage(null);
    setCardError('');
    const r = await saveCard();
    if (r.state === 'saved') {
      setAddOpen(false);
      setCardType('');
      setCardComplete(false);
      await refresh(r.customerId);
      setMessage({ kind: 'ok', text: r.message });
    } else if (r.state === 'error') {
      setCardError(r.message);
    }
    setBusy(null);
  };

  const addBankAccount = async () => {
    setBankAuthOpen(false);
    setBusy('bank');
    setMessage(null);
    const r = await saveBank();
    if (r.state === 'saved' || r.state === 'verifying') {
      await refresh(r.customerId);
      setMessage({ kind: 'ok', text: r.message, link: r.state === 'verifying' ? r.link : undefined });
    } else if (r.state === 'error') {
      setMessage({ kind: 'err', text: r.message });
    }
    setBusy(null);
  };

  // Escape closes the add-card sheet and the remove prompt, like the other dialogs.
  useEffect(() => {
    if (!addOpen && !toRemove) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (toRemove) setToRemove(null);
      else closeAdd();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [addOpen, toRemove, closeAdd]);

  // Every account has to keep a method on file, so the last one can only be
  // removed once another has been added.
  const canRemove = methods.length > 1;

  const askRemove = (m: SavedPaymentMethod, name: string) => {
    if (!canRemove) { setKeepOneOpen(true); return; }
    setToRemove({ method: m, name });
  };

  const remove = async (m: SavedPaymentMethod) => {
    setToRemove(null);
    if (!customerId) return;
    if (!canRemove) { setKeepOneOpen(true); return; }
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
      <h3 className="text-white text-[22px] mb-4">Payment Methods</h3>

      {blockedText && <p className="text-[#FF6B6B] text-[15px] leading-[22px] mb-5">{blockedText}</p>}

      {message && (
        <p
          role="status"
          className={`text-[15px] leading-[22px] mb-5 ${message.kind === 'ok' ? 'text-[#3DDC84]' : 'text-[#FF6B6B]'}`}
        >
          {message.text}
          {message.link && (
            <a
              href={message.link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="block mt-1 text-white underline underline-offset-2"
            >
              {message.link.label}
            </a>
          )}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-24">
          <div className="w-6 h-6 border-2 border-white/40 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {methods.length > 0 && (
            <div className="mb-2.5">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                {methods.map((m, i) => {
                  const name = methodName(m, i);
                  const icon = m.kind === 'card' ? paymentMethodIcon(m.brand) : null;
                  const removing = busy === m.stripePaymentMethodId;
                  return (
                    <div key={m.stripePaymentMethodId} className="bg-[#F4F2EE] rounded-xl border border-[#333] p-5">
                      <div className="flex items-center justify-between gap-3 mb-4">
                        <p className="text-black text-lg font-medium truncate">{name}</p>
                        {icon && <img src={icon} alt={m.brand} className="h-[25px] max-w-[60px] object-contain" />}
                      </div>

                      {m.kind === 'bank' ? (
                        <div className="space-y-3">
                          <div className="bg-[#e8e8e8] rounded-lg p-3">
                            <p className="text-[#999] text-xs mb-1">Account Number</p>
                            <p className="text-black text-base">•••• {m.last4}</p>
                          </div>
                          <div className="bg-[#e8e8e8] rounded-lg p-3">
                            <p className="text-[#999] text-xs mb-1">Account Type</p>
                            <p className="text-black text-base">{capitalize(m.accountType || 'checking')} · Bank transfer</p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="bg-[#e8e8e8] rounded-lg p-3">
                            <p className="text-[#999] text-xs mb-1">Card Number</p>
                            <p className="text-black text-base">•••• •••• •••• {m.last4}</p>
                          </div>
                          <div className="flex gap-3">
                            <div className="flex-1 bg-[#e8e8e8] rounded-lg p-3">
                              <p className="text-[#999] text-xs mb-1">Expiry</p>
                              <p className="text-black text-base">
                                {m.expMonth ? String(m.expMonth).padStart(2, '0') : '**'}/{m.expYear ? String(m.expYear).slice(-2) : '**'}
                              </p>
                            </div>
                            <div className="flex-1 bg-[#e8e8e8] rounded-lg p-3">
                              <p className="text-[#999] text-xs mb-1">CVC</p>
                              <p className="text-black text-base">•••</p>
                            </div>
                          </div>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => askRemove(m, name)}
                        disabled={!!busy}
                        className="mt-4 py-2 text-black text-base hover:underline underline-offset-4 disabled:opacity-60 disabled:no-underline"
                      >
                        {removing ? 'Removing…' : 'Remove'}
                      </button>
                    </div>
                  );
                })}
              </div>
              {methods.length === 1 && (
                <p className="text-[#999] text-[13px] leading-[18px] mt-4 mb-2">
                  You need to keep at least one payment method on file. Add another one to remove this one.
                </p>
              )}
            </div>
          )}

          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-1">
            <button
              type="button"
              onClick={openAdd}
              disabled={!!busy}
              className="flex items-center rounded-xl bg-[#2A2A2A] hover:bg-[#333] px-5 py-5 text-left text-white text-lg transition-colors disabled:opacity-60"
            >
              <PlusIcon />
              Add Card
            </button>
            <button
              type="button"
              onClick={() => { setMessage(null); setBankAuthOpen(true); }}
              disabled={!!busy}
              className="flex items-center rounded-xl bg-[#2A2A2A] hover:bg-[#333] px-5 py-5 text-left text-white text-lg transition-colors disabled:opacity-60"
            >
              <PlusIcon />
              {busy === 'bank' ? 'Opening your bank…' : 'Add Bank Account'}
            </button>
          </div>
          <p className="text-[#999] text-[13px] leading-[18px] mt-3">
            Bank accounts use ACH Direct Debit, and transfers take a few business days to clear.
          </p>
        </>
      )}

      {/* ── Add Payment Method (the app's light sheet) ─────────────────────── */}
      {addOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4" onClick={closeAdd}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-pm-title"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[480px] max-h-[85vh] flex flex-col overflow-hidden rounded-[15px] bg-[#F4F2EE]"
          >
            <div className="relative flex items-center justify-center p-5 border-b border-[#E0E0E0]">
              <button
                type="button"
                onClick={closeAdd}
                disabled={busy === 'card'}
                aria-label="Close"
                className="absolute left-5 p-1 text-2xl leading-none text-[#666] hover:text-black disabled:opacity-60"
              >
                ✕
              </button>
              <h3 id="add-pm-title" className="text-xl font-medium text-black">Add Payment Method</h3>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <p className="text-base font-medium text-black mb-5">Select Card Type</p>
              {CARD_TYPE_ROWS.map((row, r) => (
                <div key={r} className="flex items-center justify-around px-2.5 py-[15px] mb-[5px]">
                  {row.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => { setCardType(t.id); setCardComplete(false); setCardError(''); }}
                      disabled={busy === 'card'}
                      aria-pressed={cardType === t.id}
                      aria-label={t.name}
                      className={`rounded-lg p-[5px] transition-colors ${cardType === t.id ? 'bg-[#E3F2FD]' : 'hover:bg-black/5'}`}
                    >
                      <img
                        src={`/assets/icons/payment/${t.id}.png`}
                        alt=""
                        style={{ width: t.width }}
                        className="h-[22px] object-contain"
                      />
                    </button>
                  ))}
                </div>
              ))}

              {cardType && (
                <div className="mt-2.5 px-1 sm:px-5 pb-2">
                  <p className="text-lg font-medium text-black mb-5">Enter Card Details</p>
                  <p className="text-sm font-medium text-black mb-2">Card Information</p>
                  <div
                    className={`my-2 flex h-[50px] items-center rounded-lg bg-[#F4F2EE] px-3 ${
                      cardError ? 'border-2 border-[#FF0000]' : 'border border-[#E0E0E0]'
                    }`}
                  >
                    <div className="w-full">
                      <CardElement
                        options={LIGHT_CARD_ELEMENT}
                        onChange={(e) => { setCardComplete(e.complete); setCardError(e.error?.message || ''); }}
                      />
                    </div>
                  </div>
                  {cardError && <p className="mt-1 text-xs text-[#FF4444]">{cardError}</p>}

                  <button
                    type="button"
                    onClick={addCard}
                    disabled={!cardComplete || busy === 'card'}
                    className="mt-5 w-full rounded-lg bg-black py-4 text-base font-medium text-white hover:bg-[#1a1a1a] transition-colors disabled:opacity-60"
                  >
                    {busy === 'card' ? 'Saving…' : 'Add Payment Method'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Authorize bank payments (the app asks before opening the bank) ── */}
      {bankAuthOpen && (
        <DarkDialog title="Authorize bank payments" onClose={() => setBankAuthOpen(false)}>
          <p className="text-[#ccc] text-[15px] leading-[22px] mb-5">{BANK_AUTHORIZATION}</p>
          <div className="flex gap-3">
            <button type="button" onClick={() => setBankAuthOpen(false)} className={cancelBtn}>Cancel</button>
            <button type="button" onClick={addBankAccount} className={primaryBtn}>Agree</button>
          </div>
        </DarkDialog>
      )}

      {/* ── Keep one on file ─────────────────────────────────────────────── */}
      {keepOneOpen && (
        <DarkDialog title="Keep one payment method on file" onClose={() => setKeepOneOpen(false)}>
          <p className="text-[#ccc] text-[15px] leading-[22px] mb-5">
            Every account needs a card or bank account saved. Add another one before removing this one.
          </p>
          <div className="flex">
            <button type="button" onClick={() => setKeepOneOpen(false)} className={primaryBtn}>OK</button>
          </div>
        </DarkDialog>
      )}

      {/* ── Remove confirmation (the app's black, white-bordered prompt) ─── */}
      {toRemove && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-6" onClick={() => setToRemove(null)}>
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label="Remove payment method"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[360px] rounded-xl border border-white bg-black p-6 text-center"
          >
            <p className="text-white text-base leading-[22px] mb-6">
              Are you sure you want to remove {toRemove.name} from your Payment Methods?
            </p>
            <div className="flex gap-5">
              <button type="button" onClick={() => setToRemove(null)} className="flex-1 py-3 text-white text-base rounded-lg hover:bg-white/10 transition-colors">
                No
              </button>
              <button type="button" onClick={() => remove(toRemove.method)} className="flex-1 py-3 text-white text-base rounded-lg hover:bg-white/10 transition-colors">
                Yes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const PaymentMethodsPanel = (props: Props) => (
  <Elements stripe={getStripe()}>
    <Inner {...props} />
  </Elements>
);

export default PaymentMethodsPanel;
