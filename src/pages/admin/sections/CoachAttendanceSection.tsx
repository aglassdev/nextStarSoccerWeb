import { useEffect, useMemo, useState } from 'react';
import {
  buildCoachAttendance,
  CoachAttendanceData,
  CoachRow,
  AttendanceVia,
} from '../../../services/coachAttendance';

const pad2 = (n: number) => String(n).padStart(2, '0');
const easternDay = (iso: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(iso));
const addDaysStr = (dayStr: string, n: number) => {
  const [y, m, d] = dayStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
};
const sundayOf = (dayStr: string) => {
  const [y, m, d] = dayStr.split('-').map(Number);
  return addDaysStr(dayStr, -new Date(y, m - 1, d).getDay());
};
const dayParts = (dayStr: string) => {
  const [y, m, d] = dayStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return {
    weekday: dt.toLocaleDateString('en-US', { weekday: 'short' }),
    date: dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  };
};
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', {
    timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric',
  });
const fmtTime = (iso: string, dateOnly?: boolean) =>
  dateOnly ? 'All day' : new Date(iso).toLocaleTimeString('en-US', {
    timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit',
  });

const VIA_LABEL: Record<AttendanceVia, string> = {
  checkin: 'Check-in',
  signup: 'Signup (attendance taken)',
  calendar: 'Calendar description',
};

const ViaBadge = ({ via }: { via: AttendanceVia }) => {
  const styles: Record<AttendanceVia, string> = {
    checkin: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    signup: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
    calendar: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  };
  return (
    <span className={`px-1.5 py-0.5 rounded border text-[10px] font-medium ${styles[via]}`} title={VIA_LABEL[via]}>
      {via === 'checkin' ? 'CHK' : via === 'signup' ? 'SGN' : 'CAL'}
    </span>
  );
};

