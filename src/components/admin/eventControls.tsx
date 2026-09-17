import { useState, useEffect, useRef, useCallback } from 'react';
import { GooglePlacesService, GooglePlacesPrediction } from '../../services/googlePlaces';

// Shared session-editing controls. The Event Assistant builds sessions with
// these; the Attendance Manager edits existing ones with the same pieces, so
// both surfaces stay in step.

export interface CoachRecord {
  $id: string;
  userId?: string;
  firstName?: string;
  lastName?: string;
  [key: string]: any;
}

// ── Constants copied verbatim from mobile EventMakerScreen ───────────────────
export const PUBLIC_EVENT_TYPES = [
  'Morning Group Training',
  'Afternoon Group Training',
  'Evening Group Training',
  'Next Star x Nike Evening Group Training',
];
export const PRIVATE_EVENT_TYPES = ['Private Session'];
export const ANALYSIS_EVENT_TYPES = ['Game Analysis', 'Parent Consultation'];
// Private Session leads the list — it is by far the most frequently created type.
export const ALL_EVENT_TYPES = [...PRIVATE_EVENT_TYPES, ...PUBLIC_EVENT_TYPES, ...ANALYSIS_EVENT_TYPES];

// Every address is the Google Places formatted address and is prefixed with the
// venue name. Both matter downstream: coachPayouts matches facility hire on
// substrings of the location ("sofive", "bethesda soccer club") and derives the
// facility label from everything before the first comma.
export const PRESET_VENUES: { label: string; address: string }[] = [
  { label: 'Lewinsville Park', address: 'Lewinsville Park, 1659 Chain Bridge Rd, McLean, VA 22101' },
  { label: 'Whitman HS', address: 'Walt Whitman High School, 7100 Whittier Blvd, Bethesda, MD 20817' },
  { label: 'Somerset ES', address: 'Somerset Elementary School, 5811 Warwick Pl, Chevy Chase, MD 20815' },
  { label: 'Murch ES', address: 'Ben Murch Elementary School, 4810 36th St NW, Washington, DC 20008' },
  { label: 'Sofive Rockville', address: 'Sofive Soccer Centers Rockville, 1008 Westmore Ave, Rockville, MD 20850' },
  { label: 'Bethesda SC', address: 'Bethesda Soccer Club, 8717 Grovemont Cir, Gaithersburg, MD 20877' },
  { label: 'Howard University', address: 'Howard University, 2400 6th St NW, Washington, DC 20059' },
  { label: 'Wootton HS', address: 'Thomas S. Wootton High School, 2100 Wootton Pkwy, Rockville, MD 20850' },
];

// ── Coach picker roster ──────────────────────────────────────────────────────
export const normalizeCoachName = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ');

// Surfaced at the top of the picker, in this order. Everyone else follows
// alphabetically.
export const COACH_PRIORITY = [
  'paul torres',
  'phillip gyau',
  'ryan machado',
  'noah satriano',
  'jake steinman',
];

// Test accounts and people who are not coaches, kept out of the picker.
export const HIDDEN_COACH_NAMES = new Set([
  'coach testing',
  'mike kin',
  'peabo',
  'rolando aguilar',
]);

export const coachFullName = (c: CoachRecord) =>
  `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim();

// The head coach privates default to.
export const DEFAULT_PRIVATE_COACH = 'paul torres';

// Red asterisk for required field labels
export const Req = () => <span className="text-red-400 ml-0.5">*</span>;

// White box with a black check — matches the white button treatment.
export const Check = ({ checked }: { checked: boolean }) => (
  <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
    checked ? 'bg-white border-white' : 'border-gray-600'
  }`}>
    {checked && (
      <svg className="w-2.5 h-2.5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
      </svg>
    )}
  </div>
);

