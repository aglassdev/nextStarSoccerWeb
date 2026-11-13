import { useEffect, useMemo, useState } from 'react';
import type { PayoutRow, SessionRow } from '../../../services/coachPayouts';
import {
  Adjustment, AdjustmentReason, REASON_LABELS, Statement, StatementLog, addAdjustment, deleteAdjustment,
  listStatementLog, previewStatement, sendStatement, sendTestStatement, statementsFor,
} from '../../../services/coachPayoutLedger';

// Coach Payments → Payouts → Monthly statements: each coach's statement for a
// month as a PDF (Phillip's as his session share report), with deductions for
// lateness or no-shows, emailed to them from here.

const fmtMoney = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const monthLabel = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 15).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};
const monthOf = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(iso)).slice(0, 7);
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

type SendState = 'sending' | 'sent' | 'failed';

function DeductionModal({ coaches, coach: initialCoach, month, recordedBy, onClose, onSaved }: {
  coaches: string[]; coach: string; month: string; recordedBy?: string;
  onClose: () => void; onSaved: (a: Adjustment) => void;
}) {
  const [coach, setCoach] = useState(initialCoach);
  const [reason, setReason] = useState<AdjustmentReason>('late');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const value = Number(amount.replace(/[$,\s]/g, ''));
  const valid = !!coach && Number.isFinite(value) && value > 0 && (!date || date.startsWith(month));
  const input = 'mt-1 w-full bg-[#0b0b0b] border border-[#2a2a2a] focus:border-white/30 rounded-lg px-3 py-2 text-[13px] text-white outline-none';

  const save = async () => {
    if (!valid) return;
    setSaving(true); setError('');
    try {
      onSaved(await addAdjustment({
        coach, month, reason, amount: Math.round(value * 100) / 100,
        date: date || null, note: note.trim() || null, recordedBy: recordedBy || null,
      }));
    } catch (e: any) { setError(e?.message || "Couldn't save."); setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-[#141414] border border-white/10 rounded-xl shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-white/[0.08]">
          <p className="text-white text-[14px] font-semibold">Add a deduction · {monthLabel(month)}</p>
          <p className="text-white/40 text-[12px] mt-0.5">Comes off the coach's statement and what they're owed.</p>
        </div>
        <div className="px-5 py-4 space-y-3">
          <label className="block">
            <span className="text-white/50 text-[11px] uppercase tracking-wider">Coach</span>
            <select value={coach} onChange={e => setCoach(e.target.value)} className={input}>
              <option value="">Choose a coach</option>
              {coaches.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <div className="flex bg-white/[0.04] border border-white/10 rounded-lg p-0.5">
            {(Object.keys(REASON_LABELS) as AdjustmentReason[]).map(r => (
              <button key={r} onClick={() => setReason(r)}
                className={`flex-1 px-3 py-1.5 text-[12px] rounded-md transition-colors ${reason === r ? 'bg-white text-black font-medium' : 'text-white/60 hover:text-white'}`}>
                {REASON_LABELS[r]}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-white/50 text-[11px] uppercase tracking-wider">Amount</span>
              <input value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" placeholder="$0.00" autoFocus className={input} />
            </label>
            <label className="block">
              <span className="text-white/50 text-[11px] uppercase tracking-wider">Date (optional)</span>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} min={`${month}-01`} max={`${month}-31`}
                className={`${input} [color-scheme:dark]`} />
            </label>
          </div>
          <label className="block">
            <span className="text-white/50 text-[11px] uppercase tracking-wider">Note (optional, shown on the statement)</span>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. 20 minutes late, Oct 9 evening" className={input} />
          </label>
          {error && <p className="text-red-400 text-[12px]">{error}</p>}
        </div>
        <div className="px-5 pb-5 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-[12px] text-white/60 hover:text-white transition-colors">Cancel</button>
          <button onClick={save} disabled={!valid || saving}
            className="px-4 py-2 text-[12px] bg-white text-black font-medium rounded-lg hover:bg-white/90 transition-colors disabled:opacity-40">
            {saving ? 'Saving…' : 'Add deduction'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function StatementsPanel({ rows, sessions, adjustments, setAdjustments, recordedBy }: {
  rows: PayoutRow[];
  sessions: SessionRow[];
  adjustments: Adjustment[];
  setAdjustments: (fn: (prev: Adjustment[]) => Adjustment[]) => void;
  recordedBy?: string;
}) {
  const months = useMemo(
    () => [...new Set(rows.map(r => monthOf(r.startDateTime)))].sort().reverse(),
    [rows],
  );
  // Default to last month: the one whose statements go out now
  const [month, setMonth] = useState(() => {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1);
    const last = monthOf(d.toISOString());
    return months.includes(last) ? last : months[0] ?? last;
  });
  const [log, setLog] = useState<StatementLog[]>([]);
  const [sendState, setSendState] = useState<Record<string, SendState>>({});
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState<[string, boolean] | null>(null);
  const [deductFor, setDeductFor] = useState<string | null>(null);

  useEffect(() => {
    setSendState({});
    listStatementLog(month).then(setLog).catch(() => setLog([]));
  }, [month]);

  const statements = useMemo(() => statementsFor(month, rows, sessions, adjustments), [month, rows, sessions, adjustments]);
  const coaches = useMemo(() => [...new Set(rows.map(r => r.coach))].sort((a, b) => a.localeCompare(b)), [rows]);
  const monthDeductions = adjustments.filter(a => a.month === month);
  const lastSent = (coach: string) => log.find(l => l.coach.toLowerCase() === coach.toLowerCase());

  const preview = async (s: Statement) => {
    // Opened first, so the browser doesn't treat it as a pop-up
    const w = window.open('', '_blank');
    setBusy(`preview:${s.coach}`); setMessage(null);
    try {
      const { pdf } = await previewStatement(s);
      const bytes = Uint8Array.from(atob(pdf), c => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      if (w) w.location.href = url; else window.location.href = url;
    } catch (e: any) {
      w?.close();
      setMessage([e?.message || "Couldn't make the preview.", true]);
    } finally { setBusy(''); }
  };

  const sendTest = async (s: Statement) => {
    setBusy(`test:${s.coach}`); setMessage(null);
    try { setMessage([`Test of ${s.coach}'s statement sent to ${await sendTestStatement(s)}.`, false]); }
    catch (e: any) { setMessage([e?.message || "Couldn't send the test.", true]); }
    finally { setBusy(''); }
  };

  const send = async (list: Statement[]) => {
    const what = list.length === 1 ? `${list[0].coach} their` : `${list.length} coaches their`;
    if (!window.confirm(`Email ${what} ${monthLabel(month)} statement${list.length === 1 ? '' : 's'}? This sends real emails.`)) return;
    setBusy('send'); setMessage(null);
    let sent = 0;
    for (const s of list) {
      setSendState(prev => ({ ...prev, [s.coach]: 'sending' }));
      try {
        const r = await sendStatement(s);
        setSendState(prev => ({ ...prev, [s.coach]: r?.ok ? 'sent' : 'failed' }));
        if (r?.ok) sent++;
      } catch {
        setSendState(prev => ({ ...prev, [s.coach]: 'failed' }));
      }
    }
    setBusy('');
    setMessage([`${sent} of ${list.length} statement${list.length === 1 ? '' : 's'} sent.`, sent < list.length]);
    listStatementLog(month).then(setLog).catch(() => {});
  };

  const removeDeduction = async (a: Adjustment) => {
    if (!window.confirm(`Remove the ${fmtMoney(a.amount)} deduction for ${a.coach}?`)) return;
    try { await deleteAdjustment(a.$id); setAdjustments(prev => prev.filter(x => x.$id !== a.$id)); }
    catch (e: any) { setMessage([e?.message || "Couldn't remove it.", true]); }
  };

  const small = 'px-2 py-1 text-[11px] text-white/70 hover:text-white border border-white/10 hover:border-white/25 rounded-md transition-colors whitespace-nowrap disabled:opacity-40';

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <h2 className="text-white/70 text-[11px] uppercase tracking-wider font-semibold">Monthly statements</h2>
        <div className="flex items-center gap-2">
          <select value={month} onChange={e => setMonth(e.target.value)}
            className="px-3 py-1.5 text-[12px] rounded-lg border bg-white/[0.04] border-white/10 text-white outline-none">
            {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
          <button onClick={() => setDeductFor('')} className="px-3 py-1.5 text-[12px] text-white/70 hover:text-white border border-white/10 hover:border-white/25 rounded-lg transition-colors">
            Add deduction
          </button>
          <button onClick={() => send(statements)} disabled={!!busy || statements.length === 0}
            className="px-3 py-1.5 text-[12px] bg-white text-black font-medium rounded-lg hover:bg-white/90 transition-colors disabled:opacity-40">
            {busy === 'send' ? 'Sending…' : `Email all ${statements.length}`}
          </button>
        </div>
      </div>
      {message && <p className={`text-[12px] mb-2 ${message[1] ? 'text-red-300' : 'text-emerald-300'}`}>{message[0]}</p>}

      <div className="bg-[#0e0e0e] border border-[#1c1c1c] rounded-xl overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse">
          <thead className="bg-[#141414] border-b border-white/[0.08]">
            <tr className="text-white/45 text-[10px] uppercase tracking-wider">
              <th className="text-left font-semibold px-4 py-2.5">Coach</th>
              <th className="text-right font-semibold px-3 py-2.5">Sessions</th>
              <th className="text-right font-semibold px-3 py-2.5">Deductions</th>
              <th className="text-right font-semibold px-3 py-2.5">Total earned</th>
              <th className="text-left font-semibold px-3 py-2.5">Sent</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {statements.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-white/30 text-sm">No coach sessions in {monthLabel(month)}.</td></tr>
            ) : statements.map(s => {
              const ded = s.deductions.reduce((t, d) => t + d.amount, 0);
              const st = sendState[s.coach];
              const prev = lastSent(s.coach);
              return (
                <tr key={s.coach} className="border-b border-white/[0.04] last:border-0">
                  <td className="px-4 py-2.5 text-white text-[13px] font-medium">
                    {s.coach}
                    {s.kind === 'share' && <span className="ml-2 text-[10px] text-white/35">session share report</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right text-white/50 text-[12px]">{s.sessions.length}</td>
                  <td className="px-3 py-2.5 text-right text-[12px]">{ded ? <span className="text-red-300">– {fmtMoney(ded)}</span> : <span className="text-white/20">—</span>}</td>
                  <td className="px-3 py-2.5 text-right text-white text-[12px] font-semibold">
                    {fmtMoney(s.total)}
                    {s.kind === 'share' && <p className="text-white/30 text-[10px] font-normal">collected share</p>}
                  </td>
                  <td className="px-3 py-2.5 text-[11px]">
                    {st === 'sending' ? <span className="text-white/50">Sending…</span>
                      : st === 'sent' ? <span className="text-emerald-300">Sent just now</span>
                      : st === 'failed' ? <span className="text-red-300">Failed</span>
                      : prev ? <span className="text-white/45">Sent {fmtDate(prev.$createdAt)}</span>
                      : <span className="text-white/20">Not sent</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1.5">
                      <button onClick={() => preview(s)} disabled={!!busy} className={small}>
                        {busy === `preview:${s.coach}` ? 'Making…' : 'Preview'}
                      </button>
                      <button onClick={() => setDeductFor(s.coach)} disabled={!!busy} className={small}>Deduct</button>
                      <button onClick={() => sendTest(s)} disabled={!!busy} className={small} title="Email this statement to you instead of the coach">
                        {busy === `test:${s.coach}` ? 'Sending…' : 'Test to me'}
                      </button>
                      <button onClick={() => send([s])} disabled={!!busy} className={small}>Email</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {monthDeductions.length > 0 && (
        <div className="mt-3 bg-[#0e0e0e] border border-[#1c1c1c] rounded-xl divide-y divide-white/[0.05]">
          {monthDeductions.map(a => (
            <div key={a.$id} className="px-4 py-2 flex items-center gap-3 text-[12px]">
              <span className="text-white w-44 truncate">{a.coach}</span>
              <span className="text-white/60 w-20">{REASON_LABELS[a.reason] ?? a.reason}</span>
              <span className="text-white/40 w-16">{a.date ? fmtDate(`${a.date}T12:00:00`) : ''}</span>
              <span className="text-white/45 flex-1 min-w-0 truncate">{a.note}</span>
              <span className="text-red-300">– {fmtMoney(a.amount)}</span>
              <button onClick={() => removeDeduction(a)} title="Remove this deduction" className="text-white/25 hover:text-red-400 transition-colors p-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {deductFor !== null && (
        <DeductionModal
          coaches={coaches} coach={deductFor} month={month} recordedBy={recordedBy}
          onClose={() => setDeductFor(null)}
          onSaved={a => { setAdjustments(prev => [...prev, a]); setDeductFor(null); }}
        />
      )}
    </div>
  );
}
