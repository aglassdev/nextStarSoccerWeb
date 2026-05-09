import { useState, useEffect, useRef, useCallback } from 'react';
import { Query, ID } from 'appwrite';
import { databases, databaseId, collections, functions } from '../../../services/appwrite';
import { googleCalendarService, CalendarEvent, isEventCancelled } from '../../../services/googleCalendar';
import { GooglePlacesService, GooglePlacesPrediction } from '../../../services/googlePlaces';

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
  firstName: string;
  lastName: string;
  type: 'Youth' | 'Collegiate' | 'Professional';
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
}

const EMPTY_FORM: EventFormData = {
  title: '',
  date: '',
  startTime: '',
  endTime: '',
  location: '',
  eventType: '',
  selectedPlayers: [],
  selectedCoaches: [],
  isRecurring: false,
  recurringWeeks: '',
};

// ── Constants copied verbatim from mobile EventMakerScreen ───────────────────
const PUBLIC_EVENT_TYPES = [
  'Morning Group Training',
  'Afternoon Group Training',
  'Evening Group Training',
  'Next Star x Nike Evening Group Training',
];
const PRIVATE_EVENT_TYPES = ['Private Session'];
const ANALYSIS_EVENT_TYPES = ['Game Analysis', 'Parent Consultation'];
const ALL_EVENT_TYPES = [...PUBLIC_EVENT_TYPES, ...PRIVATE_EVENT_TYPES, ...ANALYSIS_EVENT_TYPES];

const PRESET_VENUES: { label: string; address: string }[] = [
  { label: 'Whitman HS', address: 'Walt Whitman High School, 7100 Whittier Blvd, Bethesda, MD 20817' },
  { label: 'Lewinsville Park', address: 'Lewinsville Park, 1659 Chain Bridge Rd, McLean, VA 22101' },
  { label: 'Somerset ES', address: 'Somerset Elementary School, 5811 Warwick Pl, Chevy Chase, MD 20815' },
  { label: 'Washington Episcopal', address: 'Washington Episcopal School, 5600 Little Falls Pkwy, Bethesda, MD 20816' },
  { label: 'Palisades Rec', address: 'Palisades Recreation Center, 5200 Sherier Pl NW, Washington, DC 20016' },
];

// 15-min interval slots between two 24-hour bounds (inclusive)
function generateTimeRange(startHour24: number, endHour24: number): string[] {
  const out: string[] = [];
  for (let h = startHour24; h <= endHour24; h++) {
    for (let m = 0; m < 60; m += 15) {
      if (h === endHour24 && m > 0) break;
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const ampm = h < 12 ? 'AM' : 'PM';
      out.push(`${h12}:${String(m).padStart(2, '0')} ${ampm}`);
    }
  }
  return out;
}

// Start: 7:00 AM – 7:00 PM ; End: 8:00 AM – 8:00 PM
const START_TIME_OPTIONS = generateTimeRange(7, 19);
const END_TIME_OPTIONS = generateTimeRange(8, 20);

// Calendar-type derivation matches mobile logic
function calendarTypeFor(eventType: string): 'public' | 'private' | 'analysis' {
  if (ANALYSIS_EVENT_TYPES.includes(eventType)) return 'analysis';
  if (PRIVATE_EVENT_TYPES.includes(eventType)) return 'private';
  return 'public';
}

