import { useState, useEffect } from 'react';
import { Query } from 'appwrite';
import { databases, databaseId, collections } from '../../../services/appwrite';

type BillStatus = 'outstanding' | 'settled' | 'overdue';

interface BillRecord {
  $id: string;
  monthName?: string;
  name?: string;
  names?: string;
  dueDate?: string;
  amount?: number;
  status: string;
  parentId?: string;
  description?: string;
  createdAt?: string;
  paidAt?: string;
  [key: string]: any;
}

const deriveBillStatus = (b: BillRecord): BillStatus => {
  if (b.status === 'paid') return 'settled';
  if (b.status === 'cancelled') return 'settled';
  // If due date has passed, it's overdue regardless of Appwrite status
  const dueMs = b.dueDate ? Date.parse(b.dueDate) : NaN;
  if (!isNaN(dueMs) && dueMs < Date.now()) return 'overdue';
  return 'outstanding';
};

const BillsSection = () => {
  const [bills, setBills] = useState<BillRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<BillStatus>('outstanding');
  const [search, setSearch] = useState('');
  const [selectedBill, setSelectedBill] = useState<BillRecord | null>(null);

  useEffect(() => {
    fetchBills();
  }, []);

  const fetchBills = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await databases.listDocuments(databaseId, collections.bills, [Query.limit(5000)]);
      setBills(res.documents as unknown as BillRecord[]);
    } catch (err: any) {
      setError('Failed to load bills: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const tabBills = bills.filter(b => deriveBillStatus(b) === activeTab);

  const filtered = tabBills.filter(b => {
    const name = (b.name || b.names || b.parentId || '').toLowerCase();
    return name.includes(search.toLowerCase());
  });

  const statusBadge = (tab: BillStatus) => {
    if (tab === 'settled') return 'bg-green-500/20 text-green-400 border border-green-500/30';
    if (tab === 'overdue') return 'bg-red-500/20 text-red-400 border border-red-500/30';
    return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
  };

  const tabLabel: Record<BillStatus, string> = {
    outstanding: 'Outstanding',
    settled: 'Settled',
    overdue: 'Overdue',
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-white mb-6">Bills</h2>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-900 rounded-lg p-1 w-fit border border-gray-800">
        {(['outstanding', 'settled', 'overdue'] as BillStatus[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tabLabel[tab]}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name..."
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
                <th className="text-left px-4 py-3 text-gray-400 text-sm font-medium">Month</th>
                <th className="text-left px-4 py-3 text-gray-400 text-sm font-medium">Name(s)</th>
                <th className="text-left px-4 py-3 text-gray-400 text-sm font-medium">Due Date</th>
                <th className="text-left px-4 py-3 text-gray-400 text-sm font-medium">Amount</th>
                <th className="text-left px-4 py-3 text-gray-400 text-sm font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No {tabLabel[activeTab].toLowerCase()} bills found
                  </td>
                </tr>
              ) : (
                filtered.map(bill => (
                  <tr
                    key={bill.$id}
                    onClick={() => setSelectedBill(bill)}
                    className="hover:bg-gray-800/50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 text-white">{bill.monthName || '—'}</td>
                    <td className="px-4 py-3 text-gray-300">{bill.name || bill.names || bill.parentId || '—'}</td>
                    <td className="px-4 py-3 text-gray-400">
                      {bill.dueDate ? new Date(bill.dueDate).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-white">
                      {(bill.totalAmount ?? bill.amount) != null ? `$${Number(bill.totalAmount ?? bill.amount).toFixed(2)}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusBadge(activeTab)}`}>
                        {tabLabel[activeTab]}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Slide-in Detail Panel */}
      {selectedBill && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setSelectedBill(null)}
          />
          <div className="fixed right-0 top-0 h-full w-96 bg-gray-900 border-l border-gray-700 z-50 overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">Bill Details</h3>
                <button
                  onClick={() => setSelectedBill(null)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusBadge(deriveBillStatus(selectedBill))}`}>
                    {tabLabel[deriveBillStatus(selectedBill)]}
                  </span>
                </div>

                <DetailRow label="Month" value={selectedBill.monthName} />
                <DetailRow label="Name(s)" value={selectedBill.name || selectedBill.names || selectedBill.parentId} />
                <DetailRow
                  label="Due Date"
                  value={selectedBill.dueDate ? new Date(selectedBill.dueDate).toLocaleDateString() : undefined}
                />
                <DetailRow
                  label="Amount"
                  value={(selectedBill.totalAmount ?? selectedBill.amount) != null ? `$${Number(selectedBill.totalAmount ?? selectedBill.amount).toFixed(2)}` : undefined}
                />
                <DetailRow label="Description" value={selectedBill.description} />
                <DetailRow
                  label="Created"
                  value={selectedBill.createdAt ? new Date(selectedBill.createdAt).toLocaleDateString() : undefined}
                />
                {selectedBill.paidAt && (
                  <DetailRow
                    label="Paid At"
                    value={new Date(selectedBill.paidAt).toLocaleDateString()}
                  />
                )}
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
    <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">{label}</p>
    <p className="text-white">{value || '—'}</p>
  </div>
);

export default BillsSection;
