import { useState, useEffect } from 'react';
import { Query, ID } from 'appwrite';
import { databases, databaseId, collections, functions } from '../../../services/appwrite';
import { googleCalendarService, CalendarEvent, isEventCancelled } from '../../../services/googleCalendar';

const APPWRITE_FUNCTION_ID = '68c373b50026f961bdc4';

// ── Types ─────────────────────────────────────────────────────────────────────
interface CoachRecord {
  $id: string;
  userId?: string;
  firstName?: string;
  lastName?: string;
  [key: string]: any;
}

interface PlayerRecord {
  $id: string;
  userId?: string;
  firstName?: string;
  lastName?: string;
  [key: string]: any;
}

interface EventForm {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  description: string;
  type: 'public' | 'private';
  coachIds: string[];
  playerIds: string[];
}

const EMPTY_FORM: EventForm = {
  title: '',
  date: new Date().toISOString().split('T')[0],
  startTime: '09:00',
  endTime: '10:00',
  location: '',
  description: '',
  type: 'public',
  coachIds: [],
  playerIds: [],
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTime(dt: string, dateOnly?: boolean) {
  if (dateOnly) return 'All Day';
  return new Date(dt).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York',
  });
}

function formatDate(dt: string) {
  return new Date(dt).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    timeZone: 'America/New_York',
  });
}

