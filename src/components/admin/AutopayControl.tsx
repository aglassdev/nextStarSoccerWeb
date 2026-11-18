// Autopay On/Off for an admin profile. "On" is dimmed while the person who'd
// be charged has no saved card or bank account; clicking it says why. If
// autopay is already on without a method, it warns that the charge will fail.
import { useEffect, useState } from 'react';
import { checkPaymentMethod } from '../../services/payment/paymentApi';

export type MethodState = 'checking' | 'yes' | 'no' | 'unknown';

/** Whether the Stripe customer has a saved card or bank account. */
export function usePaymentMethodState(stripeId: string | null | undefined, ready: boolean): MethodState {
  const [state, setState] = useState<MethodState>('checking');
  useEffect(() => {
    if (!ready) { setState('checking'); return; }
    let live = true;
    setState('checking');
    checkPaymentMethod(stripeId).then((s) => { if (live) setState(s); });
    return () => { live = false; };
  }, [stripeId, ready]);
  return state;
}

const AutopayControl = ({
  on, saving, method, payerName, note, onChange,
}: {
  on: boolean;
  saving: boolean;
  method: MethodState;
  /** Who gets charged, e.g. "this parent" or the paying parent's name. */
  payerName: string;
  /** Result of the last change ("Autopay on for all 3 family members."). */
  note: string;
  onChange: (on: boolean) => void;
}) => {
  const [blocked, setBlocked] = useState(false);
  useEffect(() => { setBlocked(false); }, [method, on]);
  const canTurnOn = method === 'yes' || method === 'unknown';

  const button = (value: boolean) => {
    const selected = on === value;
    const dimmed = value && !selected && !canTurnOn;
    return (
      <button
        key={String(value)}
        type="button"
        onClick={() => {
          if (selected || saving) return;
          if (dimmed) { setBlocked(true); return; }
          onChange(value);
        }}
        disabled={saving || selected}
        title={dimmed ? 'No saved payment method' : undefined}
        className={`flex-1 px-2.5 py-1.5 rounded text-[11px] font-medium border transition-all ${
          selected
            ? 'bg-white/10 border-white/40 text-white'
            : dimmed
              ? 'bg-white/[0.02] border-white/[0.06] text-white/20 cursor-not-allowed'
              : 'bg-white/[0.04] border-white/10 text-white/45 hover:text-white hover:border-white/25'
        }`}
      >
        {value ? 'On' : 'Off'}
      </button>
    );
  };

  return (
    <div>
      <p className="text-white/40 text-[10px] uppercase tracking-wider mb-2">Autopay</p>
      <div className="flex gap-1.5">
        {button(true)}
        {button(false)}
      </div>
      {method === 'checking' && !on && (
        <p className="text-white/30 text-[11px] mt-2">Checking for a saved payment method…</p>
      )}
      {method === 'no' && !on && (
        <p className={`text-[11px] mt-2 ${blocked ? 'text-amber-400' : 'text-white/40'}`}>
          {blocked
            ? `Can't turn autopay on: ${payerName} has no saved card or bank account. Add one in their Payment Methods first.`
            : `No saved payment method for ${payerName}, so autopay can't be turned on.`}
        </p>
      )}
      {method === 'no' && on && (
        <p className="text-amber-400 text-[11px] mt-2">
          Autopay is on, but {payerName} has no saved card or bank account, so the monthly charge will fail.
        </p>
      )}
      {method === 'unknown' && (
        <p className="text-white/30 text-[11px] mt-2">Couldn't check for a saved payment method.</p>
      )}
      {note && <p className="text-white/40 text-[11px] mt-2">{note}</p>}
    </div>
  );
};

export default AutopayControl;
