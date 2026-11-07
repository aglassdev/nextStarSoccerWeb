import { useEffect, useRef, useState } from 'react';
import { AppModal, CheckIcon, ChevronDownIcon, SaveButton } from './ui';
import { POSITION_OPTIONS } from './fields';
import { nations, youthClubs } from './lists';
import { searchClubs, searchColleges, searchSchools } from './search';

// The app's profile edit modals (components/profile/modals): Position,
// Dropdown, Club, Nation, Youth Club, School, College and Experience.

export type EditorType = 'position' | 'dropdown' | 'club' | 'nation' | 'youthClub' | 'school' | 'college' | 'experience';

export interface EditRequest {
  field: string;
  type: EditorType;
  title: string;
  value: any;
  options?: string[];
}

const inputClass =
  'w-full h-[45px] px-3 rounded bg-transparent border border-white text-white text-base placeholder:text-[#666] focus:outline-none focus:ring-2 focus:ring-white/30';

const toList = (v: any): string[] =>
  Array.isArray(v) ? v.filter(Boolean) : typeof v === 'string' && v.trim() ? v.split(',').map((s) => s.trim()).filter(Boolean) : [];

/** The cream dropdown menu the app's pickers open under their input. */
const Menu = ({ children }: { children: React.ReactNode }) => (
  <div className="absolute left-0 right-0 top-[45px] z-10 max-h-[200px] overflow-y-auto rounded bg-[#F4F2EE] shadow-lg">
    {children}
  </div>
);
const MenuItem = ({ onPick, children }: { onPick: () => void; children: React.ReactNode }) => (
  <button
    type="button"
    // mousedown so the pick lands before the input's blur closes the menu
    onMouseDown={(e) => { e.preventDefault(); onPick(); }}
    className="w-full min-h-[45px] px-3 py-2.5 text-left text-black text-base hover:bg-black/[0.06] flex items-center"
  >
    {children}
  </button>
);

/** Text input with a suggestion menu (clubs, nations, schools, colleges). */
const Autocomplete = ({ value, onChange, placeholder, suggestions, loading, loadingText, minChars, onPick }: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  suggestions: { key: string; label: string; value: string }[];
  loading?: boolean;
  loadingText?: string;
  minChars: number;
  onPick: (v: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const showMenu = open && value.length >= minChars && (suggestions.length > 0 || !!loading);
  return (
    <div className="relative mb-5">
      <input
        autoFocus
        className={inputClass}
        value={value}
        placeholder={placeholder}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      />
      {showMenu && (
        <Menu>
          {loading ? (
            <p className="px-3 py-3 text-sm italic text-[#666]">{loadingText}</p>
          ) : (
            suggestions.map((s) => (
              <MenuItem key={s.key} onPick={() => { onPick(s.value); setOpen(false); }}>{s.label}</MenuItem>
            ))
          )}
        </Menu>
      )}
    </div>
  );
};

/** Debounced async suggestions (300ms, as in the app). */
function useSuggestions<T>(term: string, search: (t: string) => Promise<T[]>, enabled: boolean) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const searchRef = useRef(search);
  searchRef.current = search;
  useEffect(() => {
    if (!enabled) { setItems([]); setLoading(false); return; }
    let live = true;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await searchRef.current(term);
        if (live) setItems(r);
      } catch {
        if (live) setItems([]);
      } finally {
        if (live) setLoading(false);
      }
    }, 300);
    return () => { live = false; clearTimeout(t); };
  }, [term, enabled]);
  return { items, loading };
}

const PositionEditor = ({ value, onSave, saving }: { value: any; onSave: (v: string[]) => void; saving: boolean }) => {
  const [selected, setSelected] = useState<string[]>(() => toList(value));
  const [open, setOpen] = useState(false);
  const toggle = (v: string) => setSelected((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]));
  const display =
    selected.length === 0 ? 'Select Position(s)'
      : selected.length === 1 ? POSITION_OPTIONS.find((p) => p.value === selected[0])?.label || selected[0]
        : 'Multiple Positions';
  return (
    <>
      <div className="relative mb-5">
        <button type="button" onClick={() => setOpen(!open)}
          className="w-full h-[45px] px-3 rounded border border-white flex items-center justify-between text-left">
          <span className={selected.length ? 'text-white' : 'text-white/70'}>{display}</span>
          <ChevronDownIcon className={`w-3 h-3 text-white transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <Menu>
            {POSITION_OPTIONS.map((o) => {
              const on = selected.includes(o.value);
              return (
                <MenuItem key={o.value} onPick={() => toggle(o.value)}>
                  <span className={`mr-3 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${on ? 'bg-[#1e1e1e] border-[#1e1e1e] text-white' : 'border-[#ccc]'}`}>
                    {on && <CheckIcon />}
                  </span>
                  {o.label}
                </MenuItem>
              );
            })}
          </Menu>
        )}
      </div>
      <SaveButton disabled={selected.length === 0 || saving} onClick={() => onSave(selected)} className="mt-5">
        {saving ? 'Saving…' : 'Save'}
      </SaveButton>
    </>
  );
};

const DropdownEditor = ({ value, options, onSave, saving }: { value: string; options: string[]; onSave: (v: string) => void; saving: boolean }) => {
  const [selected, setSelected] = useState(value || '');
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="relative mb-5">
        <button type="button" onClick={() => setOpen(!open)}
          className="w-full h-[45px] px-3 rounded border border-white flex items-center justify-between text-left">
          <span className={selected ? 'text-white' : 'text-white/70'}>{selected || 'Select option'}</span>
          <ChevronDownIcon className={`w-3 h-3 text-white transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <Menu>
            {options.map((o) => (
              <MenuItem key={o} onPick={() => { setSelected(o); setOpen(false); }}>
                <span className={o === selected ? 'font-medium' : ''}>{o}</span>
              </MenuItem>
            ))}
          </Menu>
        )}
      </div>
      <SaveButton disabled={!selected || saving} onClick={() => onSave(selected)} className="mt-5">
        {saving ? 'Saving…' : 'Save'}
      </SaveButton>
    </>
  );
};

