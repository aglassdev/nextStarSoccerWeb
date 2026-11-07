import { useEffect, useRef, useState } from 'react';
import { GooglePlacesService, type GooglePlacesPrediction } from '@/services/googlePlaces';
import { CHAT_EVENT_TYPES, TIME_OPTIONS, formatDateDisplay } from './eventCards';

// The app's "Alter Event" modal (ChatScreen renderEventFormModal): event type,
// date, start/end time and a location search, with Cancel / Send.

export interface EventFormValues {
  eventType: string;
  eventDate: string; // YYYY-MM-DD
  eventStartTime: string; // "5:00 PM"
  eventEndTime: string;
  eventLocation: string;
}

type Open = 'type' | 'date' | 'start' | 'end' | 'loc' | null;

const Chevron = () => (
  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" /></svg>
);
const CalendarIcon = () => (
  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2" /><path strokeLinecap="round" d="M3 10h18M8 3v4M16 3v4" /></svg>
);
const ClockIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path strokeLinecap="round" d="M12 7v5l3 2" /></svg>
);

const label = 'block text-[#F4F2EE] text-base font-medium mt-3 mb-2';
const pickerButton =
  'w-full h-[45px] px-3.5 flex items-center justify-between gap-2 border border-[#F4F2EE] rounded text-[#F4F2EE] text-base text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40';
const dropdown = 'mt-1 bg-[#F4F2EE] rounded overflow-hidden';
const option = 'w-full text-left px-3.5 py-3 min-h-[45px] text-black text-[15px] hover:bg-[#e8e6e2]';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const pad = (n: number) => String(n).padStart(2, '0');

