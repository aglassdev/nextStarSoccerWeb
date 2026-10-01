import { useCallback, useEffect, useRef, useState } from 'react';
import { Query } from 'appwrite';
import { databases, databaseId, collections } from '../../services/appwrite';
import {
  customerHasPaymentMethod,
  resolveUserStripeContext,
} from '../../services/payment/paymentApi';

// Same rule as the app's PaymentMethodRequiredModal: every paying account keeps
// a card or bank account on file, regardless of `billing: "approved"`.
//
// Shown each time the portal is opened or the tab is brought back while the
// account has no saved method. Dismissing it only hides it for now; it returns
// next time until a method is saved. Its single action jumps to Payment Methods.

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

const PaymentMethodRequiredModal = ({
  userId,
  suppressed,
  onAddPaymentMethod,
}: {
  userId: string;
  /** True once the user is working in Payment Methods or has a method saved. */
  suppressed: boolean;
  onAddPaymentMethod: () => void;
}) => {
  const [visible, setVisible] = useState(false);
  const checking = useRef(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const runCheck = useCallback(async () => {
    if (checking.current || suppressed) return;
    checking.current = true;
    try {
      if (await needsPaymentMethod(userId)) setVisible(true);
    } catch {
      // Never nag on a failed lookup.
    } finally {
      checking.current = false;
    }
  }, [userId, suppressed]);

  // On opening the portal.
  useEffect(() => {
    runCheck();
  }, [runCheck]);

  // Coming back to the tab counts as going back in, like the app returning to
  // the foreground.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') runCheck();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [runCheck]);

  // Escape closes it for now, like the Android back button in the app.
  useEffect(() => {
    if (!visible) return;
    buttonRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setVisible(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible]);

  if (!visible || suppressed) return null;

  return (
    // Clicking outside the card is the only way out besides the button.
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/75"
      onClick={() => setVisible(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pm-required-title"
        className="w-full max-w-[420px] bg-[#111] border border-[#222] rounded-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="pm-required-title" className="text-white text-xl font-medium mb-3">
          Payment method required
        </h3>
        <p className="text-[#ccc] text-[15px] leading-[22px] mb-5">
          Every Next Star Soccer account is now required to have a card or bank account saved on
          file. Please add one to continue.
        </p>
        <button
          ref={buttonRef}
          onClick={() => {
            setVisible(false);
            onAddPaymentMethod();
          }}
          className="w-full min-h-[48px] bg-[#F4F2EE] hover:bg-white text-black text-[15px] font-medium rounded-[10px] transition-colors"
        >
          Add Payment Method
        </button>
      </div>
    </div>
  );
};

export default PaymentMethodRequiredModal;
