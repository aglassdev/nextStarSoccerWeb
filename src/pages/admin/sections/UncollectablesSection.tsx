import React, { useMemo, useState } from 'react';
import {
  UNCOLLECTABLES,
  UNKNOWN_ATTENDEES,
  Uncollectable,
  UncollectableSession,
  UncollectableStatus,
  UnknownAttendee,
} from '../../../data/uncollectables';

// Players who came to sessions that were never billed: the admin's own list
// plus everyone the coaches named in session notes. The data lives in
// src/data/uncollectables.ts.

type Filter = 'all' | UncollectableStatus | 'unknowns';

const GROUPS: { key: UncollectableStatus; title: string; blurb?: string }[] = [
  { key: 'emails', title: 'Emails' },
  { key: 'none', title: 'Nothing Exists', blurb: 'No account or family on file.' },
  { key: 'contacted', title: 'Contacted' },
  { key: 'willContact', title: 'Will Contact' },
  { key: 'notes', title: 'From Session Notes', blurb: "Named in a coach's note, not on the list, and not checked in to that session." },
];

const TAG_STYLES: Record<string, string> = {
  'contacted': 'bg-sky-500/15 text-sky-300 border-sky-500/25',
  'charge henry': 'bg-amber-500/15 text-amber-300 border-amber-500/25',
  'charged through quickbooks': 'bg-green-500/15 text-green-400 border-green-500/25',
  'no child set up': 'bg-red-500/15 text-red-400 border-red-500/25',
};

// Dates are stored as Eastern calendar days, so they are built locally rather
// than parsed as UTC (which would show the day before in the evening).
const dayOf = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const fmtDay = (ymd: string) =>
  dayOf(ymd).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

const isOpen = (s: UncollectableSession) => !s.billed;

// Coaches wrote times both ways ("5:30 PM", "17:30", "10:00"); show them one way.
const fmtTime = (t: string | null) => {
  if (!t) return null;
  const m = t.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return t.trim();
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
};

// "William & Lucas Naaman" is two players.
const headcount = (name: string) => (name.includes(' & ') ? 2 : 1);

const CountPill = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[11px] font-mono text-white/45 bg-white/[0.05] border border-white/[0.07] rounded-full px-2 py-0.5 flex-shrink-0">
    {children}
  </span>
);

const Tag = ({ label }: { label: string }) => (
  <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium border ${TAG_STYLES[label.toLowerCase()] || 'bg-white/[0.06] text-white/55 border-white/10'}`}>
    {label}
  </span>
);

const SessionList = ({ sessions }: { sessions: { date: string; time: string | null; title: string | null; billed?: 'billed' | 'paid'; amount?: number }[] }) => {
  if (sessions.length === 0) {
    return <p className="text-white/30 text-[12px] italic">No session dates recorded.</p>;
  }
  return (
    <ul className="divide-y divide-white/[0.05]">
      {sessions.map((s, i) => (
        <li key={`${s.date}-${i}`} className="flex items-baseline gap-3 py-1.5">
          <span className={`text-[12px] font-mono w-[86px] flex-shrink-0 ${s.billed ? 'text-white/35' : 'text-white/80'}`}>{fmtDay(s.date)}</span>
          <span className={`text-[12px] flex-1 min-w-0 truncate ${s.billed ? 'text-white/35 line-through decoration-white/20' : 'text-white/55'}`} title={s.title || undefined}>
            {s.title || 'Session'}
            {s.time ? <span className="text-white/30"> · {fmtTime(s.time)}</span> : null}
          </span>
          {s.billed && (
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border flex-shrink-0 ${
              s.billed === 'paid' ? 'bg-green-500/15 text-green-400 border-green-500/25' : 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25'
            }`}>
              {s.billed === 'paid' ? 'Paid' : 'Billed'}{s.amount !== undefined ? ` $${s.amount}` : ''}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
};

const PlayerCard = ({ p }: { p: Uncollectable }) => {
  const open = p.sessions.filter(isOpen).length;
  return (
    <div className="bg-[#131211] border border-white/[0.07] rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-white text-[14px] font-semibold leading-snug">{p.name}</p>
          <p className="text-[12px] mt-0.5">
            {p.parent
              ? <><span className="text-white/35">Parent </span><span className="text-white/70">{p.parent}</span></>
              : <span className="text-white/30">No parent on file</span>}
          </p>
        </div>
        {p.sessions.length > 0 && (
          <CountPill>{open === 0 ? 'All collected' : `${open} ${open === 1 ? 'session' : 'sessions'}`}</CountPill>
        )}
      </div>

      {(p.tags.length > 0 || p.hasAccount) && (
        <div className="flex flex-wrap gap-1.5">
          {p.tags.map(t => <Tag key={t} label={t} />)}
          {p.hasAccount && <Tag label="Has account" />}
        </div>
      )}

      {(p.comment || p.hint) && (
        <div className="space-y-0.5">
          {p.comment && <p className="text-white/45 text-[12px]">{p.comment}</p>}
          {p.hint && <p className="text-amber-300/80 text-[12px]">{p.hint}</p>}
        </div>
      )}

      <SessionList sessions={p.sessions} />
    </div>
  );
};

