import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildCoachAttendance } from '../../../services/coachAttendance';
import { computePayoutTable, PayoutRow, PayoutTable } from '../../../services/coachPayouts';

const CACHE_KEY = 'nss.coachPayouts.v3';

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

type SortKey = 'coach' | 'sessionTitle' | 'startDateTime' | 'facility' | 'supportCoaches' | 'supportCost' | 'payment';
type SortDir = 'asc' | 'desc';

interface Filters {
  coach: string;
  sessionTitle: string;
  facility: string;
  supportCoaches: string;
  attendance: 'all' | 'attended' | 'absent';
}

const EMPTY_FILTERS: Filters = {
  coach: '', sessionTitle: '', facility: '', supportCoaches: '', attendance: 'all',
};

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

const CoachPaymentsSection = () => {
  const [table, setTable] = useState<PayoutTable | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'startDateTime', dir: 'desc' });

  const recalculate = useCallback(async (isCancelled: () => boolean = () => false) => {
    setCalculating(true);
    setError('');
    try {
      const data = await buildCoachAttendance();
      const computed = computePayoutTable(data);
      if (isCancelled()) return;
      setTable(computed);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(computed)); } catch { /* quota */ }
    } catch (e: any) {
      if (!isCancelled()) setError(e?.message || 'Failed to calculate payouts');
    } finally {
      if (!isCancelled()) setCalculating(false);
    }
  }, []);

  // Recalculates on every open. The last figures are cached and drawn straight
  // away so the table is never blank while the refresh runs.
  useEffect(() => {
    let cancelled = false;
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) setTable(JSON.parse(raw));
    } catch { /* ignore malformed cache */ }
    recalculate(() => cancelled);
    return () => { cancelled = true; };
  }, [recalculate]);

  const toggleSort = (key: SortKey) =>
    setSort(s => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'startDateTime' || key === 'payment' || key === 'supportCost' ? 'desc' : 'asc' }));

  const facilities = useMemo(
    () => Array.from(new Set((table?.rows ?? []).map(r => r.facility))).sort(),
    [table]
  );

  const visibleRows = useMemo(() => {
    let rows = table?.rows ?? [];
    const has = (hay: string, needle: string) => hay.toLowerCase().includes(needle.trim().toLowerCase());
    if (filters.coach) rows = rows.filter(r => has(r.coach, filters.coach));
    if (filters.sessionTitle) rows = rows.filter(r => has(r.sessionTitle, filters.sessionTitle));
    if (filters.facility) rows = rows.filter(r => r.facility === filters.facility);
    if (filters.supportCoaches) rows = rows.filter(r => has(r.supportCoaches.join(', '), filters.supportCoaches));
    if (filters.attendance !== 'all') {
      rows = rows.filter(r => (filters.attendance === 'attended' ? r.attended : !r.attended));
    }

    const dir = sort.dir === 'asc' ? 1 : -1;
    const val = (r: PayoutRow) => {
      switch (sort.key) {
        case 'coach': return r.coach.toLowerCase();
        case 'sessionTitle': return r.sessionTitle.toLowerCase();
        case 'startDateTime': return Date.parse(r.startDateTime);
        case 'facility': return r.facility.toLowerCase();
        case 'supportCoaches': return r.supportCoaches.length;
        case 'supportCost': return r.supportCost;
        case 'payment': return r.payment ?? -1;
      }
    };
    return [...rows].sort((a, b) => {
      const av = val(a), bv = val(b);
      if (av === bv) return Date.parse(b.startDateTime) - Date.parse(a.startDateTime);
      return av > bv ? dir : -dir;
    });
  }, [table, filters, sort]);

  const visibleTotal = useMemo(
    () => visibleRows.reduce((s, r) => s + (r.payment ?? 0), 0),
    [visibleRows]
  );

  const lastRun = table
    ? new Date(table.builtAt).toLocaleString('en-US', { timeZone: 'America/New_York' })
    : null;
  const filtersActive = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);

  return (
    <div className="px-5 py-5">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="text-white text-xl font-semibold">Coach Payments</h1>
          <p className="text-white/40 text-[13px] mt-1">
            {calculating ? 'Recalculating…' : lastRun ? `Recalculated on open · ${lastRun}` : 'Calculating…'}
          </p>
        </div>
        <button
          onClick={() => recalculate()}
          disabled={calculating}
          className="flex items-center gap-2 px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {calculating ? (
            <><span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />Recalculating…</>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Recalculate
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-lg px-4 py-2.5 mb-4">{error}</div>
      )}

      {!table ? (
        <div className="bg-[#0e0e0e] border border-[#1c1c1c] rounded-xl px-6 py-12 text-center">
          <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto" />
          <p className="text-white/50 text-sm mt-3">Pulling attendance, facilities and session revenue…</p>
        </div>
      ) : (
        <>
          {/* Per-coach totals */}
          <div className="flex flex-wrap gap-2 mb-4">
            {table.totalsByCoach.map(t => (
              <button
                key={t.coach}
                onClick={() => setFilters(f => ({ ...f, coach: f.coach === t.coach ? '' : t.coach }))}
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
                <p className="text-white/30 text-[10px]">{t.sessions} session{t.sessions === 1 ? '' : 's'}</p>
              </button>
            ))}
          </div>

          {/* Summary bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="flex bg-white/[0.04] border border-white/10 rounded-lg p-0.5">
                {(['all', 'attended', 'absent'] as const).map(a => (
                  <button
                    key={a}
                    onClick={() => setFilters(f => ({ ...f, attendance: a }))}
                    className={`px-3 py-1.5 text-[12px] rounded-md capitalize transition-colors ${
                      filters.attendance === a ? 'bg-white text-black font-medium' : 'text-white/60 hover:text-white'
                    }`}
                  >
                    {a === 'absent' ? 'Did not attend' : a}
                  </button>
                ))}
              </div>
              {filtersActive && (
                <button
                  onClick={() => setFilters(EMPTY_FILTERS)}
                  className="px-3 py-1.5 text-[12px] text-white/60 hover:text-white border border-white/10 hover:border-white/25 rounded-lg transition-colors"
                >
                  Clear filters
                </button>
              )}
            </div>
            <p className="text-white/40 text-[12px]">
              {visibleRows.length} of {table.rows.length} rows ·{' '}
              <span className="text-emerald-300 font-medium">{fmtMoney(visibleTotal)}</span>
              {filtersActive ? ' shown' : ' total'}
            </p>
          </div>

          <div className="bg-[#0e0e0e] border border-[#1c1c1c] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
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
                      <select
                        value={filters.facility}
                        onChange={e => setFilters(f => ({ ...f, facility: e.target.value }))}
                        className="w-full min-w-[110px] bg-[#0b0b0b] border border-[#242424] focus:border-white/30 rounded px-1 py-1 text-[11px] text-white outline-none font-normal normal-case tracking-normal"
                      >
                        <option value="">All</option>
                        {facilities.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
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
                    <tr key={r.id} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
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
                        {r.supportCoaches.length === 0 ? <span className="text-white/20">—</span> : r.supportCoaches.join(', ')}
                      </td>
                      <td className="px-3 py-2 text-right text-white/55 text-[12px] whitespace-nowrap">
                        {r.supportCost > 0 ? fmtMoney(r.supportCost) : <span className="text-white/20">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap" title={r.basis}>
                        {r.payment === null
                          ? <span className="text-white/25 text-[12px]">—</span>
                          : <span className="text-emerald-300 text-[12px] font-medium">{fmtMoney(r.payment)}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default CoachPaymentsSection;
