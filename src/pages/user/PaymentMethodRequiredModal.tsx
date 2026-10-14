import { useCallback, useEffect, useRef, useState } from 'react';
import { Query } from 'appwrite';
import { Elements, CardElement } from '@stripe/react-stripe-js';
import { getStripe } from '../../services/payment/stripeClient';
import { databases, databaseId, collections } from '../../services/appwrite';
import {
  customerHasPaymentMethod,
  resolveUserStripeContext,
} from '../../services/payment/paymentApi';
import { CARD_ELEMENT_STYLE, SaveResult, usePaymentMethodActions } from './usePaymentMethodActions';

// Same rule as the app: every paying account keeps a card or bank account on
// file, regardless of `billing: "approved"`.
//
// It can't be dismissed. Continue reveals Add card / Add bank account; each
// opens its own step whose X only comes back here. It is checked on every
// visit and reload until a method is saved.

// Admin accounts, as in the app's constants/adminConfig.ts.
const ADMIN_USER_IDS = ['mi363q40_q03mtr0sknh', 'mi36bdeg_o704o948kfd', 'mj7d9825_hhgqztus4tb'];

async function needsPaymentMethod(userId: string): Promise<boolean> {
  if (ADMIN_USER_IDS.includes(userId)) return false;

  const ctx = await resolveUserStripeContext(userId);
  // No payer profile, or a pure coach: coaches are never billed. (A
  // player+coach hybrid resolves to their player profile, so still pays.)
  if (!ctx.profile || ctx.userType === 'coach') return false;

  if (await customerHasPaymentMethod(ctx.stripeId)) return false;

  // A child linked to a parent is billed to that parent, so the parent's
  // method satisfies the requirement.
  const parentId = ctx.profile.linkedParentId;
  if (parentId) {
    try {
      const r = await databases.listDocuments(databaseId, collections.parentUsers, [
        Query.equal('userId', parentId),
        Query.limit(1),
      ]);
      const parent = r.documents[0] as any;
      if (parent && (await customerHasPaymentMethod(parent.stripeId))) return false;
    } catch {
      return false;
    }
  }
  return true;
}

type Step = 'intro' | 'choose' | 'card' | 'bank';

const primaryBtn = 'min-h-[48px] px-3 bg-[#F4F2EE] hover:bg-white text-black text-[15px] font-medium rounded-[10px] transition-colors disabled:opacity-40';
const secondaryBtn = 'min-h-[48px] px-3 border border-white/25 hover:border-white/60 text-white text-[15px] font-medium rounded-[10px] transition-colors disabled:opacity-40';

const CloseX = ({ onClick, label }: { onClick: () => void; label: string }) => (
  <button onClick={onClick} aria-label={label} className="text-white/50 hover:text-white transition-colors -mr-1 -mt-1 p-1">
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  </button>
);

