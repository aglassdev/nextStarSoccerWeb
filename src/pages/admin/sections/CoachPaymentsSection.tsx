import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildCoachAttendance } from '../../../services/coachAttendance';
import { computePayoutTable, PayoutRow, PayoutTable, SessionRow } from '../../../services/coachPayouts';

// Bumped whenever the cached shape changes, so an old payload is never drawn.
const CACHE_KEY = 'nss.coachPayouts.v5';

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

type SessionSortKey = 'title' | 'startDateTime' | 'headCoaches' | 'supportCoaches' | 'facility' | 'facilityCost' | 'profit';
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

const CoachPaymentsSection = () => {
  const [table, setTable] = useState<PayoutTable | null>(null);
  const [error, setError] = useState('');
  const [view, setView] = useState<View>('session');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
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
      if (raw) setTable(JSON.parse(raw));
    } catch { /* ignore malformed cache */ }
    recalculate(() => cancelled);
    return () => { cancelled = true; };
  }, [recalculate]);

  const toggleSort = (key: SortKey) =>
    setSort(s => (s.key === key
      ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: key === 'startDateTime' || key === 'payment' || key === 'profit' || key === 'supportCost' || key === 'facilityCost' ? 'desc' : 'asc' }));

  const switchView = (next: View) => {
    setView(next);
    setSort({ key: 'startDateTime', dir: 'desc' });
  };

  const facilities = useMemo(
    () => Array.from(new Set((table?.sessions ?? []).map(s => s.facility))).sort(),
    [table]
  );

  const has = (hay: string, needle: string) => hay.toLowerCase().includes(needle.trim().toLowerCase());

  const visibleSessions = useMemo(() => {
    let rows = table?.sessions ?? [];
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
        case 'profit': return r.profit;
        default: return Date.parse(r.startDateTime);
      }
    };
    return [...rows].sort((a, b) => {
      const av = val(a), bv = val(b);
      if (av === bv) return Date.parse(b.startDateTime) - Date.parse(a.startDateTime);
      return av > bv ? dir : -dir;
    });
  }, [table, filters, sort]);

  const visibleRows = useMemo(() => {
    let rows = table?.rows ?? [];
    if (filters.coach) rows = rows.filter(r => has(r.coach, filters.coach));
    if (filters.sessionTitle) rows = rows.filter(r => has(r.sessionTitle, filters.sessionTitle));
    if (filters.facility) rows = rows.filter(r => r.facility === filters.facility);
    if (filters.supportCoaches) rows = rows.filter(r => has((r.supportCoaches ?? []).join(', '), filters.supportCoaches));

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
  }, [table, filters, sort]);

  const sessionProfitTotal = useMemo(
    () => visibleSessions.reduce((s, r) => s + r.profit, 0),
    [visibleSessions]
  );
  const coachPaymentTotal = useMemo(
    () => visibleRows.reduce((s, r) => s + (r.payment ?? 0), 0),
    [visibleRows]
  );

  const filtersActive = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);

  return (
    <div className="px-5 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h1 className="text-white text-xl font-semibold">Coach Payments</h1>
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
          {/* Per-coach profit. Paul Torres takes whatever is left after
              these, so he is not calculated here. */}
          <div className="mb-5">
            <div className="flex items-baseline justify-between gap-3 mb-2">
              <h2 className="text-white/70 text-[11px] uppercase tracking-wider font-semibold">Profit by coach</h2>
              <p className="text-white/40 text-[12px]">
                <span className="text-emerald-300 font-medium">{fmtMoney(table.grandTotal)}</span> paid out
                {table.adminFeeTotal > 0 && (
                  <> · <span className="text-amber-300/80 font-medium">{fmtMoney(table.adminFeeTotal)}</span> admin kept</>
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {table.totalsByCoach.length === 0 ? (
                <p className="text-white/30 text-sm">No coach payouts in this window.</p>
              ) : table.totalsByCoach.map(t => (
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
                  <p className="text-white/30 text-[10px]">{t.sessions} session{t.sessions === 1 ? '' : 's'}</p>
                  {t.adminFee !== undefined && t.adminFee > 0 && (
                    <p className="text-white/35 text-[10px] mt-1 pt-1 border-t border-white/[0.08]">
                      net of {fmtMoney(t.adminFee)} admin
                    </p>
                  )}
                </button>
              ))}
            </div>
          </div>
          {/* Summary bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            {filtersActive ? (
              <button
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="px-3 py-1.5 text-[12px] text-white/60 hover:text-white border border-white/10 hover:border-white/25 rounded-lg transition-colors"
              >
                Clear filters
              </button>
            ) : <span />}
            <p className="text-white/40 text-[12px]">
              {view === 'session' ? (
                <>
                  {visibleSessions.length} of {table.sessions.length} sessions ·{' '}
                  <span className={sessionProfitTotal < 0 ? 'text-rose-300 font-medium' : 'text-emerald-300 font-medium'}>
                    {fmtMoney(sessionProfitTotal)}
                  </span>{' '}
                  profit
                </>
              ) : (
                <>
                  {visibleRows.length} of {table.rows.length} rows ·{' '}
                  <span className="text-emerald-300 font-medium">{fmtMoney(coachPaymentTotal)}</span>
                  {filtersActive ? ' shown' : ' total'}
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
                      <Th label="Session profit" sortKey="profit" sort={sort} onSort={toggleSort} align="right" />
                    </tr>
                  </thead>
                  <tbody>
                    {visibleSessions.length === 0 ? (
                      <tr><td colSpan={7} className="px-3 py-8 text-center text-white/30 text-sm">No sessions match these filters.</td></tr>
                    ) : visibleSessions.map(s => {
                      const breakdown = [
                        `Revenue ${fmtMoney(s.revenue)}`,
                        s.facilityCost > 0 ? `− Facility ${fmtMoney(s.facilityCost)}` : null,
                        s.supportCost > 0 ? `− Coaches ${fmtMoney(s.supportCost)}` : null,
                        ...s.otherCosts.map(c => `− ${c.label} ${fmtMoney(c.amount)}`),
                        `= ${fmtMoney(s.profit)}`,
                        s.adminFee > 0 ? `− Admin 5% ${fmtMoney(s.adminFee)}` : null,
                        s.gyauEligible
                          ? `Gyau ${s.gyauAttended ? '50%' : '30%'} of the rest → ${fmtMoney(s.gyauShare)}`
                          : 'Gyau share: not eligible',
                      ].filter(Boolean).join('\n');
                      return (
                        <tr key={s.id} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] align-top">
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
                          <td className="px-3 py-2 text-right whitespace-nowrap" title={breakdown}>
                            <span className={`text-[12px] font-medium ${s.profit < 0 ? 'text-rose-300' : 'text-emerald-300'}`}>
                              {fmtMoney(s.profit)}
                            </span>
                            {s.gyauEligible && s.gyauShare > 0 && (
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
                          {r.supportCoaches && r.supportCoaches.length > 0 ? r.supportCoaches.join(', ') : <Dash />}
                        </td>
                        <td className="px-3 py-2 text-right text-white/55 text-[12px] whitespace-nowrap">
                          {r.supportCost && r.supportCost > 0 ? fmtMoney(r.supportCost) : <Dash />}
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
              )}
            </div>
          </div>

        </>
      )}
    </div>
  );
};

export default CoachPaymentsSection;