// Convert "5:30 PM" → "17:30"
function to24h(time12: string): string {
  if (!time12) return '';
  const [t, ampm] = time12.split(' ');
  const [hStr, mStr] = t.split(':');
  let h = parseInt(hStr);
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${mStr}`;
}

// "5:30 PM" + 1h → "6:30 PM"
function plusOneHour(time12: string): string {
  if (!time12) return '';
  const [t, ampm] = time12.split(' ');
  const [hStr, mStr] = t.split(':');
  let h = parseInt(hStr);
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  h = (h + 1) % 24;
  const newAmPm = h < 12 ? 'AM' : 'PM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${mStr} ${newAmPm}`;
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

// ── Reusable dropdown ────────────────────────────────────────────────────────
function Dropdown({
  label, value, options, onChange, placeholder = 'Select…', error,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  placeholder?: string;
  error?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <label className="block text-gray-400 text-xs mb-1">{label}</label>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full px-3 py-2 bg-[#1a1a1a] border rounded-lg text-left text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors flex items-center justify-between ${
          error ? 'border-red-500/50' : 'border-[#2a2a2a] hover:border-gray-600'
        }`}
      >
        <span className={value ? 'text-white' : 'text-gray-600'}>{value || placeholder}</span>
        <svg className={`w-3.5 h-3.5 text-gray-500 flex-shrink-0 ml-2 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 w-full bg-[#111] border border-[#2a2a2a] rounded-lg shadow-xl max-h-56 overflow-y-auto">
            {options.map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => { onChange(opt); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                  value === opt ? 'bg-blue-600/20 text-blue-300' : 'text-gray-300 hover:bg-white/[0.04]'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
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
        const [coachRes, youthRes, colRes, proRes] = await Promise.all([
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
        ]);
        setCoaches(((coachRes as any).documents as CoachRecord[]).sort((a, b) =>
          `${a.firstName ?? ''} ${a.lastName ?? ''}`.localeCompare(`${b.firstName ?? ''} ${b.lastName ?? ''}`)
        ));
        const players: PlayerRecord[] = [
          ...(youthRes as any).documents.map((p: any) => ({ $id: p.$id, userId: p.userId, firstName: p.firstName || '', lastName: p.lastName || '', type: 'Youth' as const })),
          ...(colRes as any).documents.map((p: any) => ({ $id: p.$id, userId: p.userId, firstName: p.firstName || '', lastName: p.lastName || '', type: 'Collegiate' as const })),
          ...(proRes as any).documents.map((p: any) => ({ $id: p.$id, userId: p.userId, firstName: p.firstName || '', lastName: p.lastName || '', type: 'Professional' as const })),
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
      try {
        const now = new Date();
        const evs = await googleCalendarService.getEventsForMonth(now.getFullYear(), now.getMonth(), calType);
        setEvents(evs.filter(e => !isEventCancelled(e)));
      } catch { setEvents([]); }
      finally { setLoadingEvents(false); }
    })();
  }, [tab, calType]);

  const callCalendarFunction = async (action: string, payload: object) => {
    const res = await functions.createExecution(
      APPWRITE_FUNCTION_ID,
      JSON.stringify({ service: 'google-calendar', action, ...payload }),
      false,
    );
    if (res.status !== 'completed' || res.responseStatusCode !== 200) {
      throw new Error('Calendar function failed.');
    }
    const body = JSON.parse(res.responseBody);
    if (!body.success) throw new Error(body.error || 'Function returned an error');
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
      <h2 className="text-2xl font-bold text-white mb-6">Event Maker</h2>

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
              tab === t ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
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
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
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
          <div className="flex gap-1 mb-4 bg-gray-900 rounded-lg p-1 w-fit border border-gray-800">
            {(['public', 'private'] as const).map(t => (
              <button
                key={t}
                onClick={() => setCalType(t)}
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
            <div className="space-y-2 max-w-2xl">
              {events.map(ev => (
                <div key={ev.id} className="bg-[#0e0e0e] border border-[#1c1c1c] rounded-xl px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{ev.title}</p>
                    <p className="text-gray-500 text-xs mt-0.5">
                      {formatDate(ev.startDateTime)} · {formatTime(ev.startDateTime, ev.dateOnly)}
                    </p>
                    {ev.location && <p className="text-gray-600 text-xs truncate mt-0.5">{ev.location}</p>}
                  </div>
                  <button
                    onClick={() => handleDeleteEvent(ev)}
                    className="p-1.5 text-gray-600 hover:text-red-400 transition-colors"
                    title="Delete"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
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
}: {
  coaches: CoachRecord[];
  allPlayers: PlayerRecord[];
  callCalendarFunction: (action: string, payload: object) => Promise<any>;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [form, setForm] = useState<EventFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  const set = <K extends keyof EventFormData>(k: K, v: EventFormData[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  // Auto-set end time when start time changes
  const handleStartTime = (v: string) => {
    setForm(f => ({ ...f, startTime: v, endTime: plusOneHour(v) }));
  };

  // Auto-fill title when event type changes (mobile uses eventType as title fallback)
  const handleEventType = (v: string) => {
    setForm(f => ({ ...f, eventType: v, title: f.title || v }));
  };

  // ─── Address autocomplete ───
  const [addrInput, setAddrInput] = useState('');
  const [addrSuggestions, setAddrSuggestions] = useState<GooglePlacesPrediction[]>([]);
  const [addrOpen, setAddrOpen] = useState(false);
  const [addrSelected, setAddrSelected] = useState(false);
  const addrTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchAddressSuggestions = useCallback(async (input: string) => {
    if (input.length < 2) { setAddrSuggestions([]); setAddrOpen(false); return; }
    const out = await GooglePlacesService.getAutocompleteSuggestions(input, 'establishment', {
      componentRestrictions: { country: 'us' },
    });
    setAddrSuggestions(out);
    setAddrOpen(out.length > 0);
  }, []);

  const handleAddressInput = (text: string) => {
    setAddrInput(text);
    set('location', text);
    setAddrSelected(false);
    if (addrTimeout.current) clearTimeout(addrTimeout.current);
    addrTimeout.current = setTimeout(() => fetchAddressSuggestions(text), 250);
  };

  const handleSelectSuggestion = async (s: GooglePlacesPrediction) => {
    let location = s.description;
    try {
      const details = await GooglePlacesService.getPlaceDetails(s.place_id);
      if (details?.name && details?.formatted_address) {
        location = `${details.name}, ${details.formatted_address}`;
      } else if (details?.formatted_address) {
        location = details.formatted_address;
      }
    } catch { /* fall back to description */ }
    setAddrInput(location);
    set('location', location);
    setAddrSelected(true);
    setAddrOpen(false);
  };

  const handlePresetVenue = (preset: { label: string; address: string }) => {
    setAddrInput(preset.address);
    set('location', preset.address);
    setAddrSelected(true);
    setAddrOpen(false);
  };

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
    const newErr = {
      title: titleRequired && !form.title.trim(),
      date: !form.date.trim(),
      startTime: !startValid,
      endTime: !endValid,
      timeOrder: timeOrderInvalid,
      location: !isAnalysis && (!form.location.trim() || !addrSelected),
      eventType: !form.eventType,
    };
    setErrors(newErr);
    return !Object.values(newErr).some(Boolean);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) { onError('Please fill in all required fields correctly.'); return; }
    if (form.isRecurring) {
      const w = parseInt(form.recurringWeeks);
      if (!w || w < 1 || w > 52) { onError('Recurring weeks must be 1–52.'); return; }
    }

    setSaving(true);
    try {
      const calendarType = calendarTypeFor(form.eventType);
      const eventTitle = form.title.trim() || form.eventType;
      const startTime24 = to24h(form.startTime);
      const endTime24 = to24h(form.endTime);

      const weeksToCreate = form.isRecurring ? parseInt(form.recurringWeeks) : 1;
      let createdCount = 0;

      for (let week = 0; week < weeksToCreate; week++) {
        const [yr, mo, dy] = form.date.split('-').map(Number);
        const baseDate = new Date(yr, mo - 1, dy);
        baseDate.setDate(baseDate.getDate() + week * 7);
        const eventDateStr = `${baseDate.getFullYear()}-${String(baseDate.getMonth() + 1).padStart(2, '0')}-${String(baseDate.getDate()).padStart(2, '0')}`;

        const result = await callCalendarFunction('createEvent', {
          calendarType,
          title: eventTitle,
          date: eventDateStr,
          startTime: startTime24,
          endTime: endTime24,
          location: form.location,
          description: '',
          coachIds: form.selectedCoaches.map(c => c.$id),
          playerIds: form.selectedPlayers.map(p => p.$id),
        });

        const eventId: string = result.eventId || result.id || '';
        const eventDateISO = `${eventDateStr}T${startTime24}:00`;

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
              isProxySignup: false,
            })
          ));
        }
        createdCount++;
      }

      onSuccess(
        createdCount === 1
          ? 'Event created successfully.'
          : `${createdCount} recurring events created successfully.`
      );
      setForm(EMPTY_FORM);
      setAddrInput('');
      setAddrSelected(false);
      setErrors({});
    } catch (err: any) {
      onError(err.message || 'Failed to create event.');
    } finally {
      setSaving(false);
    }
  };

  const isAnalysis = ANALYSIS_EVENT_TYPES.includes(form.eventType);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* Event Type */}
      <Dropdown
        label="Event Type *"
        value={form.eventType}
        options={ALL_EVENT_TYPES}
        onChange={handleEventType}
        placeholder="Select event type"
        error={errors.eventType}
      />

      {/* Title */}
      <div>
        <label className="block text-gray-400 text-xs mb-1">Title {form.eventType ? '(optional)' : '*'}</label>
        <input
          type="text"
          value={form.title}
          onChange={e => set('title', e.target.value)}
          placeholder={form.eventType || 'Event title'}
          className={`w-full px-3 py-2 bg-[#1a1a1a] border rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-600 ${
            errors.title ? 'border-red-500/50' : 'border-[#2a2a2a]'
          }`}
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
            className={`w-full px-3 py-2 bg-[#1a1a1a] border rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${
              errors.date ? 'border-red-500/50' : 'border-[#2a2a2a]'
            }`}
          />
        </div>
        <Dropdown
          label="Start Time *"
          value={form.startTime}
          options={START_TIME_OPTIONS}
          onChange={handleStartTime}
          placeholder="Start"
          error={errors.startTime}
        />
        <Dropdown
          label="End Time *"
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
        <div className="relative">
          <label className="block text-gray-400 text-xs mb-1">Location *</label>

          {/* Preset venue pills */}
          <div className="flex flex-wrap gap-1.5 mb-2">
            {PRESET_VENUES.map(v => (
              <button
                key={v.label}
                type="button"
                onClick={() => handlePresetVenue(v)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                  form.location === v.address
                    ? 'bg-blue-600/20 border-blue-500/40 text-blue-300'
                    : 'bg-white/[0.04] border-white/10 text-white/50 hover:text-white hover:border-white/25'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={addrInput || form.location}
            onChange={e => handleAddressInput(e.target.value)}
            onFocus={() => { if (addrSuggestions.length > 0) setAddrOpen(true); }}
            placeholder="Search a venue, school, or address…"
            className={`w-full px-3 py-2 bg-[#1a1a1a] border rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-600 ${
              errors.location ? 'border-red-500/50' : 'border-[#2a2a2a]'
            }`}
          />
          {addrOpen && addrSuggestions.length > 0 && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setAddrOpen(false)} />
              <div className="absolute z-20 mt-1 left-0 right-0 bg-[#111] border border-[#2a2a2a] rounded-lg shadow-xl max-h-56 overflow-y-auto">
                {addrSuggestions.map(s => (
                  <button
                    key={s.place_id}
                    type="button"
                    onClick={() => handleSelectSuggestion(s)}
                    className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-white/[0.04] transition-colors"
                  >
                    {s.description}
                  </button>
                ))}
              </div>
            </>
          )}
          {errors.location && <p className="text-red-400 text-xs mt-1">Please select a location from suggestions.</p>}
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
                  const name = `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || c.$id;
                  return (
                    <button
                      key={c.$id}
                      type="button"
                      onClick={() => toggleCoach(c)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-white/[0.04]"
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                        checked ? 'bg-blue-600 border-blue-600' : 'border-gray-600'
                      }`}>
                        {checked && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className="text-gray-300">{name}</span>
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
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-blue-600/20 border border-blue-500/30 text-blue-300"
                >
                  {p.firstName} {p.lastName}
                  <button
                    type="button"
                    onClick={() => removePlayer(p.$id)}
                    className="text-blue-300/60 hover:text-blue-300"
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
            className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-600 disabled:opacity-50"
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
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider">{p.type}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recurring */}
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.isRecurring}
            onChange={e => set('isRecurring', e.target.checked)}
            className="w-4 h-4 rounded border-gray-600 bg-[#1a1a1a] text-blue-600 focus:ring-1 focus:ring-blue-500"
          />
          <span className="text-gray-300 text-sm">Recurring weekly</span>
        </label>
        {form.isRecurring && (
          <input
            type="number"
            min={1}
            max={52}
            value={form.recurringWeeks}
            onChange={e => set('recurringWeeks', e.target.value)}
            placeholder="weeks"
            className="w-24 px-3 py-1.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-600"
          />
        )}
      </div>

      {/* Submit */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={saving}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
          {saving ? 'Creating…' : 'Create Event'}
        </button>
      </div>
    </form>
  );
}

export default EventAssistantSection;
