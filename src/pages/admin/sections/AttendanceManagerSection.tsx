import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Query, ID } from 'appwrite';
import { databases, databaseId, collections } from '../../../services/appwrite';
import { useAuth } from '../../../contexts/AuthContext';
import { googleCalendarService, CalendarEvent, isEventCancelled } from '../../../services/googleCalendar';

type CalType = 'public' | 'private';

interface PlayerSearchResult {
  $id: string;
  userId: string;
  firstName: string;
  lastName: string;
  type: 'Youth' | 'Collegiate' | 'Professional';
  isProxy?: boolean;
}

interface AttendeeDoc {
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

interface SessionNoteDoc {
  $id: string;
  content: string;
  eventID?: string;
  sessionDate?: string;
  sessionTime?: string;
  coachUserId?: string;
  coachName?: string;
  $updatedAt?: string;
}

// ── Session Notes Panel ───────────────────────────────────────────────────────
function SessionNotesPanel({ eventId, eventDate, eventTime, currentUserId, currentUserName }: {
  eventId: string;
  eventDate: string;
  eventTime: string;
  currentUserId?: string;
  currentUserName?: string;
}) {
  const [note, setNote] = useState<SessionNoteDoc | null>(null);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        if (!collections.sessionNotes) { setLoading(false); return; }
        const res = await databases.listDocuments(databaseId, collections.sessionNotes, [
          Query.equal('eventID', eventId), Query.limit(1),
        ]);
        if (res.documents.length > 0) {
          const doc = res.documents[0] as any as SessionNoteDoc;
          setNote(doc);
          setContent(doc.content);
        }
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, [eventId]);

