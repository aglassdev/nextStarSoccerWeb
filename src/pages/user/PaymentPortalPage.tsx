import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  Bill,
  BillItem,
  getUserBills,
  getBillItems,
  getBillOwnerFirstNames,
  formatMoney,
  formatBillDate,
  billTitle,
  isBillOverdue,
  calculateLateFee,
} from '../../services/payment/billingService';

// ── Bill detail modal ──────────────────────────────────────────────────────────
const BillModal = ({
  bill,
  title,
  onClose,
  onPay,
}: {
  bill: Bill;
  title: string;
  onClose: () => void;
  onPay: (bill: Bill) => void;
}) => {
  const [items, setItems] = useState<BillItem[]>([]);
  const [loading, setLoading] = useState(true);
  const lateFee = calculateLateFee(bill);
  const isPaid = bill.status === 'paid';
  const isProcessing = bill.status === 'processing';

  useEffect(() => {
    (async () => {
      setLoading(true);
      setItems(await getBillItems(bill.$id));
      setLoading(false);
    })();
  }, [bill.$id]);

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-lg bg-[#111] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <h3 className="text-white font-semibold text-lg">{title}</h3>
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
            {/* Meta */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wider mb-0.5">
                  {isPaid ? 'Paid On' : 'Due Date'}
                </p>
                <p className="text-white text-sm">
                  {isPaid ? formatBillDate(bill.paidAt) : formatBillDate(bill.dueDate)}
                </p>
              </div>
              {bill.paymentMethod && (
                <div>
                  <p className="text-gray-500 text-xs uppercase tracking-wider mb-0.5">Method</p>
                  <p className="text-white text-sm capitalize">{bill.paymentMethod}</p>
                </div>
              )}
            </div>

            {/* Items */}
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-3">Sessions</p>
              {loading ? (
                <div className="flex items-center justify-center h-16">
                  <div className="w-5 h-5 border-2 border-white/40 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : items.length === 0 ? (
                <p className="text-gray-600 text-sm text-center py-4">No session items found</p>
              ) : (
                <div className="space-y-2">
                  {items.map((item) => (
                    <div
                      key={item.$id}
                      className="bg-[#0d0d0d] border border-white/10 rounded-xl px-4 py-3 flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-white text-sm font-medium truncate">{item.eventTitle || '—'}</p>
                        {item.eventDate && <p className="text-gray-600 text-xs mt-0.5">{item.eventDate}</p>}
                      </div>
                      <span className="text-white text-sm font-medium flex-shrink-0">
                        {formatMoney(item.price)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Totals */}
            <div className="bg-[#0d0d0d] border border-white/10 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Subtotal</span>
                <span className="text-white">{formatMoney(bill.totalAmount)}</span>
              </div>
              {lateFee > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-red-400">Late fee (10%)</span>
                  <span className="text-red-400">{formatMoney(lateFee)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-semibold pt-2 border-t border-white/10">
                <span className="text-white">Total</span>
                <span className="text-white">USD {formatMoney(bill.totalAmount + lateFee)}</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-white/10 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2 text-sm text-gray-400 hover:text-white border border-white/10 hover:border-white/30 rounded-lg transition-colors"
            >
              Close
            </button>
            {!isPaid && !isProcessing && (
              <button
                onClick={() => onPay(bill)}
                className="px-6 py-2 text-sm bg-white hover:bg-gray-200 text-black font-semibold rounded-lg transition-colors"
              >
                Pay USD {formatMoney(bill.totalAmount + lateFee)}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

// ── Payment Portal ──────────────────────────────────────────────────────────────
const PaymentPortalPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [bills, setBills] = useState<Bill[]>([]);
  const [childNames, setChildNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const result = await getUserBills(user.$id);
        result.sort((a, b) => Date.parse(b.$createdAt || '') - Date.parse(a.$createdAt || ''));
        setBills(result);
        setChildNames(await getBillOwnerFirstNames(result, user.$id));
      } catch (e: any) {
        setError(e.message || 'Failed to load bills');
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const unpaidBills = useMemo(
    () => bills.filter((b) => b.status === 'pending' || b.status === 'processing'),
    [bills],
  );
  const paidBills = useMemo(() => bills.filter((b) => b.status === 'paid'), [bills]);

  const outstandingTotal = useMemo(
    () =>
      unpaidBills
        .filter((b) => b.status === 'pending')
        .reduce((sum, b) => sum + b.totalAmount + calculateLateFee(b), 0),
    [unpaidBills],
  );

  const titleFor = (bill: Bill) => billTitle(bill.monthName, childNames[bill.$id]);

  // Greeting matches the admin dashboard: time-of-day + full name.
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const fullName = user?.name?.trim() || user?.email?.split('@')[0] || '';

  const payBills = (billIds: string[]) => {
    navigate('/user/payments/checkout', { state: { billIds } });
  };

  const pendingUnpaid = unpaidBills.filter((b) => b.status === 'pending');

  return (
    <div className="min-h-screen bg-black">
      {/* Top bar */}
      <header className="border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/assets/images/NextStarBall.png"
              alt="Next Star"
              className="w-7 h-7 opacity-90"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <h1 className="text-white font-bold text-lg">Payment Portal</h1>
          </div>
          <button
            onClick={async () => { await logout(); navigate('/user'); }}
            className="text-sm text-gray-400 hover:text-white border border-white/10 hover:border-white/30 rounded-lg px-4 py-1.5 transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 md:px-6 py-8 space-y-8">
        {/* Greeting */}
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-white">
            {greeting}{fullName ? `, ${fullName}` : ''}
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-2 border-white/40 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">{error}</div>
        ) : (
          <>
            {/* Big card: current unpaid bills */}
            <section className="bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d] border border-white/10 rounded-2xl p-6 md:p-8">
              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
                <div>
                  <p className="text-gray-400 text-sm uppercase tracking-wider mb-1">Total Outstanding</p>
                  <p className="text-4xl md:text-5xl font-bold text-white">USD {formatMoney(outstandingTotal)}</p>
                </div>
                {pendingUnpaid.length > 1 && (
                  <button
                    onClick={() => payBills(pendingUnpaid.map((b) => b.$id))}
                    className="px-6 py-3 bg-white hover:bg-gray-200 text-black font-semibold rounded-lg transition-colors self-start md:self-auto"
                  >
                    Pay All
                  </button>
                )}
              </div>

              {unpaidBills.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-green-400 text-lg font-medium">You're all caught up</p>
                  <p className="text-gray-500 text-sm mt-1">No outstanding bills.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {unpaidBills.map((bill) => {
                    const overdue = isBillOverdue(bill);
                    const processing = bill.status === 'processing';
                    const total = bill.totalAmount + calculateLateFee(bill);
                    return (
                      <div
                        key={bill.$id}
                        className="bg-[#111] border border-white/10 rounded-xl p-4 flex items-center justify-between gap-4 hover:border-white/25 transition-colors"
                      >
                        <button onClick={() => setSelectedBill(bill)} className="flex-1 min-w-0 text-left">
                          <div className="flex items-center gap-2">
                            <p className="text-white font-medium truncate">{titleFor(bill)}</p>
                            {processing ? (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                Processing
                              </span>
                            ) : overdue ? (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-500/20 text-red-400 border border-red-500/30">
                                Overdue
                              </span>
                            ) : null}
                          </div>
                          <p className="text-gray-500 text-xs mt-0.5">
                            {processing
                              ? 'Bank transfer clearing (3–5 business days)'
                              : `Due ${formatBillDate(bill.dueDate)}`}
                          </p>
                        </button>
                        <div className="flex items-center gap-4 flex-shrink-0">
                          <span className="text-white font-semibold">{formatMoney(total)}</span>
                          {!processing && (
                            <button
                              onClick={() => payBills([bill.$id])}
                              className="px-5 py-2 bg-white hover:bg-gray-200 text-black text-sm font-semibold rounded-lg transition-colors"
                            >
                              Pay
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Past paid bills */}
            <section>
              <h3 className="text-white font-semibold text-lg mb-4">Payment History</h3>
              {paidBills.length === 0 ? (
                <p className="text-gray-500 text-sm">No past payments yet.</p>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {paidBills.map((bill) => (
                    <button
                      key={bill.$id}
                      onClick={() => setSelectedBill(bill)}
                      className="bg-[#111] border border-white/10 rounded-xl p-4 text-left hover:border-white/25 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                          Paid
                        </span>
                        <span className="text-white font-semibold">{formatMoney(bill.totalAmount)}</span>
                      </div>
                      <p className="text-white text-sm font-medium truncate">{titleFor(bill)}</p>
                      <p className="text-gray-500 text-xs mt-0.5">
                        {bill.paidAt ? `Paid ${formatBillDate(bill.paidAt)}` : ''}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {selectedBill && (
        <BillModal
          bill={selectedBill}
          title={titleFor(selectedBill)}
          onClose={() => setSelectedBill(null)}
          onPay={(bill) => { setSelectedBill(null); payBills([bill.$id]); }}
        />
      )}
    </div>
  );
};

export default PaymentPortalPage;
