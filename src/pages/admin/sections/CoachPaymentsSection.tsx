import { useEffect, useMemo, useState } from 'react';
import {
  buildCoachAttendance,
  CoachAttendanceData,
  CoachSession,
  normalizeName,
} from '../../../services/coachAttendance';

// ── Payout rules ──────────────────────────────────────────────────────────────
const HOURLY_RATE = 25;          // $25 per hour, part-hours paid as a full hour
const CAMP_FLAT_RATE = 25;       // camps pay a flat rate regardless of length
const GYAU_ATTENDED_SHARE = 0.5; // 50% of session revenue when he coached it
const GYAU_ABSENT_SHARE = 0.3;   // 30% of revenue on qualifying sessions he missed

// Coaches whose pay is settled outside this calculation.
const NOT_CALCULATED = ['paul torres', 'patrick mullins'];
const GYAU = 'phillip gyau';

const CACHE_KEY = 'nss.coachPayouts.v1';

const has = (title: string, ...needles: string[]) => {
  const t = title.toLowerCase();
  return needles.every(n => t.includes(n));
};
const isCamp = (title: string) => has(title, 'camp');
const isPrivate = (title: string) => {
  const t = title.toLowerCase();
  return ['private session', 'individual session', 'two-person', 'small group', 'game analysis', 'parent consultation']
    .some(p => t.includes(p));
};
const isAfternoon = (title: string) => has(title, 'afternoon');

// Sessions Gyau earns a revenue share on even when he did not attend.
const gyauQualifiesWhenAbsent = (title: string) => {
  if (isPrivate(title) || isAfternoon(title)) return false;
  return has(title, 'morning group') || has(title, 'evening group') || isCamp(title);
};

const standardPayout = (s: CoachSession): number => {
  if (isCamp(s.title)) return CAMP_FLAT_RATE;
  const hours = (Date.parse(s.endDateTime) - Date.parse(s.startDateTime)) / 3_600_000;
  if (!Number.isFinite(hours) || hours <= 0) return HOURLY_RATE;
  return Math.ceil(hours) * HOURLY_RATE;
};

interface PayoutLine {
  eventId: string;
  title: string;
  startDateTime: string;
  basis: string;
  amount: number;
}
interface CoachPayout {
  key: string;
  name: string;
  calculated: boolean;
  note?: string;
  sessionCount: number;
  total: number;
  lines: PayoutLine[];
}
interface PayoutResult {
  builtAt: string;
  coaches: CoachPayout[];
  grandTotal: number;
}

const fmtMoney = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', {
    timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric',
  });

function computePayouts(data: CoachAttendanceData): PayoutResult {
  const coaches: CoachPayout[] = [];

  for (const coach of data.coaches) {
    const key = normalizeName(coach.name);

    // Attendance for pay = tracked sessions, plus calendar-only sessions for
    // coaches who have no account (Gyau) and therefore no tracked record.
    const attended = new Map<string, CoachSession>();
    for (const s of coach.tracked) attended.set(s.eventId, s);
    for (const s of coach.calendar) if (!attended.has(s.eventId)) attended.set(s.eventId, s);
    const sessions = Array.from(attended.values());

    if (NOT_CALCULATED.includes(key)) {
      coaches.push({
        key, name: coach.name, calculated: false,
        note: 'Settled separately — not calculated here',
        sessionCount: sessions.length, total: 0, lines: [],
      });
      continue;
    }

    const lines: PayoutLine[] = [];

    if (key === GYAU) {
      const attendedIds = new Set(sessions.map(s => s.eventId));
      for (const s of sessions) {
        const revenue = data.revenueByEvent[s.eventId] || 0;
        if (revenue <= 0) continue;
        lines.push({
          eventId: s.eventId, title: s.title, startDateTime: s.startDateTime,
          basis: `50% of ${fmtMoney(revenue)} (attended)`,
          amount: revenue * GYAU_ATTENDED_SHARE,
        });
      }
      for (const ev of data.events) {
        if (attendedIds.has(ev.id)) continue;
        if (!gyauQualifiesWhenAbsent(ev.title)) continue;
        const revenue = data.revenueByEvent[ev.id] || 0;
        if (revenue <= 0) continue;
        lines.push({
          eventId: ev.id, title: ev.title, startDateTime: ev.startDateTime,
          basis: `30% of ${fmtMoney(revenue)} (did not attend)`,
          amount: revenue * GYAU_ABSENT_SHARE,
        });
      }
    } else {
      for (const s of sessions) {
        const amount = standardPayout(s);
        const hours = (Date.parse(s.endDateTime) - Date.parse(s.startDateTime)) / 3_600_000;
        lines.push({
          eventId: s.eventId, title: s.title, startDateTime: s.startDateTime,
          basis: isCamp(s.title)
            ? 'Camp flat rate'
            : `${Number.isFinite(hours) && hours > 0 ? hours.toFixed(hours % 1 ? 1 : 0) : '?'}h → ${Math.round(amount / HOURLY_RATE)} × $${HOURLY_RATE}`,
          amount,
        });
      }
    }

    lines.sort((a, b) => Date.parse(b.startDateTime) - Date.parse(a.startDateTime));
    coaches.push({
      key, name: coach.name, calculated: true,
      sessionCount: key === GYAU ? lines.length : sessions.length,
      total: lines.reduce((s, l) => s + l.amount, 0),
      lines,
    });
  }

  coaches.sort((a, b) => Number(b.calculated) - Number(a.calculated) || b.total - a.total || a.name.localeCompare(b.name));
  return {
    builtAt: data.builtAt,
    coaches,
    grandTotal: coaches.reduce((s, c) => s + c.total, 0),
  };
}