// ── Multi-select chip component ───────────────────────────────────────────────
function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { id: string; name: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]);
  };

  const selectedNames = options.filter(o => selected.includes(o.id)).map(o => o.name);

  return (
    <div className="relative">
      <label className="block text-gray-400 text-xs mb-1">{label}</label>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-left text-sm text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors hover:border-gray-600 flex items-center justify-between"
      >
        <span className="truncate">
          {selectedNames.length === 0 ? `Select ${label.toLowerCase()}…` : selectedNames.join(', ')}
        </span>
        <svg className={`w-3.5 h-3.5 text-gray-500 flex-shrink-0 ml-2 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 w-full bg-[#111] border border-[#2a2a2a] rounded-lg shadow-xl max-h-48 overflow-y-auto">
            {options.length === 0 ? (
              <p className="text-gray-600 text-xs text-center py-3">None found</p>
            ) : (
              options.map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => toggle(opt.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-white/[0.04] transition-colors"
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                    selected.includes(opt.id) ? 'bg-blue-600 border-blue-600' : 'border-gray-600'
                  }`}>
                    {selected.includes(opt.id) && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="text-gray-300">{opt.name}</span>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Event Form ────────────────────────────────────────────────────────────────
function EventForm({
  initial,
  coaches,
  players,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  initial: EventForm;
  coaches: CoachRecord[];
  players: PlayerRecord[];
  onSubmit: (form: EventForm) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
}) {
  const [form, setForm] = useState<EventForm>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (key: keyof EventForm, val: any) => setForm(f => ({ ...f, [key]: val }));

  const coachOptions = coaches.map(c => ({
    id: c.$id,
    name: `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.$id,
  }));
  const playerOptions = players.map(p => ({
    id: p.$id,
    name: `${p.firstName || ''} ${p.lastName || ''}`.trim() || p.$id,
  }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { setError('Title is required'); return; }
    if (!form.date) { setError('Date is required'); return; }
    setSaving(true);
    setError('');
    try {
      await onSubmit(form);
    } catch (err: any) {
      setError(err.message || 'Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
      )}

      {/* Type toggle */}
      <div>
        <label className="block text-gray-400 text-xs mb-1">Calendar</label>
        <div className="flex gap-1 bg-[#111] rounded-lg p-1 w-fit border border-[#2a2a2a]">
          {(['public', 'private'] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => set('type', t)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
                form.type === t ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Title */}
      <div>
        <label className="block text-gray-400 text-xs mb-1">Title *</label>
        <input
          type="text"
          value={form.title}
          onChange={e => set('title', e.target.value)}
          className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-600"
          placeholder="Event title"
        />
      </div>

      {/* Date + times */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-gray-400 text-xs mb-1">Date *</label>
          <input
            type="date"
            value={form.date}
            onChange={e => set('date', e.target.value)}
            className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-gray-400 text-xs mb-1">Start Time</label>
          <input
            type="time"
            value={form.startTime}
            onChange={e => set('startTime', e.target.value)}
            className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-gray-400 text-xs mb-1">End Time</label>
          <input
            type="time"
            value={form.endTime}
            onChange={e => set('endTime', e.target.value)}
            className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Location */}
      <div>
        <label className="block text-gray-400 text-xs mb-1">Location</label>
        <input
          type="text"
          value={form.location}
          onChange={e => set('location', e.target.value)}
          className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-600"
          placeholder="e.g. Main Field"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-gray-400 text-xs mb-1">Description</label>
        <textarea
          value={form.description}
          onChange={e => set('description', e.target.value)}
          rows={3}
          className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-600 resize-none"
          placeholder="Optional notes…"
        />
      </div>

      {/* Coaches */}
      <MultiSelect
        label="Coaches"
        options={coachOptions}
        selected={form.coachIds}
        onChange={ids => set('coachIds', ids)}
      />

      {/* Players — only for private events */}
      {form.type === 'private' && (
        <MultiSelect
          label="Players"
          options={playerOptions}
          selected={form.playerIds}
          onChange={ids => set('playerIds', ids)}
        />
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
          {saving ? 'Saving…' : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── EventAssistantSection ─────────────────────────────────────────────────────
type Tab = 'create' | 'manage';

const EventAssistantSection = () => {
  const [tab, setTab] = useState<Tab>('create');

  // People data
  const [coaches, setCoaches] = useState<CoachRecord[]>([]);
  const [players, setPlayers] = useState<PlayerRecord[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(true);

  // Manage tab
  const [calType, setCalType] = useState<'public' | 'private'>('public');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  // Feedback
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const showFeedback = (msg: string, isError = false) => {
    if (isError) { setErrorMsg(msg); setSuccessMsg(''); }
    else { setSuccessMsg(msg); setErrorMsg(''); }
    setTimeout(() => { setSuccessMsg(''); setErrorMsg(''); }, 4000);
  };

  // Load coaches + players
  useEffect(() => {
    (async () => {
      setLoadingPeople(true);
      try {
        const [coachRes, youthRes, colRes] = await Promise.all([
          collections.coaches
            ? databases.listDocuments(databaseId, collections.coaches, [Query.limit(500)]).catch(() => ({ documents: [] }))
            : { documents: [] },
          collections.youthPlayers
            ? databases.listDocuments(databaseId, collections.youthPlayers, [Query.limit(500)]).catch(() => ({ documents: [] }))
            : { documents: [] },
          collections.collegiatePlayers
            ? databases.listDocuments(databaseId, collections.collegiatePlayers, [Query.limit(500)]).catch(() => ({ documents: [] }))
            : { documents: [] },
        ]);
        setCoaches((coachRes as any).documents as CoachRecord[]);
        setPlayers([
          ...(youthRes as any).documents,
          ...(colRes as any).documents,
        ] as PlayerRecord[]);
      } catch { /* ignore */ } finally {
        setLoadingPeople(false);
      }
    })();
  }, []);

  // Load events when manage tab is active
  useEffect(() => {
    if (tab !== 'manage') return;
    loadEvents();
  }, [tab, calType]);

  const loadEvents = async () => {
    setLoadingEvents(true);
    setEvents([]);
    try {
      const now = new Date();
      const evs = await googleCalendarService.getEventsForMonth(now.getFullYear(), now.getMonth(), calType);
      setEvents(evs.filter(e => !isEventCancelled(e)));
    } catch { setEvents([]); }
    finally { setLoadingEvents(false); }
  };

  // Call Appwrite function for calendar writes
  const callCalendarFunction = async (action: string, payload: object) => {
    const res = await functions.createExecution(
      APPWRITE_FUNCTION_ID,
      JSON.stringify({ service: 'google-calendar', action, ...payload }),
      false,
    );
    if (res.status !== 'completed' || res.responseStatusCode !== 200) {
      throw new Error('Function failed — check that the Appwrite function supports write operations.');
    }
    const body = JSON.parse(res.responseBody);
    if (!body.success) throw new Error(body.error || 'Function returned an error');
    return body;
  };

  const handleCreate = async (form: EventForm) => {
    const result = await callCalendarFunction('createEvent', {
      calendarType: form.type,
      title: form.title,
      date: form.date,
      startTime: form.startTime,
      endTime: form.endTime,
      location: form.location,
      description: form.description,
      coachIds: form.coachIds,
      playerIds: form.playerIds,
    });

    // Build event meta for signup docs
    const eventId: string = result.eventId || result.id || '';
    const eventTitle = form.title;
    const eventDate = `${form.date}T${form.startTime}:00`;

    // Create coach signup docs
    if (form.coachIds.length > 0 && collections.coachSignups) {
      const coachMap = new Map(coaches.map(c => [c.$id, c]));
      await Promise.allSettled(
        form.coachIds.map(id => {
          const coach = coachMap.get(id);
          const coachUserId = coach?.userId || id;
          return databases.createDocument(databaseId, collections.coachSignups, ID.unique(), {
            eventID: eventId,
            eventTitle,
            eventDate,
            coachUserId,
            coaches: [coachUserId],
            isHeadCoach: false,
          });
        })
      );
    }

    // Create player signup docs (private events only)
    if (form.type === 'private' && form.playerIds.length > 0 && collections.signups) {
      const playerMap = new Map(players.map(p => [p.$id, p]));
      await Promise.allSettled(
        form.playerIds.map(id => {
          const player = playerMap.get(id);
          return databases.createDocument(databaseId, collections.signups, ID.unique(), {
            eventID: eventId,
            eventTitle,
            eventDate,
            userId: player?.userId || id,
            firstName: player?.firstName || '',
            lastName: player?.lastName || '',
            type: 'admin',
            isProxySignup: false,
          });
        })
      );
    }

    showFeedback('Event created successfully.');
  };

  const handleUpdate = async (form: EventForm) => {
    if (!editingEvent) return;
    await callCalendarFunction('updateEvent', {
      calendarType: form.type,
      eventId: editingEvent.id,
      title: form.title,
      date: form.date,
      startTime: form.startTime,
      endTime: form.endTime,
      location: form.location,
      description: form.description,
      coachIds: form.coachIds,
      playerIds: form.playerIds,
    });
    showFeedback('Event updated.');
    setEditingEvent(null);
    loadEvents();
  };

  const handleDelete = async (ev: CalendarEvent) => {
    if (!confirm(`Delete "${ev.title}"?`)) return;
    try {
      await callCalendarFunction('deleteEvent', {
        calendarType: calType,
        eventId: ev.id,
      });
      showFeedback('Event deleted.');
      loadEvents();
    } catch (e: any) {
      showFeedback(e.message || 'Failed to delete', true);
    }
  };

  const eventToForm = (ev: CalendarEvent): EventForm => {
    const start = new Date(ev.startDateTime);
    const end = new Date(ev.endDateTime);
    return {
      title: ev.title,
      date: start.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }),
      startTime: ev.dateOnly ? '00:00' : start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/New_York' }),
      endTime: ev.dateOnly ? '23:59' : end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/New_York' }),
      location: ev.location || '',
      description: ev.description || '',
      type: calType,
      coachIds: [],
      playerIds: [],
    };
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-white mb-6">Event Assistant</h2>

      {/* Feedback */}
      {successMsg && (
        <div className="mb-4 px-4 py-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm">
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {errorMsg}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 bg-gray-900 rounded-lg p-1 w-fit border border-gray-800">
        {([['create', 'Create Event'], ['manage', 'Manage Events']] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => { setTab(t); setEditingEvent(null); }}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Create tab ── */}
      {tab === 'create' && (
        <div className="max-w-lg">
          {loadingPeople ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <EventForm
              initial={EMPTY_FORM}
              coaches={coaches}
              players={players}
              onSubmit={handleCreate}
              onCancel={() => {}}
              submitLabel="Create Event"
            />
          )}
        </div>
      )}

      {/* ── Manage tab ── */}
      {tab === 'manage' && (
        <div className="flex gap-6">

          {/* Event list */}
          <div className="flex-1 min-w-0">
            {/* Calendar type selector */}
            <div className="flex gap-1 mb-4 bg-gray-900 rounded-lg p-1 w-fit border border-gray-800">
              {(['public', 'private'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => { setCalType(t); setEditingEvent(null); }}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
                    calType === t ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {loadingEvents ? (
              <div className="flex items-center justify-center h-40">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : events.length === 0 ? (
              <p className="text-gray-600 text-sm text-center py-12">No events found for this month</p>
            ) : (
              <div className="space-y-2">
                {events.map(ev => (
                  <div
                    key={ev.id}
                    className={`bg-[#0e0e0e] border rounded-xl px-4 py-3 flex items-center gap-3 transition-colors ${
                      editingEvent?.id === ev.id ? 'border-blue-500/50' : 'border-[#1c1c1c] hover:border-[#2a2a2a]'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{ev.title}</p>
                      <p className="text-gray-500 text-xs mt-0.5">
                        {formatDate(ev.startDateTime)} · {formatTime(ev.startDateTime, ev.dateOnly)}
                      </p>
                      {ev.location && (
                        <p className="text-gray-600 text-xs truncate mt-0.5">{ev.location}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => setEditingEvent(editingEvent?.id === ev.id ? null : ev)}
                        className="p-1.5 text-gray-600 hover:text-blue-400 transition-colors"
                        title="Edit"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 0l.172.172a2 2 0 010 2.828L12 16H9v-3z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(ev)}
                        className="p-1.5 text-gray-600 hover:text-red-400 transition-colors"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Edit form */}
          {editingEvent && (
            <div className="w-96 flex-shrink-0 bg-[#0e0e0e] border border-[#1c1c1c] rounded-xl p-5">
              <p className="text-white text-sm font-semibold mb-4">Edit Event</p>
              <EventForm
                initial={eventToForm(editingEvent)}
                coaches={coaches}
                players={players}
                onSubmit={handleUpdate}
                onCancel={() => setEditingEvent(null)}
                submitLabel="Save Changes"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EventAssistantSection;
