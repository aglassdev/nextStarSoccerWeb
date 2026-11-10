import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { isEventCancelled, type CalendarEvent } from '@/services/googleCalendar';
import { AccountPageHeader, AccountSpinner } from '../account/AccountLayout';
import SessionsCalendar from '../account/schedule/SessionsCalendar';
import { ConfirmCancelModal, ErrorModal } from '../account/schedule/ScheduleModals';
import { calculateStreak, formatCardDateTime, keyToLocalDate, locationName, sessionsByDay, todayKey } from '../account/schedule/scheduleData';
import { cancelCoaching, fetchCoachSchedule, type CoachSchedule, type CoachSession } from './coachData';

// Coach Dashboard, as the app's CoachDashboardScreen and laid out like the
// client's My Schedule: the sessions calendar and the coach's stats in a
// column, beside Ongoing / Your Sessions / Past Sessions (two to a row on a
// wide screen). A session opens its page; sessions to sign up for are on
// the Calendar.

const LOAD_ERROR = 'Failed to load your sessions. Please check your internet connection and try again.';

const cacheKey = (uid: string) => `nss.coachDashboard.v1.${uid}`;
const readCache = (uid?: string): CoachSchedule | null => {
  if (!uid) return null;
  try {
    const raw = localStorage.getItem(cacheKey(uid));
    return raw ? (JSON.parse(raw) as CoachSchedule) : null;
  } catch {
    return null;
  }
};
const writeCache = (uid: string, data: CoachSchedule) => {
  try {
    localStorage.setItem(cacheKey(uid), JSON.stringify(data));
  } catch {
    /* storage unavailable */
  }
};

const cardClass =
  'relative overflow-hidden min-h-[90px] lg:min-h-[112px] flex items-center gap-4 px-4 py-4 lg:px-6 lg:py-5 bg-[#111] border border-[#222] rounded-[14px] lg:rounded-2xl';

const SessionCard = ({
  session,
  kind,
  onOpen,
  onCancel,
}: {
  session: CoachSession;
  kind: 'ongoing' | 'upcoming' | 'past';
  onOpen: () => void;
  onCancel: () => void;
}) => {
  const { date, time } = formatCardDateTime(session);
  const where = locationName(session.location);
  const cancelled = isEventCancelled(session);
  const clickable = !cancelled;

  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? onOpen : undefined}
      onKeyDown={(e) => {
        if (clickable && e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onOpen();
        }
      }}
      className={`${cardClass} ${clickable ? 'cursor-pointer hover:border-[#3a3a3a] active:opacity-70 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30' : ''}`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-white text-lg lg:text-xl font-bold leading-snug line-clamp-2 mb-1">{session.title}</p>
        <p className="text-[#9ca3af] text-base mb-1">
          {date} | {time}
        </p>
        {where && <p className="text-[#9ca3af] text-base truncate">{where}</p>}
        {(session.isHeadCoach || (kind !== 'upcoming' && session.coachCheckedIn)) && (
          <p className="flex flex-wrap gap-x-3 mt-2 text-[13px]">
            {session.isHeadCoach && <span className="text-[#c4b5fd] font-semibold">Head Coach</span>}
            {kind !== 'upcoming' && session.coachCheckedIn && <span className="text-[#4ade80]">Checked in</span>}
          </p>
        )}
      </div>

      {kind !== 'past' && !cancelled && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCancel();
          }}
          className="flex-shrink-0 pr-2 text-white text-lg underline underline-offset-4 hover:text-[#ccc]"
        >
          Cancel
        </button>
      )}

      {cancelled && (
        <div className="absolute top-[35px] inset-x-0 bg-[#DC2626] py-2.5 text-center text-white text-lg font-bold tracking-[2px]">CANCELLED</div>
      )}
    </div>
  );
};

const Section = ({ title, count, bold, empty, children }: { title: string; count?: number; bold?: boolean; empty?: string; children?: React.ReactNode }) => (
  <section>
    <div className="flex items-center justify-between mb-4">
      <h3 className={`text-white text-lg lg:text-xl ${bold ? 'font-bold' : 'font-normal'}`}>{title}</h3>
      {count !== undefined && <span className="text-white text-lg lg:text-xl font-bold">{count}</span>}
    </div>
    {empty ? (
      <p className="py-6 text-center text-[#9ca3af] text-lg">{empty}</p>
    ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3">{children}</div>
    )}
  </section>
);

const Stat = ({ value, label, active }: { value: number; label: string; active?: boolean }) => (
  <div className="flex-1 first:pl-1">
    <p className="text-white text-[32px] lg:text-[40px] leading-none font-bold">{value}</p>
    <p className="text-[#888] text-[13px] lg:text-sm font-medium mt-2">{label}</p>
    {active && <p className="text-[#16a34a] text-[11px] lg:text-xs font-bold tracking-[0.5px] mt-0.5">Active</p>}
  </div>
);

const CoachDashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const uid = user?.$id;

  const [data, setData] = useState<CoachSchedule | null>(() => readCache(uid));
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [month, setMonth] = useState(() => {
    const t = keyToLocalDate(todayKey());
    return new Date(t.getFullYear(), t.getMonth(), 1);
  });
  const [toCancel, setToCancel] = useState<CoachSession | null>(null);
  const [busy, setBusy] = useState('');
  const [alertMsg, setAlertMsg] = useState<string | null>(null);
  const fetching = useRef(false);

  const load = useCallback(async () => {
    if (!uid || fetching.current) return;
    fetching.current = true;
    try {
      const fresh = await fetchCoachSchedule(uid);
      setData(fresh);
      writeCache(uid, fresh);
      setLoadError('');
    } catch (e) {
      console.error('Coach dashboard failed to load:', e);
      setLoadError(LOAD_ERROR);
      setData((d) => d ?? { upcoming: [], ongoing: [], past: [] });
    } finally {
      fetching.current = false;
      setRefreshing(false);
    }
  }, [uid]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = () => {
    if (fetching.current) return;
    setRefreshing(true);
    load();
  };

  const closeCancel = useCallback(() => {
    if (!busy) setToCancel(null);
  }, [busy]);

  const confirmCancel = async () => {
    if (!toCancel || !uid) return;
    setBusy('cancel');
    try {
      await cancelCoaching(toCancel.id, uid);
      setToCancel(null);
      load();
    } catch (e) {
      console.error('Cancel failed:', e);
      setToCancel(null);
      setAlertMsg('Failed to cancel. Please try again.');
    } finally {
      setBusy('');
    }
  };

  const all = useMemo(() => (data ? [...data.upcoming, ...data.ongoing, ...data.past] : []), [data]);
  const dots = useMemo(() => sessionsByDay(all), [all]);
  const streak = useMemo(() => (data ? calculateStreak(data.past) : { streak: 0, active: false }), [data]);

  const openSession = (s: CalendarEvent) => navigate(`/coach/session/${encodeURIComponent(s.id)}`, { state: { event: s } });

  const refreshButton = (
    <button
      type="button"
      onClick={refresh}
      disabled={refreshing}
      aria-label="Refresh"
      title="Refresh"
      className="w-10 h-10 flex items-center justify-center rounded-full text-[#888] hover:text-white hover:bg-white/10 transition-colors disabled:opacity-60"
    >
      <svg className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    </button>
  );

  const card = (s: CoachSession, kind: 'ongoing' | 'upcoming' | 'past') => (
    <SessionCard key={`${kind}-${s.id}`} session={s} kind={kind} onOpen={() => openSession(s)} onCancel={() => setToCancel(s)} />
  );

  return (
    <div>
      <AccountPageHeader title="Dashboard" right={data ? refreshButton : undefined} />

      {loadError && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 px-5 py-4 bg-[#111] border border-[#DC2626]/40 rounded-2xl">
          <p className="text-[#e5a3a3] text-sm">{loadError}</p>
          <button type="button" onClick={refresh} className="text-white text-sm underline underline-offset-4">
            Try again
          </button>
        </div>
      )}

      {!data ? (
        <AccountSpinner />
      ) : (
        <div className="grid gap-8 lg:gap-10 lg:grid-cols-[360px_minmax(0,1fr)] xl:grid-cols-[400px_minmax(0,1fr)] lg:items-start">
          <aside className="grid gap-6 md:grid-cols-2 md:gap-8 md:items-start lg:block lg:space-y-8 lg:sticky lg:top-24">
            <div className="lg:bg-[#111] lg:border lg:border-[#222] lg:rounded-2xl lg:p-6">
              <SessionsCalendar month={month} onChangeMonth={setMonth} sessionsByDay={dots} />
            </div>

            <div>
              <h3 className="text-white text-[22px] font-normal mb-3">Your Stats</h3>
              <div className="flex py-[18px] border-y border-[#222]">
                <Stat value={data.past.length + data.ongoing.length} label="Sessions" />
                <Stat value={data.upcoming.filter((e) => !isEventCancelled(e)).length} label="Upcoming" />
                <Stat value={streak.streak} label="Streak" active={streak.active} />
              </div>
            </div>
          </aside>

          <div className="space-y-8 lg:space-y-10 min-w-0">
            {data.ongoing.length > 0 && (
              <Section title="Ongoing" count={data.ongoing.length} bold>
                {data.ongoing.map((s) => card(s, 'ongoing'))}
              </Section>
            )}

            <Section title="Your Sessions" empty={data.upcoming.length === 0 ? 'No upcoming sessions' : undefined}>
              {data.upcoming.map((s) => card(s, 'upcoming'))}
            </Section>

            <Section title="Past Sessions" empty={data.past.length === 0 ? 'No past sessions' : undefined}>
              {data.past.map((s) => card(s, 'past'))}
            </Section>

          </div>
        </div>
      )}

      {toCancel && <ConfirmCancelModal busy={busy === 'cancel'} onClose={closeCancel} onConfirm={confirmCancel} />}
      {alertMsg && <ErrorModal message={alertMsg} onClose={() => setAlertMsg(null)} />}
    </div>
  );
};

export default CoachDashboardPage;