// ── By-coach view ─────────────────────────────────────────────────────────────
// One column per coach, mirroring the day columns in the player attendance
// week view. Expanding a coach pushes their session list down its own column.
const CoachColumn = ({ coach }: { coach: CoachRow }) => {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'tracked' | 'calendar'>('tracked');
  const sessions = tab === 'tracked' ? coach.tracked : coach.calendar;

  return (
    <div className="flex-shrink-0 w-[230px]">
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full text-left px-3 py-2.5 rounded-lg mb-2 border transition-colors ${
          open ? 'bg-white/[0.08] border-white/30' : 'bg-[#0e0e0e] border-[#1c1c1c] hover:border-white/20'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-white text-[13px] font-semibold truncate">{coach.name}</p>
          <svg className={`w-3.5 h-3.5 text-white/30 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        <p className="text-white/30 text-[11px] mt-0.5">
          {coach.inRoster ? 'Coach account' : 'No coach account'}
        </p>
        <div className="flex items-center gap-4 mt-2">
          <div>
            <span className="text-white text-[15px] font-semibold leading-none">{coach.tracked.length}</span>
            <span className="text-white/30 text-[10px] uppercase tracking-wider ml-1">sessions</span>
          </div>
          <div>
            <span className="text-amber-300 text-[15px] font-semibold leading-none">{coach.calendar.length}</span>
            <span className="text-amber-300/40 text-[10px] uppercase tracking-wider ml-1">cal</span>
          </div>
        </div>
      </button>

      {open && (
        <div className="space-y-2">
          <div className="flex bg-white/[0.04] border border-white/10 rounded-lg p-0.5">
            {(['tracked', 'calendar'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 px-2 py-1 text-[11px] rounded-md transition-colors ${
                  tab === t ? 'bg-white text-black font-medium' : 'text-white/60 hover:text-white'
                }`}>
                {t === 'tracked' ? `Tracked ${coach.tracked.length}` : `Cal ${coach.calendar.length}`}
              </button>
            ))}
          </div>
          {tab === 'calendar' && (
            <p className="text-amber-300/70 text-[10px] leading-snug">
              Hand-entered in Google Calendar and often incomplete.
            </p>
          )}
          {sessions.length === 0 ? (
            <p className="text-white/20 text-[11px] text-center py-4">No sessions</p>
          ) : sessions.map(sess => (
            <div key={`${sess.eventId}-${sess.via}`} className="bg-[#0e0e0e] border border-[#1c1c1c] rounded-lg p-2.5">
              <p className="text-white text-[12px] font-medium leading-snug">{sess.title}</p>
              <div className="flex items-center justify-between gap-2 mt-1">
                <p className="text-white/35 text-[11px]">
                  {fmtDate(sess.startDateTime)} · {fmtTime(sess.startDateTime, sess.dateOnly)}
                </p>
                <ViaBadge via={sess.via} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── By-session week view ──────────────────────────────────────────────────────
const WeekView = ({ data }: { data: CoachAttendanceData }) => {
  const todayStr = easternDay(new Date().toISOString());
  const [weekStart, setWeekStart] = useState(() => sundayOf(todayStr));
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysStr(weekStart, i)), [weekStart]);

  const eventsByDay = useMemo(() => {
    const daySet = new Set(days);
    const map: Record<string, typeof data.events> = {};
    for (const d of days) map[d] = [];
    for (const ev of data.events) {
      const d = easternDay(ev.startDateTime);
      if (daySet.has(d)) map[d].push(ev);
    }
    for (const d of days) map[d].sort((a, b) => Date.parse(a.startDateTime) - Date.parse(b.startDateTime));
    return map;
  }, [data.events, days]);

  const weekLabel = `${dayParts(days[0]).date} – ${dayParts(days[6]).date}`;
  const totalCoachSlots = days.reduce(
    (sum, d) => sum + eventsByDay[d].reduce((s, ev) => s + (data.coachesByEvent[ev.id]?.tracked.length || 0), 0),
    0
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekStart(w => addDaysStr(w, -7))}
            className="p-2 text-white/50 hover:text-white border border-white/10 hover:border-white/25 rounded-lg transition-colors" title="Previous week">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button onClick={() => setWeekStart(sundayOf(todayStr))}
            className="px-3 py-2 text-sm text-white/60 hover:text-white border border-white/10 hover:border-white/25 rounded-lg transition-colors">
            This week
          </button>
          <button onClick={() => setWeekStart(w => addDaysStr(w, 7))}
            className="p-2 text-white/50 hover:text-white border border-white/10 hover:border-white/25 rounded-lg transition-colors" title="Next week">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
        <div className="text-right">
          <p className="text-white text-sm font-medium">{weekLabel}</p>
          <p className="text-white/30 text-xs">{totalCoachSlots} coach attendances this week</p>
        </div>
      </div>

      <div className="overflow-x-auto pb-3">
       <div className="grid grid-cols-7 gap-2.5 min-w-[1000px]">
        {days.map(dayStr => {
          const { weekday, date } = dayParts(dayStr);
          const isToday = dayStr === todayStr;
          const dayEvents = eventsByDay[dayStr];
          return (
            <div key={dayStr} className="min-w-0">
              <div className={`px-3 py-2 rounded-lg mb-2 border ${isToday ? 'bg-white/[0.08] border-white/30' : 'bg-[#0e0e0e] border-[#1c1c1c]'}`}>
                <p className="text-white text-sm font-semibold">{weekday}</p>
                <p className="text-white/40 text-xs">{date}</p>
              </div>
              <div className="space-y-2">
                {dayEvents.length === 0 ? (
                  <p className="text-white/20 text-xs text-center py-4">No sessions</p>
                ) : dayEvents.map(ev => {
                  const slot = data.coachesByEvent[ev.id];
                  const tracked = slot?.tracked ?? [];
                  const calendarOnly = (slot?.calendar ?? []).filter(
                    n => !tracked.some(t => t.name.toLowerCase() === n.toLowerCase())
                  );
                  return (
                    <div key={ev.id} className="bg-[#0e0e0e] border border-[#1c1c1c] rounded-lg p-2.5">
                      <p className="text-white text-[12px] font-medium leading-snug">{ev.title}</p>
                      <p className="text-white/35 text-[11px] mt-0.5">{fmtTime(ev.startDateTime, ev.dateOnly)}</p>
                      <div className="mt-2 space-y-1">
                        {tracked.length === 0 && calendarOnly.length === 0 ? (
                          <p className="text-white/20 text-[11px]">No coaches recorded</p>
                        ) : (
                          <>
                            {tracked.map(t => (
                              <div key={t.name} className="flex items-center justify-between gap-2">
                                <span className="text-white/85 text-[11px] truncate">{t.name}</span>
                                <ViaBadge via={t.via} />
                              </div>
                            ))}
                            {calendarOnly.map(n => (
                              <div key={n} className="flex items-center justify-between gap-2">
                                <span className="text-amber-300/80 text-[11px] truncate">{n}</span>
                                <ViaBadge via="calendar" />
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
       </div>
      </div>
    </div>
  );
};

// ── Section ───────────────────────────────────────────────────────────────────
const CoachAttendanceSection = () => {
  const [data, setData] = useState<CoachAttendanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'coach' | 'session'>('coach');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const result = await buildCoachAttendance();
        if (!cancelled) setData(result);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filteredCoaches = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return q ? data.coaches.filter(c => c.name.toLowerCase().includes(q)) : data.coaches;
  }, [data, search]);

  const totals = useMemo(() => {
    if (!data) return { tracked: 0, calendar: 0, coaches: 0 };
    return {
      tracked: data.coaches.reduce((s, c) => s + c.tracked.length, 0),
      calendar: data.coaches.reduce((s, c) => s + c.calendar.length, 0),
      coaches: data.coaches.length,
    };
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 p-6">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }
  if (!data) return <p className="text-white/40 text-sm p-6">Could not load coach attendance.</p>;

  return (
    <div className="px-5 py-5">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="text-white text-xl font-semibold">Coach Attendance</h1>
          <p className="text-white/40 text-[13px] mt-1">
            Tracked attendance comes from coach check-ins, plus signups on days attendance was taken.
          </p>
        </div>
        <div className="flex bg-white/[0.04] border border-white/10 rounded-lg p-0.5">
          {(['coach', 'session'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${view === v ? 'bg-white text-black font-medium' : 'text-white/60 hover:text-white'}`}>
              {v === 'coach' ? 'By coach' : 'By session'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-[#0e0e0e] border border-[#1c1c1c] rounded-xl px-4 py-3">
          <p className="text-white text-xl font-semibold leading-none">{totals.tracked}</p>
          <p className="text-white/35 text-[11px] uppercase tracking-wider mt-1.5">Tracked sessions</p>
        </div>
        <div className="bg-[#0e0e0e] border border-amber-500/20 rounded-xl px-4 py-3">
          <p className="text-amber-300 text-xl font-semibold leading-none">{totals.calendar}</p>
          <p className="text-amber-300/40 text-[11px] uppercase tracking-wider mt-1.5">From calendar</p>
        </div>
        <div className="bg-[#0e0e0e] border border-[#1c1c1c] rounded-xl px-4 py-3">
          <p className="text-white text-xl font-semibold leading-none">{totals.coaches}</p>
          <p className="text-white/35 text-[11px] uppercase tracking-wider mt-1.5">Coaches</p>
        </div>
      </div>

      {view === 'coach' ? (
        <>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search coaches"
            className="w-full sm:w-72 bg-[#0e0e0e] border border-[#1c1c1c] focus:border-white/25 rounded-lg px-3 py-2 text-[13px] text-white placeholder-white/25 outline-none mb-3"
          />
          {filteredCoaches.length === 0 ? (
            <p className="text-white/30 text-sm py-6 text-center">No coaches match.</p>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-3 items-start">
              {filteredCoaches.map(c => <CoachColumn key={c.key} coach={c} />)}
            </div>
          )}
        </>
      ) : (
        <WeekView data={data} />
      )}
    </div>
  );
};

export default CoachAttendanceSection;