/** The app's inline calendar dropdown (react-native-calendars). */
const MiniCalendar = ({ value, onPick }: { value: string; onPick: (iso: string) => void }) => {
  const start = value ? new Date(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, 1) : new Date();
  const [view, setView] = useState({ y: start.getFullYear(), m: start.getMonth() });
  const first = new Date(view.y, view.m, 1).getDay();
  const days = new Date(view.y, view.m + 1, 0).getDate();
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const shift = (d: number) => setView(({ y, m }) => ({ y: m + d < 0 ? y - 1 : m + d > 11 ? y + 1 : y, m: (m + d + 12) % 12 }));
  return (
    <div className="mt-1 bg-white rounded-lg p-3 text-[#2d4150]">
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={() => shift(-1)} className="w-8 h-8 rounded-full hover:bg-black/5" aria-label="Previous month">‹</button>
        <p className="font-medium">{new Date(view.y, view.m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
        <button type="button" onClick={() => shift(1)} className="w-8 h-8 rounded-full hover:bg-black/5" aria-label="Next month">›</button>
      </div>
      <div className="grid grid-cols-7 text-center text-[13px] text-[#b6c1cd] mb-1">
        {WEEKDAYS.map((d) => <span key={d}>{d}</span>)}
      </div>
      <div className="grid grid-cols-7 text-center gap-y-1">
        {Array.from({ length: first }, (_, i) => <span key={`b${i}`} />)}
        {Array.from({ length: days }, (_, i) => {
          const iso = `${view.y}-${pad(view.m + 1)}-${pad(i + 1)}`;
          const selected = iso === value;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onPick(iso)}
              className={`mx-auto w-8 h-8 rounded-full text-[15px] ${selected ? 'bg-black text-white' : iso === todayIso ? 'text-[#00adf5] font-semibold hover:bg-black/5' : 'hover:bg-black/5'}`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
};

interface Props {
  title: string;
  hint?: string;
  initial: EventFormValues;
  sending: boolean;
  onCancel: () => void;
  onSend: (values: EventFormValues) => void;
}

const EventFormModal = ({ title, hint, initial, sending, onCancel, onSend }: Props) => {
  const [v, setV] = useState<EventFormValues>(initial);
  const [open, setOpen] = useState<Open>(null);
  const [locSugs, setLocSugs] = useState<GooglePlacesPrediction[]>([]);
  const [locLoading, setLocLoading] = useState(false);
  const locTimer = useRef<ReturnType<typeof setTimeout>>();
  const timeListRef = useRef<HTMLDivElement>(null);
  const set = (patch: Partial<EventFormValues>) => setV((prev) => ({ ...prev, ...patch }));
  const toggle = (which: Open) => setOpen((o) => (o === which ? null : which));

  // A time list opens on the chosen time rather than at midnight.
  useEffect(() => {
    const list = timeListRef.current;
    const chosen = open === 'start' ? v.eventStartTime : open === 'end' ? v.eventEndTime : '';
    const item = list && chosen ? (list.children[TIME_OPTIONS.indexOf(chosen)] as HTMLElement | undefined) : undefined;
    if (list && item) list.scrollTop = item.offsetTop - list.clientHeight / 2 + item.offsetHeight / 2;
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const searchLocation = (text: string) => {
    set({ eventLocation: text });
    if (locTimer.current) clearTimeout(locTimer.current);
    locTimer.current = setTimeout(async () => {
      if (text.trim().length < 1) { setLocSugs([]); setOpen(null); return; }
      setLocLoading(true);
      try {
        const sug = await GooglePlacesService.getAutocompleteSuggestions(text, 'establishment', { componentRestrictions: { country: 'us' } });
        const safe = Array.isArray(sug) ? sug : [];
        setLocSugs(safe);
        setOpen(safe.length > 0 ? 'loc' : null);
      } catch {
        setLocSugs([]);
        setOpen(null);
      } finally {
        setLocLoading(false);
      }
    }, 300);
  };

  const pickLocation = async (s: GooglePlacesPrediction) => {
    let loc = s.description;
    try {
      const det = await GooglePlacesService.getPlaceDetails(s.place_id);
      if (det?.name && det?.formatted_address) loc = `${det.name}, ${det.formatted_address}`;
      else if (det?.formatted_address) loc = det.formatted_address;
    } catch {
      // keep the description
    }
    set({ eventLocation: loc });
    setOpen(null);
    setLocSugs([]);
  };

  const timeField = (which: 'start' | 'end') => {
    const key = which === 'start' ? 'eventStartTime' : 'eventEndTime';
    return (
      <div className="flex-1 min-w-0">
        <label className={label}>{which === 'start' ? 'Start Time' : 'End Time'}</label>
        <button type="button" className={pickerButton} onClick={() => toggle(which)}>
          <span className={`truncate ${v[key] ? '' : 'text-[#F4F2EE]/50'}`}>{v[key] || (which === 'start' ? 'Start' : 'End')}</span>
          <ClockIcon />
        </button>
        {open === which && (
          <div ref={timeListRef} className={`${dropdown} relative max-h-[200px] overflow-y-auto`}>
            {TIME_OPTIONS.map((t) => (
              <button key={t} type="button" className={`${option} ${v[key] === t ? 'bg-[#e8e6e2] font-bold' : ''}`} onClick={() => { set({ [key]: t }); setOpen(null); }}>
                {t}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-5 bg-black/70" onMouseDown={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-[520px] max-h-[80vh] flex flex-col bg-[#2C2C2C] rounded-2xl p-5"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h3 className={`text-[#F4F2EE] text-2xl font-bold text-center ${hint ? 'mb-1.5' : 'mb-4'}`}>{title}</h3>
        {hint && <p className="text-[#F4F2EE]/70 text-sm text-center mb-3">{hint}</p>}

        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          <label className={label}>Event Type</label>
          <button type="button" className={pickerButton} onClick={() => toggle('type')}>
            <span className={v.eventType ? '' : 'text-[#F4F2EE]/50'}>{v.eventType || 'Select event type'}</span>
            <Chevron />
          </button>
          {open === 'type' && (
            <div className={dropdown}>
              {CHAT_EVENT_TYPES.map((t) => (
                <button key={t} type="button" className={`${option} ${v.eventType === t ? 'bg-[#e8e6e2] font-bold' : ''}`} onClick={() => { set({ eventType: t }); setOpen(null); }}>
                  {t}
                </button>
              ))}
            </div>
          )}

          <label className={label}>Date</label>
          <button type="button" className={pickerButton} onClick={() => toggle('date')}>
            <span className={v.eventDate ? '' : 'text-[#F4F2EE]/50'}>{v.eventDate ? formatDateDisplay(v.eventDate) : 'Select a date'}</span>
            <CalendarIcon />
          </button>
          {open === 'date' && <MiniCalendar value={v.eventDate} onPick={(iso) => { set({ eventDate: iso }); setOpen(null); }} />}

          <div className="flex gap-2">
            {timeField('start')}
            {timeField('end')}
          </div>

          <label className={label}>Location</label>
          <input
            className="w-full h-[45px] px-3.5 bg-transparent border border-[#F4F2EE] rounded text-[#F4F2EE] text-base placeholder:text-[#F4F2EE]/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            placeholder="Search for a location..."
            value={v.eventLocation}
            onChange={(e) => searchLocation(e.target.value)}
            onFocus={() => setOpen(v.eventLocation.length >= 1 && locSugs.length > 0 ? 'loc' : null)}
          />
          {open === 'loc' && (
            <div className={dropdown}>
              {locLoading && <p className="px-3 py-3 text-[#666] text-sm italic">Loading...</p>}
              {!locLoading && locSugs.map((s, i) => (
                <button key={s.place_id || i} type="button" className={`${option} line-clamp-2`} onClick={() => pickLocation(s)}>
                  {s.description}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-5">
          <button type="button" onClick={onCancel} className="flex-1 py-3.5 border border-[#F4F2EE] rounded text-[#F4F2EE] text-[15px] font-medium hover:bg-white/5">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSend(v)}
            disabled={sending}
            className="flex-1 py-3.5 bg-[#F4F2EE] rounded text-black text-[15px] font-bold flex items-center justify-center hover:bg-white disabled:opacity-70"
          >
            {sending ? <span className="w-5 h-5 border-2 border-black/40 border-t-transparent rounded-full animate-spin" /> : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EventFormModal;