const PayoutCard = ({ payout }: { payout: CoachPayout }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-[#0e0e0e] border border-[#1c1c1c] rounded-xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] transition-colors text-left">
        <div className="min-w-0">
          <p className="text-white text-[13px] font-medium truncate">{payout.name}</p>
          <p className="text-white/30 text-[11px]">
            {payout.note ?? `${payout.sessionCount} session${payout.sessionCount === 1 ? '' : 's'}`}
          </p>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          <p className={`text-[15px] font-semibold ${payout.calculated ? 'text-emerald-300' : 'text-white/25'}`}>
            {payout.calculated ? fmtMoney(payout.total) : '—'}
          </p>
          <svg className={`w-4 h-4 text-white/30 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-white/[0.06] pt-3">
          {payout.lines.length === 0 ? (
            <p className="text-white/25 text-xs">{payout.note ?? 'No payable sessions'}</p>
          ) : (
            <div className="space-y-1">
              {payout.lines.map(l => (
                <div key={`${l.eventId}-${l.basis}`} className="flex items-center justify-between gap-3 py-1.5 border-b border-white/[0.05] last:border-0">
                  <div className="min-w-0">
                    <p className="text-white/90 text-[12px] truncate">{l.title}</p>
                    <p className="text-white/35 text-[11px]">{fmtDate(l.startDateTime)} · {l.basis}</p>
                  </div>
                  <p className="text-white text-[12px] font-medium flex-shrink-0">{fmtMoney(l.amount)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const CoachPaymentsSection = () => {
  const [result, setResult] = useState<PayoutResult | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState('');

  // Cached results only. Recalculation is explicit — opening or reloading the
  // page never refetches, so the numbers stay stable until you ask for new ones.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) setResult(JSON.parse(raw));
    } catch { /* ignore malformed cache */ }
  }, []);

  const recalculate = async () => {
    setCalculating(true);
    setError('');
    try {
      const data = await buildCoachAttendance();
      const computed = computePayouts(data);
      setResult(computed);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(computed)); } catch { /* quota */ }
    } catch (e: any) {
      setError(e?.message || 'Failed to calculate payouts');
    } finally {
      setCalculating(false);
    }
  };

  const lastRun = useMemo(
    () => result ? new Date(result.builtAt).toLocaleString('en-US', { timeZone: 'America/New_York' }) : null,
    [result]
  );

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="text-white text-xl font-semibold">Coach Payments</h1>
          <p className="text-white/40 text-[13px] mt-1">
            {lastRun ? `Last calculated ${lastRun}` : 'Not calculated yet'}
          </p>
        </div>
        <button
          onClick={recalculate}
          disabled={calculating}
          className="flex items-center gap-2 px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {calculating ? (
            <><span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />Calculating…</>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {result ? 'Recalculate' : 'Calculate'}
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-lg px-4 py-2.5 mb-4">{error}</div>
      )}

      {!result ? (
        <div className="bg-[#0e0e0e] border border-[#1c1c1c] rounded-xl px-6 py-12 text-center">
          <p className="text-white/50 text-sm">No payout figures yet.</p>
          <p className="text-white/25 text-[12px] mt-1">
            Press Calculate to pull attendance and session revenue. Results are cached, so reopening this page won't recalculate.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="bg-[#0e0e0e] border border-[#1c1c1c] rounded-xl px-4 py-3">
              <p className="text-emerald-300 text-xl font-semibold leading-none">{fmtMoney(result.grandTotal)}</p>
              <p className="text-white/35 text-[11px] uppercase tracking-wider mt-1.5">Total payable</p>
            </div>
            <div className="bg-[#0e0e0e] border border-[#1c1c1c] rounded-xl px-4 py-3">
              <p className="text-white text-xl font-semibold leading-none">{result.coaches.filter(c => c.calculated).length}</p>
              <p className="text-white/35 text-[11px] uppercase tracking-wider mt-1.5">Coaches calculated</p>
            </div>
          </div>

          <div className="space-y-2">
            {result.coaches.map(c => <PayoutCard key={c.key} payout={c} />)}
          </div>
        </>
      )}
    </div>
  );
};

export default CoachPaymentsSection;