const ExperienceEditor = ({ value, onSave, saving }: { value: any; onSave: (v: string[]) => void; saving: boolean }) => {
  const [rows, setRows] = useState<string[]>(() => {
    const r = Array.isArray(value) ? [...value] : [];
    while (r.length < 3) r.push('');
    return r.slice(0, 3);
  });
  return (
    <>
      <div className="space-y-4 mb-5">
        {rows.map((r, i) => (
          <label key={i} className="block">
            <span className="block text-white text-sm font-medium mb-2">Experience #{i + 1}</span>
            <textarea
              rows={2}
              value={r}
              placeholder={`Experience ${i + 1}`}
              onChange={(e) => setRows(rows.map((x, j) => (j === i ? e.target.value : x)))}
              className="w-full px-3 py-2.5 rounded bg-transparent border border-white text-white text-base placeholder:text-[#666] focus:outline-none focus:ring-2 focus:ring-white/30 resize-none"
            />
          </label>
        ))}
      </div>
      <SaveButton disabled={saving} onClick={() => onSave(rows.filter((x) => x.trim() !== ''))}>
        {saving ? 'Saving…' : 'Save'}
      </SaveButton>
    </>
  );
};

/** Club / nation / youth club / school / college: a search box and a Save button. */
const SearchEditor = ({ type, value, onSave, saving }: {
  type: 'club' | 'nation' | 'youthClub' | 'school' | 'college';
  value: string;
  onSave: (v: string) => void;
  saving: boolean;
}) => {
  const [text, setText] = useState(typeof value === 'string' ? value : '');
  const q = text.trim().toLowerCase();

  const clubs = useSuggestions(text, searchClubs, type === 'club' && text.trim().length >= 3);
  const schools = useSuggestions(text, searchSchools, type === 'school' && text.length > 2);
  const colleges = useSuggestions(text, searchColleges, type === 'college' && text.length > 1);

  let suggestions: { key: string; label: string; value: string }[] = [];
  let loading = false;
  let loadingText = '';
  let minChars = 1;
  let placeholder = 'Enter club name';
  if (type === 'club') {
    suggestions = clubs.items.map((c) => ({ key: c.id, label: c.displayName, value: c.name }));
    loading = clubs.loading;
    loadingText = 'Loading clubs...';
    minChars = 2;
    placeholder = 'Search for club';
  } else if (type === 'school') {
    suggestions = schools.items.map((s) => ({ key: s.id, label: s.description, value: s.name }));
    loading = schools.loading;
    loadingText = 'Searching schools...';
    minChars = 3;
    placeholder = 'Enter school name';
  } else if (type === 'college') {
    suggestions = colleges.items.map((c) => ({ key: c, label: c, value: c }));
    loading = colleges.loading;
    loadingText = 'Searching colleges...';
    minChars = 2;
    placeholder = 'Enter college name';
  } else if (type === 'nation') {
    suggestions = q ? nations.filter((n) => n.toLowerCase().includes(q)).map((n) => ({ key: n, label: n, value: n })) : [];
    placeholder = 'Enter nation name';
  } else {
    suggestions = q ? youthClubs.filter((c) => c.toLowerCase().includes(q)).map((c) => ({ key: c, label: c, value: c })) : [];
  }

  // Nation must be one from the list; the others accept any text.
  const validNation = type === 'nation' ? nations.find((n) => n.toLowerCase() === q) : undefined;
  const canSave = type === 'nation' ? !!validNation : !!text.trim();

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (canSave && !saving) onSave(validNation || text.trim()); }}>
      <Autocomplete
        value={text}
        onChange={setText}
        placeholder={placeholder}
        suggestions={suggestions}
        loading={loading}
        loadingText={loadingText}
        minChars={minChars}
        onPick={setText}
      />
      <SaveButton type="submit" disabled={!canSave || saving}>{saving ? 'Saving…' : 'Save'}</SaveButton>
    </form>
  );
};

const EditFieldModal = ({ request, onClose, onSave }: {
  request: EditRequest;
  onClose: () => void;
  /** Resolves when saved; the modal then closes. Rejects with a message to show. */
  onSave: (field: string, value: any) => Promise<void>;
}) => {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const save = async (value: any) => {
    setSaving(true);
    setError('');
    try {
      await onSave(request.field, value);
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Could not save. Please try again.');
      setSaving(false);
    }
  };

  let body: React.ReactNode;
  switch (request.type) {
    case 'position':
      body = <PositionEditor value={request.value} onSave={save} saving={saving} />;
      break;
    case 'dropdown':
      body = <DropdownEditor value={request.value} options={request.options || []} onSave={save} saving={saving} />;
      break;
    case 'experience':
      body = <ExperienceEditor value={request.value} onSave={save} saving={saving} />;
      break;
    default:
      body = <SearchEditor type={request.type} value={request.value} onSave={save} saving={saving} />;
  }

  return (
    <AppModal title={request.title} onClose={onClose} wide={request.type === 'experience'}>
      {body}
      {error && <p className="text-[#ff4444] text-sm text-center mt-3">{error}</p>}
    </AppModal>
  );
};

export default EditFieldModal;
