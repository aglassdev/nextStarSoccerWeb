import { useState, useEffect } from 'react';
import { googleCalendarService, CalendarEvent, isEventCancelled } from '../../../services/googleCalendar';

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// ── Event color classification (mirrors CalendarPage logic) ──────────────────
function getEventColor(title: string): string {
  if (!title) return '#D3D3D3';
  const t = title.toLowerCase();

  // Highest-priority overrides
  if (t.includes('patrick mullins')) return '#FFB300';
  if (t.includes('attacking focus')) return '#FF00FF';

  // Group training variants
  if (t.includes('afternoon group training')) return '#EAB308';
  if (t.includes('morning group training')) return '#FF8A14';
  if (t.includes('next star x nike evening')) return '#06B6D4';
  if (t.includes('evening group training')) return '#E50101';

  // Specific camp / group types
  if (t.includes('youth group')) return '#008806';
  if (t.includes('college/pro group')) return '#9FDC59';
  if (t.includes('camp morning')) return '#1976D2';
  if (t.includes('camp afternoon')) return '#29B6F6';

  // Generic camp (no nike / youth / pro / college)
  if (
    t.includes('camp') &&
    !t.includes('nike') &&
    !t.includes('youth') &&
    !t.includes('pro') &&
    !t.includes('college')
  ) return '#008806';

  if (t.includes('clinic')) return '#FF00FF';
  if (t.includes('showcase')) return '#800080';
  return '#D3D3D3';
}

// ── Mini calendar grid ────────────────────────────────────────────────────────
function CalendarGrid({
  year,
  month,
  events,
  onDayClick,
  selectedDay,
}: {
  year: number;
  month: number;
  events: CalendarEvent[];
  onDayClick: (day: number) => void;
  selectedDay: number | null;
}) {
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

  // Map day → events (active, not cancelled)
  const eventsByDay: Record<number, CalendarEvent[]> = {};
  for (const ev of events) {
    if (isEventCancelled(ev)) continue;
    const d = new Date(ev.startDateTime);
    const dayNum = Number(d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }).split('-')[2]);
    const evYear = Number(d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }).split('-')[0]);
    const evMonth = Number(d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }).split('-')[1]) - 1;
    if (evYear === year && evMonth === month) {
      if (!eventsByDay[dayNum]) eventsByDay[dayNum] = [];
      eventsByDay[dayNum].push(ev);
    }
  }

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div>
      {/* Day labels */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map(d => (
          <div key={d} className="text-center text-[10px] text-gray-600 py-1">{d}</div>
        ))}
      </div>
      {/* Cells */}
      <div className="grid grid-cols-7 gap-px bg-[#1a1a1a] rounded-lg overflow-hidden">
        {cells.map((day, i) => {
          if (!day) return <div key={i} className="bg-[#0a0a0a] h-9" />;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isToday = dateStr === todayStr;
          const evs = eventsByDay[day] || [];
          const isSelected = selectedDay === day;

          return (
            <button
              key={i}
              onClick={() => onDayClick(day)}
              className={`bg-[#0a0a0a] h-9 flex flex-col items-center justify-start pt-1 gap-0.5 transition-colors hover:bg-[#151515] ${
                isSelected ? 'ring-1 ring-inset ring-blue-500' : ''
              }`}
            >
              <span className={`text-xs leading-none w-5 h-5 flex items-center justify-center rounded-full font-medium ${
                isToday ? 'bg-blue-600 text-white' : 'text-gray-400'
              }`}>
                {day}
              </span>
              {evs.length > 0 && (
                <div className="flex gap-0.5 flex-wrap justify-center px-0.5">
                  {evs.slice(0, 3).map((ev, di) => (
                    <div
                      key={di}
                      className="w-1 h-1 rounded-full flex-shrink-0"
                      style={{ backgroundColor: getEventColor(ev.title) }}
                    />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Event list for selected day ───────────────────────────────────────────────
function DayEvents({ events, day, month, year }: { events: CalendarEvent[]; day: number; month: number; year: number }) {
  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const dayEvents = events.filter(ev => {
    if (isEventCancelled(ev)) return false;
    const d = new Date(ev.startDateTime).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    return d === dateStr;
  });

  if (dayEvents.length === 0) {
    return <p className="text-gray-600 text-xs text-center py-3">No events</p>;
  }

  return (
    <div className="space-y-1.5 mt-2">
      {dayEvents.map(ev => {
        const start = new Date(ev.startDateTime);
        const time = ev.dateOnly
          ? 'All Day'
          : start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York' });
        const color = getEventColor(ev.title);
        return (
          <div
            key={ev.id}
            className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-lg px-3 py-2"
            style={{ borderLeftColor: color, borderLeftWidth: '3px' }}
          >
            <p className="text-white text-xs font-medium leading-snug">{ev.title}</p>
            <p className="text-gray-500 text-[11px] mt-0.5">{time}</p>
            {ev.location && <p className="text-gray-600 text-[11px] mt-0.5 truncate">{ev.location}</p>}
          </div>
        );
      })}
    </div>
  );
}

// ── Single Calendar Panel ─────────────────────────────────────────────────────
function CalendarPanel({ type }: { type: 'public' | 'private' }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<number | null>(
    now.getDate()
  );

  useEffect(() => {
    setLoading(true);
    setEvents([]);
    googleCalendarService.getEventsForMonth(year, month, type)
      .then(setEvents)
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [year, month, type]);

  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
    setSelectedDay(null);
  };

  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
    setSelectedDay(null);
  };

  const activeCount = events.filter(e => !isEventCancelled(e)).length;

  return (
    <div className="flex-1 bg-[#0e0e0e] border border-[#1c1c1c] rounded-xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#1a1a1a] flex items-center justify-between">
        <div>
          <p className="text-white text-sm font-semibold">
            {type === 'public' ? 'Public Calendar' : 'Private Calendar'}
          </p>
          <p className="text-gray-600 text-xs mt-0.5">
            {loading ? '…' : `${activeCount} events`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-1 text-gray-500 hover:text-white transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-white text-sm font-medium w-32 text-center">
            {MONTH_NAMES[month]} {year}
          </span>
          <button onClick={nextMonth} className="p-1 text-gray-500 hover:text-white transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <div className="px-4 py-4 flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <CalendarGrid
              year={year}
              month={month}
              events={events}
              onDayClick={setSelectedDay}
              selectedDay={selectedDay}
            />

            {selectedDay && (
              <div className="mt-4">
                <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">
                  {MONTH_NAMES[month]} {selectedDay}
                </p>
                <DayEvents events={events} day={selectedDay} month={month} year={year} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── CalendarSection ───────────────────────────────────────────────────────────
const CalendarSection = () => (
  <div className="p-6">
    <h2 className="text-2xl font-bold text-white mb-6">Calendar Centre</h2>
    <div className="flex gap-5 h-[calc(100vh-160px)] min-h-0">
      <CalendarPanel type="public" />
      <CalendarPanel type="private" />
    </div>
  </div>
);

export default CalendarSection;
