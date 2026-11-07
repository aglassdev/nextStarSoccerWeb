import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { useAccount } from '../AccountContext';
import { AccountPageHeader, AccountSpinner } from '../AccountLayout';
import {
  Bill,
  getUserBills,
  getBillOwnerFirstNames,
  formatMoney,
  formatBillDate,
  isBillOverdue,
  calculateLateFee,
} from '../../../services/payment/billingService';
import { resolveUserStripeContext } from '../../../services/payment/paymentApi';
import { PAYMENTS_PATH } from '../../../constants/features';
import AutopayToggle from '../../user/AutopayToggle';
import PaymentMethodRequiredModal from '../../user/PaymentMethodRequiredModal';
import PaymentMethodsPanel from './PaymentMethodsPanel';
import { BillDetailModal, PrepaidPaymentModal } from './PaymentDetailModal';
import { PrepaidPayment, centerBillTitle, getPrepaidPayments } from './paymentCenterData';

// Account Center → Payment Center, the app's PaymentCenterScreen on a wide
// screen: "Payment Center" with the Autopay pill, then Upcoming (the Family
// Balance card for parents paying for 2+ players, then each bill) and Past
// (prepaid payments and paid bills). Selecting a bill opens its receipt sheet,
// with Pay for an unpaid one. Payment methods sit beside them on desktop and
// below on phones. Amounts follow the web's billing rules: an overdue bill
// shows its 10% late fee, matching what checkout charges.

/** What an unpaid bill costs today: its total plus any late fee (same as checkout). */
const amountDue = (bill: Bill) => bill.totalAmount + calculateLateFee(bill);

const cardBase =
  'relative w-full overflow-hidden text-left rounded-[14px] bg-[#111] border border-[#222] px-5 md:px-6 min-h-[100px] md:min-h-[116px] flex flex-col justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40';
const cardHover = 'hover:bg-[#161616] hover:border-[#333]';

const SectionTitle = ({ id, children }: { id: string; children: React.ReactNode }) => (
  <h3 id={id} className="text-white text-[22px] mb-4">{children}</h3>
);

const UpcomingBillCard = ({ bill, title, onOpen }: { bill: Bill; title: string; onOpen: (b: Bill) => void }) => {
  const isPending = bill.status === 'pending';
  const isProcessing = bill.status === 'processing';
  const isOverdue = isPending && isBillOverdue(bill);
  return (
    <button
      type="button"
      onClick={() => !isProcessing && onOpen(bill)}
      disabled={isProcessing}
      className={`${cardBase} ${isOverdue ? 'pt-12 pb-5 md:pb-6' : 'py-5 md:py-6'} ${
        isProcessing ? 'opacity-70 cursor-default' : cardHover
      }`}
    >
      {isOverdue && (
        <span className="absolute top-0 inset-x-0 bg-[#DC2626] px-3 py-1.5 text-center text-xs uppercase tracking-[0.5px] text-white">
          Overdue
        </span>
      )}
      {isProcessing && (
        <span className="self-start mb-2 rounded-md bg-[#1f6feb] px-2 py-[3px] text-[11px] font-semibold text-white">
          Processing
        </span>
      )}
      <span className="flex w-full items-center justify-between gap-4">
        <span className="min-w-0 flex-1">
          <span className="block text-white text-[22px] leading-snug mb-2 line-clamp-2">{title}</span>
          <span className={`block mt-1 text-lg md:text-xl leading-snug ${isPending ? 'text-[#fca5a5]' : 'text-[#9ca3af]'}`}>
            {isProcessing ? 'Bank transfer clearing (3–5 business days)' : `Due by ${formatBillDate(bill.dueDate)}`}
          </span>
        </span>
        <span className="flex-shrink-0 text-white text-[26px] tabular-nums">{formatMoney(amountDue(bill))}</span>
      </span>
    </button>
  );
};

