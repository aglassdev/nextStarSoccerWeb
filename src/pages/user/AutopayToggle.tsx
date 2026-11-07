import { useEffect, useState } from 'react';
import { databases, databaseId } from '../../services/appwrite';
import {
  resolveUserStripeContext,
  listPaymentMethods,
  clearUserStripeContextCache,
} from '../../services/payment/paymentApi';

// The Autopay pill, as in the app's Payment Center. Autopay is the `autoPay`
// field on the user's profile ("true" on, "" off), which the autopay run reads.
// Turning it on needs a saved payment method and an explicit agreement; turning
// it off is immediate.
const AutopayToggle = ({
  userId,
  onNeedPaymentMethod,
}: {
  userId: string;
  // Called when there is no saved method, so the page can point to where to add one.
  onNeedPaymentMethod: () => void;
}) => {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [profile, setProfile] = useState<{ docId: string; collectionId: string; stripeId: string | null } | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [noMethodOpen, setNoMethodOpen] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const ctx = await resolveUserStripeContext(userId);
      if (!ctx.profile || !ctx.collectionId) return;
      setProfile({ docId: ctx.profile.$id, collectionId: ctx.collectionId, stripeId: ctx.stripeId });
      setEnabled(ctx.profile.autoPay === 'true');
    })();
  }, [userId]);

  const save = async (value: 'true' | '') => {
    if (!profile) return;
    await databases.updateDocument(databaseId, profile.collectionId, profile.docId, { autoPay: value });
    clearUserStripeContextCache(userId);
    setEnabled(value === 'true');
  };

  const onPress = async () => {
    if (busy || !profile) return;
    setError('');
    if (enabled) {
      setBusy(true);
      try { await save(''); } catch (e: any) { setError(e?.message || 'Could not turn off autopay.'); }
      finally { setBusy(false); }
      return;
    }
    // Turning on: a saved card or bank account has to be there to charge.
    setBusy(true);
    // Read fresh, so a method added a moment ago on this page counts.
    clearUserStripeContextCache(userId);
    const ctx = await resolveUserStripeContext(userId);
    const methods = ctx.stripeId ? await listPaymentMethods(ctx.stripeId) : [];
    setBusy(false);
    if (methods.length === 0) { setNoMethodOpen(true); return; }
    setAgreed(false);
    setConsentOpen(true);
  };

  const activate = async () => {
    if (!agreed || busy) return;
    setBusy(true);
    setError('');
    try { await save('true'); setConsentOpen(false); }
    catch (e: any) { setError(e?.message || 'Could not enable autopay.'); }
    finally { setBusy(false); }
  };

  return (
    <>
      {/* The app's pill: grey when off, green with a bright dot when on. */}
      <button
        type="button"
        onClick={onPress}
        disabled={busy || !profile}
        aria-pressed={enabled}
        title={enabled ? 'Autopay is on' : 'Autopay is off'}
        className={`inline-flex items-center rounded-full border px-3 md:px-3.5 py-2 text-xs md:text-[13px] leading-[18px] font-medium transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
          enabled
            ? 'border-[#1F7A3C] bg-[#0E3B1E] text-white'
            : 'border-[#2A2A2A] bg-[#1A1A1A] text-[#aaa] hover:border-[#3a3a3a] hover:text-white'
        }`}
      >
        <span className={`mr-1.5 h-2 w-2 rounded-full ${enabled ? 'bg-[#3DDC84]' : 'bg-[#555]'}`} />
        Autopay
      </button>
      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}

      {noMethodOpen && (
        <Dialog onClose={() => setNoMethodOpen(false)}>
          <h3 className="text-white text-xl font-medium mb-3">No payment method</h3>
          <p className="text-[#ccc] text-[15px] leading-[22px] mb-[18px]">
            You need a saved payment method before turning on autopay. Add a card or bank
            account under Payment Methods, then come back here to enable it.
          </p>
          <button
            type="button"
            onClick={() => { setNoMethodOpen(false); onNeedPaymentMethod(); }}
            className="w-full min-h-[48px] rounded-[10px] bg-[#F4F2EE] py-3.5 text-sm font-medium text-black hover:bg-white transition-colors"
          >
            Continue
          </button>
        </Dialog>
      )}

      {consentOpen && (
        <Dialog onClose={() => setConsentOpen(false)}>
          <h3 className="text-white text-xl font-medium mb-3">Turn on autopay</h3>
          <p className="text-[#ccc] text-[15px] leading-[22px] mb-[18px]">
            I agree to let Next Star automatically charge my saved payment method for each
            monthly bill. Autopay only runs on the last day of the billing period, so I can
            still pay manually any time before then.
          </p>
          <label className="mb-5 flex cursor-pointer items-center gap-3 py-1">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-[3px] border border-white peer-checked:bg-[#F4F2EE] peer-focus-visible:ring-2 peer-focus-visible:ring-white/50"
            >
              {agreed && (
                <svg className="h-3 w-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </span>
            <span className="text-sm text-white">I agree to the autopay terms above</span>
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setConsentOpen(false)}
              className="flex-1 rounded-[10px] py-3 text-sm font-medium text-white hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={activate}
              disabled={!agreed || busy}
              className="flex-1 min-h-[48px] rounded-[10px] bg-[#F4F2EE] py-3.5 text-sm font-medium text-black hover:bg-white transition-colors disabled:opacity-40"
            >
              {busy ? 'Activating…' : 'Activate'}
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
};

const Dialog = ({ children, onClose }: { children: React.ReactNode; onClose: () => void }) => (
  <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 p-6" onClick={onClose}>
    <div
      role="dialog"
      aria-modal="true"
      className="w-full max-w-[420px] rounded-2xl border border-[#222] bg-[#111] p-6"
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  </div>
);

export default AutopayToggle;
