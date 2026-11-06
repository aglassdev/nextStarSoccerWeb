import { useCallback, useEffect, useMemo, useState } from 'react';
import { ID, Query } from 'appwrite';
import { useAuth } from '../../contexts/AuthContext';
import { databases, databaseId, collections } from '../../services/appwrite';
import { googleCalendarService, CalendarEvent } from '../../services/googleCalendar';
import { useAccount } from '../account/AccountContext';

// Sessions, as on the app's Coach Dashboard: the coach's own sessions (cancel,
// check in when it's on), and open group sessions to sign up for. Same
// records and rules as the app (coach_signups with the head-coach rule, a
// check-in reminder, coach_checkins). Taking player attendance stays in the app.

const NOTIFICATIONS = 'notifications_scheduled';
const COACH_CHECKIN_REMINDER = 'coach_checkin_reminder';
const HEAD_COACHES = ['Paul Torres', 'Philip Gyau'];
const CHECKIN_EARLY_MS = 30 * 60 * 1000;

interface CoachSignup {
  $id: string;
  eventID: string;
  eventTitle: string;
  eventDate: string;
  coaches?: string[];
  isHeadCoach?: boolean;
}

const estDate = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });
const fmtDay = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

const CoachSessionsPage = () => {
  const { user } = useAuth();
  const { profile } = useAccount();
  const myName = (user?.name || `${profile?.firstName || ''} ${profile?.lastName || ''}`).trim();

  const [mine, setMine] = useState<CoachSignup[] | null>(null);
  const [checkedIn, setCheckedIn] = useState<Set<string>>(new Set());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [coachCounts, setCoachCounts] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [signups, checkins] = await Promise.all([
        databases.listDocuments(databaseId, collections.coachSignups, [
          Query.equal('coachUserId', user.$id), Query.orderDesc('eventDate'), Query.limit(200),
        ]),
        databases.listDocuments(databaseId, collections.coachCheckins, [
          Query.equal('coachUserId', user.$id), Query.orderDesc('$createdAt'), Query.limit(200),
        ]),
      ]);
      setMine(signups.documents as any);
      setCheckedIn(new Set((checkins.documents as any[]).map((c) => c.eventID)));

      const now = new Date();
      const months = [0, 1].map((i) => new Date(now.getFullYear(), now.getMonth() + i, 1));
      const lists = await Promise.all(months.map((d) => googleCalendarService.getEventsForMonth(d.getFullYear(), d.getMonth(), 'public').catch(() => [])));
      const horizon = Date.now() + 28 * 86400000;
      const upcoming = lists.flat()
        .filter((e) => Date.parse(e.endDateTime) > Date.now() && Date.parse(e.startDateTime) < horizon)
        .filter((e) => !/cancel/i.test(`${e.title} ${e.description || ''}`))
        .sort((a, b) => Date.parse(a.startDateTime) - Date.parse(b.startDateTime));
      setEvents(upcoming);
      if (upcoming.length) {
        const all = await databases.listDocuments(databaseId, collections.coachSignups, [
          Query.equal('eventID', upcoming.map((e) => e.id).slice(0, 100)), Query.limit(1000),
        ]);
        const counts: Record<string, number> = {};
        for (const s of all.documents as any[]) counts[s.eventID] = (counts[s.eventID] || 0) + 1;
        setCoachCounts(counts);
      }
    } catch (e: any) {
      setError(e?.message || 'Could not load sessions.');
      setMine((m) => m || []);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const eventById = useMemo(() => Object.fromEntries(events.map((e) => [e.id, e])), [events]);
  const mySignedIds = useMemo(() => new Set((mine || []).map((s) => s.eventID)), [mine]);
  const today = estDate(new Date().toISOString());
  const myUpcoming = (mine || []).filter((s) => s.eventDate >= today).sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  const myPast = (mine || []).filter((s) => s.eventDate < today).slice(0, 12);
  const open = events.filter((e) => !mySignedIds.has(e.id));

  /** The app's rule: Paul or Philip are head coach; otherwise the first coach is, until they sign up. */
  const createSignup = async (ev: { id: string; title: string; startDateTime: string }) => {
    const existing = await databases.listDocuments(databaseId, collections.coachSignups, [Query.equal('eventID', ev.id), Query.limit(1000)]);
    const headSignedUp = (existing.documents as any[]).some((d) => (d.coaches || []).some((c: string) => HEAD_COACHES.includes(c)));
    const isHead = HEAD_COACHES.includes(myName);
    if (isHead) {
      for (const d of existing.documents) {
        await databases.updateDocument(databaseId, collections.coachSignups, d.$id, { isHeadCoach: false });
      }
    }
    return databases.createDocument(databaseId, collections.coachSignups, ID.unique(), {
      eventID: ev.id,
      eventTitle: ev.title,
      eventDate: estDate(ev.startDateTime),
      coachUserId: user!.$id,
      coaches: [myName],
      isHeadCoach: isHead || !headSignedUp,
    });
  };

  const signUp = async (ev: CalendarEvent) => {
    if (!user) return;
    setBusy(ev.id);
    setError('');
    try {
      const doc = await createSignup(ev);
      // Reminder to take attendance when the session starts (as in the app).
      if (Date.parse(ev.startDateTime) > Date.now()) {
        const pending = await databases.listDocuments(databaseId, NOTIFICATIONS, [
          Query.equal('eventId', ev.id), Query.equal('notificationType', COACH_CHECKIN_REMINDER), Query.limit(50),
        ]).catch(() => ({ documents: [] as any[] }));
        if (!(pending.documents as any[]).some((d) => (d.userIds || []).includes(user.$id))) {
          await databases.createDocument(databaseId, NOTIFICATIONS, ID.unique(), {
            signupId: doc.$id,
            userIds: [user.$id],
            eventId: ev.id,
            eventTitle: ev.title || 'Event',
            eventDate: ev.startDateTime,
            eventType: 'coach',
            notificationType: COACH_CHECKIN_REMINDER,
            sendAt: new Date(ev.startDateTime).toISOString(),
            title: 'Check-ins are open',
            body: `${ev.title || 'Your session'} is starting — take attendance now.`,
            screen: 'CoachEventDashboard',
            status: 'pending',
            createdAt: new Date().toISOString(),
          }).catch(() => {});
        }
      }
      await load();
    } catch (e: any) {
      setError(e?.message || 'Could not sign up.');
    } finally {
      setBusy('');
    }
  };

  const cancel = async (s: CoachSignup) => {
    if (!user || !confirm(`Cancel coaching ${s.eventTitle}?`)) return;
    setBusy(s.eventID);
    try {
      const rows = await databases.listDocuments(databaseId, collections.coachSignups, [
        Query.equal('eventID', s.eventID), Query.equal('coachUserId', user.$id), Query.limit(20),
      ]);
      for (const d of rows.documents) await databases.deleteDocument(databaseId, collections.coachSignups, d.$id);
      const reminders = await databases.listDocuments(databaseId, NOTIFICATIONS, [
        Query.equal('eventId', s.eventID), Query.equal('notificationType', COACH_CHECKIN_REMINDER), Query.limit(50),
      ]).catch(() => ({ documents: [] as any[] }));
      for (const d of reminders.documents as any[]) {
        if (d.status === 'pending' && (d.userIds || []).includes(user.$id)) {
          await databases.deleteDocument(databaseId, NOTIFICATIONS, d.$id).catch(() => {});
        }
      }
      await load();
    } catch (e: any) {
      setError(e?.message || 'Could not cancel.');
    } finally {
      setBusy('');
    }
  };

  const checkIn = async (s: CoachSignup) => {
    if (!user) return;
    setBusy(s.eventID);
    try {
      const existing = await databases.listDocuments(databaseId, collections.coachCheckins, [
        Query.equal('eventID', s.eventID), Query.equal('coachUserId', user.$id), Query.limit(1),
      ]);
      if (existing.documents.length === 0) {
        await databases.createDocument(databaseId, collections.coachCheckins, ID.unique(), {
          eventID: s.eventID,
          eventTitle: s.eventTitle || 'Untitled Event',
          eventDate: s.eventDate,
          coachUserId: user.$id,
          coaches: [myName],
        });
      }
      setCheckedIn((prev) => new Set(prev).add(s.eventID));
    } catch (e: any) {
      setError(e?.message || 'Could not check in.');
    } finally {
      setBusy('');
    }
  };

  /** Check-in opens 30 minutes before a session and stays open until it ends. */
  const canCheckIn = (s: CoachSignup) => {
    const ev = eventById[s.eventID];
    if (!ev) return s.eventDate === today;
    const now = Date.now();
    return now >= Date.parse(ev.startDateTime) - CHECKIN_EARLY_MS && now <= Date.parse(ev.endDateTime);
  };

  if (mine === null) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-8 h-8 border-2 border-white/40 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const Row = ({ children }: { children: React.ReactNode }) => (
    <div className="bg-[#111] border border-white/10 rounded-xl p-4 flex items-center justify-between gap-4">{children}</div>
  );

  return (
    <div className="space-y-8">
      {error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>}

      <section>
        <h3 className="text-white font-semibold text-lg mb-3">Your sessions</h3>
        {myUpcoming.length === 0 ? (
          <p className="text-gray-500 text-sm">You're not signed up for any upcoming sessions.</p>
        ) : (
          <div className="space-y-2">
            {myUpcoming.map((s) => {
              const ev = eventById[s.eventID];
              const isIn = checkedIn.has(s.eventID);
              return (
                <Row key={s.$id}>
                  <div className="min-w-0">
                    <p className="text-white font-medium truncate">
                      {s.eventTitle}
                      {s.isHeadCoach && <span className="ml-2 text-[11px] text-gray-400 font-normal">Head coach</span>}
                    </p>
                    <p className="text-gray-500 text-xs mt-0.5">{ev ? fmtWhen(ev.startDateTime) : fmtDay(s.eventDate)}{ev?.location ? ` · ${ev.location}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isIn ? (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-green-500/20 text-green-400 border border-green-500/30">Checked in</span>
                    ) : canCheckIn(s) ? (
                      <button onClick={() => checkIn(s)} disabled={busy === s.eventID}
                        className="px-4 py-1.5 bg-white text-black text-sm font-semibold rounded-lg disabled:opacity-40">Check in</button>
                    ) : null}
                    {!isIn && (
                      <button onClick={() => cancel(s)} disabled={busy === s.eventID}
                        className="px-3 py-1.5 text-sm text-gray-400 hover:text-white border border-white/10 hover:border-white/30 rounded-lg disabled:opacity-40">Cancel</button>
                    )}
                  </div>
                </Row>
              );
            })}
          </div>
        )}
        <p className="text-gray-600 text-xs mt-3">Player check-ins and walk-ins are taken in the app during the session.</p>
      </section>

      <section>
        <h3 className="text-white font-semibold text-lg mb-3">Sign up to coach</h3>
        {open.length === 0 ? (
          <p className="text-gray-500 text-sm">No open group sessions in the next four weeks.</p>
        ) : (
          <div className="space-y-2">
            {open.map((ev) => (
              <Row key={ev.id}>
                <div className="min-w-0">
                  <p className="text-white font-medium truncate">{ev.title}</p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {fmtWhen(ev.startDateTime)}{ev.location ? ` · ${ev.location}` : ''} · {coachCounts[ev.id] || 0} coach{coachCounts[ev.id] === 1 ? '' : 'es'}
                  </p>
                </div>
                <button onClick={() => signUp(ev)} disabled={busy === ev.id}
                  className="px-4 py-1.5 bg-white text-black text-sm font-semibold rounded-lg flex-shrink-0 disabled:opacity-40">
                  {busy === ev.id ? 'Signing up…' : 'Sign up'}
                </button>
              </Row>
            ))}
          </div>
        )}
      </section>

      {myPast.length > 0 && (
        <section>
          <h3 className="text-white font-semibold text-lg mb-3">Past sessions</h3>
          <div className="space-y-2">
            {myPast.map((s) => (
              <Row key={s.$id}>
                <div className="min-w-0">
                  <p className="text-white/80 truncate">{s.eventTitle}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{fmtDay(s.eventDate)}</p>
                </div>
                <span className={`text-xs flex-shrink-0 ${checkedIn.has(s.eventID) ? 'text-green-400' : 'text-gray-600'}`}>
                  {checkedIn.has(s.eventID) ? 'Checked in' : 'No check-in'}
                </span>
              </Row>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default CoachSessionsPage;