// 15-min interval slots between two 24-hour bounds (inclusive)
export function generateTimeRange(startHour24: number, endHour24: number): string[] {
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

// Start: 6:00 AM – 7:00 PM ; End: 7:00 AM – 8:00 PM
export const START_TIME_OPTIONS = generateTimeRange(6, 19);
export const END_TIME_OPTIONS = generateTimeRange(7, 20);

// Calendar-type derivation matches mobile logic
export function calendarTypeFor(eventType: string): 'public' | 'private' | 'analysis' {
  if (ANALYSIS_EVENT_TYPES.includes(eventType)) return 'analysis';
  if (PRIVATE_EVENT_TYPES.includes(eventType)) return 'private';
  return 'public';
}

// Convert "5:30 PM" → "17:30"
export function to24h(time12: string): string {
  if (!time12) return '';
  const [t, ampm] = time12.split(' ');
  const [hStr, mStr] = t.split(':');
  let h = parseInt(hStr);
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${mStr}`;
}

// "5:30 PM" + 1h → "6:30 PM"
export function plusOneHour(time12: string): string {
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


// ── Location picker modal — themed, rounded, with map preview ───────────────
export function LocationPickerModal({
  open, currentValue, onClose, onSelect,
}: {
  open: boolean;
  currentValue: string;
  onClose: () => void;
  onSelect: (loc: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<GooglePlacesPrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(currentValue);
  const tRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) { setQuery(''); setSuggestions([]); setPreview(currentValue); }
  }, [open, currentValue]);

  const fetchSuggestions = useCallback(async (input: string) => {
    if (input.trim().length < 2) { setSuggestions([]); return; }
    setLoading(true);
    try {
      // No `types` filter: restricting to 'establishment' makes Google return
      // ZERO_RESULTS for plain street addresses, so both are requested here and
      // the venue/address mix comes back ranked by relevance.
      const out = await GooglePlacesService.getAutocompleteSuggestions(input, '', {
        componentRestrictions: { country: 'us' },
      });
      setSuggestions(out);
    } finally { setLoading(false); }
  }, []);

  const handleQuery = (v: string) => {
    setQuery(v);
    if (tRef.current) clearTimeout(tRef.current);
    tRef.current = setTimeout(() => fetchSuggestions(v), 250);
  };

  const pickSuggestion = async (s: GooglePlacesPrediction) => {
    let location = s.description;
    try {
      const details = await GooglePlacesService.getPlaceDetails(s.place_id);
      const address = details?.formatted_address;
      const name = details?.name?.trim();
      if (address) {
        // A street address comes back with its house number as the `name`, so
        // prefixing it would read "7100, 7100 Whittier Blvd". Only venues get
        // the name prepended.
        location = name && !address.startsWith(name) ? `${name}, ${address}` : address;
      }
    } catch { /* fall back */ }
    setPreview(location);
  };

  if (!open) return null;

  const mapsKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  const mapSrc = preview && mapsKey
    ? `https://www.google.com/maps/embed/v1/place?key=${mapsKey}&q=${encodeURIComponent(preview)}`
    : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[#141214] border border-white/[0.08] rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div>
            <h3 className="text-white text-base font-semibold">Pick Location</h3>
            <p className="text-white/40 text-xs mt-0.5">Choose a preset, search, or type an address.</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white p-1.5 rounded-lg hover:bg-white/[0.04] transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Preset venues */}
          <div>
            <p className="text-white/40 text-[10px] uppercase tracking-wider mb-2">Frequent Locations</p>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_VENUES.map(v => (
                <button
                  key={v.label}
                  onClick={() => setPreview(v.address)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    preview === v.address
                      ? 'bg-white border-white text-black'
                      : 'bg-white/[0.03] border-white/[0.10] text-white/55 hover:text-white hover:border-white/25'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <p className="text-white/40 text-[10px] uppercase tracking-wider mb-2">Search</p>
            <input
              type="text"
              value={query}
              onChange={e => handleQuery(e.target.value)}
              placeholder="Type a venue, school, or address…"
              autoFocus
              className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.10] rounded-xl text-white text-sm placeholder-white/25 focus:outline-none focus:border-white/30 transition-colors"
            />
            {loading && (
              <div className="absolute right-3 top-9 w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
            )}
            {suggestions.length > 0 && (
              <div className="mt-2 bg-white/[0.03] border border-white/[0.08] rounded-xl overflow-hidden divide-y divide-white/[0.05]">
                {suggestions.map(s => (
                  <button
                    key={s.place_id}
                    onClick={() => pickSuggestion(s)}
                    className="w-full text-left px-3 py-2.5 text-sm text-white/80 hover:bg-white/[0.04] transition-colors"
                  >
                    {s.description}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Map preview */}
          {preview && (
            <div>
              <p className="text-white/40 text-[10px] uppercase tracking-wider mb-2">Preview</p>
              <div className="rounded-xl overflow-hidden border border-white/[0.08] bg-white/[0.02]">
                {mapSrc ? (
                  <iframe
                    src={mapSrc}
                    className="w-full h-56"
                    style={{ border: 0 }}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title="Location preview"
                  />
                ) : (
                  <div className="px-4 py-6 text-white/30 text-xs text-center">
                    Map preview unavailable (set VITE_GOOGLE_MAPS_API_KEY).
                  </div>
                )}
                <div className="px-4 py-2.5 border-t border-white/[0.06]">
                  <p className="text-white text-xs">{preview}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-white/[0.06] bg-white/[0.02]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-white/60 hover:text-white border border-white/[0.10] hover:border-white/30 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => preview && onSelect(preview)}
            disabled={!preview}
            className="px-4 py-2 text-sm font-medium bg-white hover:bg-gray-200 text-black rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Use This Location
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Calendar helpers ─────────────────────────────────────────────────────────
export const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// YYYY-MM-DD for a local-time y/m/d triple, avoiding UTC shifts from toISOString
export const dateKey = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

// "Mon, Sep 21" from a YYYY-MM-DD key
export const prettyDate = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
};

// ── Reusable dropdown ────────────────────────────────────────────────────────
export function Dropdown({
  label, required, value, options, onChange, placeholder = 'Select…', error,
}: {
  label: string;
  required?: boolean;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  placeholder?: string;
  error?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <label className="block text-gray-400 text-xs mb-1">
        {label}{required && <Req />}
      </label>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full px-3 py-2 bg-[#1a1a1a] border rounded-lg text-left text-sm focus:outline-none focus:ring-1 focus:ring-white/40 transition-colors flex items-center justify-between ${
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
                  value === opt ? 'bg-white text-black font-medium' : 'text-gray-300 hover:bg-white/[0.04]'
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

// Today as YYYY-MM-DD in local time.
export const todayStr = () => new Date().toLocaleDateString('en-CA');

// ── Single-date calendar modal ───────────────────────────────────────────────
export function DatePickerModal({
  open, value, onClose, onSelect,
}: {
  open: boolean;
  value: string;               // YYYY-MM-DD
  onClose: () => void;
  onSelect: (day: string) => void;
}) {
  const [month, setMonth] = useState(() => {
    const [y, m] = (value || todayStr()).split('-').map(Number);
    return new Date(y, (m || 1) - 1, 1);
  });
  useEffect(() => {
    if (!open) return;
    const [y, m] = (value || todayStr()).split('-').map(Number);
    setMonth(new Date(y, (m || 1) - 1, 1));
  }, [open, value]);

  if (!open) return null;
  const y = month.getFullYear(), m = month.getMonth();
  const blanks = new Date(y, m, 1).getDay();
  const daysIn = new Date(y, m + 1, 0).getDate();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#141214] border border-white/[0.08] rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06]">
          <h3 className="text-white text-base font-semibold">Pick Date</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white p-1.5 rounded-lg hover:bg-white/[0.04] transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={() => setMonth(new Date(y, m - 1, 1))}
              className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.06]" aria-label="Previous month">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <p className="text-white text-sm font-medium">{month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
            <button type="button" onClick={() => setMonth(new Date(y, m + 1, 1))}
              className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.06]" aria-label="Next month">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAY_LABELS.map((d, i) => (
              <div key={i} className="text-center text-white/30 text-[10px] uppercase tracking-wider py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: blanks }, (_, i) => <div key={`b${i}`} />)}
            {Array.from({ length: daysIn }, (_, i) => {
              const key = dateKey(y, m, i + 1);
              const picked = key === value;
              return (
                <button key={key} type="button" onClick={() => onSelect(key)}
                  className={`aspect-square rounded-lg text-sm transition-colors ${
                    picked ? 'bg-white text-black font-semibold'
                           : `text-white/70 hover:bg-white/[0.08] hover:text-white ${key === todayStr() ? 'ring-1 ring-white/30' : ''}`
                  }`}>
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Coach multi-select ───────────────────────────────────────────────────────
export function CoachPicker({ coaches, selected, onToggle }: {
  coaches: CoachRecord[];
  selected: CoachRecord[];
  onToggle: (c: CoachRecord) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full px-3 py-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg text-left text-sm text-gray-300 hover:border-gray-600 flex items-center justify-between">
        <span className="truncate">
          {selected.length === 0 ? 'Select coaches…' : selected.map(c => coachFullName(c)).join(', ')}
        </span>
        <svg className={`w-3.5 h-3.5 text-gray-500 ml-2 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 w-full bg-[#111] border border-[#2a2a2a] rounded-lg shadow-xl max-h-56 overflow-y-auto">
            {coaches.length === 0 ? (
              <p className="text-gray-600 text-xs text-center py-3">No coaches found</p>
            ) : coaches.map(c => {
              const checked = selected.some(x => x.$id === c.$id);
              return (
                <button key={c.$id} type="button" onClick={() => onToggle(c)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-white/[0.04]">
                  <Check checked={checked} />
                  <span className={checked ? 'text-white' : 'text-gray-300'}>{coachFullName(c) || c.$id}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// Orders the roster the way the pickers expect and drops test/non-coach rows.
export function sortCoachRoster(docs: CoachRecord[]): CoachRecord[] {
  const rank = (c: CoachRecord) => {
    const i = COACH_PRIORITY.indexOf(normalizeCoachName(coachFullName(c)));
    return i === -1 ? COACH_PRIORITY.length : i;
  };
  return docs
    .filter(c => !HIDDEN_COACH_NAMES.has(normalizeCoachName(coachFullName(c))))
    .sort((a, b) => rank(a) - rank(b) || coachFullName(a).localeCompare(coachFullName(b)));
}
