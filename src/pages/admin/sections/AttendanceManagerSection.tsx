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
  onBehalfOfUserId?: string | null;
  onBehalfOfProxyId?: string | null;
  isProxySignup?: boolean;
  isProxyCheckin?: boolean;
  checkinTime?: string;
  $createdAt?: string;
}

// Uniquely identifies the actual player a signup/check-in is FOR. Siblings signed
// up by one parent share the parent's userId and are distinguished only by
// onBehalfOfProxyId (proxy child) or onBehalfOfUserId (linked child) — so key off
// those first, falling back to userId for direct (self) signups.
const attendeeIdentity = (d: { userId?: string; onBehalfOfUserId?: string | null; onBehalfOfProxyId?: string | null }): string =>
  d.onBehalfOfProxyId || d.onBehalfOfUserId || d.userId || '';


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
  allEvents,
  onSelectEvent,
  onBack,
  onFeedback,
  currentUserId,
  currentUserName,
}: {
  event: CalendarEvent;
  calType: CalType;
  allEvents: CalendarEvent[];
  onSelectEvent: (ev: CalendarEvent) => void;
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
  const [checkingIn, setCheckingIn] = useState<string | null>(null);

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

  const checkedInKeys = useMemo(
    () => new Set(checkins.map(attendeeIdentity).filter(Boolean)),
    [checkins],
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

  const handleCheckinFromSignup = async (s: AttendeeDoc) => {
    if (!s.userId || checkedInKeys.has(attendeeIdentity(s))) return;
    setCheckingIn(s.$id);
    try {
      if (collections.checkins) {
        await databases.createDocument(databaseId, collections.checkins, ID.unique(), {
          eventID: event.id,
          eventTitle: event.title,
          eventDate: event.startDateTime,
          userId: s.userId,
          firstName: s.firstName ?? '',
          lastName: s.lastName ?? '',
          // Carry the sibling-distinguishing identity so this check-in matches
          // only THIS player, not every signup sharing the parent's userId.
          onBehalfOfUserId: s.onBehalfOfUserId ?? null,
          onBehalfOfProxyId: s.onBehalfOfProxyId ?? null,
          isProxyCheckin: s.isProxySignup === true,
          type: 'bill',
          calendarSource: calType,
        });
      }
      reloadCheckins();
    } catch (e: any) {
      onFeedback(e.message || 'Check-in failed', true);
    } finally {
      setCheckingIn(null);
    }
  };

  const handleRemoveCheckin = async (c: AttendeeDoc) => {
    if (!confirm(`Remove ${c.firstName ?? ''} ${c.lastName ?? ''} from check-ins and signups?`)) return;
    try {
      const deletes: Promise<any>[] = [];
      if (collections.checkins) deletes.push(databases.deleteDocument(databaseId, collections.checkins, c.$id));
      if (collections.signups && c.userId) {
        const existing = await databases.listDocuments(databaseId, collections.signups, [
          Query.equal('eventID', event.id), Query.equal('userId', c.userId), Query.limit(10),
        ]);
        for (const doc of existing.documents) {
          deletes.push(databases.deleteDocument(databaseId, collections.signups, doc.$id));
        }
      }
      await Promise.all(deletes);
      onFeedback('Removed from check-ins and signups.');
      reloadCheckins();
      reloadSignups();
    } catch (e: any) { onFeedback(e.message || 'Failed to remove', true); }
  };

  const lq = listSearch.trim().toLowerCase();
  const filteredSignups = lq
    ? signups.filter(s => `${s.firstName ?? ''} ${s.lastName ?? ''}`.toLowerCase().includes(lq))
    : signups;
  const filteredCheckins = lq
    ? checkins.filter(c => `${c.firstName ?? ''} ${c.lastName ?? ''}`.toLowerCase().includes(lq))
    : checkins;

  // Nearby sessions in the same calendar — a handful before (Earlier, closest
  // first) and after (Later) the current event, for quick hop-to navigation.
  const { earlier, later } = useMemo(() => {
    const idx = allEvents.findIndex(e => e.id === event.id);
    if (idx === -1) return { earlier: [] as CalendarEvent[], later: [] as CalendarEvent[] };
    return {
      earlier: allEvents.slice(0, idx).reverse().slice(0, 8),
      later: allEvents.slice(idx + 1).slice(0, 8),
    };
  }, [allEvents, event.id]);

  const currentDay = event.startDateTime.slice(0, 10);
  const NearbyChip = ({ ev }: { ev: CalendarEvent }) => {
    const sameDay = ev.startDateTime.slice(0, 10) === currentDay;
    return (
      <button
        onClick={() => onSelectEvent(ev)}
        className="w-full text-left px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:border-white/25 transition-colors"
      >
        <div className="flex items-center gap-2">
          <p className="text-white text-sm truncate flex-1">{ev.title}</p>
          {sameDay && (
            <span className="text-[9px] uppercase tracking-wider text-green-400/80 bg-green-500/10 border border-green-500/20 rounded px-1.5 py-0.5 flex-shrink-0">
              Same day
            </span>
          )}
        </div>
        <p className="text-gray-500 text-xs mt-0.5">
          {formatDate(ev.startDateTime)} · {formatTime(ev.startDateTime, ev.dateOnly)}
        </p>
      </button>
    );
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
                  const alreadyCheckedIn = checkedInKeys.has(attendeeIdentity(s));
                  const isCheckingIn = checkingIn === s.$id;
                  return (
                    <div key={s.$id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                      <button
                        onClick={() => handleCheckinFromSignup(s)}
                        disabled={alreadyCheckedIn || isCheckingIn}
                        title={alreadyCheckedIn ? 'Already checked in' : 'Click to check in'}
                        className={`flex-1 min-w-0 text-left flex items-center gap-2 group ${alreadyCheckedIn ? 'cursor-default' : 'cursor-pointer'}`}
                      >
                        <p className={`text-sm truncate transition-colors ${alreadyCheckedIn ? 'text-white/40' : 'text-white group-hover:text-green-400'}`}>
                          {isCheckingIn ? 'Checking in…' : name}
                        </p>
                        {alreadyCheckedIn && (
                          <svg className="w-3 h-3 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414L8.414 15l-4.121-4.121a1 1 0 011.414-1.414L8.414 12.172l6.879-6.879a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
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

        {/* Nearby sessions — quick hop to events close to this one */}
        {(earlier.length > 0 || later.length > 0) && (
          <div className="bg-[#1d1c21] border border-white/[0.08] rounded-xl p-5">
            <p className="text-white/50 text-[11px] font-medium tracking-widest uppercase mb-4">Nearby Sessions</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-white/35 text-[10px] uppercase tracking-wider mb-2">← Earlier</p>
                {earlier.length === 0 ? (
                  <p className="text-white/25 text-xs py-2">No earlier sessions.</p>
                ) : (
                  <div className="space-y-1.5">
                    {earlier.map(ev => <NearbyChip key={ev.id} ev={ev} />)}
                  </div>
                )}
              </div>
              <div>
                <p className="text-white/35 text-[10px] uppercase tracking-wider mb-2 text-right">Later →</p>
                {later.length === 0 ? (
                  <p className="text-white/25 text-xs py-2 text-right">No later sessions.</p>
                ) : (
                  <div className="space-y-1.5">
                    {later.map(ev => <NearbyChip key={ev.id} ev={ev} />)}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Week view ──────────────────────────────────────────────────────────────────
interface WeekEvent extends CalendarEvent { calType: CalType; }

const pad2 = (n: number) => String(n).padStart(2, '0');
const easternDay = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(iso));
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

function WeekView({
  publicEvents,
  privateEvents,
  allPlayers,
  onFeedback,
}: {
  publicEvents: CalendarEvent[];
  privateEvents: CalendarEvent[];
  allPlayers: PlayerSearchResult[];
  onFeedback: (msg: string, isError?: boolean) => void;
}) {
  const todayStr = easternDay(new Date().toISOString());
  const [weekStart, setWeekStart] = useState(() => sundayOf(todayStr));
  const [checkinsByEvent, setCheckinsByEvent] = useState<Record<string, AttendeeDoc[]>>({});
  const [loading, setLoading] = useState(true);
  const [addFor, setAddFor] = useState<string | null>(null);
  const [addSearch, setAddSearch] = useState('');

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysStr(weekStart, i)), [weekStart]);

  const eventsByDay = useMemo(() => {
    const daySet = new Set(days);
    const map: Record<string, WeekEvent[]> = {};
    for (const d of days) map[d] = [];
    const all: WeekEvent[] = [
      ...publicEvents.map(e => ({ ...e, calType: 'public' as const })),
      ...privateEvents.map(e => ({ ...e, calType: 'private' as const })),
    ];
    for (const ev of all) {
      const d = easternDay(ev.startDateTime);
      if (daySet.has(d)) map[d].push(ev);
    }
    for (const d of days) map[d].sort((a, b) => Date.parse(a.startDateTime) - Date.parse(b.startDateTime));
    return map;
  }, [publicEvents, privateEvents, days]);

  const weekEventIds = useMemo(() => days.flatMap(d => eventsByDay[d].map(e => e.id)), [days, eventsByDay]);
  const weekKey = weekEventIds.join(',');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        if (!collections.checkins || weekEventIds.length === 0) { if (!cancelled) setCheckinsByEvent({}); return; }
        const entries = await Promise.all(weekEventIds.map(async (id) => {
          try {
            const res = await databases.listDocuments(databaseId, collections.checkins!, [Query.equal('eventID', id), Query.limit(500)]);
            return [id, res.documents as any] as const;
          } catch { return [id, [] as AttendeeDoc[]] as const; }
        }));
        if (!cancelled) setCheckinsByEvent(Object.fromEntries(entries));
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekKey]);

  const addCheckin = async (ev: WeekEvent, p: PlayerSearchResult) => {
    try {
      if (!collections.checkins) return;
      const doc = await databases.createDocument(databaseId, collections.checkins, ID.unique(), {
        eventID: ev.id, eventTitle: ev.title, eventDate: ev.startDateTime,
        userId: p.userId, firstName: p.firstName, lastName: p.lastName,
        type: 'bill', calendarSource: ev.calType, isProxyCheckin: p.isProxy === true,
      });
      setCheckinsByEvent(prev => ({ ...prev, [ev.id]: [...(prev[ev.id] || []), doc as any] }));
      setAddSearch(''); setAddFor(null);
      onFeedback(`${p.firstName} ${p.lastName} checked in.`);
    } catch (e: any) { onFeedback(e.message || 'Failed to check in', true); }
  };

  const removeCheckin = async (evId: string, c: AttendeeDoc) => {
    try {
      if (collections.checkins) await databases.deleteDocument(databaseId, collections.checkins, c.$id);
      setCheckinsByEvent(prev => ({ ...prev, [evId]: (prev[evId] || []).filter(x => x.$id !== c.$id) }));
    } catch (e: any) { onFeedback(e.message || 'Failed to remove', true); }
  };

  const weekLabel = `${dayParts(days[0]).date} – ${dayParts(days[6]).date}`;
  const totalCheckins = weekEventIds.reduce((s, id) => s + (checkinsByEvent[id]?.length || 0), 0);

  return (
    <div>
      {/* Week nav */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekStart(w => addDaysStr(w, -7))}
            className="p-2 text-white/50 hover:text-white border border-white/10 hover:border-white/25 rounded-lg transition-colors"
            title="Previous week"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button
            onClick={() => setWeekStart(sundayOf(todayStr))}
            className="px-3 py-2 text-sm text-white/60 hover:text-white border border-white/10 hover:border-white/25 rounded-lg transition-colors"
          >
            This week
          </button>
          <button
            onClick={() => setWeekStart(w => addDaysStr(w, 7))}
            className="p-2 text-white/50 hover:text-white border border-white/10 hover:border-white/25 rounded-lg transition-colors"
            title="Next week"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
        <div className="text-right">
          <p className="text-white text-sm font-medium">{weekLabel}</p>
          <p className="text-white/30 text-xs">{totalCheckins} check-ins this week</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-3">
          {days.map(dayStr => {
            const { weekday, date } = dayParts(dayStr);
            const isToday = dayStr === todayStr;
            const dayEvents = eventsByDay[dayStr];
            return (
              <div key={dayStr} className="flex-shrink-0 w-[240px]">
                <div className={`px-3 py-2 rounded-lg mb-2 border ${isToday ? 'bg-white/[0.08] border-white/30' : 'bg-[#0e0e0e] border-[#1c1c1c]'}`}>
                  <p className="text-white text-sm font-semibold">{weekday}</p>
                  <p className="text-white/40 text-xs">{date}</p>
                </div>
                <div className="space-y-2">
                  {dayEvents.length === 0 ? (
                    <p className="text-white/20 text-xs text-center py-4">No sessions</p>
                  ) : dayEvents.map(ev => {
                    const checkins = checkinsByEvent[ev.id] || [];
                    const isAdding = addFor === ev.id;
                    const q = addSearch.trim().toLowerCase();
                    const checkedKeys = new Set(checkins.map(attendeeIdentity));
                    const results = isAdding && q.length >= 2
                      ? allPlayers
                          .filter(p => `${p.firstName} ${p.lastName}`.toLowerCase().includes(q))
                          .filter(p => !checkedKeys.has(attendeeIdentity(p as any)))
                          .slice(0, 8)
                      : [];
                    return (
                      <div key={ev.id} className="bg-[#1d1c21] border border-white/[0.08] rounded-xl p-3">
                        <div className="flex items-start gap-1.5">
                          <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${ev.calType === 'private' ? 'bg-purple-400' : 'bg-sky-400'}`} title={ev.calType} />
                          <div className="min-w-0 flex-1">
                            <p className="text-white text-xs font-medium leading-snug">{ev.title}</p>
                            <p className="text-white/40 text-[10px] mt-0.5">{formatTime(ev.startDateTime, ev.dateOnly)}</p>
                          </div>
                        </div>

                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-white/40 text-[10px] uppercase tracking-wider">Checked in · {checkins.length}</span>
                          <button
                            onClick={() => { setAddFor(isAdding ? null : ev.id); setAddSearch(''); }}
                            className="text-[11px] text-white/50 hover:text-green-400 transition-colors"
                          >
                            {isAdding ? 'Close' : '+ Add'}
                          </button>
                        </div>

                        {isAdding && (
                          <div className="mt-2 relative">
                            <input
                              autoFocus
                              value={addSearch}
                              onChange={e => setAddSearch(e.target.value)}
                              placeholder="Search player…"
                              className="w-full px-2 py-1.5 bg-white/[0.05] border border-white/15 rounded-lg text-white text-xs placeholder-white/25 focus:outline-none focus:border-white/35"
                            />
                            {results.length > 0 && (
                              <div className="absolute z-20 left-0 right-0 mt-1 bg-[#111] border border-white/15 rounded-lg shadow-xl max-h-48 overflow-y-auto divide-y divide-white/[0.05]">
                                {results.map(p => (
                                  <button
                                    key={p.$id}
                                    onClick={() => addCheckin(ev, p)}
                                    className="w-full text-left px-2.5 py-1.5 text-xs text-white hover:bg-white/[0.06] transition-colors"
                                  >
                                    {p.firstName} {p.lastName}
                                    {p.isProxy && <span className="text-white/30"> · Proxy</span>}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {checkins.length > 0 && (
                          <div className="mt-2 space-y-1 max-h-56 overflow-y-auto">
                            {checkins.map(c => {
                              const name = `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || c.userId || 'Unknown';
                              return (
                                <div key={c.$id} className="flex items-center justify-between gap-1.5 px-2 py-1 rounded-md bg-white/[0.03] border border-white/[0.05]">
                                  <span className="text-white/85 text-xs truncate">{name}</span>
                                  <button
                                    onClick={() => removeCheckin(ev.id, c)}
                                    className="p-0.5 text-white/25 hover:text-red-400 transition-colors flex-shrink-0"
                                    title="Remove check-in"
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
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

  // Find-by-date
  const easternToday = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const [showDateModal, setShowDateModal] = useState(false);
  const [jumpDate, setJumpDate] = useState(easternToday);
  const [highlightIds, setHighlightIds] = useState<string[]>([]);

  // List vs Week view, plus a shared player list for the week view's add search
  const [viewMode, setViewMode] = useState<'list' | 'week'>('list');
  const [allPlayers, setAllPlayers] = useState<PlayerSearchResult[]>([]);

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

  // Load the player roster once (shared with the week view's add-check-in search)
  useEffect(() => {
    (async () => {
      try {
        const [yRes, cRes, pRes, proxyRes] = await Promise.all([
          collections.youthPlayers ? databases.listDocuments(databaseId, collections.youthPlayers, [Query.limit(2000)]).catch(() => ({ documents: [] })) : { documents: [] },
          collections.collegiatePlayers ? databases.listDocuments(databaseId, collections.collegiatePlayers, [Query.limit(2000)]).catch(() => ({ documents: [] })) : { documents: [] },
          collections.professionalPlayers ? databases.listDocuments(databaseId, collections.professionalPlayers, [Query.limit(2000)]).catch(() => ({ documents: [] })) : { documents: [] },
          collections.proxyChildren ? databases.listDocuments(databaseId, collections.proxyChildren, [Query.limit(2000)]).catch(() => ({ documents: [] })) : { documents: [] },
        ]);
        setAllPlayers([
          ...((yRes as any).documents).map((d: any) => ({ $id: d.$id, userId: d.userId || d.$id, firstName: d.firstName || '', lastName: d.lastName || '', type: 'Youth' as const })),
          ...((cRes as any).documents).map((d: any) => ({ $id: d.$id, userId: d.userId || d.$id, firstName: d.firstName || '', lastName: d.lastName || '', type: 'Collegiate' as const })),
          ...((pRes as any).documents).map((d: any) => ({ $id: d.$id, userId: d.userId || d.$id, firstName: d.firstName || '', lastName: d.lastName || '', type: 'Professional' as const })),
          ...((proxyRes as any).documents).map((d: any) => ({ $id: d.$id, userId: d.$id, firstName: d.firstName || '', lastName: d.lastName || '', type: 'Youth' as const, isProxy: true })),
        ]);
      } catch { /* ignore */ }
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

  // Scroll both columns to the first session on/after the chosen date, and
  // briefly highlight the landed-on events.
  const jumpToDate = (dateStr: string) => {
    if (!dateStr) return;
    const scrollList = (list: HTMLDivElement | null, events: CalendarEvent[]): string | null => {
      if (!list) return null;
      const target = events.find(e => e.startDateTime.slice(0, 10) >= dateStr);
      if (!target) { list.scrollTop = list.scrollHeight; return null; }
      const el = list.querySelector<HTMLElement>(`[data-eid="${CSS.escape(target.id)}"]`);
      if (el) list.scrollTop = el.offsetTop - list.offsetTop;
      return target.id;
    };
    const ids = [
      scrollList(publicListRef.current, publicEvents),
      scrollList(privateListRef.current, privateEvents),
    ].filter(Boolean) as string[];
    setHighlightIds(ids);
    setShowDateModal(false);
    window.setTimeout(() => setHighlightIds([]), 2800);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Attendance Manager</h2>
        {!selected && !loading && (
          <div className="flex items-center gap-2">
            {/* List / Week toggle */}
            <div className="flex bg-white/[0.04] border border-white/10 rounded-lg p-0.5">
              {(['list', 'week'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors capitalize ${
                    viewMode === mode ? 'bg-white text-black font-medium' : 'text-white/60 hover:text-white'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
            {viewMode === 'list' && (
              <button
                onClick={() => { setJumpDate(easternToday); setShowDateModal(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 rounded-lg text-white text-sm transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Jump to date
              </button>
            )}
          </div>
        )}
      </div>

      {successMsg && (
        <div className="mb-4 px-4 py-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm">{successMsg}</div>
      )}
      {errorMsg && (
        <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{errorMsg}</div>
      )}

      {selected ? (
        <EventDetailView
          key={selected.event.id}
          event={selected.event}
          calType={selected.calType}
          allEvents={selected.calType === 'public' ? publicEvents : privateEvents}
          onSelectEvent={(ev) => {
            setSelected({ event: ev, calType: selected.calType });
            navigate(`/admin/attendance/${selected.calType}/${ev.id}`);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onBack={() => { setSelected(null); navigate('/admin/attendance'); }}
          onFeedback={showFeedback}
          currentUserId={user?.$id}
          currentUserName={user?.name || user?.email?.split('@')[0]}
        />
      ) : loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      ) : viewMode === 'week' ? (
        <WeekView
          publicEvents={publicEvents}
          privateEvents={privateEvents}
          allPlayers={allPlayers}
          onFeedback={showFeedback}
        />
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
                const isHighlighted = highlightIds.includes(ev.id);
                return (
                  <button
                    key={ev.id}
                    data-eid={ev.id}
                    ref={isFirstUpcoming ? publicTodayRef : undefined}
                    onClick={() => { setSelected({ event: ev, calType: 'public' }); navigate(`/admin/attendance/public/${ev.id}`); }}
                    className={`w-full text-left bg-[#0e0e0e] border rounded-xl px-4 py-3 transition-colors ${
                      isHighlighted
                        ? 'border-green-400 ring-2 ring-green-400/60'
                        : isFirstUpcoming
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
                const isHighlighted = highlightIds.includes(ev.id);
                return (
                  <button
                    key={ev.id}
                    data-eid={ev.id}
                    ref={isFirstUpcoming ? privateTodayRef : undefined}
                    onClick={() => { setSelected({ event: ev, calType: 'private' }); navigate(`/admin/attendance/private/${ev.id}`); }}
                    className={`w-full text-left bg-[#0e0e0e] border rounded-xl px-4 py-3 transition-colors ${
                      isHighlighted
                        ? 'border-green-400 ring-2 ring-green-400/60'
                        : isFirstUpcoming
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

      {/* Find-by-date modal */}
      {showDateModal && (
        <>
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40" onClick={() => setShowDateModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className="pointer-events-auto w-full max-w-sm bg-[#111] border border-white/10 rounded-2xl p-6 shadow-2xl">
              <h3 className="text-white font-semibold text-lg mb-1">Jump to date</h3>
              <p className="text-white/40 text-xs mb-4">
                Scrolls both columns to the first session on or after the chosen date.
              </p>
              <input
                type="date"
                value={jumpDate}
                onChange={e => setJumpDate(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') jumpToDate(jumpDate); }}
                autoFocus
                className="w-full px-3 py-2 bg-[#1a1a1a] border border-white/15 rounded-lg text-white text-sm [color-scheme:dark] focus:outline-none focus:border-white/40 mb-4"
              />
              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={() => { setJumpDate(easternToday); jumpToDate(easternToday); }}
                  className="px-3 py-2 text-sm text-white/60 hover:text-white border border-white/10 hover:border-white/25 rounded-lg transition-colors"
                >
                  Today
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowDateModal(false)}
                    className="px-4 py-2 text-sm text-white/60 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => jumpToDate(jumpDate)}
                    className="px-5 py-2 text-sm bg-white hover:bg-gray-200 text-black font-semibold rounded-lg transition-colors"
                  >
                    Go
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AttendanceManagerSection;
