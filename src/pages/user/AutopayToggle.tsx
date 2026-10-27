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
      <button
        type="button"
        onClick={onPress}
        disabled={busy || !profile}
        aria-pressed={enabled}
        className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
          enabled
            ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300'
            : 'border-white/15 text-gray-300 hover:border-white/30 hover:text-white'
        }`}
      >
        <span className={`h-2 w-2 rounded-full ${enabled ? 'bg-emerald-400' : 'bg-white/30'}`} />
        Autopay
        <span className="text-xs opacity-70">{busy ? '…' : enabled ? 'On' : 'Off'}</span>
      </button>
      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}

      {noMethodOpen && (
        <Dialog onClose={() => setNoMethodOpen(false)}>
          <h3 className="text-white text-lg font-semibold">No payment method</h3>
          <p className="mt-2 text-sm text-gray-400 leading-relaxed">
            You need a saved payment method before turning on autopay. Add a card or bank
            account under Payment Methods, then come back here to enable it.
          </p>
          <button
            type="button"
            onClick={() => { setNoMethodOpen(false); onNeedPaymentMethod(); }}
            className="mt-6 w-full rounded-lg bg-white py-2.5 text-sm font-semibold text-black hover:bg-gray-200"
          >
            Continue
          </button>
        </Dialog>
      )}

      {consentOpen && (
        <Dialog onClose={() => setConsentOpen(false)}>
          <h3 className="text-white text-lg font-semibold">Turn on autopay</h3>
          <p className="mt-2 text-sm text-gray-400 leading-relaxed">
            I agree to let Next Star automatically charge my saved payment method for each
            monthly bill. Autopay only runs on the last day of the billing period, so I can
            still pay manually any time before then.
          </p>
          <label className="mt-5 flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="h-4 w-4 accent-white"
            />
            <span className="text-sm text-white">I agree to the autopay terms above</span>
          </label>
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={() => setConsentOpen(false)}
              className="flex-1 rounded-lg border border-white/15 py-2.5 text-sm text-gray-300 hover:border-white/30 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={activate}
              disabled={!agreed || busy}
              className="flex-1 rounded-lg bg-white py-2.5 text-sm font-semibold text-black hover:bg-gray-200 disabled:opacity-40"
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
  <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
    <div
      role="dialog"
      aria-modal="true"
      className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#111] p-6"
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  </div>
);

export default AutopayToggle;