const PastCard = ({ title, amount, bill, onOpen }: { title: string; amount: number; bill?: boolean; onOpen: () => void }) => (
  <button type="button" onClick={onOpen} className={`${cardBase} ${cardHover} py-5 md:py-6`}>
    <span className="flex w-full items-center justify-between gap-4">
      <span className={`min-w-0 flex-1 text-white leading-snug line-clamp-2 ${bill ? 'text-[22px]' : 'text-xl'}`}>{title}</span>
      <span className={`flex-shrink-0 text-white tabular-nums ${bill ? 'text-[26px]' : 'text-2xl'}`}>{formatMoney(amount)}</span>
    </span>
  </button>
);

const FamilyBalance = ({
  bills,
  players,
  nameFor,
  onPayAll,
}: {
  bills: Bill[];
  players: number;
  nameFor: (b: Bill) => string;
  onPayAll: () => void;
}) => {
  const total = bills.reduce((s, b) => s + amountDue(b), 0);
  return (
    <div className="mb-4 rounded-[14px] border border-white/15 bg-[#111] p-4 md:p-6 md:flex md:items-end md:gap-10">
      <div className="md:flex-1 min-w-0">
        <p className="text-white text-lg font-medium">Family Balance</p>
        <p className="text-white/60 text-[13px] mt-0.5 mb-3">
          {formatMoney(total)} across {players} players
        </p>
        {bills.map((b) => (
          <div key={b.$id} className="flex justify-between gap-4 py-1 text-sm text-white/85">
            <span className="truncate">{nameFor(b)}</span>
            <span className="font-medium tabular-nums">{formatMoney(amountDue(b))}</span>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onPayAll}
        className="mt-3.5 w-full md:w-auto md:min-w-[240px] md:px-8 rounded-[10px] bg-[#1f6feb] hover:bg-[#3b82f6] py-[13px] text-[15px] font-medium text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
      >
        Pay All {formatMoney(total)}
      </button>
    </div>
  );
};

const PaymentCenter = () => {
  const { user } = useAuth();
  const { userType } = useAccount();
  const navigate = useNavigate();
  const [bills, setBills] = useState<Bill[]>([]);
  const [payments, setPayments] = useState<PrepaidPayment[]>([]);
  const [childNames, setChildNames] = useState<Record<string, string>>({});
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<PrepaidPayment | null>(null);
  // The payment-method prompt goes away only once a method is saved.
  const [paymentPromptSuppressed, setPaymentPromptSuppressed] = useState(false);
  // Remounts Payment Methods so a method added in the prompt shows up there.
  const [methodsKey, setMethodsKey] = useState(0);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      setError('');
      try {
        // First name only (from the profile) — the name new methods are saved under.
        const ctx = await resolveUserStripeContext(user.$id);
        const name = (ctx.profile?.firstName || '').trim();
        if (name) setDisplayName(name);

        const [result, prepaid] = await Promise.all([getUserBills(user.$id), getPrepaidPayments(user.$id)]);
        result.sort((a, b) => Date.parse(b.$createdAt || '') - Date.parse(a.$createdAt || ''));
        setBills(result);
        setPayments(prepaid);
        setChildNames(await getBillOwnerFirstNames(result, user.$id));
      } catch (e: any) {
        setError(e.message || 'Failed to load bills');
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const pendingBills = useMemo(() => bills.filter((b) => b.status === 'pending'), [bills]);
  // In-flight bank transfers (ACH): listed under Upcoming as Processing, not payable.
  const processingBills = useMemo(() => bills.filter((b) => b.status === 'processing'), [bills]);
  const paidBills = useMemo(() => bills.filter((b) => b.status === 'paid'), [bills]);
  const upcoming = useMemo(() => [...pendingBills, ...processingBills], [pendingBills, processingBills]);

  // Family Balance: parents only, and only when paying for 2+ players (months
  // are paid separately, so it's a multi-child view, as in the app).
  const familyPlayers = useMemo(() => new Set(pendingBills.map((b) => b.userId)).size, [pendingBills]);
  const showFamilyBalance = userType === 'parent' && familyPlayers >= 2;

  const titleFor = (bill: Bill) => centerBillTitle(bill, childNames[bill.$id]);

  const payBills = (billIds: string[]) => {
    navigate(`${PAYMENTS_PATH}/checkout`, { state: { billIds } });
  };

  const autopay = user?.$id && (
    <AutopayToggle
      userId={user.$id}
      onNeedPaymentMethod={() =>
        document.getElementById('payment-methods')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    />
  );

  const pastCount = payments.length + paidBills.length;

  return (
    <>
      <AccountPageHeader title="Payment Center" right={autopay} />

      <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-10 xl:grid-cols-[minmax(0,1fr)_400px] xl:gap-14">
        <div className="min-w-0 space-y-10 md:space-y-12">
          {loading ? (
            <AccountSpinner />
          ) : error ? (
            <div className="rounded-[14px] border border-[#DC2626]/40 bg-[#DC2626]/10 p-4 text-[#fca5a5]">{error}</div>
          ) : (
            <>
              <section aria-labelledby="pc-upcoming" className="min-h-[180px]">
                <SectionTitle id="pc-upcoming">Upcoming</SectionTitle>

                {showFamilyBalance && (
                  <FamilyBalance
                    bills={pendingBills}
                    players={familyPlayers}
                    nameFor={(b) => childNames[b.$id] || 'Player'}
                    onPayAll={() => payBills(pendingBills.map((b) => b.$id))}
                  />
                )}

                {upcoming.length === 0 ? (
                  <p className="pt-10 pb-6 text-center text-lg text-[#9ca3af]">No upcoming payments</p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {upcoming.map((bill) => (
                      <UpcomingBillCard key={bill.$id} bill={bill} title={titleFor(bill)} onOpen={setSelectedBill} />
                    ))}
                  </div>
                )}
              </section>

              <section aria-labelledby="pc-past">
                <SectionTitle id="pc-past">Past</SectionTitle>
                {pastCount === 0 ? (
                  <p className="py-6 text-center text-lg text-[#9ca3af]">No past payments</p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {payments.map((p) => (
                      <PastCard key={p.$id} title={p.name} amount={p.price} onOpen={() => setSelectedPayment(p)} />
                    ))}
                    {paidBills.map((bill) => (
                      <PastCard
                        key={`paid-${bill.$id}`}
                        bill
                        title={titleFor(bill)}
                        amount={bill.totalAmount}
                        onOpen={() => setSelectedBill(bill)}
                      />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>

        {/* Saved payment methods — cards and bank accounts (ACH) */}
        <aside id="payment-methods" className="min-w-0 scroll-mt-28">
          {user?.$id && (
            <PaymentMethodsPanel
              key={methodsKey}
              userId={user.$id}
              userName={displayName || ''}
              userEmail={(user as any)?.email || ''}
              onMethodsChange={(count) => {
                if (count > 0) setPaymentPromptSuppressed(true);
              }}
            />
          )}
        </aside>
      </div>

      {selectedBill && (
        <BillDetailModal
          bill={selectedBill}
          onClose={() => setSelectedBill(null)}
          onPay={(bill) => { setSelectedBill(null); payBills([bill.$id]); }}
        />
      )}
      {selectedPayment && <PrepaidPaymentModal payment={selectedPayment} onClose={() => setSelectedPayment(null)} />}

      {/* Required until a card or bank account is saved; it can't be dismissed. */}
      {user?.$id && !loading && (
        <PaymentMethodRequiredModal
          userId={user.$id}
          userName={displayName || ''}
          userEmail={(user as any)?.email || ''}
          suppressed={paymentPromptSuppressed}
          onMethodAdded={() => {
            setPaymentPromptSuppressed(true);
            setMethodsKey((k) => k + 1);
          }}
        />
      )}
    </>
  );
};

export default PaymentCenter;
