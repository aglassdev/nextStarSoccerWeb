import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { isEventCancelled } from '@/services/googleCalendar';
import type { ParentChild } from '@/services/clinicRegistration';
import { useAccount } from './AccountContext';
import { AccountPageHeader, AccountSpinner } from './AccountLayout';
import SessionsCalendar from './schedule/SessionsCalendar';
import { ChildSelectionModal, ConfirmCancelModal, ErrorModal, EventDetailsModal } from './schedule/ScheduleModals';
import {
  ScheduleData,
  ScheduleEvent,
  calculateStreak,
  cancelChildSignups,
  cancelOwnSignup,
  fetchSchedule,
  formatCardDateTime,
  keyToLocalDate,
  locationName,
  resolveFamily,
  sessionsByDay,
  todayKey,
} from './schedule/scheduleData';

// My Schedule — the app's "My Sessions" screen: a sessions calendar, your
// stats, then Ongoing / Upcoming / Past sessions. On a wide screen the
// calendar and stats sit in a column beside the sessions, which lay out two
// to a row; on a phone it stacks exactly like the app.

const LOAD_ERROR = 'Failed to load your schedule. Please check your internet connection and try again.';

// The app keeps the last schedule so the screen opens populated, then
// refreshes it. Same here, per account, in this browser.
const cacheKey = (uid: string) => `nss.mySchedule.v1.${uid}`;
const readCache = (uid?: string): ScheduleData | null => {
  if (!uid) return null;
  try {
    const raw = localStorage.getItem(cacheKey(uid));
    return raw ? (JSON.parse(raw) as ScheduleData) : null;
  } catch {
    return null;
  }
};
const writeCache = (uid: string, data: ScheduleData) => {
  try {
    localStorage.setItem(cacheKey(uid), JSON.stringify(data));
  } catch {
    /* storage unavailable */
  }
};

const EventCard = ({
  event,
  kind,
  players,
  onOpen,
  onCancel,
}: {
  event: ScheduleEvent;
  kind: 'ongoing' | 'upcoming' | 'past';
  players: string[];
  onOpen: () => void;
  onCancel: () => void;
}) => {
  const { date, time } = formatCardDateTime(event);
  const where = locationName(event.location);
  const cancelled = isEventCancelled(event);
  // Cancel only for an upcoming, not-prepaid session nobody has checked into.
  const showCancel = kind === 'upcoming' && event.signupType !== 'prepaid' && !event.hasCheckin && !cancelled;
  const showPrepaid = (kind === 'upcoming' || kind === 'ongoing') && event.signupType === 'prepaid' && !showCancel;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onOpen();
        }
      }}
      className="relative overflow-hidden min-h-[90px] lg:min-h-[112px] flex items-center gap-4 px-4 py-4 lg:px-6 lg:py-5 bg-[#111] border border-[#222] rounded-[14px] lg:rounded-2xl cursor-pointer hover:border-[#3a3a3a] active:opacity-70 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
    >
      <div className="flex-1 min-w-0">
        <p className="text-white text-lg lg:text-xl font-bold leading-snug line-clamp-2 mb-1">{event.title}</p>
        <p className="text-[#9ca3af] text-base mb-1">
          {date} | {time}
        </p>
        {where && <p className="text-[#9ca3af] text-base truncate mb-1">{where}</p>}
        {players.length > 0 && <p className="text-white text-base font-bold mt-2">{players.join(', ')}</p>}
      </div>

      {showCancel && (
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
      {showPrepaid && <span className="flex-shrink-0 pr-2 text-[#666] text-base italic">Prepaid</span>}

      {cancelled && (
        <div className="absolute top-[35px] inset-x-0 bg-[#DC2626] py-2.5 text-center text-white text-lg font-bold tracking-[2px]">CANCELLED</div>
      )}
    </div>
  );
};

