import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PayoutRow } from '../../../services/coachPayouts';
import {
  CoachBalance, PayoutKind, PayoutRecord, QuickBooksStatus, addPayoutRecord, coachBalances, deletePayoutRecord,
  listPayoutRecords, quickbooksAuthUrl, quickbooksDisconnect, quickbooksStatus, quickbooksSync,
} from '../../../services/coachPayoutLedger';

// Coach Payments → Payouts: what each coach has earned, what they've been
// paid, and what's still owed. Earnings come from the same calculation as the
// Session and Coach views (every month); payments are recorded here.

const fmtMoney = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const fmtDay = (ymd: string) =>
  new Date(`${ymd}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const todayEastern = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
const differs = (a: number, b: number) => Math.abs(a - b) >= 0.005;

const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

// Where an admin lands back from Intuit's sign-in (?quickbooks=…)
const RETURN_MESSAGES: Record<string, [string, boolean]> = {
  connected: ['QuickBooks is connected. Coach payments from QuickBooks will now show up here.', false],
  access_denied: ['QuickBooks wasn\'t connected: access was declined.', true],
  expired: ['That QuickBooks sign-in expired. Try connecting again.', true],
  error: ['QuickBooks couldn\'t be connected. Try again.', true],
};

/** The QuickBooks connection: connect, sync now, and what the last sync did. */
function QuickBooksBar({ onSynced }: { onSynced: () => void }) {
  const [status, setStatus] = useState<QuickBooksStatus | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice] = useState(() => {
    try {
      const v = new URLSearchParams(window.location.search).get('quickbooks');
      return v ? (RETURN_MESSAGES[v] ?? RETURN_MESSAGES.error) : null;
    } catch { return null; }
  });

  const load = useCallback(async () => {
    try { setStatus(await quickbooksStatus()); setError(''); }
    catch (e: any) { setError(e?.message || "Couldn't check QuickBooks."); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const run = async (what: string, fn: () => Promise<unknown>) => {
    setBusy(what); setError('');
    try { await fn(); await load(); onSynced(); }
    catch (e: any) { setError(e?.message || 'Something went wrong.'); }
    finally { setBusy(''); }
  };
  const connect = () => run('connect', async () => { window.location.href = await quickbooksAuthUrl(); });
  const disconnect = () => {
    if (!window.confirm('Disconnect QuickBooks? Payments already recorded stay; new ones stop coming in.')) return;
    run('disconnect', quickbooksDisconnect);
  };

  const unmatched = Object.entries(status?.lastResult?.unmatched ?? {});
  const btn = 'px-3 py-1.5 text-[12px] rounded-lg transition-colors disabled:opacity-40';

  return (
    <div className="bg-[#0e0e0e] border border-[#1c1c1c] rounded-xl px-4 py-3">
      {notice && (
        <p className={`text-[12px] mb-2 ${notice[1] ? 'text-red-300' : 'text-emerald-300'}`}>{notice[0]}</p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-white text-[13px] font-medium">QuickBooks</p>
          <p className="text-white/45 text-[12px]">
            {!status ? 'Checking…'
              : !status.configured ? "Not set up yet: the Intuit app's keys need adding to the quickbooks-sync function."
              : !status.connected ? 'Not connected. Connect it to record coach payments automatically.'
              : <>Connected{status.companyName ? ` to ${status.companyName}` : ''}
                  {status.lastSyncAt ? ` · last checked ${fmtWhen(status.lastSyncAt)}` : ''}
                  {` · payments from ${fmtDay(status.syncFrom)} on`}
                  {!status.webhookReady && ' · checks daily (instant updates need the webhook token)'}</>}
          </p>
        </div>
        {status?.configured && (
          <div className="flex items-center gap-2">
            {status.connected ? (
              <>
                <button onClick={() => run('sync', () => quickbooksSync())} disabled={!!busy}
                  className={`${btn} bg-white text-black font-medium hover:bg-white/90`}>
                  {busy === 'sync' ? 'Checking…' : 'Sync now'}
                </button>
                <button onClick={disconnect} disabled={!!busy}
                  className={`${btn} text-white/50 hover:text-white border border-white/10 hover:border-white/25`}>
                  Disconnect
                </button>
              </>
            ) : (
              <button onClick={connect} disabled={!!busy}
                className={`${btn} bg-white text-black font-medium hover:bg-white/90`}>
                {busy === 'connect' ? 'Opening QuickBooks…' : 'Connect QuickBooks'}
              </button>
            )}
          </div>
        )}
      </div>
      {unmatched.length > 0 && (
        <p className="text-white/35 text-[11px] mt-2">
          Not matched to a coach (left out): {unmatched.map(([name, n]) => `${name}${n > 1 ? ` ×${n}` : ''}`).join(', ')}
        </p>
      )}
      {error && <p className="text-red-300 text-[12px] mt-2">{error}</p>}
    </div>
  );
}

const recordLabel = (r: PayoutRecord) =>
  r.kind === 'paidThrough' && r.paidThrough ? `Paid through ${fmtDay(r.paidThrough)}` : fmtMoney(r.amount || 0);

const Owed = ({ value }: { value: number }) =>
  value > 0.004 ? <span className="text-amber-300 font-semibold">{fmtMoney(value)}</span>
    : value < -0.004 ? <span className="text-sky-300 font-semibold">{fmtMoney(-value)} credit</span>
    : <span className="text-white/35">Paid up</span>;

function RecordModal({ coaches, initialCoach, recordedBy, onClose, onSaved }: {
  coaches: string[];
  initialCoach: string;
  recordedBy?: string;
  onClose: () => void;
  onSaved: (r: PayoutRecord) => void;
}) {
  const [coach, setCoach] = useState(initialCoach);
  const [kind, setKind] = useState<PayoutKind>('amount');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayEastern());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const value = Number(amount.replace(/[$,\s]/g, ''));
  const valid = !!coach && (kind === 'amount' ? Number.isFinite(value) && value > 0 : /^\d{4}-\d{2}-\d{2}$/.test(date));

  const save = async () => {
    if (!valid) return;
    setSaving(true); setError('');
    try {
      const rec = await addPayoutRecord({
        coach, kind,
        amount: kind === 'amount' ? Math.round(value * 100) / 100 : null,
        paidThrough: kind === 'paidThrough' ? date : null,
        note: note.trim() || null,
        recordedBy: recordedBy || null,
      });
      onSaved(rec);
    } catch (e: any) {
      setError(e?.message || "Couldn't save the payment.");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-[#141414] border border-white/10 rounded-xl shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-white/[0.08]">
          <p className="text-white text-[14px] font-semibold">Record a payment</p>
          <p className="text-white/40 text-[12px] mt-0.5">Either an amount paid, or a date everything up to is paid.</p>
        </div>
        <div className="px-5 py-4 space-y-3">
          <label className="block">
            <span className="text-white/50 text-[11px] uppercase tracking-wider">Coach</span>
            <select value={coach} onChange={e => setCoach(e.target.value)}
              className="mt-1 w-full bg-[#0b0b0b] border border-[#2a2a2a] focus:border-white/30 rounded-lg px-3 py-2 text-[13px] text-white outline-none">
              <option value="">Choose a coach</option>
              {coaches.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <div className="flex bg-white/[0.04] border border-white/10 rounded-lg p-0.5">
            {([['amount', 'An amount paid'], ['paidThrough', 'Paid through a date']] as [PayoutKind, string][]).map(([k, label]) => (
              <button key={k} onClick={() => setKind(k)}
                className={`flex-1 px-3 py-1.5 text-[12px] rounded-md transition-colors ${kind === k ? 'bg-white text-black font-medium' : 'text-white/60 hover:text-white'}`}>
                {label}
              </button>
            ))}
          </div>
          {kind === 'amount' ? (
            <label className="block">
              <span className="text-white/50 text-[11px] uppercase tracking-wider">Amount</span>
              <input value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" placeholder="$0.00" autoFocus
                className="mt-1 w-full bg-[#0b0b0b] border border-[#2a2a2a] focus:border-white/30 rounded-lg px-3 py-2 text-[13px] text-white outline-none" />
            </label>
          ) : (
            <label className="block">
              <span className="text-white/50 text-[11px] uppercase tracking-wider">Paid for every session up to and including</span>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="mt-1 w-full bg-[#0b0b0b] border border-[#2a2a2a] focus:border-white/30 rounded-lg px-3 py-2 text-[13px] text-white outline-none [color-scheme:dark]" />
            </label>
          )}
          <label className="block">
            <span className="text-white/50 text-[11px] uppercase tracking-wider">Note (optional)</span>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Venmo, Nov 12"
              className="mt-1 w-full bg-[#0b0b0b] border border-[#2a2a2a] focus:border-white/30 rounded-lg px-3 py-2 text-[13px] text-white outline-none" />
          </label>
          {error && <p className="text-red-400 text-[12px]">{error}</p>}
        </div>
        <div className="px-5 pb-5 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-[12px] text-white/60 hover:text-white transition-colors">Cancel</button>
          <button onClick={save} disabled={!valid || saving}
            className="px-4 py-2 text-[12px] bg-white text-black font-medium rounded-lg hover:bg-white/90 transition-colors disabled:opacity-40">
            {saving ? 'Saving…' : 'Save payment'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CoachPayoutsView({ rows, recordedBy }: { rows: PayoutRow[]; recordedBy?: string }) {
  const [records, setRecords] = useState<PayoutRecord[] | null>(null);
  const [error, setError] = useState('');
  const [modalFor, setModalFor] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRecords(await listPayoutRecords());
      setError('');
    } catch (e: any) {
      setError(e?.message || "Couldn't load payments.");
      setRecords(prev => prev ?? []);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const balances: CoachBalance[] = useMemo(() => coachBalances(rows, records ?? []), [rows, records]);
  const coaches = useMemo(() => balances.map(b => b.coach).sort((a, b) => a.localeCompare(b)), [balances]);
  const totals = useMemo(() => balances.reduce(
    (t, b) => ({
      income: t.income + b.income, expectedIncome: t.expectedIncome + b.expectedIncome, paid: t.paid + b.paid,
      owed: t.owed + Math.max(0, b.owed), expectedOwed: t.expectedOwed + Math.max(0, b.expectedOwed),
    }),
    { income: 0, expectedIncome: 0, paid: 0, owed: 0, expectedOwed: 0 },
  ), [balances]);

  const remove = async (r: PayoutRecord) => {
    if (!window.confirm(`Remove "${recordLabel(r)}" for ${r.coach}? Their balance goes back up by it.`)) return;
    try {
      await deletePayoutRecord(r.$id);
      setRecords(prev => (prev ?? []).filter(x => x.$id !== r.$id));
    } catch (e: any) {
      setError(e?.message || "Couldn't remove that payment.");
    }
  };

  if (!records) {
    return (
      <div className="bg-[#0e0e0e] border border-[#1c1c1c] rounded-xl px-6 py-12 text-center">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error && <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-lg px-4 py-2.5">{error}</div>}

      <QuickBooksBar onSynced={load} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {([
          ['Income', totals.income, totals.expectedIncome, 'text-white'],
          ['Paid', totals.paid, totals.paid, 'text-emerald-300'],
          ['Owed', totals.owed, totals.expectedOwed, 'text-amber-300'],
        ] as const).map(([label, v, exp, cls]) => (
          <div key={label} className="bg-[#0e0e0e] border border-[#1c1c1c] rounded-xl px-4 py-3">
            <p className="text-white/45 text-[10px] uppercase tracking-wider font-semibold">{label}</p>
            <p className={`text-[20px] font-semibold mt-0.5 ${cls}`}>{fmtMoney(v)}</p>
            {differs(v, exp) && <p className="text-white/35 text-[11px]">{fmtMoney(exp)} once every bill is paid</p>}
          </div>
        ))}
      </div>

      <div className="bg-[#0e0e0e] border border-[#1c1c1c] rounded-xl overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse">
          <thead className="bg-[#141414] border-b border-white/[0.08]">
            <tr className="text-white/45 text-[10px] uppercase tracking-wider">
              <th className="text-left font-semibold px-4 py-2.5">Coach</th>
              <th className="text-right font-semibold px-3 py-2.5">Sessions</th>
              <th className="text-right font-semibold px-3 py-2.5">Income</th>
              <th className="text-right font-semibold px-3 py-2.5">Paid</th>
              <th className="text-right font-semibold px-3 py-2.5">Owed</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {balances.map(b => (
              <tr key={b.coach} className="border-b border-white/[0.04] last:border-0 align-top">
                <td className="px-4 py-3 text-white text-[13px] font-medium">{b.coach}</td>
                <td className="px-3 py-3 text-right text-white/50 text-[12px]">{b.sessions}</td>
                <td className="px-3 py-3 text-right text-[12px]">
                  <span className="text-white">{fmtMoney(b.income)}</span>
                  {differs(b.income, b.expectedIncome) && <p className="text-white/30 text-[10px]">{fmtMoney(b.expectedIncome)} exp.</p>}
                </td>
                <td className="px-3 py-3 text-right text-[12px]">
                  <span className="text-emerald-300">{fmtMoney(b.paid)}</span>
                  {b.paidThrough && <p className="text-white/35 text-[10px]">through {fmtDay(b.paidThrough)}</p>}
                  {b.lumpSums > 0 && b.paidThrough && <p className="text-white/35 text-[10px]">+ {fmtMoney(b.lumpSums)} paid</p>}
                </td>
                <td className="px-3 py-3 text-right text-[12px]">
                  <Owed value={b.owed} />
                  {differs(b.owed, b.expectedOwed) && <p className="text-white/30 text-[10px]">{fmtMoney(b.expectedOwed)} once every bill is paid</p>}
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => setModalFor(b.coach)}
                    className="px-2.5 py-1 text-[11px] text-white/70 hover:text-white border border-white/10 hover:border-white/25 rounded-md transition-colors whitespace-nowrap">
                    Record payment
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-white/70 text-[11px] uppercase tracking-wider font-semibold">Payments on record</h2>
          <button onClick={() => setModalFor('')}
            className="px-3 py-1.5 text-[12px] bg-white text-black font-medium rounded-lg hover:bg-white/90 transition-colors">
            Record payment
          </button>
        </div>
        <div className="bg-[#0e0e0e] border border-[#1c1c1c] rounded-xl divide-y divide-white/[0.05]">
          {records.length === 0 ? (
            <p className="px-4 py-6 text-center text-white/30 text-sm">No payments recorded yet.</p>
          ) : records.map(r => (
            <div key={r.$id} className="px-4 py-2.5 flex items-center gap-3">
              <p className="text-white/35 text-[11px] w-24 flex-shrink-0">
                {r.paidOn ? fmtDay(r.paidOn)
                  : new Date(r.$createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
              <p className="text-white text-[12px] font-medium w-44 flex-shrink-0 truncate">{r.coach}</p>
              <p className="text-emerald-300 text-[12px] w-48 flex-shrink-0">
                {recordLabel(r)}
                {r.source === 'quickbooks' && (
                  <span className="ml-2 text-[9px] uppercase tracking-wider text-sky-300/80 bg-sky-500/10 border border-sky-500/20 rounded px-1.5 py-0.5">QuickBooks</span>
                )}
              </p>
              <p className="text-white/45 text-[12px] flex-1 min-w-0 truncate">
                {r.note}{r.recordedBy && <span className="text-white/25">{r.note ? ' · ' : ''}by {r.recordedBy}</span>}
              </p>
              <button onClick={() => remove(r)} title="Remove this payment"
                className="text-white/25 hover:text-red-400 transition-colors p-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      {modalFor !== null && (
        <RecordModal
          coaches={coaches}
          initialCoach={modalFor}
          recordedBy={recordedBy}
          onClose={() => setModalFor(null)}
          onSaved={rec => { setRecords(prev => [rec, ...(prev ?? [])]); setModalFor(null); }}
        />
      )}
    </div>
  );
}
