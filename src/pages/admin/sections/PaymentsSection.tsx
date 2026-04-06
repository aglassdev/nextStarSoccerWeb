import { useState, useEffect } from 'react';
import { Query } from 'appwrite';
import { databases, databaseId, collections } from '../../../services/appwrite';

interface PaymentRecord {
  $id: string;
  payerName?: string;
  eventName?: string;
  createdAt?: string;
  amount?: number;
  paymentMethod?: string;
  weeks?: number;
  startDate?: string;
  endDate?: string;
  subtotal?: number;
  discount?: number;
  status?: string;
  stripePaymentIntentId?: string;
  billId?: string;
  parentId?: string;
  [key: string]: any;
}

const PaymentsSection = () => {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedPayment, setSelectedPayment] = useState<PaymentRecord | null>(null);

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await databases.listDocuments(databaseId, collections.payments, [Query.limit(5000)]);
      setPayments(res.documents as unknown as PaymentRecord[]);
    } catch (err: any) {
      setError('Failed to load payments: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const filtered = payments.filter(p => {
    const name = (p.payerName || p.parentId || '').toLowerCase();
    const event = (p.eventName || '').toLowerCase();
    const q = search.toLowerCase();
    return name.includes(q) || event.includes(q);
  });

  const statusColor = (status?: string) => {
    if (status === 'succeeded') return 'bg-green-500/20 text-green-400 border border-green-500/30';
    if (status === 'failed') return 'bg-red-500/20 text-red-400 border border-red-500/30';
    return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-white mb-6">Payments</h2>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search by payer or event..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-md px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
        />
      </div>

      {loading && (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500 rounded-lg text-red-400 mb-4">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-950">
                <th className="text-left px-4 py-3 text-gray-400 text-sm font-medium">Payer</th>
                <th className="text-left px-4 py-3 text-gray-400 text-sm font-medium">Event</th>
                <th className="text-left px-4 py-3 text-gray-400 text-sm font-medium">Date</th>
                <th className="text-left px-4 py-3 text-gray-400 text-sm font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    No payments found
                  </td>
                </tr>
              ) : (
                filtered.map(payment => (
                  <tr
                    key={payment.$id}
                    onClick={() => setSelectedPayment(payment)}
                    className="hover:bg-gray-800/50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 text-white">{payment.payerName || payment.parentId || '—'}</td>
                    <td className="px-4 py-3 text-gray-300">{payment.eventName || '—'}</td>
                    <td className="px-4 py-3 text-gray-400">
                      {payment.createdAt ? new Date(payment.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-white">
                      {payment.amount != null ? `$${Number(payment.amount).toFixed(2)}` : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Centered Modal */}
      {selectedPayment && (
        <>
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40" onClick={() => setSelectedPayment(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className="pointer-events-auto w-full max-w-lg bg-[#111] border border-[#222] rounded-2xl shadow-2xl overflow-hidden">

              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e1e1e]">
                <div className="flex items-center gap-3">
                  <h3 className="text-white font-semibold text-lg">Payment Details</h3>
                  {selectedPayment.status && (
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor(selectedPayment.status)}`}>
                      {selectedPayment.status.charAt(0).toUpperCase() + selectedPayment.status.slice(1)}
                    </span>
                  )}
                </div>
                <button onClick={() => setSelectedPayment(null)} className="text-gray-500 hover:text-white transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="px-6 py-5 max-h-[65vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <DetailRow label="Payer" value={selectedPayment.payerName || selectedPayment.parentId} />
                  <DetailRow label="Event" value={selectedPayment.eventName} />
                  <DetailRow label="Date" value={selectedPayment.createdAt ? new Date(selectedPayment.createdAt).toLocaleDateString() : undefined} />
                  <DetailRow label="Amount" value={selectedPayment.amount != null ? `$${Number(selectedPayment.amount).toFixed(2)}` : undefined} />
                  <DetailRow label="Payment Method" value={selectedPayment.paymentMethod} />
                  <DetailRow label="Weeks" value={selectedPayment.weeks != null ? String(selectedPayment.weeks) : undefined} />
                  <DetailRow label="Start Date" value={selectedPayment.startDate ? new Date(selectedPayment.startDate).toLocaleDateString() : undefined} />
                  <DetailRow label="End Date" value={selectedPayment.endDate ? new Date(selectedPayment.endDate).toLocaleDateString() : undefined} />
                  <DetailRow label="Subtotal" value={selectedPayment.subtotal != null ? `$${Number(selectedPayment.subtotal).toFixed(2)}` : undefined} />
                  <DetailRow label="Discount" value={selectedPayment.discount != null ? `$${Number(selectedPayment.discount).toFixed(2)}` : undefined} />
                  {selectedPayment.stripePaymentIntentId && (
                    <div className="col-span-2">
                      <DetailRow label="Stripe Intent ID" value={selectedPayment.stripePaymentIntentId} />
                    </div>
                  )}
                </div>
              </div>

              <div className="px-6 py-4 border-t border-[#1e1e1e] flex justify-end">
                <button
                  onClick={() => setSelectedPayment(null)}
                  className="px-5 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const DetailRow = ({ label, value }: { label: string; value?: string }) => (
  <div>
    <p className="text-gray-600 text-xs uppercase tracking-wider mb-0.5">{label}</p>
    <p className="text-white text-sm">{value || '—'}</p>
  </div>
);

export default PaymentsSection;