const UnknownCard = ({ u }: { u: UnknownAttendee }) => (
  <div className="bg-[#131211] border border-dashed border-white/[0.12] rounded-xl p-4 flex flex-col gap-3">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-white text-[14px] font-semibold leading-snug">{u.label}</p>
        {u.comment && <p className="text-white/40 text-[12px] mt-0.5">{u.comment}</p>}
      </div>
      {u.count > 1 && <CountPill>{u.count} people</CountPill>}
    </div>
    <SessionList sessions={u.sessions} />
  </div>
);

const SectionHeader = ({ title, count, blurb }: { title: string; count: number; blurb?: string }) => (
  <div className="flex items-baseline gap-2 mb-3 flex-wrap">
    <h3 className="text-white text-[15px] font-semibold">{title}</h3>
    <span className="text-white/30 text-xs font-mono">{count}</span>
    {blurb && <span className="text-white/30 text-xs basis-full sm:basis-auto">{blurb}</span>}
  </div>
);

const matches = (q: string, ...fields: (string | null | undefined)[]) =>
  fields.some(f => (f || '').toLowerCase().includes(q));

const UncollectablesSection = () => {
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();

  const people = useMemo(
    () => UNCOLLECTABLES.filter(p => !q || matches(q, p.name, p.parent, p.comment, ...p.tags)),
    [q]
  );
  const unknowns = useMemo(
    () => UNKNOWN_ATTENDEES.filter(u => !q || matches(q, u.label, u.comment)),
    [q]
  );

  const totals = useMemo(() => ({
    players: UNCOLLECTABLES.reduce((n, p) => n + headcount(p.name), 0),
    sessions: UNCOLLECTABLES.reduce((n, p) => n + p.sessions.filter(isOpen).length, 0),
    unknowns: UNKNOWN_ATTENDEES.length,
  }), []);

  const countFor = (f: Filter) =>
    f === 'all' ? people.length + unknowns.length
      : f === 'unknowns' ? unknowns.length
      : people.filter(p => p.status === f).length;

  const chips: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    ...GROUPS.map(g => ({ key: g.key as Filter, label: g.title })),
    { key: 'unknowns', label: 'Unknowns' },
  ];

  const visibleGroups = GROUPS.filter(g => filter === 'all' || filter === g.key)
    .map(g => ({ ...g, people: people.filter(p => p.status === g.key) }))
    .filter(g => g.people.length > 0);
  const showUnknowns = (filter === 'all' || filter === 'unknowns') && unknowns.length > 0;
  const nothing = visibleGroups.length === 0 && !showUnknowns;

  return (
    <div className="p-4 sm:p-6 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-white text-xl font-semibold">Uncollectables</h2>
        <p className="text-white/30 text-xs mt-0.5 font-mono">
          {totals.players} players · {totals.sessions} unbilled sessions · {totals.unknowns} unknown
        </p>
        <p className="text-white/40 text-[12px] mt-2 max-w-2xl">
          Sessions people attended from April onward that were never billed, from the uncollectables list and the coaches' session notes.
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {chips.map(c => (
          <button
            key={c.key}
            onClick={() => setFilter(c.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === c.key ? 'bg-white text-black' : 'bg-white/[0.06] text-white/50 hover:bg-white/10 hover:text-white'
            }`}
          >
            {c.label} <span className="opacity-60">({countFor(c.key)})</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search by player or parent…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg pl-9 pr-4 py-2 text-white text-[13px] placeholder-white/25 focus:outline-none focus:border-white/20"
        />
      </div>

      {nothing && <p className="text-white/25 text-sm text-center py-10">No matches.</p>}

      <div className="space-y-8">
        {visibleGroups.map(g => (
          <section key={g.key}>
            <SectionHeader title={g.title} count={g.people.length} blurb={g.blurb} />
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 items-start">
              {g.people.map(p => <PlayerCard key={p.name} p={p} />)}
            </div>
          </section>
        ))}

        {showUnknowns && (
          <section>
            <SectionHeader title="Unknowns" count={unknowns.length} blurb="Attendees the notes don't name: nicknames, first names only, and head counts." />
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 items-start">
              {unknowns.map((u, i) => <UnknownCard key={`${u.label}-${i}`} u={u} />)}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default UncollectablesSection;
