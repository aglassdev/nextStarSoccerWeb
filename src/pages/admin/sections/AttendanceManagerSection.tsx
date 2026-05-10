import { useState, useEffect, useMemo } from 'react';
import { Query, ID } from 'appwrite';
import { databases, databaseId, collections } from '../../../services/appwrite';
import { googleCalendarService, CalendarEvent, isEventCancelled } from '../../../services/googleCalendar';

type CalType = 'public' | 'private';

interface PlayerSearchResult {
  $id: string;
  userId: string;
  firstName: string;
  lastName: string;
  type: 'Youth' | 'Collegiate' | 'Professional';
}

interface CheckinDoc {
  $id: string;
  userId?: string;
  firstName?: string;
  lastName?: string;
  checkinTime?: string;
  $createdAt?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatTime(dt: string, dateOnly?: boolean) {
  if (dateOnly) return 'All Day';
  return new Date(dt).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York',
  });
}
function formatDate(dt: string) {
  return new Date(dt).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/New_York',
  });
}
function formatFullDate(dt: string) {
  return new Date(dt).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York',
  });
}

// ── Event card grid ──────────────────────────────────────────────────────────
function EventCard({ event, onClick }: { event: CalendarEvent & { calendarType: CalType }; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-left bg-[#0e0e0e] border border-[#1c1c1c] hover:border-white/25 rounded-xl px-4 py-3 transition-colors w-full"
    >
      <p className="text-white text-sm font-medium truncate">{event.title}</p>
      <p className="text-gray-500 text-xs mt-0.5">
        {formatDate(event.startDateTime)} · {formatTime(event.startDateTime, event.dateOnly)}
      </p>
      {event.location && <p className="text-gray-600 text-xs truncate mt-0.5">{event.location}</p>}
    </button>
  );
}

// ── Event detail view (with attending list + add player search) ─────────────
function EventDetailView({
  event,
  calType,
  onBack,
  onFeedback,
}: {
  event: CalendarEvent;
  calType: CalType;
  onBack: () => void;
  onFeedback: (msg: string, isError?: boolean) => void;
}) {
  const [checkins, setCheckins] = useState<CheckinDoc[]>([]);
  const [loadingCheckins, setLoadingCheckins] = useState(true);
  const [allPlayers, setAllPlayers] = useState<PlayerSearchResult[]>([]);
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState<string | null>(null);

  // Load checkins for this event
  const reloadCheckins = async () => {
    setLoadingCheckins(true);
    try {
      if (!collections.checkins) { setCheckins([]); return; }
      const res = await databases.listDocuments(databaseId, collections.checkins, [
        Query.equal('eventID', event.id), Query.limit(500),
      ]);
      setCheckins(res.documents as any);
    } catch { setCheckins([]); }
    finally { setLoadingCheckins(false); }
  };

  useEffect(() => {
    reloadCheckins();
    // Load all players once for search
    (async () => {
      try {
        const [yRes, cRes, pRes] = await Promise.all([
          collections.youthPlayers
            ? databases.listDocuments(databaseId, collections.youthPlayers, [Query.limit(2000)]).catch(() => ({ documents: [] }))
            : { documents: [] },
          collections.collegiatePlayers
            ? databases.listDocuments(databaseId, collections.collegiatePlayers, [Query.limit(2000)]).catch(() => ({ documents: [] }))
            : { documents: [] },
          collections.professionalPlayers
            ? databases.listDocuments(databaseId, collections.professionalPlayers, [Query.limit(2000)]).catch(() => ({ documents: [] }))
            : { documents: [] },
        ]);
        const players: PlayerSearchResult[] = [
          ...((yRes as any).documents).map((d: any) => ({
            $id: d.$id, userId: d.userId || d.$id, firstName: d.firstName || '', lastName: d.lastName || '', type: 'Youth' as const,
          })),
          ...((cRes as any).documents).map((d: any) => ({
            $id: d.$id, userId: d.userId || d.$id, firstName: d.firstName || '', lastName: d.lastName || '', type: 'Collegiate' as const,
          })),
          ...((pRes as any).documents).map((d: any) => ({
            $id: d.$id, userId: d.userId || d.$id, firstName: d.firstName || '', lastName: d.lastName || '', type: 'Professional' as const,
          })),
        ];
        setAllPlayers(players);
      } catch { /* ignore */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id]);

  const checkedInUserIds = useMemo(
    () => new Set(checkins.map(c => c.userId).filter(Boolean) as string[]),
    [checkins],
  );

  const filteredPlayers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 2) return [];
    return allPlayers
      .filter(p => `${p.firstName} ${p.lastName}`.toLowerCase().includes(q))
      .filter(p => !checkedInUserIds.has(p.userId))
      .sort((a, b) => {
        const an = `${a.firstName} ${a.lastName}`.toLowerCase();
        const bn = `${b.firstName} ${b.lastName}`.toLowerCase();
        const aS = an.startsWith(q), bS = bn.startsWith(q);
        if (aS && !bS) return -1;
        if (!aS && bS) return 1;
        return an.localeCompare(bn);
      })
      .slice(0, 12);
  }, [allPlayers, search, checkedInUserIds]);

  // Add a player to attendance: create signup + checkin docs (no notifications)
  const handleAddPlayer = async (p: PlayerSearchResult) => {
    setAdding(p.$id);
    try {
      const eventDateISO = event.startDateTime;
      // Signup (skip if duplicate)
      if (collections.signups) {
        try {
          const existing = await databases.listDocuments(databaseId, collections.signups, [
            Query.equal('eventID', event.id), Query.equal('userId', p.userId), Query.limit(1),
          ]);
          if (existing.documents.length === 0) {
            await databases.createDocument(databaseId, collections.signups, ID.unique(), {
              eventID: event.id,
              eventTitle: event.title,
              eventDate: eventDateISO,
              userId: p.userId,
              firstName: p.firstName,
              lastName: p.lastName,
              type: 'bill',
              isProxySignup: false,
            });
          }
        } catch (e) { console.error('Signup create failed:', e); }
      }
      // Checkin (skip if duplicate)
      if (collections.checkins) {
        try {
          const existing = await databases.listDocuments(databaseId, collections.checkins, [
            Query.equal('eventID', event.id), Query.equal('userId', p.userId), Query.limit(1),
          ]);
          if (existing.documents.length === 0) {
            await databases.createDocument(databaseId, collections.checkins, ID.unique(), {
              eventID: event.id,
              eventTitle: event.title,
              eventDate: eventDateISO,
              userId: p.userId,
              firstName: p.firstName,
              lastName: p.lastName,
              type: 'bill',
              calendarSource: calType,
              isProxyCheckin: false,
            });
          }
        } catch (e) { console.error('Checkin create failed:', e); }
      }
      onFeedback(`${p.firstName} ${p.lastName} added (no notification sent).`);
      setSearch('');
      reloadCheckins();
    } catch (e: any) {
      onFeedback(e.message || 'Failed to add player', true);
    } finally {
      setAdding(null);
    }
  };

  const handleRemoveCheckin = async (c: CheckinDoc) => {
    if (!confirm(`Remove ${c.firstName ?? ''} ${c.lastName ?? ''} from attendance?`)) return;
    try {
      if (collections.checkins) {
        await databases.deleteDocument(databaseId, collections.checkins, c.$id);
      }
      onFeedback('Player removed from attendance.');
      reloadCheckins();
    } catch (e: any) {
      onFeedback(e.message || 'Failed to remove', true);
    }
  };

  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-4 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
        </svg>
        Back to events
      </button>

      <div className="grid grid-cols-2 gap-4 max-w-5xl">
        {/* Event Details */}
        <div className="bg-[#1d1c21] border border-white/[0.08] rounded-xl p-5">
          <p className="text-white/50 text-[11px] font-medium tracking-widest uppercase mb-4">Event Details</p>
          <div className="space-y-3">
            <div>
              <p className="text-white/40 text-[10px] uppercase tracking-wider mb-0.5">Title</p>
              <p className="text-white text-sm">{event.title}</p>
            </div>
            <div>
              <p className="text-white/40 text-[10px] uppercase tracking-wider mb-0.5">Date</p>
              <p className="text-white text-sm">{formatFullDate(event.startDateTime)}</p>
            </div>
            <div>
              <p className="text-white/40 text-[10px] uppercase tracking-wider mb-0.5">Time</p>
              <p className="text-white text-sm">
                {event.dateOnly ? 'All Day' : `${formatTime(event.startDateTime)} – ${formatTime(event.endDateTime)}`}
              </p>
            </div>
            {event.location && (
              <div>
                <p className="text-white/40 text-[10px] uppercase tracking-wider mb-0.5">Location</p>
                <p className="text-white text-sm">{event.location}</p>
              </div>
            )}
            <div>
              <p className="text-white/40 text-[10px] uppercase tracking-wider mb-0.5">Calendar</p>
              <p className="text-white text-sm capitalize">{calType}</p>
            </div>
            {event.description && (
              <div>
                <p className="text-white/40 text-[10px] uppercase tracking-wider mb-0.5">Description</p>
                <p className="text-white text-sm whitespace-pre-wrap">{event.description}</p>
              </div>
            )}
          </div>
        </div>

        {/* Attending Players */}
        <div className="bg-[#1d1c21] border border-white/[0.08] rounded-xl p-5">
          <p className="text-white/50 text-[11px] font-medium tracking-widest uppercase mb-4">
            Attending Players · {checkins.length}
          </p>

          {/* Player search */}
          <div className="relative mb-4">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search a player to add…"
              className="w-full px-3 py-2 bg-white/[0.04] border border-white/[0.10] rounded-lg text-white text-sm placeholder-white/25 focus:outline-none focus:border-white/30 transition-colors"
            />
            {filteredPlayers.length > 0 && (
              <div className="absolute z-20 left-0 right-0 mt-1 bg-[#111] border border-white/[0.10] rounded-lg shadow-xl max-h-60 overflow-y-auto divide-y divide-white/[0.05]">
                {filteredPlayers.map(p => (
                  <button
                    key={p.$id}
                    onClick={() => handleAddPlayer(p)}
                    disabled={adding === p.$id}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-white/[0.04] transition-colors disabled:opacity-50"
                  >
                    <span className="text-white">{p.firstName} {p.lastName}</span>
                    <span className="text-[10px] text-white/40 uppercase tracking-wider">
                      {adding === p.$id ? 'adding…' : p.type}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {search.trim().length >= 2 && filteredPlayers.length === 0 && (
              <p className="text-white/30 text-xs mt-2">No matching players (or already attending)</p>
            )}
          </div>

          {/* List of checked-in players */}
          {loadingCheckins ? (
            <div className="flex items-center justify-center h-20">
              <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
          ) : checkins.length === 0 ? (
            <p className="text-white/30 text-sm text-center py-4">No players have checked in yet.</p>
          ) : (
            <div className="space-y-1 max-h-[400px] overflow-y-auto">
              {checkins.map(c => {
                const name = `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || c.userId || 'Unknown';
                return (
                  <div
                    key={c.$id}
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.05]"
                  >
                    <div className="min-w-0">
                      <p className="text-white text-sm truncate">{name}</p>
                      {(c.checkinTime || c.$createdAt) && (
                        <p className="text-white/40 text-[10px]">
                          checked in {formatTime(c.checkinTime || c.$createdAt!)}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveCheckin(c)}
                      className="p-1 text-white/30 hover:text-red-400 transition-colors flex-shrink-0"
                      title="Remove"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main section ─────────────────────────────────────────────────────────────
const AttendanceManagerSection = () => {
  const [publicEvents, setPublicEvents] = useState<CalendarEvent[]>([]);
  const [privateEvents, setPrivateEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<{ event: CalendarEvent; calType: CalType } | null>(null);

  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const showFeedback = (msg: string, isError = false) => {
    if (isError) { setErrorMsg(msg); setSuccessMsg(''); }
    else { setSuccessMsg(msg); setErrorMsg(''); }
    setTimeout(() => { setSuccessMsg(''); setErrorMsg(''); }, 4000);
  };

  // Load events from current month + previous month + next month for both calendars
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const now = new Date();
        const yr = now.getFullYear();
        const mo = now.getMonth();
        const ranges = [
          { y: mo === 0 ? yr - 1 : yr, m: mo === 0 ? 11 : mo - 1 },
          { y: yr, m: mo },
          { y: mo === 11 ? yr + 1 : yr, m: mo === 11 ? 0 : mo + 1 },
        ];
        const fetchAll = (type: CalType) =>
          Promise.all(ranges.map(r => googleCalendarService.getEventsForMonth(r.y, r.m, type).catch(() => [])))
            .then(arrs => arrs.flat());
        const [pub, priv] = await Promise.all([fetchAll('public'), fetchAll('private')]);

        // Dedupe by id, filter cancelled, sort by date desc (most recent first)
        const dedup = (arr: CalendarEvent[]) => {
          const map = new Map<string, CalendarEvent>();
          for (const e of arr) if (!isEventCancelled(e)) map.set(e.id, e);
          return Array.from(map.values()).sort(
            (a, b) => Date.parse(b.startDateTime) - Date.parse(a.startDateTime)
          );
        };
        setPublicEvents(dedup(pub));
        setPrivateEvents(dedup(priv));
      } finally { setLoading(false); }
    })();
  }, []);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-white mb-6">Attendance Manager</h2>

      {successMsg && (
        <div className="mb-4 px-4 py-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm">{successMsg}</div>
      )}
      {errorMsg && (
        <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{errorMsg}</div>
      )}

      {selected ? (
        <EventDetailView
          event={selected.event}
          calType={selected.calType}
          onBack={() => setSelected(null)}
          onFeedback={showFeedback}
        />
      ) : loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Public row */}
          <section>
            <div className="flex items-baseline gap-3 mb-3">
              <h3 className="text-white text-base font-semibold">Public Sessions</h3>
              <span className="text-white/30 text-xs">{publicEvents.length} session{publicEvents.length !== 1 ? 's' : ''}</span>
            </div>
            {publicEvents.length === 0 ? (
              <p className="text-white/25 text-sm">No public sessions found.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {publicEvents.map(ev => (
                  <EventCard
                    key={ev.id}
                    event={{ ...ev, calendarType: 'public' }}
                    onClick={() => setSelected({ event: ev, calType: 'public' })}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Private row */}
          <section>
            <div className="flex items-baseline gap-3 mb-3">
              <h3 className="text-white text-base font-semibold">Private Sessions</h3>
              <span className="text-white/30 text-xs">{privateEvents.length} session{privateEvents.length !== 1 ? 's' : ''}</span>
            </div>
            {privateEvents.length === 0 ? (
              <p className="text-white/25 text-sm">No private sessions found.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {privateEvents.map(ev => (
                  <EventCard
                    key={ev.id}
                    event={{ ...ev, calendarType: 'private' }}
                    onClick={() => setSelected({ event: ev, calType: 'private' })}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
};

export default AttendanceManagerSection;