  const handleSave = async () => {
    if (!content.trim()) return;
    setSaving(true);
    try {
      const payload = {
        content: content.trim(),
        eventID: eventId,
        sessionDate: eventDate,
        sessionTime: eventTime,
        coachUserId: currentUserId || '',
        coachName: currentUserName || '',
      };
      let updated: any;
      if (note) {
        updated = await databases.updateDocument(databaseId, collections.sessionNotes!, note.$id, payload);
      } else {
        updated = await databases.createDocument(databaseId, collections.sessionNotes!, ID.unique(), payload);
      }
      setNote(updated as SessionNoteDoc);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const lastSaved = note?.$updatedAt
    ? new Date(note.$updatedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York' })
    : null;

  return (
    <div className="bg-[#1d1c21] border border-white/[0.08] rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-white/50 text-[11px] font-medium tracking-widest uppercase">Session Notes</p>
        <div className="flex items-center gap-3">
          {lastSaved && <span className="text-white/25 text-[10px]">Saved {lastSaved}{note?.coachName ? ` · ${note.coachName}` : ''}</span>}
          {saved && <span className="text-green-400 text-[10px]">Saved</span>}
        </div>
      </div>
      {loading ? (
        <div className="flex items-center justify-center h-20">
          <div className="w-4 h-4 border border-white/10 border-t-white/40 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder=""
            rows={5}
            className="w-full px-3 py-2.5 bg-white/[0.03] border border-white/[0.10] rounded-lg text-white text-sm placeholder-white/20 focus:outline-none focus:border-white/25 transition-colors resize-none leading-relaxed"
          />
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving || !content.trim()}
              className="px-4 py-1.5 bg-white/[0.08] hover:bg-white/[0.13] disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-white text-sm transition-colors"
            >
              {saving ? 'Saving…' : note ? 'Update Notes' : 'Save Notes'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Event detail view ─────────────────────────────────────────────────────────
function EventDetailView({
  event,
  calType,
  onBack,
  onFeedback,
  currentUserId,
  currentUserName,
}: {
  event: CalendarEvent;
  calType: CalType;
  onBack: () => void;
  onFeedback: (msg: string, isError?: boolean) => void;
  currentUserId?: string;
  currentUserName?: string;
}) {
  const [signups, setSignups] = useState<AttendeeDoc[]>([]);
  const [checkins, setCheckins] = useState<AttendeeDoc[]>([]);
  const [loadingSignups, setLoadingSignups] = useState(true);
  const [loadingCheckins, setLoadingCheckins] = useState(true);
  const [allPlayers, setAllPlayers] = useState<PlayerSearchResult[]>([]);
  const [search, setSearch] = useState('');
  const [listSearch, setListSearch] = useState('');
  const [adding, setAdding] = useState<string | null>(null);

  const reloadSignups = async () => {
    setLoadingSignups(true);
    try {
      if (!collections.signups) { setSignups([]); return; }
      const res = await databases.listDocuments(databaseId, collections.signups, [
        Query.equal('eventID', event.id), Query.limit(500),
      ]);
      setSignups(res.documents as any);
    } catch { setSignups([]); }
    finally { setLoadingSignups(false); }
  };

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
    reloadSignups();
    reloadCheckins();
    (async () => {
      try {
        const [yRes, cRes, pRes, proxyRes] = await Promise.all([
          collections.youthPlayers
            ? databases.listDocuments(databaseId, collections.youthPlayers, [Query.limit(2000)]).catch(() => ({ documents: [] }))
            : { documents: [] },
          collections.collegiatePlayers
            ? databases.listDocuments(databaseId, collections.collegiatePlayers, [Query.limit(2000)]).catch(() => ({ documents: [] }))
            : { documents: [] },
          collections.professionalPlayers
            ? databases.listDocuments(databaseId, collections.professionalPlayers, [Query.limit(2000)]).catch(() => ({ documents: [] }))
            : { documents: [] },
          collections.proxyChildren
            ? databases.listDocuments(databaseId, collections.proxyChildren, [Query.limit(2000)]).catch(() => ({ documents: [] }))
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
          ...((proxyRes as any).documents).map((d: any) => ({
            $id: d.$id, userId: d.$id, firstName: d.firstName || '', lastName: d.lastName || '', type: 'Youth' as const, isProxy: true,
          })),
        ];
        setAllPlayers(players);
      } catch { /* ignore */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id]);

  const signedUpUserIds = useMemo(
    () => new Set(signups.map(s => s.userId).filter(Boolean) as string[]),
    [signups],
  );

  const filteredPlayers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 2) return [];
    return allPlayers
      .filter(p => `${p.firstName} ${p.lastName}`.toLowerCase().includes(q))
      .filter(p => !signedUpUserIds.has(p.userId))
      .sort((a, b) => {
        const an = `${a.firstName} ${a.lastName}`.toLowerCase();
        const bn = `${b.firstName} ${b.lastName}`.toLowerCase();
        const aS = an.startsWith(q), bS = bn.startsWith(q);
        if (aS && !bS) return -1;
        if (!aS && bS) return 1;
        return an.localeCompare(bn);
      })
      .slice(0, 12);
  }, [allPlayers, search, signedUpUserIds]);

  const handleAddPlayer = async (p: PlayerSearchResult) => {
    setAdding(p.$id);
    try {
      const eventDateISO = event.startDateTime;
      if (collections.signups) {
        try {
          const existing = await databases.listDocuments(databaseId, collections.signups, [
            Query.equal('eventID', event.id), Query.equal('userId', p.userId), Query.limit(1),
          ]);
          if (existing.documents.length === 0) {
            await databases.createDocument(databaseId, collections.signups, ID.unique(), {
              eventID: event.id, eventTitle: event.title, eventDate: eventDateISO,
              userId: p.userId, firstName: p.firstName, lastName: p.lastName,
              type: 'bill', isProxySignup: p.isProxy === true,
            });
          }
        } catch (e) { console.error('Signup create failed:', e); }
      }
      if (collections.checkins) {
        try {
          const existing = await databases.listDocuments(databaseId, collections.checkins, [
            Query.equal('eventID', event.id), Query.equal('userId', p.userId), Query.limit(1),
          ]);
          if (existing.documents.length === 0) {
            await databases.createDocument(databaseId, collections.checkins, ID.unique(), {
              eventID: event.id, eventTitle: event.title, eventDate: eventDateISO,
              userId: p.userId, firstName: p.firstName, lastName: p.lastName,
              type: 'bill', calendarSource: calType, isProxyCheckin: p.isProxy === true,
            });
          }
        } catch (e) { console.error('Checkin create failed:', e); }
      }
      onFeedback(`${p.firstName} ${p.lastName} added.`);
      setSearch('');
      reloadSignups();
      reloadCheckins();
    } catch (e: any) {
      onFeedback(e.message || 'Failed to add player', true);
    } finally {
      setAdding(null);
    }
  };

  const handleRemoveSignup = async (s: AttendeeDoc) => {
    if (!confirm(`Remove ${s.firstName ?? ''} ${s.lastName ?? ''} from signups?`)) return;
    try {
      if (collections.signups) await databases.deleteDocument(databaseId, collections.signups, s.$id);
      onFeedback('Removed from signups.');
      reloadSignups();
    } catch (e: any) { onFeedback(e.message || 'Failed to remove', true); }
  };

  const handleRemoveCheckin = async (c: AttendeeDoc) => {
    if (!confirm(`Remove ${c.firstName ?? ''} ${c.lastName ?? ''} from check-ins?`)) return;
    try {
      if (collections.checkins) await databases.deleteDocument(databaseId, collections.checkins, c.$id);
      onFeedback('Removed from check-ins.');
      reloadCheckins();
    } catch (e: any) { onFeedback(e.message || 'Failed to remove', true); }
  };

  const lq = listSearch.trim().toLowerCase();
  const filteredSignups = lq
    ? signups.filter(s => `${s.firstName ?? ''} ${s.lastName ?? ''}`.toLowerCase().includes(lq))
    : signups;
  const filteredCheckins = lq
    ? checkins.filter(c => `${c.firstName ?? ''} ${c.lastName ?? ''}`.toLowerCase().includes(lq))
    : checkins;

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

      <div className="space-y-4 max-w-5xl">
        {/* Event Details */}
        <div className="bg-[#1d1c21] border border-white/[0.08] rounded-xl p-5">
          <p className="text-white/50 text-[11px] font-medium tracking-widest uppercase mb-3">Event Details</p>
          <div className="flex flex-wrap gap-x-8 gap-y-2">
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
          </div>
        </div>

        {/* Add player search */}
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search a player to add…"
            className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.10] rounded-xl text-white text-sm placeholder-white/25 focus:outline-none focus:border-white/30 transition-colors"
          />
          {filteredPlayers.length > 0 && (
            <div className="absolute z-20 left-0 right-0 mt-1 bg-[#111] border border-white/[0.10] rounded-xl shadow-xl max-h-60 overflow-y-auto divide-y divide-white/[0.05]">
              {filteredPlayers.map(p => (
                <button
                  key={p.$id}
                  onClick={() => handleAddPlayer(p)}
                  disabled={adding === p.$id}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-white/[0.04] transition-colors disabled:opacity-50"
                >
                  <span className="text-white">{p.firstName} {p.lastName}</span>
                  <span className="text-[10px] text-white/40 uppercase tracking-wider">
                    {adding === p.$id ? 'adding…' : p.type}{p.isProxy && adding !== p.$id ? ' · Proxy' : ''}
                  </span>
                </button>
              ))}
            </div>
          )}
          {search.trim().length >= 2 && filteredPlayers.length === 0 && (
            <p className="text-white/30 text-xs mt-2 px-1">No matching players (or already signed up)</p>
          )}
        </div>

        {/* Filter list search */}
        <input
          type="text"
          value={listSearch}
          onChange={e => setListSearch(e.target.value)}
          placeholder="Filter signups & check-ins…"
          className="w-full px-4 py-2 bg-white/[0.03] border border-white/[0.07] rounded-xl text-white text-sm placeholder-white/20 focus:outline-none focus:border-white/20 transition-colors"
        />

        {/* Signups | Checkins columns */}
        <div className="grid grid-cols-2 gap-4">
          {/* Signups */}
          <div className="bg-[#1d1c21] border border-white/[0.08] rounded-xl p-5 overflow-hidden">
            <p className="text-white/50 text-[11px] font-medium tracking-widest uppercase mb-4">
              Signups · {signups.length}
            </p>
            {loadingSignups ? (
              <div className="flex items-center justify-center h-20">
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              </div>
            ) : filteredSignups.length === 0 ? (
              <p className="text-white/30 text-sm text-center py-4">
                {lq ? 'No matches.' : 'No signups yet.'}
              </p>
            ) : (
              <div className="space-y-1 max-h-[400px] overflow-y-auto">
                {filteredSignups.map(s => {
                  const name = `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim() || s.userId || 'Unknown';
                  return (
                    <div key={s.$id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                      <p className="text-white text-sm truncate">{name}</p>
                      <button
                        onClick={() => handleRemoveSignup(s)}
                        className="p-1 text-white/30 hover:text-red-400 transition-colors flex-shrink-0"
                        title="Remove signup"
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

          {/* Check-ins */}
          <div className="bg-[#1d1c21] border border-white/[0.08] rounded-xl p-5 overflow-hidden">
            <p className="text-white/50 text-[11px] font-medium tracking-widest uppercase mb-4">
              Check-ins · {checkins.length}
            </p>
            {loadingCheckins ? (
              <div className="flex items-center justify-center h-20">
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              </div>
            ) : filteredCheckins.length === 0 ? (
              <p className="text-white/30 text-sm text-center py-4">
                {lq ? 'No matches.' : 'No check-ins yet.'}
              </p>
            ) : (
              <div className="space-y-1 max-h-[400px] overflow-y-auto">
                {filteredCheckins.map(c => {
                  const name = `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || c.userId || 'Unknown';
                  return (
                    <div key={c.$id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                      <div className="min-w-0">
                        <p className="text-white text-sm truncate">{name}</p>
                        {(c.checkinTime || c.$createdAt) && (
                          <p className="text-white/40 text-[10px]">
                            {formatTime(c.checkinTime || c.$createdAt!)}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleRemoveCheckin(c)}
                        className="p-1 text-white/30 hover:text-red-400 transition-colors flex-shrink-0"
                        title="Remove check-in"
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

        <SessionNotesPanel
          eventId={event.id}
          eventDate={event.startDateTime.slice(0, 10)}
          eventTime={event.dateOnly ? 'All Day' : formatTime(event.startDateTime)}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
        />
      </div>
    </div>
  );
}

// ── Main section ─────────────────────────────────────────────────────────────
const AttendanceManagerSection = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const params = useParams<{ calType?: string; eventId?: string }>();
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

  // Load events across a wide window (±12 months from today) for both calendars,
  // ascending so past sessions sit above today and future sessions below.
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const now = new Date();
        const ranges: { y: number; m: number }[] = [];
        for (let offset = -12; offset <= 12; offset++) {
          const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
          ranges.push({ y: d.getFullYear(), m: d.getMonth() });
        }
        const fetchAll = (type: CalType) =>
          Promise.all(ranges.map(r => googleCalendarService.getEventsForMonth(r.y, r.m, type).catch(() => [])))
            .then(arrs => arrs.flat());
        const [pub, priv] = await Promise.all([fetchAll('public'), fetchAll('private')]);

        // Dedupe by id, filter cancelled, sort ascending (oldest first)
        const dedup = (arr: CalendarEvent[]) => {
          const map = new Map<string, CalendarEvent>();
          for (const e of arr) if (!isEventCancelled(e)) map.set(e.id, e);
          return Array.from(map.values()).sort(
            (a, b) => Date.parse(a.startDateTime) - Date.parse(b.startDateTime)
          );
        };
        const dedupedPub = dedup(pub);
        const dedupedPriv = dedup(priv);
        setPublicEvents(dedupedPub);
        setPrivateEvents(dedupedPriv);

        // Restore selected event from URL params on (re)load
        if (params.eventId && params.calType) {
          const calType = params.calType as CalType;
          const list = calType === 'public' ? dedupedPub : dedupedPriv;
          const found = list.find(e => e.id === params.eventId);
          if (found) setSelected({ event: found, calType });
        }
      } finally { setLoading(false); }
    })();
  }, []);

  // Auto-scroll each column to the first event on or after today
  const publicListRef = useRef<HTMLDivElement | null>(null);
  const privateListRef = useRef<HTMLDivElement | null>(null);
  const publicTodayRef = useRef<HTMLButtonElement | null>(null);
  const privateTodayRef = useRef<HTMLButtonElement | null>(null);

  const todayStartMs = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, []);
  const firstUpcomingPublicId = useMemo(
    () => publicEvents.find(e => Date.parse(e.startDateTime) >= todayStartMs)?.id ?? null,
    [publicEvents, todayStartMs],
  );
  const firstUpcomingPrivateId = useMemo(
    () => privateEvents.find(e => Date.parse(e.startDateTime) >= todayStartMs)?.id ?? null,
    [privateEvents, todayStartMs],
  );

  useEffect(() => {
    if (loading || selected) return;
    // Scroll each column so the first event >= today sits at the top of its container
    const scrollColumn = (
      list: HTMLDivElement | null,
      target: HTMLButtonElement | null,
    ) => {
      if (!list || !target) return;
      list.scrollTop = target.offsetTop - list.offsetTop;
    };
    // RAF lets the layout settle before reading offsetTop
    requestAnimationFrame(() => {
      scrollColumn(publicListRef.current, publicTodayRef.current);
      scrollColumn(privateListRef.current, privateTodayRef.current);
    });
  }, [loading, selected, firstUpcomingPublicId, firstUpcomingPrivateId]);

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
          onBack={() => { setSelected(null); navigate('/admin/attendance'); }}
          onFeedback={showFeedback}
          currentUserId={user?.$id}
          currentUserName={user?.name || user?.email?.split('@')[0]}
        />
      ) : loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 h-[calc(100vh-180px)] min-h-0">

          {/* Public column */}
          <section className="flex flex-col min-h-0 bg-[#0e0e0e] border border-[#1c1c1c] rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-[#1a1a1a] flex items-baseline gap-3 flex-shrink-0">
              <h3 className="text-white text-sm font-semibold">Public Sessions</h3>
              <span className="text-white/30 text-xs">{publicEvents.length}</span>
            </div>
            <div ref={publicListRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
              {publicEvents.length === 0 ? (
                <p className="text-white/25 text-sm text-center py-6">No public sessions found.</p>
              ) : publicEvents.map(ev => {
                const isFirstUpcoming = ev.id === firstUpcomingPublicId;
                return (
                  <button
                    key={ev.id}
                    ref={isFirstUpcoming ? publicTodayRef : undefined}
                    onClick={() => { setSelected({ event: ev, calType: 'public' }); navigate(`/admin/attendance/public/${ev.id}`); }}
                    className={`w-full text-left bg-[#0e0e0e] border rounded-xl px-4 py-3 transition-colors ${
                      isFirstUpcoming
                        ? 'border-white/30'
                        : 'border-[#1c1c1c] hover:border-white/20'
                    }`}
                  >
                    <p className="text-white text-sm font-medium truncate">{ev.title}</p>
                    <p className="text-gray-500 text-xs mt-0.5">
                      {formatDate(ev.startDateTime)} · {formatTime(ev.startDateTime, ev.dateOnly)}
                    </p>
                    {ev.location && <p className="text-gray-600 text-xs truncate mt-0.5">{ev.location}</p>}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Private column */}
          <section className="flex flex-col min-h-0 bg-[#0e0e0e] border border-[#1c1c1c] rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-[#1a1a1a] flex items-baseline gap-3 flex-shrink-0">
              <h3 className="text-white text-sm font-semibold">Private Sessions</h3>
              <span className="text-white/30 text-xs">{privateEvents.length}</span>
            </div>
            <div ref={privateListRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
              {privateEvents.length === 0 ? (
                <p className="text-white/25 text-sm text-center py-6">No private sessions found.</p>
              ) : privateEvents.map(ev => {
                const isFirstUpcoming = ev.id === firstUpcomingPrivateId;
                return (
                  <button
                    key={ev.id}
                    ref={isFirstUpcoming ? privateTodayRef : undefined}
                    onClick={() => { setSelected({ event: ev, calType: 'private' }); navigate(`/admin/attendance/private/${ev.id}`); }}
                    className={`w-full text-left bg-[#0e0e0e] border rounded-xl px-4 py-3 transition-colors ${
                      isFirstUpcoming
                        ? 'border-white/30'
                        : 'border-[#1c1c1c] hover:border-white/20'
                    }`}
                  >
                    <p className="text-white text-sm font-medium truncate">{ev.title}</p>
                    <p className="text-gray-500 text-xs mt-0.5">
                      {formatDate(ev.startDateTime)} · {formatTime(ev.startDateTime, ev.dateOnly)}
                    </p>
                    {ev.location && <p className="text-gray-600 text-xs truncate mt-0.5">{ev.location}</p>}
                  </button>
                );
              })}
            </div>
          </section>

        </div>
      )}
    </div>
  );
};

export default AttendanceManagerSection;
