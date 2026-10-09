import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildCoachAttendance } from '../../../services/coachAttendance';
import {
  computePayoutTable, summarizePayouts, easternMonthKey, easternMonthLabel,
  PayoutRow, PayoutTable, SessionRow,
} from '../../../services/coachPayouts';

// Bumped whenever the cached shape changes, so an old payload is never drawn.
const CACHE_KEY = 'nss.coachPayouts.v11';

const ALL_MONTHS = 'all';

// Gyau's rows split on whether he was at the session: 50% when present, 30%
// when absent. Every other coach's row is a session they worked.
type Presence = 'all' | 'present' | 'absent';
const GYAU_NAME = 'phillip gyau';
const isGyauRow = (r: PayoutRow) => r.coach.trim().toLowerCase() === GYAU_NAME;

const fmtMoney = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const fmtDateTime = (iso: string, dateOnly?: boolean) => {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-US', {
    timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric',
  });
  if (dateOnly) return `${date} · All day`;
  const time = d.toLocaleTimeString('en-US', {
    timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit',
  });
  return `${date} · ${time}`;
};

type View = 'session' | 'coach';

type SessionSortKey = 'title' | 'startDateTime' | 'headCoaches' | 'supportCoaches' | 'facility' | 'facilityCost' | 'revenue' | 'profit';
type CoachSortKey = 'coach' | 'sessionTitle' | 'startDateTime' | 'facility' | 'supportCoaches' | 'supportCost' | 'payment';
type SortKey = SessionSortKey | CoachSortKey;
type SortDir = 'asc' | 'desc';

interface Filters {
  coach: string;
  sessionTitle: string;
  facility: string;
  supportCoaches: string;
}

const EMPTY_FILTERS: Filters = { coach: '', sessionTitle: '', facility: '', supportCoaches: '' };

const SortArrow = ({ active, dir }: { active: boolean; dir: SortDir }) => (
  <span className={`inline-block ml-1 text-[9px] leading-none ${active ? 'text-white' : 'text-white/20'}`}>
    {active ? (dir === 'asc' ? '▲' : '▼') : '↕'}
  </span>
);

// Header cell with click-to-sort and an inline filter control underneath.
const Th = ({
  label, sortKey, sort, onSort, align = 'left', children,
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; dir: SortDir };
  onSort: (k: SortKey) => void;
  align?: 'left' | 'right';
  children?: React.ReactNode;
}) => (
  <th className={`px-3 py-2 align-top ${align === 'right' ? 'text-right' : 'text-left'}`}>
    <button
      onClick={() => onSort(sortKey)}
      className="text-white/60 hover:text-white text-[10px] uppercase tracking-wider font-semibold whitespace-nowrap transition-colors"
    >
      {label}
      <SortArrow active={sort.key === sortKey} dir={sort.dir} />
    </button>
    {children && <div className="mt-1.5">{children}</div>}
  </th>
);

const FilterInput = ({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder: string;
}) => (
  <input
    value={value}
    onChange={e => onChange(e.target.value)}
    placeholder={placeholder}
    className="w-full min-w-[90px] bg-[#0b0b0b] border border-[#242424] focus:border-white/30 rounded px-1.5 py-1 text-[11px] text-white placeholder-white/20 outline-none font-normal normal-case tracking-normal"
  />
);

const FacilitySelect = ({ value, onChange, facilities }: {
  value: string; onChange: (v: string) => void; facilities: string[];
}) => (
  <select
    value={value}
    onChange={e => onChange(e.target.value)}
    className="w-full min-w-[110px] bg-[#0b0b0b] border border-[#242424] focus:border-white/30 rounded px-1 py-1 text-[11px] text-white outline-none font-normal normal-case tracking-normal"
  >
    <option value="">All</option>
    {facilities.map(f => <option key={f} value={f}>{f}</option>)}
  </select>
);

const Dash = () => <span className="text-white/20">—</span>;