const Gate = ({ userId, userName, userEmail, onSaved, onDeferred }: {
  userId: string; userName: string; userEmail: string;
  onSaved: () => void;
  /** A bank account is waiting on its test deposit: let them in for this visit. */
  onDeferred: () => void;
}) => {
  const { saveCard, saveBank } = usePaymentMethodActions({ userId, userName, userEmail });
  const [step, setStep] = useState<Step>('intro');
  const [busy, setBusy] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState<Extract<SaveResult, { state: 'verifying' }> | null>(null);
  const focusRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { focusRef.current?.focus(); }, [step]);

  const go = (s: Step) => { setError(''); setStep(s); };
  const handle = (r: SaveResult) => {
    if (r.state === 'saved') onSaved();
    else if (r.state === 'verifying') setVerifying(r);
    else if (r.state === 'error') setError(r.message);
  };

  const card = 'w-full max-w-[420px] bg-[#111] border border-[#222] rounded-2xl p-6';
  const errorLine = error && <p className="mt-3 text-sm text-red-400">{error}</p>;

  let content;
  if (step === 'intro' || step === 'choose') {
    content = (
      <div role="dialog" aria-modal="true" aria-labelledby="pm-required-title" className={card}>
        <h3 id="pm-required-title" className="text-white text-xl font-medium mb-3">Payment method required</h3>
        <p className="text-[#ccc] text-[15px] leading-[22px] mb-5">
          Every Next Star Soccer account is now required to have a card or bank account saved on
          file. Please add one to continue.
        </p>
        {step === 'intro' ? (
          <button ref={focusRef} onClick={() => go('choose')} className={`w-full ${primaryBtn}`}>Continue</button>
        ) : (
          <div className="flex gap-3">
            <button ref={focusRef} onClick={() => go('card')} className={`flex-1 ${primaryBtn}`}>Add card</button>
            <button onClick={() => go('bank')} className={`flex-1 ${secondaryBtn}`}>Add bank account</button>
          </div>
        )}
      </div>
    );
  } else if (step === 'card') {
    content = (
      <div role="dialog" aria-modal="true" aria-labelledby="pm-card-title" className={card}>
        <div className="flex items-start justify-between mb-5">
          <h3 id="pm-card-title" className="text-white text-xl font-medium">Add a card</h3>
          <CloseX onClick={() => go('choose')} label="Back" />
        </div>
        <div className="p-4 rounded-xl border border-white/15 bg-white/[0.03]">
          <CardElement options={CARD_ELEMENT_STYLE} onChange={(e) => setCardComplete(e.complete)} />
        </div>
        {errorLine}
        <button
          ref={focusRef}
          onClick={async () => { setBusy(true); setError(''); handle(await saveCard()); setBusy(false); }}
          disabled={!cardComplete || busy}
          className={`w-full mt-5 ${primaryBtn}`}
        >
          {busy ? 'Saving…' : 'Save card'}
        </button>
      </div>
    );
  } else {
    content = (
      <div role="dialog" aria-modal="true" aria-labelledby="pm-bank-title" className={card}>
        <div className="flex items-start justify-between mb-3">
          <h3 id="pm-bank-title" className="text-white text-xl font-medium">Add a bank account</h3>
          {!verifying && <CloseX onClick={() => go('choose')} label="Back" />}
        </div>
        {verifying ? (
          <>
            <p className="text-[#ccc] text-[15px] leading-[22px]">{verifying.message}</p>
            {verifying.link && (
              <a href={verifying.link.href} target="_blank" rel="noopener noreferrer" className="inline-block mt-3 text-white underline underline-offset-2 text-sm">
                {verifying.link.label}
              </a>
            )}
            <button ref={focusRef} onClick={onDeferred} className={`w-full mt-5 ${primaryBtn}`}>Got it</button>
          </>
        ) : (
          <>
            <p className="text-[#ccc] text-[15px] leading-[22px] mb-3">
              You'll log in to your bank, or enter your routing and account numbers, in Stripe's secure window.
            </p>
            <p className="text-gray-500 text-xs leading-5">
              Bank accounts use ACH Direct Debit, and transfers take a few business days to clear. By
              adding a bank account, you authorize Next Star Soccer to debit it for amounts owed for
              Next Star Soccer services and products, including recurring monthly bills, under Next
              Star Soccer's terms, until you revoke this authorization. You can change or cancel it
              at any time with 30 days' notice to Next Star Soccer.
            </p>
            {errorLine}
            <button
              ref={focusRef}
              onClick={async () => { setBusy(true); setError(''); handle(await saveBank()); setBusy(false); }}
              disabled={busy}
              className={`w-full mt-5 ${primaryBtn}`}
            >
              {busy ? 'Opening your bank…' : 'Continue to your bank'}
            </button>
          </>
        )}
      </div>
    );
  }

  // No click-outside or Escape: the only ways forward are the buttons.
  return <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/75">{content}</div>;
};

const PaymentMethodRequiredModal = ({
  userId,
  userName,
  userEmail,
  suppressed,
  onMethodAdded,
}: {
  userId: string;
  userName: string;
  userEmail: string;
  /** True once this account has a method saved. */
  suppressed: boolean;
  onMethodAdded: () => void;
}) => {
  const [visible, setVisible] = useState(false);
  const deferred = useRef(false);
  const checking = useRef(false);

  const runCheck = useCallback(async () => {
    if (checking.current || suppressed || deferred.current) return;
    checking.current = true;
    try {
      if (await needsPaymentMethod(userId)) setVisible(true);
    } catch {
      // Never block on a failed lookup.
    } finally {
      checking.current = false;
    }
  }, [userId, suppressed]);

  // On opening (and every reload of) the portal.
  useEffect(() => { runCheck(); }, [runCheck]);

  // Coming back to the tab counts as going back in.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') runCheck(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [runCheck]);

  if (!visible || suppressed) return null;

  return (
    <Elements stripe={getStripe()}>
      <Gate
        userId={userId}
        userName={userName}
        userEmail={userEmail}
        onSaved={() => { setVisible(false); onMethodAdded(); }}
        onDeferred={() => { deferred.current = true; setVisible(false); onMethodAdded(); }}
      />
    </Elements>
  );
};

export default PaymentMethodRequiredModal;
