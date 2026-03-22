import { useState } from 'react';

const BillingPage = () => {
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');

  const currentBills = [
    {
      id: 1,
      description: 'January Training Sessions',
      amount: 150,
      dueDate: '2026-02-01',
      status: 'pending',
      items: [
        { name: 'Team Training (4 sessions)', amount: 100 },
        { name: 'Individual Session', amount: 50 },
      ],
    },
    {
      id: 2,
      description: 'Tournament Registration Fee',
      amount: 100,
      dueDate: '2026-02-05',
      status: 'pending',
      items: [{ name: 'Spring Tournament', amount: 100 }],
    },
  ];

  const paymentHistory = [
    {
      id: 1,
      description: 'December Training Sessions',
      amount: 150,
      paidDate: '2025-12-15',
      method: 'Credit Card',
    },
    {
      id: 2,
      description: 'Equipment Fee',
      amount: 75,
      paidDate: '2025-12-01',
      method: 'Credit Card',
    },
  ];

  const getTotalDue = () => {
    return currentBills.reduce((sum, bill) => sum + bill.amount, 0);
  };

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
          <p className="text-3xl font-bold">${getTotalDue()}</p>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg p-6 text-white">
          <p className="text-sm opacity-90 mb-2">Paid This Month</p>
          <p className="text-3xl font-bold">$0</p>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg p-6 text-white">
          <p className="text-sm opacity-90 mb-2">Next Due Date</p>
          <p className="text-lg font-semibold">Feb 1, 2026</p>
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
      {activeTab === 'current' ? (
        <div className="space-y-4">
          {currentBills.map((bill) => (
            <div
              key={bill.id}
              className="bg-gray-800 rounded-lg p-4 md:p-6 border border-gray-700"
            >
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-2">{bill.description}</h3>
                  <div className="space-y-2">
                    {bill.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-gray-400">{item.name}</span>
                        <span className="text-gray-300">${item.amount}</span>
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
                  <div className="text-2xl font-bold text-white">${bill.amount}</div>
                  <button className="px-6 py-2 bg-primary hover:bg-primary-dark text-white font-semibold rounded-lg transition-colors">
                    Pay Now
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {paymentHistory.map((payment) => (
            <div
              key={payment.id}
              className="bg-gray-800 rounded-lg p-4 md:p-6 border border-gray-700"
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-2">{payment.description}</h3>
                  <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                    <span className="text-gray-400">
                      Paid: {new Date(payment.paidDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                    <span className="text-gray-400">Method: {payment.method}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-xl font-bold text-white">${payment.amount}</div>
                  <span className="px-3 py-1 bg-green-500/20 text-green-400 text-sm font-medium rounded-full">
                    ✓ Paid
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BillingPage;
