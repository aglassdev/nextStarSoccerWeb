import { useState, useEffect } from 'react';
import { Query, ID } from 'appwrite';
import { databases, databaseId, collections, functions } from '../../../services/appwrite';
import { googleCalendarService, CalendarEvent, isEventCancelled } from '../../../services/googleCalendar';
import { computeFacilityCost, facilityRateFor, setFacilityCost, getFacilityCost } from '../../../services/facilityCost';
import {
  CoachRecord, ALL_EVENT_TYPES, PRIVATE_EVENT_TYPES, ANALYSIS_EVENT_TYPES, PRESET_VENUES,
  normalizeCoachName, coachFullName, DEFAULT_PRIVATE_COACH, sortCoachRoster,
  Req, Check, START_TIME_OPTIONS, END_TIME_OPTIONS, calendarTypeFor, to24h, plusOneHour,
  LocationPickerModal, Dropdown, DAY_LABELS, dateKey, prettyDate,
} from '../../../components/admin/eventControls';

const APPWRITE_FUNCTION_ID = '68c373b50026f961bdc4';

// ── Types ─────────────────────────────────────────────────────────────────────
interface PlayerRecord {
  $id: string;
  userId?: string;
  firstName: string;
  lastName: string;
  type: 'Youth' | 'Collegiate' | 'Professional';
  isProxy?: boolean;
  parentUserId?: string;
}

interface EventFormData {
  title: string;
  date: string;
  startTime: string;   // "HH:MM AM/PM" format
  endTime: string;     // "HH:MM AM/PM" format
  location: string;
  eventType: string;
  selectedPlayers: PlayerRecord[];
  selectedCoaches: CoachRecord[];
  isRecurring: boolean;
  recurringWeeks: string;
  isMultiDate: boolean;
  multiDates: string[];  // YYYY-MM-DD, one event created per date
  facilityCost: string;  // auto-filled from location × duration, editable
}

// Returns today's date as YYYY-MM-DD in local time (used as default for the date field)
const todayStr = () => new Date().toLocaleDateString('en-CA');

const EMPTY_FORM_BASE: Omit<EventFormData, 'date'> = {
  title: '',
  startTime: '',
  endTime: '',
  location: '',
  eventType: '',
  selectedPlayers: [],
  selectedCoaches: [],
  isRecurring: false,
  recurringWeeks: '',
  isMultiDate: false,
  multiDates: [],
  facilityCost: '',
};
// Always call this to get a fresh form — date stamps today
const makeEmptyForm = (): EventFormData => ({ ...EMPTY_FORM_BASE, date: todayStr() });

