import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { databases, collections, databaseId } from '../services/appwrite';
import { Query } from 'appwrite';

interface BillItem {
  $id: string;
  billId: string;
  eventTitle: string;
  eventDate: string;
  price: number;
}

interface Bill {
  $id: string;
  userId: string;
  monthName: string;
  totalAmount: number;
  status: 'pending' | 'paid' | 'overdue';
  dueDate: string;
  paidAt: string | null;
  paymentMethod: string | null;
  items?: BillItem[];
}

const BillingPage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchBills();
  }, [user]);

  const fetchBills = async () => {
    setLoading(true);
    setError(null);
    try {
      const billsRes = await databases.listDocuments(
        databaseId,
        collections.bills,
        [Query.equal('userId', user!.$id), Query.orderDesc('$createdAt'), Query.limit(100)]
      );

      const billDocs = billsRes.documents as unknown as Bill[];

      // Fetch bill items for all bills in parallel
      const billsWithItems = await Promise.all(
        billDocs.map(async (bill) => {
          try {
            const itemsRes = await databases.listDocuments(
              databaseId,
              collections.billItems,
              [Query.equal('billId', bill.$id)]
            );
            return { ...bill, items: itemsRes.documents as unknown as BillItem[] };
          } catch {
            return { ...bill, items: [] };
          }
        })
      );

      setBills(billsWithItems);
    } catch (err: any) {
      console.error('Error fetching bills:', err);
      setError('Failed to load bills.');
    } finally {
      setLoading(false);
    }
  };

  const pendingBills = bills.filter((b) => b.status !== 'paid');
  const paidBills = bills.filter((b) => b.status === 'paid');
  const totalDue = pendingBills.reduce((sum, b) => sum + b.totalAmount, 0);
  const paidThisMonth = paidBills
    .filter((b) => b.paidAt && new Date(b.paidAt).getMonth() === new Date().getMonth())
    .reduce((sum, b) => sum + b.totalAmount, 0);
  const nextDue = pendingBills
    .map((b) => new Date(b.dueDate))
    .sort((a, z) => a.getTime() - z.getTime())[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">Billing</h1>
          <p className="text-gray-400 mt-1">Manage your payments and billing history</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-yellow-500 to-orange-500 rounded-lg p-6 text-white">
          <p className="text-sm opacity-90 mb-2">Total Due</p>
          <p className="text-3xl font-bold">${totalDue}</p>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg p-6 text-white">
          <p className="text-sm opacity-90 mb-2">Paid This Month</p>
          <p className="text-3xl font-bold">${paidThisMonth}</p>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg p-6 text-white">
          <p className="text-sm opacity-90 mb-2">Next Due Date</p>
          <p className="text-lg font-semibold">
            {nextDue
              ? nextDue.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : '—'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-gray-700">
        <button
          onClick={() => setActiveTab('current')}
          className={`px-4 py-3 font-medium transition-colors border-b-2 ${
            activeTab === 'current'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          Current Bills
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-3 font-medium transition-colors border-b-2 ${
            activeTab === 'history'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-400 hover:text-white'
          }`}
        >
          Payment History
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-gray-400 py-8 text-center">Loading bills...</div>
      ) : error ? (
        <div className="text-red-400 py-8 text-center">{error}</div>
      ) : activeTab === 'current' ? (
        <div className="space-y-4">
          {pendingBills.length === 0 ? (
            <div className="text-gray-400 py-8 text-center">No pending bills.</div>
          ) : (
            pendingBills.map((bill) => (
              <div key={bill.$id} className="bg-gray-800 rounded-lg p-4 md:p-6 border border-gray-700">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white mb-2">{bill.monthName}</h3>
                    <div className="space-y-2">
                      {(bill.items ?? []).map((item) => (
                        <div key={item.$id} className="flex justify-between text-sm">
                          <span className="text-gray-400">{item.eventTitle}</span>
                          <span className="text-gray-300">${item.price}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-sm">
                      <span className="text-gray-400">Due:</span>
                      <span className="text-white">
                        {new Date(bill.dueDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-3">
                    <div className="text-2xl font-bold text-white">${bill.totalAmount}</div>
                    <button className="px-6 py-2 bg-primary hover:bg-primary-dark text-white font-semibold rounded-lg transition-colors">
                      Pay Now
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {paidBills.length === 0 ? (
            <div className="text-gray-400 py-8 text-center">No payment history.</div>
          ) : (
            paidBills.map((bill) => (
              <div key={bill.$id} className="bg-gray-800 rounded-lg p-4 md:p-6 border border-gray-700">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white mb-2">{bill.monthName}</h3>
                    <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                      {bill.paidAt && (
                        <span className="text-gray-400">
                          Paid:{' '}
                          {new Date(bill.paidAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      )}
                      {bill.paymentMethod && (
                        <span className="text-gray-400">Method: {bill.paymentMethod}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-xl font-bold text-white">${bill.totalAmount}</div>
                    <span className="px-3 py-1 bg-green-500/20 text-green-400 text-sm font-medium rounded-full">
                      ✓ Paid
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default BillingPage;