const Section = ({
  title,
  count,
  bold,
  empty,
  children,
}: {
  title: string;
  count?: number;
  bold?: boolean;
  empty?: string;
  children?: React.ReactNode;
}) => (
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

const AccountSchedulePage = () => {
  const { user } = useAuth();
  const account = useAccount();
  const uid = user?.$id;

  const [data, setData] = useState<ScheduleData | null>(() => readCache(uid));
  const [family, setFamily] = useState<{ isParent: boolean; children: ParentChild[] } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [month, setMonth] = useState(() => {
    const t = keyToLocalDate(todayKey());
    return new Date(t.getFullYear(), t.getMonth(), 1);
  });
  const [detail, setDetail] = useState<ScheduleEvent | null>(null);
  const [toCancel, setToCancel] = useState<{ eventId: string; title: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [alertMsg, setAlertMsg] = useState<string | null>(null);
  const fetching = useRef(false);

  // Until the family check finishes, go by the account type.
  const isParent = family ? family.isParent : account.userType === 'parent';
  const children = family ? family.children : account.children;

  const load = useCallback(async () => {
    if (!uid || account.loading || fetching.current) return;
    fetching.current = true;
    try {
      const fam = await resolveFamily(uid, account.userType, account.children);
      setFamily(fam);
      const fresh = await fetchSchedule(uid, fam.isParent, fam.children);
      setData(fresh);
      writeCache(uid, fresh);
      setLoadError('');
    } catch (e) {
      console.error('My Schedule failed to load:', e);
      setLoadError(LOAD_ERROR);
      setData((d) => d ?? { upcoming: [], ongoing: [], past: [], childNames: {}, childSignupIds: {} });
    } finally {
      fetching.current = false;
      setRefreshing(false);
    }
  }, [uid, account.loading, account.userType, account.children]);

  useEffect(() => {
    setData((d) => d ?? readCache(uid));
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

  const confirmOwnCancel = async () => {
    if (!toCancel || !uid) return;
    setBusy(true);
    try {
      await cancelOwnSignup(toCancel.eventId, uid);
      setToCancel(null);
      load();
    } catch (e) {
      console.error('Cancel failed:', e);
      setToCancel(null);
      setAlertMsg('Failed to cancel your registration. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const confirmChildCancel = async (ids: string[]) => {
    if (!toCancel || !uid) return;
    setBusy(true);
    try {
      await cancelChildSignups(toCancel.eventId, ids, children, uid);
      setToCancel(null);
      load();
    } catch (e) {
      console.error('Cancel failed:', e);
      setToCancel(null);
      setAlertMsg('Failed to cancel registration. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const dots = useMemo(() => (data ? sessionsByDay([...data.upcoming, ...data.ongoing, ...data.past]) : new Map<string, number>()), [data]);
  const streak = useMemo(() => (data ? calculateStreak(data.past) : { streak: 0, active: false }), [data]);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-24">
        <p className="text-white text-lg mb-4">Please log in to view your schedule</p>
        <Link to="/signin" className="bg-[#F4F2EE] hover:bg-white text-black text-lg font-bold px-6 py-3 rounded-lg">
          Log In
        </Link>
      </div>
    );
  }

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

  const card = (e: ScheduleEvent, kind: 'ongoing' | 'upcoming' | 'past') => (
    <EventCard
      key={e.signupId}
      event={e}
      kind={kind}
      players={isParent ? data?.childNames[e.id] || [] : []}
      onOpen={() => setDetail(e)}
      onCancel={() => setToCancel({ eventId: e.id, title: e.title })}
    />
  );

  return (
    <div>
      <AccountPageHeader title="My Sessions" right={data ? refreshButton : undefined} />

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
                {data.ongoing.map((e) => card(e, 'ongoing'))}
              </Section>
            )}

            <Section title="Upcoming Sessions" empty={data.upcoming.length === 0 ? 'No upcoming events' : undefined}>
              {data.upcoming.map((e) => card(e, 'upcoming'))}
            </Section>

            <Section title="Past Sessions" empty={data.past.length === 0 ? 'No past sessions' : undefined}>
              {data.past.map((e) => card(e, 'past'))}
            </Section>
          </div>
        </div>
      )}

      {detail && (
        <EventDetailsModal event={detail} players={isParent ? data?.childNames[detail.id] || [] : []} onClose={() => setDetail(null)} />
      )}

      {toCancel && !isParent && <ConfirmCancelModal busy={busy} onClose={closeCancel} onConfirm={confirmOwnCancel} />}

      {toCancel && isParent && (
        <ChildSelectionModal
          players={children}
          initialSelected={data?.childSignupIds[toCancel.eventId] || []}
          busy={busy}
          onClose={closeCancel}
          onConfirm={confirmChildCancel}
        />
      )}

      {alertMsg && <ErrorModal message={alertMsg} onClose={() => setAlertMsg(null)} />}
    </div>
  );
};

export default AccountSchedulePage;