// What a figure becomes once every bill behind it is settled. Only worth
// printing when it differs from what has actually come in.
const Expected = ({ value, of }: { value: number; of: number }) =>
  Math.abs(value - of) < 0.005 ? null : (
    <p className="text-white/30 text-[10px] whitespace-nowrap">{fmtMoney(value)} exp.</p>
  );

const CoachPaymentsSection = () => {
  const navigate = useNavigate();
  const [table, setTable] = useState<PayoutTable | null>(null);
  const [error, setError] = useState('');
  const [view, setView] = useState<View>('session');
  const [month, setMonth] = useState<string>(ALL_MONTHS);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [presence, setPresence] = useState<Presence>('all');
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'startDateTime', dir: 'desc' });

  const recalculate = useCallback(async (isCancelled: () => boolean = () => false) => {
    setError('');
    try {
      const data = await buildCoachAttendance();
      const computed = computePayoutTable(data);
      if (isCancelled()) return;
      setTable(computed);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(computed)); } catch { /* quota */ }
    } catch (e: any) {
      if (!isCancelled()) setError(e?.message || 'Failed to calculate payouts');
    }
  }, []);

  // Recalculates on every open. The last figures are cached and drawn straight
  // away so the table is never blank while the refresh runs.
  useEffect(() => {
    let cancelled = false;
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      // Belt and braces on top of the version in the key: a payload missing a
      // figure the table draws would crash the page rather than look stale.
      const cached = raw ? JSON.parse(raw) : null;
      if (cached && typeof cached.expectedGrandTotal === 'number') setTable(cached);
    } catch { /* ignore malformed cache */ }
    recalculate(() => cancelled);
    return () => { cancelled = true; };
  }, [recalculate]);

  const toggleSort = (key: SortKey) =>
    setSort(s => (s.key === key
      ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: key === 'startDateTime' || key === 'payment' || key === 'profit' || key === 'revenue' || key === 'supportCost' || key === 'facilityCost' ? 'desc' : 'asc' }));

  const switchView = (next: View) => {
    setView(next);
    setSort({ key: 'startDateTime', dir: 'desc' });
  };

  const facilities = useMemo(
    () => Array.from(new Set((table?.sessions ?? []).map(s => s.facility))).sort(),
    [table]
  );

  const months = useMemo(
    () => Array.from(new Set((table?.sessions ?? []).map(s => easternMonthKey(s.startDateTime))))
      .sort()
      .reverse(),
    [table]
  );

  // Choosing a month narrows the whole page, not just the rows: the coach cards
  // and the headline figures are re-totalled over that month alone.
  const scoped = useMemo(() => {
    if (!table) return null;
    if (month === ALL_MONTHS) return table;
    const sessions = table.sessions.filter(s => easternMonthKey(s.startDateTime) === month);
    const rows = table.rows.filter(r => easternMonthKey(r.startDateTime) === month);
    return { ...table, rows, sessions, ...summarizePayouts(rows, sessions) };
  }, [table, month]);

  const openInAttendance = (eventId: string) =>
    navigate(`/admin/attendance/public/${encodeURIComponent(eventId)}`);

  const has = (hay: string, needle: string) => hay.toLowerCase().includes(needle.trim().toLowerCase());

  const visibleSessions = useMemo(() => {
    let rows = scoped?.sessions ?? [];
    if (filters.sessionTitle) rows = rows.filter(r => has(r.title, filters.sessionTitle));
    if (filters.facility) rows = rows.filter(r => r.facility === filters.facility);
    if (filters.supportCoaches) {
      rows = rows.filter(r => has(r.supportCoaches.map(c => c.name).join(', '), filters.supportCoaches));
    }

    const dir = sort.dir === 'asc' ? 1 : -1;
    const val = (r: SessionRow): string | number => {
      switch (sort.key) {
        case 'title': return r.title.toLowerCase();
        case 'headCoaches': return r.headCoaches.join(', ').toLowerCase();
        case 'supportCoaches': return r.supportCoaches.length;
        case 'facility': return r.facility.toLowerCase();
        case 'facilityCost': return r.facilityCost;
        case 'revenue': return r.expectedRevenue;
        case 'profit': return r.expectedProfit;
        default: return Date.parse(r.startDateTime);
      }
    };
    return [...rows].sort((a, b) => {
      const av = val(a), bv = val(b);
      if (av === bv) return Date.parse(b.startDateTime) - Date.parse(a.startDateTime);
      return av > bv ? dir : -dir;
    });
  }, [scoped, filters, sort]);

  const visibleRows = useMemo(() => {
    let rows = scoped?.rows ?? [];
    if (filters.coach) rows = rows.filter(r => has(r.coach, filters.coach));
    if (filters.sessionTitle) rows = rows.filter(r => has(r.sessionTitle, filters.sessionTitle));
    if (filters.facility) rows = rows.filter(r => r.facility === filters.facility);
    if (filters.supportCoaches) rows = rows.filter(r => has((r.supportCoaches ?? []).join(', '), filters.supportCoaches));
    if (presence !== 'all') rows = rows.filter(r => isGyauRow(r) && r.attended === (presence === 'present'));

    const dir = sort.dir === 'asc' ? 1 : -1;
    const val = (r: PayoutRow): string | number => {
      switch (sort.key) {
        case 'coach': return r.coach.toLowerCase();
        case 'sessionTitle': return r.sessionTitle.toLowerCase();
        case 'facility': return r.facility.toLowerCase();
        case 'supportCoaches': return r.supportCoaches?.length ?? -1;
        case 'supportCost': return r.supportCost ?? -1;
        case 'payment': return r.payment ?? -1;
        default: return Date.parse(r.startDateTime);
      }
    };
    return [...rows].sort((a, b) => {
      const av = val(a), bv = val(b);
      if (av === bv) return Date.parse(b.startDateTime) - Date.parse(a.startDateTime);
      return av > bv ? dir : -dir;
    });
  }, [scoped, filters, sort, presence]);

  // Gyau's totals split by whether he was there, over the month in view.
  const gyauSplit = useMemo(() => {
    const rows = (scoped?.rows ?? []).filter(isGyauRow);
    const sum = (attended: boolean) => {
      const r = rows.filter(x => x.attended === attended);
      return {
        sessions: r.length,
        total: r.reduce((s, x) => s + (x.payment ?? 0), 0),
        expected: r.reduce((s, x) => s + (x.expectedPayment ?? 0), 0),
      };
    };
    return { present: sum(true), absent: sum(false) };
  }, [scoped]);

  const sessionProfitTotal = useMemo(
    () => visibleSessions.reduce((s, r) => s + r.profit, 0),
    [visibleSessions]
  );
  const sessionExpectedProfitTotal = useMemo(
    () => visibleSessions.reduce((s, r) => s + r.expectedProfit, 0),
    [visibleSessions]
  );
  const coachPaymentTotal = useMemo(
    () => visibleRows.reduce((s, r) => s + (r.payment ?? 0), 0),
    [visibleRows]
  );
  const coachExpectedTotal = useMemo(
    () => visibleRows.reduce((s, r) => s + (r.expectedPayment ?? 0), 0),
    [visibleRows]
  );

  const filtersActive = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS) || presence !== 'all';

  const showPresence = (p: Presence) => {
    setView('coach');
    setPresence(cur => (cur === p ? 'all' : p));
  };

  return (
    <div className="px-5 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h1 className="text-white text-xl font-semibold">Coach Payments</h1>
        <div className="flex items-center gap-2">
          {/* Narrows the table and re-totals every coach card to that month. */}
          <select
            value={month}
            onChange={e => setMonth(e.target.value)}
            className={`px-3 py-1.5 text-[12px] rounded-lg border outline-none transition-colors ${
              month === ALL_MONTHS
                ? 'bg-white/[0.04] border-white/10 text-white/70 hover:text-white'
                : 'bg-white text-black font-medium border-white'
            }`}
          >
            <option value={ALL_MONTHS}>All months</option>
            {months.map(m => <option key={m} value={m}>{easternMonthLabel(m)}</option>)}
          </select>
          <div className="flex bg-white/[0.04] border border-white/10 rounded-lg p-0.5">
            {([['session', 'Session'], ['coach', 'Coach']] as [View, string][]).map(([v, label]) => (
              <button
                key={v}
                onClick={() => switchView(v)}
                className={`px-4 py-1.5 text-[12px] rounded-md transition-colors ${
                  view === v ? 'bg-white text-black font-medium' : 'text-white/60 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-lg px-4 py-2.5 mb-4">{error}</div>
      )}

      {!scoped ? (
        <div className="bg-[#0e0e0e] border border-[#1c1c1c] rounded-xl px-6 py-12 text-center">
          <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto" />
          <p className="text-white/50 text-sm mt-3">Pulling attendance, facilities and session revenue…</p>
        </div>
      ) : (
        <>
          {/* Per-coach profit. Paul Torres takes whatever is left after
              these, so he is not calculated here. */}
          <div className="mb-5">
            <div className="flex items-baseline justify-between gap-3 mb-2">
              <h2 className="text-white/70 text-[11px] uppercase tracking-wider font-semibold">Profit by coach</h2>
              <p className="text-white/40 text-[12px]">
                <span className="text-emerald-300 font-medium">{fmtMoney(scoped.grandTotal)}</span> earned on paid bills
                {' · '}<span className="text-white/60 font-medium">{fmtMoney(scoped.expectedGrandTotal)}</span> expected
                {scoped.expectedAdminFeeTotal > 0 && (
                  <> · <span className="text-amber-300/80 font-medium">{fmtMoney(scoped.adminFeeTotal)}</span> admin kept</>
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {scoped.totalsByCoach.length === 0 ? (
                <p className="text-white/30 text-sm">No coach payouts in this window.</p>
              ) : scoped.totalsByCoach.map(t => (
                <button
                  key={t.coach}
                  onClick={() => {
                    setView('coach');
                    setFilters(f => ({ ...f, coach: f.coach === t.coach ? '' : t.coach }));
                  }}
                  className={`text-left px-3 py-2 rounded-lg border transition-colors ${
                    filters.coach === t.coach
                      ? 'bg-white/[0.10] border-white/30'
                      : 'bg-[#0e0e0e] border-[#1c1c1c] hover:border-white/20'
                  }`}
                >
                  <p className="text-white text-[12px] font-medium">{t.coach}</p>
                  <p className={`text-[13px] font-semibold ${t.total === null ? 'text-white/25' : 'text-emerald-300'}`}>
                    {t.total === null ? '—' : fmtMoney(t.total)}
                  </p>
                  {/* What is still to come once the pending bills are settled. */}
                  {t.expectedTotal !== null && t.expectedTotal !== t.total && (
                    <p className="text-white/45 text-[11px]">{fmtMoney(t.expectedTotal)} expected</p>
                  )}
                  <p className="text-white/30 text-[10px]">{t.sessions} session{t.sessions === 1 ? '' : 's'}</p>
                  {t.coach.trim().toLowerCase() === GYAU_NAME && (
                    <div className="mt-1 pt-1 border-t border-white/[0.08] space-y-0.5">
                      {([['present', 'Present · 50%', gyauSplit.present], ['absent', 'Absent · 30%', gyauSplit.absent]] as const).map(([p, label, v]) => (
                        <span
                          key={p}
                          role="button"
                          onClick={e => { e.stopPropagation(); showPresence(p); }}
                          className={`flex items-baseline justify-between gap-3 text-[10px] rounded px-1 -mx-1 ${
                            presence === p ? 'bg-white/[0.12] text-white' : 'text-white/45 hover:text-white'
                          }`}
                        >
                          <span>{label} · {v.sessions}</span>
                          <span className="text-emerald-300/90">
                            {fmtMoney(v.total)}
                            {Math.abs(v.expected - v.total) >= 0.005 && <span className="text-white/30"> / {fmtMoney(v.expected)}</span>}
                          </span>
                        </span>
                      ))}
                    </div>
                  )}
                  {t.expectedAdminFee !== undefined && t.expectedAdminFee > 0 && (
                    <p className="text-white/35 text-[10px] mt-1 pt-1 border-t border-white/[0.08]">
                      net of {fmtMoney(t.adminFee ?? 0)} admin
                      {t.expectedAdminFee !== t.adminFee && <> · {fmtMoney(t.expectedAdminFee)} exp.</>}
                    </p>
                  )}
                </button>
              ))}
            </div>
          </div>
          {/* Summary bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              {filtersActive && (
                <button
                  onClick={() => { setFilters(EMPTY_FILTERS); setPresence('all'); }}
                  className="px-3 py-1.5 text-[12px] text-white/60 hover:text-white border border-white/10 hover:border-white/25 rounded-lg transition-colors"
                >
                  Clear filters
                </button>
              )}
              {view === 'coach' && (
                <div className="flex bg-white/[0.04] border border-white/10 rounded-lg p-0.5">
                  {([['all', 'All'], ['present', 'Gyau present'], ['absent', 'Gyau absent']] as [Presence, string][]).map(([p, label]) => (
                    <button
                      key={p}
                      onClick={() => setPresence(p)}
                      className={`px-3 py-1 text-[11px] rounded-md transition-colors ${
                        presence === p ? 'bg-white text-black font-medium' : 'text-white/60 hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
              <p className="text-white/25 text-[11px]">Click a row to open it in the Attendance Manager</p>
            </div>
            <p className="text-white/40 text-[12px]">
              {view === 'session' ? (
                <>
                  {visibleSessions.length} of {scoped.sessions.length} sessions ·{' '}
                  <span className={sessionProfitTotal < 0 ? 'text-rose-300 font-medium' : 'text-emerald-300 font-medium'}>
                    {fmtMoney(sessionProfitTotal)}
                  </span>{' '}
                  profit · <span className="text-white/60 font-medium">{fmtMoney(sessionExpectedProfitTotal)}</span> expected
                </>
              ) : (
                <>
                  {visibleRows.length} of {scoped.rows.length} rows ·{' '}
                  <span className="text-emerald-300 font-medium">{fmtMoney(coachPaymentTotal)}</span>
                  {filtersActive ? ' shown' : ' earned'}
                  {' · '}<span className="text-white/60 font-medium">{fmtMoney(coachExpectedTotal)}</span> expected
                </>
              )}
            </p>
          </div>

          <div className="bg-[#0e0e0e] border border-[#1c1c1c] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              {view === 'session' ? (
                <table className="w-full min-w-[1080px] border-collapse">
                  <thead className="bg-white/[0.03] border-b border-white/[0.08]">
                    <tr>
                      <Th label="Session name" sortKey="title" sort={sort} onSort={toggleSort}>
                        <FilterInput value={filters.sessionTitle} onChange={v => setFilters(f => ({ ...f, sessionTitle: v }))} placeholder="Filter" />
                      </Th>
                      <Th label="Date / time" sortKey="startDateTime" sort={sort} onSort={toggleSort} />
                      <Th label="Head coaches" sortKey="headCoaches" sort={sort} onSort={toggleSort} />
                      <Th label="Support coaches" sortKey="supportCoaches" sort={sort} onSort={toggleSort}>
                        <FilterInput value={filters.supportCoaches} onChange={v => setFilters(f => ({ ...f, supportCoaches: v }))} placeholder="Filter" />
                      </Th>
                      <Th label="Facility" sortKey="facility" sort={sort} onSort={toggleSort}>
                        <FacilitySelect value={filters.facility} onChange={v => setFilters(f => ({ ...f, facility: v }))} facilities={facilities} />
                      </Th>
                      <Th label="Facility cost" sortKey="facilityCost" sort={sort} onSort={toggleSort} align="right" />
                      <Th label="Revenue" sortKey="revenue" sort={sort} onSort={toggleSort} align="right" />
                      <Th label="Session profit" sortKey="profit" sort={sort} onSort={toggleSort} align="right" />
                    </tr>
                  </thead>
                  <tbody>
                    {visibleSessions.length === 0 ? (
                      <tr><td colSpan={8} className="px-3 py-8 text-center text-white/30 text-sm">No sessions match these filters.</td></tr>
                    ) : visibleSessions.map(s => {
                      const breakdown = [
                        `Revenue ${fmtMoney(s.revenue)} collected of ${fmtMoney(s.expectedRevenue)} billed`,
                        s.facilityCost > 0 ? `− Facility ${fmtMoney(s.facilityCost)}` : null,
                        s.supportCost > 0 ? `− Coaches ${fmtMoney(s.supportCost)}` : null,
                        ...s.otherCosts.map(c => `− ${c.label} ${fmtMoney(c.amount)}`),
                        `= ${fmtMoney(s.profit)} now, ${fmtMoney(s.expectedProfit)} once all bills are paid`,
                        s.expectedAdminFee > 0 ? `− Admin 5% ${fmtMoney(s.adminFee)} (${fmtMoney(s.expectedAdminFee)} expected)` : null,
                        s.gyauEligible
                          ? `Gyau ${s.gyauAttended ? '50%' : '30%'} of the rest → ${fmtMoney(s.gyauShare)} (${fmtMoney(s.expectedGyauShare)} expected)`
                          : 'Gyau share: not eligible',
                      ].filter(Boolean).join('\n');
                      return (
                        <tr
                          key={s.id}
                          onClick={() => openInAttendance(s.eventId)}
                          className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.04] align-top cursor-pointer"
                        >
                          <td className="px-3 py-2 text-white text-[12px]">{s.title}</td>
                          <td className="px-3 py-2 text-white/50 text-[12px] whitespace-nowrap">{fmtDateTime(s.startDateTime, s.dateOnly)}</td>
                          <td className="px-3 py-2 text-white/70 text-[12px]">
                            {s.headCoaches.length > 0 ? s.headCoaches.join(', ') : <Dash />}
                          </td>
                          <td className="px-3 py-2 text-white/55 text-[12px]">
                            {s.supportCoaches.length === 0 && s.otherCosts.length === 0 ? <Dash /> : (
                              <div className="space-y-0.5">
                                {s.supportCoaches.map(c => (
                                  <div key={c.name} className="whitespace-nowrap" title={c.basis}>
                                    {c.name}
                                    <span className="ml-1.5 text-rose-300/70 text-[10px]">−{fmtMoney(c.amount)}</span>
                                  </div>
                                ))}
                                {s.otherCosts.map(c => (
                                  <div key={c.label} className="whitespace-nowrap text-white/35">
                                    {c.label}
                                    <span className="ml-1.5 text-rose-300/70 text-[10px]">−{fmtMoney(c.amount)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-white/60 text-[12px] whitespace-nowrap">{s.facility}</td>
                          <td className="px-3 py-2 text-right text-[12px] whitespace-nowrap">
                            {s.facilityCost > 0
                              ? <span className="text-rose-300/80">{fmtMoney(s.facilityCost)}</span>
                              : <span className="text-white/30">{fmtMoney(0)}</span>}
                          </td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">
                            <span className={`text-[12px] ${s.revenue > 0 ? 'text-white/80' : 'text-white/30'}`}>
                              {fmtMoney(s.revenue)}
                            </span>
                            <Expected value={s.expectedRevenue} of={s.revenue} />
                          </td>
                          <td className="px-3 py-2 text-right whitespace-nowrap" title={breakdown}>
                            <span className={`text-[12px] font-medium ${s.profit < 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
                              {fmtMoney(s.profit)}
                            </span>
                            <Expected value={s.expectedProfit} of={s.profit} />
                            {s.gyauEligible && s.expectedGyauShare > 0 && (
                              <p className="text-white/30 text-[10px]">
                                Gyau {s.gyauAttended ? '50%' : '30%'} · {fmtMoney(s.gyauShare)}
                              </p>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <table className="w-full min-w-[1080px] border-collapse">
                  <thead className="bg-white/[0.03] border-b border-white/[0.08]">
                    <tr>
                      <Th label="Coach" sortKey="coach" sort={sort} onSort={toggleSort}>
                        <FilterInput value={filters.coach} onChange={v => setFilters(f => ({ ...f, coach: v }))} placeholder="Filter" />
                      </Th>
                      <Th label="Session" sortKey="sessionTitle" sort={sort} onSort={toggleSort}>
                        <FilterInput value={filters.sessionTitle} onChange={v => setFilters(f => ({ ...f, sessionTitle: v }))} placeholder="Filter" />
                      </Th>
                      <Th label="Date / time" sortKey="startDateTime" sort={sort} onSort={toggleSort} />
                      <Th label="Facility" sortKey="facility" sort={sort} onSort={toggleSort}>
                        <FacilitySelect value={filters.facility} onChange={v => setFilters(f => ({ ...f, facility: v }))} facilities={facilities} />
                      </Th>
                      <Th label="Support coaches" sortKey="supportCoaches" sort={sort} onSort={toggleSort}>
                        <FilterInput value={filters.supportCoaches} onChange={v => setFilters(f => ({ ...f, supportCoaches: v }))} placeholder="Filter" />
                      </Th>
                      <Th label="Support cost" sortKey="supportCost" sort={sort} onSort={toggleSort} align="right" />
                      <Th label="Payment" sortKey="payment" sort={sort} onSort={toggleSort} align="right" />
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.length === 0 ? (
                      <tr><td colSpan={7} className="px-3 py-8 text-center text-white/30 text-sm">No rows match these filters.</td></tr>
                    ) : visibleRows.map(r => (
                      <tr
                        key={r.id}
                        onClick={() => openInAttendance(r.eventId)}
                        className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.04] cursor-pointer"
                      >
                        <td className="px-3 py-2 text-white text-[12px] whitespace-nowrap">
                          {r.coach}
                          {!r.attended && (
                            <span className="ml-1.5 text-amber-300/80 text-[9px] border border-amber-500/30 bg-amber-500/10 px-1 py-0.5 rounded align-middle">
                              ABS
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-white/80 text-[12px]">{r.sessionTitle}</td>
                        <td className="px-3 py-2 text-white/50 text-[12px] whitespace-nowrap">{fmtDateTime(r.startDateTime, r.dateOnly)}</td>
                        <td className="px-3 py-2 text-white/60 text-[12px] whitespace-nowrap">
                          {r.facility}
                          {r.facilityCost > 0 && (
                            <span className="ml-1.5 text-rose-300/80 text-[10px]">−{fmtMoney(r.facilityCost)}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-white/55 text-[12px]">
                          {r.supportCoaches && r.supportCoaches.length > 0 ? r.supportCoaches.join(', ') : <Dash />}
                        </td>
                        <td className="px-3 py-2 text-right text-white/55 text-[12px] whitespace-nowrap">
                          {r.supportCost && r.supportCost > 0 ? fmtMoney(r.supportCost) : <Dash />}
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap" title={r.basis}>
                          {r.payment === null
                            ? <span className="text-white/25 text-[12px]">—</span>
                            : <span className="text-emerald-300 text-[12px] font-medium">{fmtMoney(r.payment)}</span>}
                          {r.payment !== null && r.expectedPayment !== null && (
                            <Expected value={r.expectedPayment} of={r.payment} />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

        </>
      )}
    </div>
  );
};

export default CoachPaymentsSection;