function MultiDatePickerModal({
  open, selected, onClose, onSave,
}: {
  open: boolean;
  selected: string[];
  onClose: () => void;
  onSave: (dates: string[]) => void;
}) {
  const [picked, setPicked] = useState<string[]>(selected);
  // Month currently on screen, as a first-of-month date
  const [month, setMonth] = useState(() => {
    const first = [...selected].sort()[0];
    if (first) {
      const [y, m] = first.split('-').map(Number);
      return new Date(y, m - 1, 1);
    }
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  useEffect(() => { if (open) setPicked(selected); }, [open, selected]);

  if (!open) return null;

  const y = month.getFullYear();
  const m = month.getMonth();
  const leadingBlanks = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const today = todayStr();

  const toggle = (key: string) =>
    setPicked(p => (p.includes(key) ? p.filter(k => k !== key) : [...p, key]));

  const shiftMonth = (delta: number) => setMonth(new Date(y, m + delta, 1));
  const sorted = [...picked].sort();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[#141214] border border-white/[0.08] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div>
            <h3 className="text-white text-base font-semibold">Pick Dates</h3>
            <p className="text-white/40 text-xs mt-0.5">Tap every day this session should run on.</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white p-1.5 rounded-lg hover:bg-white/[0.04] transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Calendar */}
        <div className="px-6 py-5">
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors"
              aria-label="Previous month"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <p className="text-white text-sm font-medium">
              {month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </p>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors"
              aria-label="Next month"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAY_LABELS.map((d, i) => (
              <div key={i} className="text-center text-white/30 text-[10px] uppercase tracking-wider py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: leadingBlanks }, (_, i) => <div key={`blank-${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const key = dateKey(y, m, day);
              const isPicked = picked.includes(key);
              const isPast = key < today;
              return (
                <button
                  key={key}
                  type="button"
                  disabled={isPast}
                  onClick={() => toggle(key)}
                  className={`aspect-square rounded-lg text-sm transition-colors ${
                    isPicked
                      ? 'bg-white text-black font-semibold'
                      : isPast
                        ? 'text-white/15 cursor-not-allowed'
                        : `text-white/70 hover:bg-white/[0.08] hover:text-white ${key === today ? 'ring-1 ring-white/30' : ''}`
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected dates */}
        {sorted.length > 0 && (
          <div className="px-6 pb-4 max-h-28 overflow-y-auto">
            <div className="flex flex-wrap gap-1.5">
              {sorted.map(key => (
                <span
                  key={key}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-white/10 border border-white/25 text-white"
                >
                  {prettyDate(key)}
                  <button type="button" onClick={() => toggle(key)} className="text-white/50 hover:text-white">✕</button>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-white/[0.06] bg-white/[0.02]">
          <span className="text-white/40 text-xs">
            {sorted.length} {sorted.length === 1 ? 'date' : 'dates'} selected
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPicked([])}
              disabled={sorted.length === 0}
              className="px-4 py-2 text-sm text-white/60 hover:text-white border border-white/[0.10] hover:border-white/30 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => onSave(sorted)}
              className="px-4 py-2 text-sm font-medium bg-white hover:bg-gray-200 text-black rounded-lg transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

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

// ── Main ─────────────────────────────────────────────────────────────────────
type Tab = 'create' | 'manage';

const EventAssistantSection = () => {
  const [tab, setTab] = useState<Tab>('create');
  const [coaches, setCoaches] = useState<CoachRecord[]>([]);
  const [allPlayers, setAllPlayers] = useState<PlayerRecord[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(true);

  // Manage tab
  const [calType, setCalType] = useState<'public' | 'private'>('public');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  // eventID → ["First Last", ...] of signed-up players
  const [eventSignupNames, setEventSignupNames] = useState<Record<string, string[]>>({});

  // Convert a CalendarEvent into an EventFormData snapshot for the edit form
  const eventToForm = (ev: CalendarEvent): EventFormData => {
    const start = new Date(ev.startDateTime);
    const end = new Date(ev.endDateTime);
    const dateStr = start.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    const fmt = (d: Date) => d.toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York',
    }).replace(/^0/, '');
    const matchedType = ALL_EVENT_TYPES.find(t =>
      ev.title?.toLowerCase().includes(t.toLowerCase())
    );
    return {
      title: ev.title || '',
      date: dateStr,
      startTime: ev.dateOnly ? '' : fmt(start),
      endTime: ev.dateOnly ? '' : fmt(end),
      location: ev.location || '',
      eventType: matchedType || ev.title || '',
      selectedPlayers: [],
      selectedCoaches: [],
      isRecurring: false,
      recurringWeeks: '',
      isMultiDate: false,
      multiDates: [],
      facilityCost: '',
    };
  };

  // Feedback
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const showFeedback = (msg: string, isError = false) => {
    if (isError) { setErrorMsg(msg); setSuccessMsg(''); }
    else { setSuccessMsg(msg); setErrorMsg(''); }
    setTimeout(() => { setSuccessMsg(''); setErrorMsg(''); }, 4000);
  };

  // Load coaches + players once
  useEffect(() => {
    (async () => {
      setLoadingPeople(true);
      try {
        const [coachRes, youthRes, colRes, proRes, proxyRes] = await Promise.all([
          collections.coaches
            ? databases.listDocuments(databaseId, collections.coaches, [Query.limit(500)]).catch(() => ({ documents: [] }))
            : { documents: [] },
          collections.youthPlayers
            ? databases.listDocuments(databaseId, collections.youthPlayers, [Query.limit(1000)]).catch(() => ({ documents: [] }))
            : { documents: [] },
          collections.collegiatePlayers
            ? databases.listDocuments(databaseId, collections.collegiatePlayers, [Query.limit(1000)]).catch(() => ({ documents: [] }))
            : { documents: [] },
          collections.professionalPlayers
            ? databases.listDocuments(databaseId, collections.professionalPlayers, [Query.limit(1000)]).catch(() => ({ documents: [] }))
            : { documents: [] },
          collections.proxyChildren
            ? databases.listDocuments(databaseId, collections.proxyChildren, [Query.limit(1000)]).catch(() => ({ documents: [] }))
            : { documents: [] },
        ]);
        // Hidden test/non-coach accounts dropped, regulars floated to the top.
        setCoaches(sortCoachRoster((coachRes as any).documents as CoachRecord[]));
        const players: PlayerRecord[] = [
          ...(youthRes as any).documents.map((p: any) => ({ $id: p.$id, userId: p.userId, firstName: p.firstName || '', lastName: p.lastName || '', type: 'Youth' as const })),
          ...(colRes as any).documents.map((p: any) => ({ $id: p.$id, userId: p.userId, firstName: p.firstName || '', lastName: p.lastName || '', type: 'Collegiate' as const })),
          ...(proRes as any).documents.map((p: any) => ({ $id: p.$id, userId: p.userId, firstName: p.firstName || '', lastName: p.lastName || '', type: 'Professional' as const })),
          ...(proxyRes as any).documents.map((p: any) => ({
            $id: p.$id,
            userId: p.userId || undefined,
            parentUserId: p.parentUserId,
            firstName: p.firstName || '',
            lastName: p.lastName || '',
            type: 'Youth' as const,
            isProxy: true,
          })),
        ];
        setAllPlayers(players);
      } catch { /* ignore */ }
      finally { setLoadingPeople(false); }
    })();
  }, []);

  // Manage events
  useEffect(() => {
    if (tab !== 'manage') return;
    (async () => {
      setLoadingEvents(true);
      setEvents([]);
      setEventSignupNames({});
      try {
        const now = new Date();
        const evs = await googleCalendarService.getEventsForMonth(now.getFullYear(), now.getMonth(), calType);
        const filtered = evs.filter(e => !isEventCancelled(e));
        setEvents(filtered);

        // Fetch player signups for these events so we can show who's signed up
        if (collections.signups && filtered.length > 0) {
          try {
            const signupRes = await databases.listDocuments(databaseId, collections.signups, [Query.limit(5000)]);
            const namesByEvent: Record<string, string[]> = {};
            for (const doc of (signupRes as any).documents) {
              const eid = doc.eventID;
              if (!eid) continue;
              const name = `${doc.firstName || ''} ${doc.lastName || ''}`.trim();
              if (!name) continue;
              if (!namesByEvent[eid]) namesByEvent[eid] = [];
              namesByEvent[eid].push(name);
            }
            setEventSignupNames(namesByEvent);
          } catch { /* signups not critical */ }
        }
      } catch { setEvents([]); }
      finally { setLoadingEvents(false); }
    })();
  }, [tab, calType]);

  const callCalendarFunction = async (action: string, payload: object) => {
    let res: Awaited<ReturnType<typeof functions.createExecution>>;
    try {
      res = await functions.createExecution(
        APPWRITE_FUNCTION_ID,
        JSON.stringify({ service: 'google-calendar', action, ...payload }),
        false,
      );
    } catch (sdkErr: any) {
      throw new Error(`SDK error calling calendar function: ${sdkErr?.message || String(sdkErr)}`);
    }

    if (res.status !== 'completed' || res.responseStatusCode !== 200) {
      // Build a human-readable detail string so we can diagnose what went wrong
      const errText = (res.errors || '').trim();
      const bodyText = (res.responseBody || '').trim();
      const detail = errText || bodyText.slice(0, 400) || `status="${res.status}" code=${res.responseStatusCode}`;
      throw new Error(`Calendar function failed (${action}): ${detail}`);
    }

    if (!res.responseBody) {
      throw new Error(`Calendar function returned empty body for action "${action}"`);
    }

    let body: any;
    try {
      body = JSON.parse(res.responseBody);
    } catch {
      throw new Error(`Calendar function returned invalid JSON: ${res.responseBody.slice(0, 200)}`);
    }

    if (!body.success) throw new Error(body.error || 'Function returned success=false');
    return body;
  };

  const handleDeleteEvent = async (ev: CalendarEvent) => {
    if (!confirm(`Delete "${ev.title}"?`)) return;
    try {
      await callCalendarFunction('deleteEvent', { calendarType: calType, eventId: ev.id });
      showFeedback('Event deleted.');
      // Reload
      const now = new Date();
      const evs = await googleCalendarService.getEventsForMonth(now.getFullYear(), now.getMonth(), calType);
      setEvents(evs.filter(e => !isEventCancelled(e)));
    } catch (e: any) { showFeedback(e.message || 'Failed to delete', true); }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-white mb-6">Event Assistant</h2>

      {successMsg && (
        <div className="mb-4 px-4 py-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm">{successMsg}</div>
      )}
      {errorMsg && (
        <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{errorMsg}</div>
      )}

      <div className="flex gap-1 mb-6 bg-gray-900 rounded-lg p-1 w-fit border border-gray-800">
        {([['create', 'Create Event'], ['manage', 'Manage Events']] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t ? 'bg-white text-black' : 'text-gray-400 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'create' && (
        <div className="max-w-2xl">
          {loadingPeople ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <CreateEventForm
              coaches={coaches}
              allPlayers={allPlayers}
              callCalendarFunction={callCalendarFunction}
              onSuccess={(msg) => showFeedback(msg)}
              onError={(msg) => showFeedback(msg, true)}
            />
          )}
        </div>
      )}

      {tab === 'manage' && (
        <div>
          {editingEvent ? (
            <div className="max-w-2xl">
              <button
                onClick={() => setEditingEvent(null)}
                className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-4 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
                </svg>
                Back to events
              </button>
              <div className="mb-5">
                <p className="text-white/40 text-[10px] uppercase tracking-widest mb-1">Editing</p>
                <h3 className="text-white text-lg font-semibold">{editingEvent.title}</h3>
              </div>
              <CreateEventForm
                key={editingEvent.id}
                coaches={coaches}
                allPlayers={allPlayers}
                callCalendarFunction={callCalendarFunction}
                onSuccess={(msg) => { showFeedback(msg); setEditingEvent(null); }}
                onError={(msg) => showFeedback(msg, true)}
                mode="edit"
                editingEvent={editingEvent}
                initialForm={eventToForm(editingEvent)}
                onDoneEditing={async () => {
                  setEditingEvent(null);
                  // Reload events
                  setLoadingEvents(true);
                  try {
                    const now = new Date();
                    const evs = await googleCalendarService.getEventsForMonth(now.getFullYear(), now.getMonth(), calType);
                    setEvents(evs.filter(e => !isEventCancelled(e)));
                  } finally { setLoadingEvents(false); }
                }}
              />
            </div>
          ) : (
            <>
              <div className="flex gap-1 mb-4 bg-gray-900 rounded-lg p-1 w-fit border border-gray-800">
                {(['public', 'private'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setCalType(t)}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
                      calType === t ? 'bg-white text-black' : 'text-gray-500 hover:text-white'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {loadingEvents ? (
                <div className="flex items-center justify-center h-40">
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              ) : events.length === 0 ? (
                <p className="text-gray-600 text-sm text-center py-12">No events found for this month</p>
              ) : (
                <div className="space-y-2 max-w-2xl">
                  {events.map(ev => {
                    const signedUp = eventSignupNames[ev.id] || [];
                    return (
                      <button
                        key={ev.id}
                        onClick={() => setEditingEvent(ev)}
                        className="w-full text-left bg-[#0e0e0e] border border-[#1c1c1c] hover:border-white/20 rounded-xl px-4 py-3 flex items-center gap-3 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">{ev.title}</p>
                          <p className="text-gray-500 text-xs mt-0.5">
                            {formatDate(ev.startDateTime)} · {formatTime(ev.startDateTime, ev.dateOnly)}
                          </p>
                          {ev.location && <p className="text-gray-600 text-xs truncate mt-0.5">{ev.location}</p>}
                          {signedUp.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {signedUp.map((name, i) => (
                                <span key={i} className="px-1.5 py-0.5 bg-white/10 border border-white/20 rounded text-white/80 text-[10px] font-medium">
                                  {name}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => { e.stopPropagation(); handleDeleteEvent(ev); }}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); handleDeleteEvent(ev); } }}
                          className="p-1.5 text-gray-600 hover:text-red-400 transition-colors cursor-pointer"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ── Create Event Form ─────────────────────────────────────────────────────────
function CreateEventForm({
  coaches,
  allPlayers,
  callCalendarFunction,
  onSuccess,
  onError,
  mode = 'create',
  initialForm,
  editingEvent,
  onDoneEditing,
}: {
  coaches: CoachRecord[];
  allPlayers: PlayerRecord[];
  callCalendarFunction: (action: string, payload: object) => Promise<any>;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
  mode?: 'create' | 'edit';
  initialForm?: EventFormData;
  editingEvent?: CalendarEvent;
  onDoneEditing?: () => void;
}) {
  const [form, setForm] = useState<EventFormData>(initialForm || makeEmptyForm());
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  const set = <K extends keyof EventFormData>(k: K, v: EventFormData[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  // Facility hire follows location × duration until someone types over it, at
  // which point the typed figure sticks.
  const [costEdited, setCostEdited] = useState(Boolean(initialForm?.facilityCost));
  const facilityRate = facilityRateFor(form.location);

  // A cost already saved against the event wins over the computed default.
  useEffect(() => {
    if (mode !== 'edit' || !editingEvent) return;
    let cancelled = false;
    getFacilityCost(editingEvent.id).then(stored => {
      if (cancelled || stored === null) return;
      setCostEdited(true);
      setForm(f => ({ ...f, facilityCost: String(stored) }));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [mode, editingEvent]);
  useEffect(() => {
    if (costEdited) return;
    const auto = computeFacilityCost(form.location, to24h(form.startTime), to24h(form.endTime));
    setForm(f => (f.facilityCost === (auto ? String(auto) : '') ? f : { ...f, facilityCost: auto ? String(auto) : '' }));
  }, [form.location, form.startTime, form.endTime, costEdited]);

  // Auto-set end time when start time changes
  const handleStartTime = (v: string) => {
    setForm(f => ({ ...f, startTime: v, endTime: plusOneHour(v) }));
  };

  // Auto-fill title when event type changes (mobile uses eventType as title fallback).
  // Privates default to Paul Torres — only when nothing is picked yet, so a
  // deliberate choice is never overwritten and the dropdown stays editable.
  const handleEventType = (v: string) => {
    setForm(f => {
      const next = { ...f, eventType: v, title: f.title || v };
      if (PRIVATE_EVENT_TYPES.includes(v) && f.selectedCoaches.length === 0) {
        const paul = coaches.find(c => normalizeCoachName(coachFullName(c)) === DEFAULT_PRIVATE_COACH);
        if (paul) next.selectedCoaches = [paul];
      }
      return next;
    });
  };

  // ─── Location modal ───
  const [locationModalOpen, setLocationModalOpen] = useState(false);

  const handlePickLocation = (location: string) => {
    set('location', location);
    setLocationModalOpen(false);
  };

  // ─── Repeat modes ───
  // Weekly recurrence and an explicit date list describe the same thing two
  // different ways, so turning one on turns the other off.
  const [dateModalOpen, setDateModalOpen] = useState(false);

  const toggleRecurring = () =>
    setForm(f => f.isRecurring
      ? { ...f, isRecurring: false, recurringWeeks: '' }
      : { ...f, isRecurring: true, isMultiDate: false, multiDates: [] });

  const toggleMultiDate = () =>
    setForm(f => {
      if (f.isMultiDate) return { ...f, isMultiDate: false, multiDates: [] };
      setDateModalOpen(true);
      return { ...f, isMultiDate: true, isRecurring: false, recurringWeeks: '' };
    });

  // ─── Player search ───
  const [playerSearch, setPlayerSearch] = useState('');
  const playerSuggestions = (() => {
    const q = playerSearch.trim().toLowerCase();
    if (q.length < 2) return [];
    return allPlayers
      .filter(p => {
        const full = `${p.firstName} ${p.lastName}`.toLowerCase();
        return full.includes(q) && !form.selectedPlayers.some(s => s.$id === p.$id);
      })
      .sort((a, b) => {
        const an = `${a.firstName} ${a.lastName}`.toLowerCase();
        const bn = `${b.firstName} ${b.lastName}`.toLowerCase();
        const aS = an.startsWith(q), bS = bn.startsWith(q);
        if (aS && !bS) return -1;
        if (!aS && bS) return 1;
        return an.localeCompare(bn);
      })
      .slice(0, 10);
  })();

  const addPlayer = (p: PlayerRecord) => {
    if (form.selectedPlayers.length >= 4) return;
    setForm(f => ({ ...f, selectedPlayers: [...f.selectedPlayers, p] }));
    setPlayerSearch('');
  };
  const removePlayer = (id: string) =>
    setForm(f => ({ ...f, selectedPlayers: f.selectedPlayers.filter(p => p.$id !== id) }));

  // ─── Coach multi-select ───
  const [coachOpen, setCoachOpen] = useState(false);
  const toggleCoach = (c: CoachRecord) => {
    setForm(f => ({
      ...f,
      selectedCoaches: f.selectedCoaches.some(x => x.$id === c.$id)
        ? f.selectedCoaches.filter(x => x.$id !== c.$id)
        : [...f.selectedCoaches, c],
    }));
  };

  // ─── Submit ───
  const validate = (): boolean => {
    const isAnalysis = ANALYSIS_EVENT_TYPES.includes(form.eventType);
    const titleRequired = !form.eventType;
    const startValid = !!form.startTime;
    const endValid = !!form.endTime;
    let timeOrderInvalid = false;
    if (startValid && endValid) {
      timeOrderInvalid = to24h(form.endTime) <= to24h(form.startTime);
    }
    const weeks = parseInt(form.recurringWeeks);
    const newErr = {
      title: titleRequired && !form.title.trim(),
      // With Make Multiple on, the picked dates stand in for the Date field.
      date: !form.isMultiDate && !form.date.trim(),
      startTime: !startValid,
      endTime: !endValid,
      timeOrder: timeOrderInvalid,
      location: !isAnalysis && !form.location.trim(),
      eventType: !form.eventType,
      recurringWeeks: form.isRecurring && (!weeks || weeks < 1 || weeks > 52),
      multiDates: form.isMultiDate && form.multiDates.length === 0,
    };
    setErrors(newErr);
    return !Object.values(newErr).some(Boolean);
  };

  // Every date this submit should create an event on, in order.
  const datesToCreate = (): string[] => {
    if (form.isMultiDate) return [...form.multiDates].sort();
    const weeks = form.isRecurring ? parseInt(form.recurringWeeks) : 1;
    const [yr, mo, dy] = form.date.split('-').map(Number);
    return Array.from({ length: weeks }, (_, week) => {
      const d = new Date(yr, mo - 1, dy);
      d.setDate(d.getDate() + week * 7);
      return dateKey(d.getFullYear(), d.getMonth(), d.getDate());
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      if (form.isMultiDate && form.multiDates.length === 0) onError('Pick at least one date for Make Multiple.');
      else if (form.isRecurring) onError('Please fill in all required fields correctly — recurring weeks must be 1–52.');
      else onError('Please fill in all required fields correctly.');
      return;
    }

    setSaving(true);
    try {
      const calendarType = calendarTypeFor(form.eventType);
      const eventTitle = form.title.trim() || form.eventType;
      const startTime24 = to24h(form.startTime);
      const endTime24 = to24h(form.endTime);

      // ─── EDIT MODE ───
      if (mode === 'edit' && editingEvent) {
        // Only hit the calendar function if a calendar field actually changed.
        // Adding players/coaches has nothing to do with Google Calendar, and
        // calling updateEvent unnecessarily causes "Calendar function failed".
        const calendarFieldsChanged =
          eventTitle !== ((initialForm?.title || initialForm?.eventType || '').trim() || initialForm?.eventType || '') ||
          form.date !== (initialForm?.date || '') ||
          form.startTime !== (initialForm?.startTime || '') ||
          form.endTime !== (initialForm?.endTime || '') ||
          form.location !== (initialForm?.location || '') ||
          form.eventType !== (initialForm?.eventType || '');

        if (calendarFieldsChanged) {
          await callCalendarFunction('updateEvent', {
            calendarType,
            eventId: editingEvent.id,
            // Function expects nested eventData with ISO datetimes
            eventData: {
              title: eventTitle,
              location: form.location,
              description: '',
              startDateTime: `${form.date}T${startTime24}:00`,
              endDateTime: `${form.date}T${endTime24}:00`,
            },
          });
        }

        // Always persist any new player signups (non-public events)
        if (calendarType !== 'public' && form.selectedPlayers.length > 0 && collections.signups) {
          const eventDateISO = `${form.date}T${startTime24}:00`;
          await Promise.allSettled(form.selectedPlayers.map(p =>
            databases.createDocument(databaseId, collections.signups!, ID.unique(), {
              eventID: editingEvent.id,
              eventTitle,
              eventDate: eventDateISO,
              userId: p.userId || p.$id,
              firstName: p.firstName,
              lastName: p.lastName,
              type: 'bill',
              isProxySignup: p.isProxy === true,
            })
          ));
        }

        // Always persist any new coach signups
        if (form.selectedCoaches.length > 0 && collections.coachSignups) {
          const eventDateISO = `${form.date}T${startTime24}:00`;
          await Promise.allSettled(form.selectedCoaches.map(c =>
            databases.createDocument(databaseId, collections.coachSignups!, ID.unique(), {
              eventID: editingEvent.id,
              eventTitle,
              eventDate: eventDateISO,
              coachUserId: c.userId || c.$id,
              coaches: [c.$id],
              isHeadCoach: false,
            })
          ));
        }

        // Facility hire lives outside Google Calendar, so it saves either way.
        await setFacilityCost(editingEvent.id, parseInt(form.facilityCost) || 0).catch(() => {});

        onSuccess(calendarFieldsChanged ? 'Event updated successfully.' : 'Players added successfully.');
        if (onDoneEditing) onDoneEditing();
        return;
      }

      const eventDates = datesToCreate();
      let createdCount = 0;

      for (const eventDateStr of eventDates) {
        const result = await callCalendarFunction('createEvent', {
          calendarType,
          // Function expects a nested eventData object with ISO datetimes
          eventData: {
            title: eventTitle,
            location: form.location,
            description: '',
            startDateTime: `${eventDateStr}T${startTime24}:00`,
            endDateTime: `${eventDateStr}T${endTime24}:00`,
          },
        });

        // Function returns the created Google Calendar event under result.data
        const eventId: string = result?.data?.id || result?.eventId || result?.id || '';
        const eventDateISO = `${eventDateStr}T${startTime24}:00`;

        const cost = parseInt(form.facilityCost) || 0;
        if (eventId && cost > 0) await setFacilityCost(eventId, cost).catch(() => {});

        // Coach signups
        if (form.selectedCoaches.length > 0 && collections.coachSignups) {
          await Promise.allSettled(form.selectedCoaches.map(c =>
            databases.createDocument(databaseId, collections.coachSignups!, ID.unique(), {
              eventID: eventId,
              eventTitle,
              eventDate: eventDateISO,
              coachUserId: c.userId || c.$id,
              coaches: [c.$id],
              isHeadCoach: false,
            })
          ));
        }

        // Player signups (only for non-public events that have players)
        if (calendarType !== 'public' && form.selectedPlayers.length > 0 && collections.signups) {
          await Promise.allSettled(form.selectedPlayers.map(p =>
            databases.createDocument(databaseId, collections.signups!, ID.unique(), {
              eventID: eventId,
              eventTitle,
              eventDate: eventDateISO,
              userId: p.userId || p.$id,
              firstName: p.firstName,
              lastName: p.lastName,
              type: 'bill',
              isProxySignup: p.isProxy === true,
            })
          ));
        }
        createdCount++;
      }

      onSuccess(
        createdCount === 1
          ? 'Event created successfully.'
          : form.isMultiDate
            ? `${createdCount} events created successfully across ${createdCount} dates.`
            : `${createdCount} recurring events created successfully.`
      );
      setForm(makeEmptyForm());
      setErrors({});
    } catch (err: any) {
      onError(err.message || 'Failed to create event.');
    } finally {
      setSaving(false);
    }
  };

  const isAnalysis = ANALYSIS_EVENT_TYPES.includes(form.eventType);
  const plannedCount = form.isMultiDate
    ? form.multiDates.length
    : form.isRecurring
      ? (parseInt(form.recurringWeeks) || 0)
      : 1;
  const submitLabel = plannedCount > 1 ? `Create ${plannedCount} Events` : 'Create Event';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* Event Type */}
      <Dropdown
        label="Event Type"
        required
        value={form.eventType}
        options={ALL_EVENT_TYPES}
        onChange={handleEventType}
        placeholder="Select event type"
        error={errors.eventType}
      />

      {/* Title */}
      <div>
        <label className="block text-gray-400 text-xs mb-1">
          Title {form.eventType ? <span className="text-gray-600">(optional)</span> : <Req />}
        </label>
        <input
          type="text"
          value={form.title}
          onChange={e => set('title', e.target.value)}
          placeholder={form.eventType || 'Event title'}
          className={`w-full px-3 py-2 bg-[#1a1a1a] border rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-white/40 placeholder-gray-600 ${
            errors.title ? 'border-red-500/50' : 'border-[#2a2a2a]'
          }`}
        />
      </div>

      {/* Date + times */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-gray-400 text-xs mb-1">Date<Req /></label>
          <input
            type="date"
            value={form.date}
            onChange={e => set('date', e.target.value)}
            className={`w-full px-3 py-2 bg-[#1a1a1a] border rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-white/40 ${
              errors.date ? 'border-red-500/50' : 'border-[#2a2a2a]'
            }`}
          />
        </div>
        <Dropdown
          label="Start Time"
          required
          value={form.startTime}
          options={START_TIME_OPTIONS}
          onChange={handleStartTime}
          placeholder="Start"
          error={errors.startTime}
        />
        <Dropdown
          label="End Time"
          required
          value={form.endTime}
          options={END_TIME_OPTIONS}
          onChange={v => set('endTime', v)}
          placeholder="End"
          error={errors.endTime || errors.timeOrder}
        />
      </div>
      {errors.timeOrder && (
        <p className="text-red-400 text-xs">End time must be after start time.</p>
      )}

      {/* Location */}
      {!isAnalysis && (
        <div>
          <label className="block text-gray-400 text-xs mb-1">Location<Req /></label>
          <div className="relative">
            <input
              type="text"
              value={form.location}
              onChange={e => set('location', e.target.value)}
              placeholder="Type an address, or click the pin to search…"
              className={`w-full px-3 py-2 pr-9 bg-[#1a1a1a] border rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-white/40 placeholder-gray-600 ${
                errors.location ? 'border-red-500/50' : 'border-[#2a2a2a]'
              }`}
            />
            {/* Pin icon opens the search/map modal */}
            <button
              type="button"
              onClick={() => setLocationModalOpen(true)}
              className="absolute inset-y-0 right-0 px-2.5 flex items-center text-gray-500 hover:text-white transition-colors"
              title="Search for a location"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
          {errors.location && <p className="text-red-400 text-xs mt-1">Please enter a location.</p>}

          {/* One-tap fill for the venues we use week to week */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {PRESET_VENUES.map(v => {
              const active = form.location === v.address;
              return (
                <button
                  key={v.label}
                  type="button"
                  onClick={() => set('location', v.address)}
                  title={v.address}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    active
                      ? 'bg-white border-white text-black'
                      : 'bg-white/[0.03] border-white/[0.12] text-white/60 hover:text-white hover:border-white/35'
                  }`}
                >
                  {v.label}
                </button>
              );
            })}
          </div>

          {/* Facility hire — auto-filled from the venue's hourly rate */}
          <div className="mt-3">
            <label className="block text-gray-400 text-xs mb-1">Facility cost</label>
            <div className="flex items-center gap-2">
              <div className="relative w-36">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 text-sm">$</span>
                <input
                  type="number"
                  min={0}
                  value={form.facilityCost}
                  onChange={e => { setCostEdited(true); set('facilityCost', e.target.value); }}
                  placeholder="0"
                  className="w-full pl-6 pr-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-white/40 placeholder-gray-600"
                />
              </div>
              <p className="text-gray-500 text-xs">
                {facilityRate
                  ? `${facilityRate.label} · $${facilityRate.hourly}/hr${costEdited ? ' · edited' : ' · auto'}`
                  : 'No hire cost at this venue'}
              </p>
              {costEdited && (
                <button
                  type="button"
                  onClick={() => setCostEdited(false)}
                  className="text-white/40 hover:text-white text-xs underline"
                >
                  reset
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Coaches */}
      <div className="relative">
        <label className="block text-gray-400 text-xs mb-1">Coaches</label>
        <button
          type="button"
          onClick={() => setCoachOpen(o => !o)}
          className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-left text-sm text-gray-300 hover:border-gray-600 flex items-center justify-between"
        >
          <span className="truncate">
            {form.selectedCoaches.length === 0
              ? 'Select coaches…'
              : form.selectedCoaches.map(c => `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim()).join(', ')}
          </span>
          <svg className={`w-3.5 h-3.5 text-gray-500 ml-2 transition-transform ${coachOpen ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {coachOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setCoachOpen(false)} />
            <div className="absolute z-20 mt-1 w-full bg-[#111] border border-[#2a2a2a] rounded-lg shadow-xl max-h-56 overflow-y-auto">
              {coaches.length === 0 ? (
                <p className="text-gray-600 text-xs text-center py-3">No coaches found</p>
              ) : (
                coaches.map(c => {
                  const checked = form.selectedCoaches.some(x => x.$id === c.$id);
                  const name = coachFullName(c) || c.$id;
                  return (
                    <button
                      key={c.$id}
                      type="button"
                      onClick={() => toggleCoach(c)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-white/[0.04]"
                    >
                      <Check checked={checked} />
                      <span className={checked ? 'text-white' : 'text-gray-300'}>{name}</span>
                    </button>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>

      {/* Players (only for non-public events) */}
      {form.eventType && calendarTypeFor(form.eventType) !== 'public' && (
        <div className="relative">
          <label className="block text-gray-400 text-xs mb-1">
            Players ({form.selectedPlayers.length}/4)
          </label>

          {form.selectedPlayers.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {form.selectedPlayers.map(p => (
                <span
                  key={p.$id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-white/10 border border-white/25 text-white"
                >
                  {p.firstName} {p.lastName}
                  <button
                    type="button"
                    onClick={() => removePlayer(p.$id)}
                    className="text-white/50 hover:text-white"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}

          <input
            type="text"
            value={playerSearch}
            onChange={e => setPlayerSearch(e.target.value)}
            placeholder={form.selectedPlayers.length >= 4 ? 'Max players reached' : 'Search players…'}
            disabled={form.selectedPlayers.length >= 4}
            className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-white/40 placeholder-gray-600 disabled:opacity-50"
          />
          {playerSearch.trim().length >= 2 && playerSuggestions.length > 0 && (
            <div className="absolute z-20 mt-1 left-0 right-0 bg-[#111] border border-[#2a2a2a] rounded-lg shadow-xl max-h-56 overflow-y-auto">
              {playerSuggestions.map(p => (
                <button
                  key={p.$id}
                  type="button"
                  onClick={() => addPlayer(p)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-white/[0.04] transition-colors"
                >
                  <span className="text-gray-300">{p.firstName} {p.lastName}</span>
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                    {p.type}{p.isProxy ? ' · Proxy' : ''}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Repeat options — creating only; editing touches one calendar event */}
      {mode === 'create' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <button type="button" onClick={toggleRecurring} className="flex items-center gap-2">
              <Check checked={form.isRecurring} />
              <span className={`text-sm ${form.isRecurring ? 'text-white' : 'text-gray-300'}`}>Recurring weekly</span>
            </button>
            {form.isRecurring && (
              <input
                type="number"
                min={1}
                max={52}
                value={form.recurringWeeks}
                onChange={e => set('recurringWeeks', e.target.value)}
                placeholder="weeks"
                className={`w-24 px-3 py-1.5 bg-[#1a1a1a] border rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-white/40 placeholder-gray-600 ${
                  errors.recurringWeeks ? 'border-red-500/50' : 'border-[#2a2a2a]'
                }`}
              />
            )}

            <button type="button" onClick={toggleMultiDate} className="flex items-center gap-2">
              <Check checked={form.isMultiDate} />
              <span className={`text-sm ${form.isMultiDate ? 'text-white' : 'text-gray-300'}`}>Make Multiple</span>
            </button>
          </div>

          {form.isMultiDate && (
            <div className={`rounded-lg border px-3 py-3 bg-white/[0.02] ${
              errors.multiDates ? 'border-red-500/50' : 'border-[#2a2a2a]'
            }`}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-gray-400 text-xs">
                  {form.multiDates.length === 0
                    ? 'No dates picked yet — this session will be created on every date you choose.'
                    : `${form.multiDates.length} ${form.multiDates.length === 1 ? 'date' : 'dates'} picked · the Date field above is ignored.`}
                </p>
                <button
                  type="button"
                  onClick={() => setDateModalOpen(true)}
                  className="flex-shrink-0 px-3 py-1.5 text-xs font-medium bg-white hover:bg-gray-200 text-black rounded-lg transition-colors"
                >
                  {form.multiDates.length === 0 ? 'Pick Dates' : 'Edit Dates'}
                </button>
              </div>
              {form.multiDates.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {form.multiDates.map(key => (
                    <span
                      key={key}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-white/10 border border-white/25 text-white"
                    >
                      {prettyDate(key)}
                      <button
                        type="button"
                        onClick={() => set('multiDates', form.multiDates.filter(k => k !== key))}
                        className="text-white/50 hover:text-white"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Submit */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={saving}
          className="w-full py-2.5 bg-white hover:bg-gray-200 text-black text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving && <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />}
          {saving ? (mode === 'edit' ? 'Saving…' : 'Creating…') : (mode === 'edit' ? 'Save Changes' : submitLabel)}
        </button>
      </div>

      <LocationPickerModal
        open={locationModalOpen}
        currentValue={form.location}
        onClose={() => setLocationModalOpen(false)}
        onSelect={handlePickLocation}
      />

      <MultiDatePickerModal
        open={dateModalOpen}
        selected={form.multiDates}
        onClose={() => setDateModalOpen(false)}
        onSave={dates => { set('multiDates', dates); setDateModalOpen(false); }}
      />
    </form>
  );
}

export default EventAssistantSection;
