import { useState, useEffect } from 'react';
import { Query } from 'appwrite';
import { databases, databaseId, collections } from '../../../services/appwrite';

type BillStatus = 'outstanding' | 'settled' | 'overdue';

interface BillRecord {
  $id: string;
  userId: string;
  monthName?: string;
  totalAmount?: number;
  dueDate?: string;
  status: string;
  paidAt?: string;
  itemCount?: number;
  parentUserId?: string;
  [key: string]: any;
}

interface BillItemRecord {
  $id: string;
  billId: string;
  eventTitle: string;
  eventDate?: string;
  price: number;
  eventId?: string;
  calendarSource?: string;
  [key: string]: any;
}

const deriveBillStatus = (b: BillRecord): BillStatus => {
  if (b.status === 'paid') return 'settled';
  if (b.status === 'cancelled') return 'settled';
  const dueMs = b.dueDate ? Date.parse(b.dueDate) : NaN;
  if (!isNaN(dueMs) && dueMs < Date.now()) return 'overdue';
  return 'outstanding';
};

// ── Eastern-time helpers ───────────────────────────────────────────────────────
// Bills are stored/displayed in America/New_York. A due date is saved at noon
// Eastern with the correct DST offset (e.g. 2026-05-07T12:00:00.000-04:00). Noon is
// used (rather than midnight) so it's safely clear of the 2 AM DST transitions,
// keeping the stored instant on the intended Eastern calendar day year-round.
const nthSundayOfMonth = (year: number, month1to12: number, n: number): Date => {
  const first = new Date(year, month1to12 - 1, 1);
  const firstSunday = 1 + ((7 - first.getDay()) % 7);
  return new Date(year, month1to12 - 1, firstSunday + (n - 1) * 7);
};
// EDT (-04:00) from the 2nd Sunday of March to the 1st Sunday of November, else EST (-05:00)
const easternOffset = (dateStr: string): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const day = new Date(y, m - 1, d);
  const dstStart = nthSundayOfMonth(y, 3, 2);
  const dstEnd = nthSundayOfMonth(y, 11, 1);
  return day >= dstStart && day < dstEnd ? '-04:00' : '-05:00';
};
const easternDueISO = (dateStr: string): string => `${dateStr}T12:00:00.000${easternOffset(dateStr)}`;
// Format any stored date on its Eastern calendar day, regardless of the admin's timezone
const fmtDateEST = (v?: string): string =>
  v ? new Date(v).toLocaleDateString('en-US', { timeZone: 'America/New_York' }) : '—';
// Extract the Eastern calendar day (YYYY-MM-DD) from a stored ISO string for a date input
const easternDayInput = (v?: string): string => {
  if (!v) return '';
  const m = v.match(/^(\d{4}-\d{2}-\d{2})T[^Z]*$/); // offset-form ISO: date portion is already Eastern
  if (m) return m[1];
  // UTC-form (e.g. ...Z) or anything else: derive the Eastern day
  const d = new Date(v);
  return isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(d);
};

const statusBadgeClass = (tab: BillStatus) => {
  if (tab === 'settled') return 'bg-green-500/20 text-green-400 border border-green-500/30';
  if (tab === 'overdue') return 'bg-red-500/20 text-red-400 border border-red-500/30';
  return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
};

const tabLabel: Record<BillStatus, string> = {
  outstanding: 'Outstanding',
  settled: 'Settled',
  overdue: 'Overdue',
};

// ── Pencil icon ──────────────────────────────────────────────────────────────
const PencilIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 0l.172.172a2 2 0 010 2.828L12 16H9v-3z" />
  </svg>
);

const TrashIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const XIcon = () => (
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

// ── BillModal ─────────────────────────────────────────────────────────────────
const BillModal = ({
  bill,
  getName,
  onClose,
  onBillUpdated,
}: {
  bill: BillRecord;
  getName: (b: BillRecord) => string;
  onClose: () => void;
  onBillUpdated: () => void;
}) => {
  const status = deriveBillStatus(bill);

  const [items, setItems] = useState<BillItemRecord[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);

  // Total editing
  const [editingTotal, setEditingTotal] = useState(false);
  const [editTotalVal, setEditTotalVal] = useState(String(bill.totalAmount ?? ''));
  const [savingTotal, setSavingTotal] = useState(false);

  // Due date editing — input is the Eastern calendar day; saved as midnight-EST ISO
  const dueDateInput = easternDayInput(bill.dueDate);
  const [editingDue, setEditingDue] = useState(false);
  const [editDueVal, setEditDueVal] = useState(dueDateInput);
  const [savingDue, setSavingDue] = useState(false);

  // Per-item editing
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemVal, setEditItemVal] = useState('');
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);

  const [error, setError] = useState('');

  useEffect(() => {
    fetchItems();
  }, [bill.$id]);

  const fetchItems = async () => {
    setLoadingItems(true);
    try {
      if (!collections.billItems) { setItems([]); return; }
      const res = await databases.listDocuments(databaseId, collections.billItems, [
        Query.equal('billId', bill.$id),
        Query.limit(200),
      ]);
      setItems(res.documents as unknown as BillItemRecord[]);
    } catch {
      setItems([]);
    } finally {
      setLoadingItems(false);
    }
  };

  const handleSaveTotal = async () => {
    const val = parseFloat(editTotalVal);
    if (isNaN(val) || val < 0) { setError('Invalid amount'); return; }
    setSavingTotal(true);
    setError('');
    try {
      await databases.updateDocument(databaseId, collections.bills, bill.$id, { totalAmount: val });
      bill.totalAmount = val;
      setEditingTotal(false);
      onBillUpdated();
    } catch (e: any) {
      setError(e.message || 'Failed to update');
    } finally {
      setSavingTotal(false);
    }
  };

  const handleSaveDue = async () => {
    if (!editDueVal || !/^\d{4}-\d{2}-\d{2}$/.test(editDueVal)) { setError('Invalid date'); return; }
    setSavingDue(true);
    setError('');
    try {
      // Store at noon Eastern with the correct DST offset (stays on the intended day)
      const iso = easternDueISO(editDueVal);
      await databases.updateDocument(databaseId, collections.bills, bill.$id, { dueDate: iso });
      bill.dueDate = iso;
      setEditingDue(false);
      onBillUpdated();
    } catch (e: any) {
      setError(e.message || 'Failed to update due date');
    } finally {
      setSavingDue(false);
    }
  };

  const handleSaveItem = async (item: BillItemRecord) => {
    const val = parseFloat(editItemVal);
    if (isNaN(val) || val < 0) { setError('Invalid amount'); return; }
    setSavingItemId(item.$id);
    setError('');
    try {
      await databases.updateDocument(databaseId, collections.billItems, item.$id, { price: val });
      setItems(prev => prev.map(i => i.$id === item.$id ? { ...i, price: val } : i));
      setEditingItemId(null);
    } catch (e: any) {
      setError(e.message || 'Failed to update item');
    } finally {
      setSavingItemId(null);
    }
  };

  const handleDeleteItem = async (item: BillItemRecord) => {
    if (!confirm(`Delete session "${item.eventTitle}"?`)) return;
    setDeletingItemId(item.$id);
    setError('');
    try {
      await databases.deleteDocument(databaseId, collections.billItems, item.$id);
      setItems(prev => prev.filter(i => i.$id !== item.$id));
      onBillUpdated();
    } catch (e: any) {
      setError(e.message || 'Failed to delete item');
    } finally {
      setDeletingItemId(null);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-lg bg-[#111] border border-[#222] rounded-2xl shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e1e1e]">
            <div className="flex items-center gap-3">
              <h3 className="text-white font-semibold text-lg">Bill Details</h3>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusBadgeClass(status)}`}>
                {tabLabel[status]}
              </span>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-1">
              <XIcon />
            </button>
          </div>

          <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
            {error && (
              <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
            )}

            {/* Meta fields */}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Account" value={getName(bill)} />
              <Field label="Month" value={bill.monthName} />

              {/* Due Date — editable */}
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-gray-600 text-xs uppercase tracking-wider">Due Date</p>
                  {!editingDue && (
                    <button
                      onClick={() => { setEditDueVal(dueDateInput); setEditingDue(true); }}
                      className="text-gray-600 hover:text-blue-400 transition-colors"
                      title="Edit due date"
                    >
                      <PencilIcon />
                    </button>
                  )}
                </div>
                {editingDue ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="date"
                      value={editDueVal}
                      onChange={e => setEditDueVal(e.target.value)}
                      className="flex-1 min-w-0 bg-[#1a1a1a] border border-gray-700 rounded-lg px-2 py-1 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 [color-scheme:dark]"
                      autoFocus
                    />
                    <button
                      onClick={handleSaveDue}
                      disabled={savingDue}
                      className="p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                      <CheckIcon />
                    </button>
                    <button
                      onClick={() => setEditingDue(false)}
                      className="p-1.5 text-gray-500 hover:text-white transition-colors"
                    >
                      <XIcon />
                    </button>
                  </div>
                ) : (
                  <p className="text-white text-sm">{fmtDateEST(bill.dueDate)}</p>
                )}
              </div>

              {bill.paidAt && <Field label="Paid At" value={fmtDateEST(bill.paidAt)} />}
              <Field label="Created" value={bill.$createdAt ? fmtDateEST(bill.$createdAt) : undefined} />
            </div>

            {/* Total amount — editable */}
            <div className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-xl p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-gray-500 text-xs uppercase tracking-wider">Total Amount</p>
                {!editingTotal && (
                  <button
                    onClick={() => { setEditTotalVal(String(bill.totalAmount ?? '')); setEditingTotal(true); }}
                    className="text-gray-600 hover:text-blue-400 transition-colors"
                    title="Edit total"
                  >
                    <PencilIcon />
                  </button>
                )}
              </div>
              {editingTotal ? (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-gray-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editTotalVal}
                    onChange={e => setEditTotalVal(e.target.value)}
                    className="flex-1 bg-[#1a1a1a] border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveTotal}
                    disabled={savingTotal}
                    className="p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    <CheckIcon />
                  </button>
                  <button
                    onClick={() => setEditingTotal(false)}
                    className="p-1.5 text-gray-500 hover:text-white transition-colors"
                  >
                    <XIcon />
                  </button>
                </div>
              ) : (
                <p className="text-white text-xl font-semibold">
                  {bill.totalAmount != null ? `$${Number(bill.totalAmount).toFixed(2)}` : '—'}
                </p>
              )}
            </div>

            {/* Bill items / sessions */}
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wider mb-3">Sessions</p>
              {loadingItems ? (
                <div className="flex items-center justify-center h-16">
                  <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : items.length === 0 ? (
                <p className="text-gray-600 text-sm text-center py-4">No session items found</p>
              ) : (
                <div className="space-y-2">
                  {items.map(item => (
                    <div key={item.$id} className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-xl px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">{item.eventTitle || '—'}</p>
                          {item.eventDate && (
                            <p className="text-gray-600 text-xs mt-0.5">{item.eventDate}</p>
                          )}
                        </div>

                        {/* Amount */}
                        {editingItemId === item.$id ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-gray-400 text-sm">$</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={editItemVal}
                              onChange={e => setEditItemVal(e.target.value)}
                              className="w-20 bg-[#1a1a1a] border border-gray-700 rounded px-2 py-1 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveItem(item)}
                              disabled={savingItemId === item.$id}
                              className="p-1 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors disabled:opacity-50"
                            >
                              <CheckIcon />
                            </button>
                            <button
                              onClick={() => setEditingItemId(null)}
                              className="p-1 text-gray-500 hover:text-white transition-colors"
                            >
                              <XIcon />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-white text-sm font-medium">
                              ${Number(item.price).toFixed(2)}
                            </span>
                            <button
                              onClick={() => { setEditItemVal(String(item.price)); setEditingItemId(item.$id); }}
                              className="text-gray-600 hover:text-blue-400 transition-colors"
                              title="Edit amount"
                            >
                              <PencilIcon />
                            </button>
                            <button
                              onClick={() => handleDeleteItem(item)}
                              disabled={deletingItemId === item.$id}
                              className="text-gray-600 hover:text-red-400 transition-colors disabled:opacity-40"
                              title="Delete session"
                            >
                              {deletingItemId === item.$id
                                ? <div className="w-3.5 h-3.5 border border-red-400 border-t-transparent rounded-full animate-spin" />
                                : <TrashIcon />
                              }
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-[#1e1e1e] flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

const Field = ({ label, value }: { label: string; value?: string }) => (
  <div>
    <p className="text-gray-600 text-xs uppercase tracking-wider mb-0.5">{label}</p>
    <p className="text-white text-sm">{value || '—'}</p>
  </div>
);

// ── BillsSection ──────────────────────────────────────────────────────────────
const BillsSection = () => {
  const [bills, setBills] = useState<BillRecord[]>([]);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<BillStatus>('outstanding');
  const [search, setSearch] = useState('');
  const [selectedBill, setSelectedBill] = useState<BillRecord | null>(null);
  const [sortKey, setSortKey] = useState<'monthName' | 'name' | 'dueDate' | 'totalAmount' | 'status' | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  useEffect(() => { fetchBills(); }, []);

  const fetchBills = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await databases.listDocuments(databaseId, collections.bills, [Query.limit(5000)]);
      const docs = res.documents as unknown as BillRecord[];
      setBills(docs);

      const uniqueIds = [...new Set(docs.map(b => b.userId).filter(Boolean))];
      const nameMap: Record<string, string> = {};

      const lookupCollections = [
        collections.youthPlayers,
        collections.collegiatePlayers,
        collections.professionalPlayers,
        collections.parentUsers,
        collections.coaches,
      ].filter(Boolean) as string[];

      for (const colId of lookupCollections) {
        try {
          const colRes = await databases.listDocuments(databaseId, colId, [Query.limit(5000)]);
          for (const doc of colRes.documents as any[]) {
            const full = `${doc.firstName || ''} ${doc.lastName || ''}`.trim();
            if (!full) continue;
            if (doc.userId && uniqueIds.includes(doc.userId) && !nameMap[doc.userId]) {
              nameMap[doc.userId] = full;
            }
            // Also index by $id for old accounts where $id ≠ userId
            if (doc.$id && doc.$id !== doc.userId && uniqueIds.includes(doc.$id) && !nameMap[doc.$id]) {
              nameMap[doc.$id] = full;
            }
          }
        } catch { /* skip */ }
      }

      // Proxy children: bills may store proxyId OR $id as userId — register both
      if (collections.proxyChildren) {
        try {
          const proxyRes = await databases.listDocuments(databaseId, collections.proxyChildren, [Query.limit(5000)]);
          for (const doc of proxyRes.documents as any[]) {
            const full = `${doc.firstName || ''} ${doc.lastName || ''}`.trim();
            if (!full) continue;
            if (doc.proxyId && uniqueIds.includes(doc.proxyId) && !nameMap[doc.proxyId]) {
              nameMap[doc.proxyId] = full;
            }
            if (doc.$id && uniqueIds.includes(doc.$id) && !nameMap[doc.$id]) {
              nameMap[doc.$id] = full;
            }
          }
        } catch { /* skip */ }
      }

      setUserNames(nameMap);
    } catch (err: any) {
      setError('Failed to load bills: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const getName = (b: BillRecord) => userNames[b.userId] || b.userId || '—';

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const tabBills = bills.filter(b => deriveBillStatus(b) === activeTab);
  const filtered = tabBills.filter(b => getName(b).toLowerCase().includes(search.toLowerCase()));

  const sorted = sortKey ? [...filtered].sort((a, b) => {
    let av: string | number = '';
    let bv: string | number = '';
    if (sortKey === 'name') { av = getName(a).toLowerCase(); bv = getName(b).toLowerCase(); }
    else if (sortKey === 'totalAmount') { av = a.totalAmount ?? 0; bv = b.totalAmount ?? 0; }
    else if (sortKey === 'dueDate') { av = a.dueDate ?? ''; bv = b.dueDate ?? ''; }
    else if (sortKey === 'monthName') { av = a.monthName ?? ''; bv = b.monthName ?? ''; }
    else if (sortKey === 'status') { av = deriveBillStatus(a); bv = deriveBillStatus(b); }
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  }) : filtered;

  // Re-sync a bill record after edits (refresh from state)
  const handleBillUpdated = () => fetchBills();

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
              activeTab === tab ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
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
        <div className="p-4 bg-red-500/10 border border-red-500 rounded-lg text-red-400 mb-4">{error}</div>
      )}

      {!loading && !error && (
        <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-950">
                {([
                  ['Month', 'monthName'],
                  ['Name', 'name'],
                  ['Due Date', 'dueDate'],
                  ['Amount', 'totalAmount'],
                  ['Status', 'status'],
                ] as [string, typeof sortKey][]).map(([label, key]) => (
                  <th key={key} onClick={() => toggleSort(key)}
                    className="text-left px-4 py-3 text-gray-400 text-sm font-medium cursor-pointer select-none hover:text-white transition-colors">
                    <span className="inline-flex items-center gap-1">
                      {label}
                      {sortKey === key
                        ? <span className="text-blue-400">{sortDir === 'asc' ? '↑' : '↓'}</span>
                        : <span className="text-gray-700">↕</span>
                      }
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No {tabLabel[activeTab].toLowerCase()} bills found
                  </td>
                </tr>
              ) : (
                sorted.map(bill => (
                  <tr
                    key={bill.$id}
                    onClick={() => setSelectedBill(bill)}
                    className="hover:bg-gray-800/50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 text-white">{bill.monthName || '—'}</td>
                    <td className="px-4 py-3 text-gray-300">{getName(bill)}</td>
                    <td className="px-4 py-3 text-gray-400">
                      {fmtDateEST(bill.dueDate)}
                    </td>
                    <td className="px-4 py-3 text-white">
                      {bill.totalAmount != null ? `$${Number(bill.totalAmount).toFixed(2)}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusBadgeClass(deriveBillStatus(bill))}`}>
                        {tabLabel[deriveBillStatus(bill)]}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Centered Modal */}
      {selectedBill && (
        <BillModal
          bill={selectedBill}
          getName={getName}
          onClose={() => setSelectedBill(null)}
          onBillUpdated={handleBillUpdated}
        />
      )}
    </div>
  );
};

export default BillsSection;
