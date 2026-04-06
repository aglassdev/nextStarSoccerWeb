import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ID } from 'appwrite';
import Navigation from '../components/layout/Navigation';
import Footer from '../components/layout/Footer';
import { databases, storage, databaseId, collections, buckets } from '../services/appwrite';

// ── Google Places loader ──────────────────────────────────────────────────────
declare global {
  interface Window {
    google: any;
    __mapsReady: boolean;
    __mapsCallbacks: Array<() => void>;
  }
}

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

function loadMapsScript(): Promise<void> {
  return new Promise(resolve => {
    if (typeof window === 'undefined') return;
    if (window.__mapsReady) { resolve(); return; }
    if (!window.__mapsCallbacks) window.__mapsCallbacks = [];
    window.__mapsCallbacks.push(resolve);
    if (document.getElementById('google-maps-script')) return; // already loading
    const script = document.createElement('script');
    script.id = 'google-maps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&libraries=places`;
    script.async = true;
    script.onload = () => {
      window.__mapsReady = true;
      (window.__mapsCallbacks || []).forEach(cb => cb());
      window.__mapsCallbacks = [];
    };
    document.head.appendChild(script);
  });
}

function SchoolAutocomplete({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!MAPS_KEY || !inputRef.current) return;
    let listener: any;
    loadMapsScript().then(() => {
      if (!inputRef.current || !window.google?.maps?.places) return;
      const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
        types: ['establishment'],
        componentRestrictions: { country: 'us' },
        fields: ['name'],
      });
      listener = ac.addListener('place_changed', () => {
        const place = ac.getPlace();
        if (place?.name) onChange(place.name);
      });
    });
    return () => {
      if (listener && window.google?.maps?.event) {
        window.google.maps.event.removeListener(listener);
      }
    };
  }, []);

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder="School name"
      autoComplete="off"
      className="w-full px-3.5 py-2.5 bg-[#111] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
    />
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface FormData {
  // Step 0 — Applicant (all required)
  applicantFirstName: string;
  applicantLastName: string;
  applicantDOB: string;
  applicantEmail: string;
  applicantPhone: string;
  applicantAddress: string;
  applicantCity: string;
  applicantState: string;
  applicantZip: string;

  // Step 1 — Player
  playerFirstName: string;
  playerLastName: string;
  playerDOB: string;
  playerGrade: string;   // required
  playerSchool: string;  // required
  clubTeam: string;      // optional
  trainingHistory: string;

  // Step 2 — Financial (all required except assistanceDetails)
  householdSize: string;
  incomeEarners: string;
  dependants: string;
  annualHouseholdIncome: string;
  receivesAssistance: string;
  assistanceDetails: string;

  // Step 3 — Statement & Docs
  personalStatement: string;
  coachReference: string;
}

const EMPTY: FormData = {
  applicantFirstName: '', applicantLastName: '', applicantDOB: '',
  applicantEmail: '', applicantPhone: '',
  applicantAddress: '', applicantCity: '', applicantState: '', applicantZip: '',
  playerFirstName: '', playerLastName: '', playerDOB: '',
  playerGrade: '', playerSchool: '', clubTeam: '', trainingHistory: '',
  householdSize: '', incomeEarners: '', dependants: '',
  annualHouseholdIncome: '', receivesAssistance: '', assistanceDetails: '',
  personalStatement: '', coachReference: '',
};

const STEPS = ['Applicant Info', 'Player Info', 'Financial Info', 'Statement & Docs', 'Review'];

const INCOME_BRACKETS = [
  'Under $40,000',
  '$40,001 – $80,000',
  '$80,001 – $120,000',
  '$120,001 – $160,000',
  '$160,001 – $200,000',
  'Over $200,000',
];

const EMPLOYMENT_OPTIONS = [
  'Employed full-time',
  'Employed part-time',
  'Self-employed',
  'Unemployed',
  'Retired',
  'Unable to work',
];

// ── Shared field components ───────────────────────────────────────────────────
const Field = ({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) => (
  <div>
    <label className="block text-gray-400 text-xs font-medium mb-1.5">
      {label}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
    {children}
  </div>
);

const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...props}
    className="w-full px-3.5 py-2.5 bg-[#111] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
  />
);

const Select = (props: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) => (
  <select
    {...props}
    className="w-full px-3.5 py-2.5 bg-[#111] border border-[#2a2a2a] rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
  />
);

const Textarea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea
    {...props}
    className="w-full px-3.5 py-2.5 bg-[#111] border border-[#2a2a2a] rounded-lg text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors resize-none"
  />
);

// ── Progress bar ──────────────────────────────────────────────────────────────
const ProgressBar = ({ step, total }: { step: number; total: number }) => (
  <div className="flex items-center gap-1.5 mb-8">
    {Array.from({ length: total }).map((_, i) => (
      <div
        key={i}
        className={`h-1 flex-1 rounded-full transition-all duration-300 ${
          i < step ? 'bg-blue-600' : i === step ? 'bg-blue-600/50' : 'bg-[#2a2a2a]'
        }`}
      />
    ))}
  </div>
);

// ── Review row ────────────────────────────────────────────────────────────────
const ReviewRow = ({ label, value }: { label: string; value?: string }) =>
  value ? (
    <div className="flex gap-3 py-2 border-b border-[#1a1a1a] last:border-0">
      <span className="text-gray-500 text-xs w-44 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-gray-200 text-xs flex-1">{value}</span>
    </div>
  ) : null;

// ── File upload ───────────────────────────────────────────────────────────────
interface UploadedFile {
  file: File;
  label: string;
  fileId?: string;
  uploading: boolean;
  error?: string;
}

const DOC_SLOTS = [
  { key: 'tax_return',   label: 'Most Recent Federal Tax Return (1040)', required: true  },
  { key: 'w2',           label: 'W-2 or 1099 Forms',                    required: true  },
  { key: 'pay_stubs',    label: 'Recent Pay Stubs (last 2 months)',      required: false },
  { key: 'benefits',     label: 'Government Assistance / Benefits Letter',required: false },
  { key: 'additional_1', label: 'Additional Document (optional)',         required: false },
  { key: 'additional_2', label: 'Additional Document (optional)',         required: false },
];

const FileUploadSlot = ({
  slotKey, label, required, uploadedFile, onFileSelect, onRemove,
}: {
  slotKey: string; label: string; required: boolean;
  uploadedFile?: UploadedFile;
  onFileSelect: (key: string, file: File) => void;
  onRemove: (key: string) => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="border border-[#2a2a2a] rounded-xl p-4 bg-[#0d0d0d]">
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="text-white text-sm font-medium leading-snug">
          {label}{required && <span className="text-red-400 ml-1">*</span>}
        </p>
        {uploadedFile && !uploadedFile.uploading && (
          <button type="button" onClick={() => onRemove(slotKey)} className="text-gray-600 hover:text-red-400 transition-colors flex-shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      {uploadedFile ? (
        <div className={`flex items-center gap-2.5 ${uploadedFile.error ? 'text-red-400' : 'text-green-400'}`}>
          {uploadedFile.uploading ? (
            <><div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" /><span className="text-gray-400 text-xs">Uploading…</span></>
          ) : uploadedFile.error ? (
            <><svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><span className="text-xs">{uploadedFile.error}</span></>
          ) : (
            <><svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg><span className="text-xs truncate">{uploadedFile.file.name}</span></>
          )}
        </div>
      ) : (
        <>
          <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) onFileSelect(slotKey, f); e.target.value = ''; }}
          />
          <button type="button" onClick={() => inputRef.current?.click()}
            className="flex items-center gap-2 text-gray-500 hover:text-blue-400 text-xs transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            Attach file (PDF, JPG, PNG — max 25 MB)
          </button>
        </>
      )}
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ScholarshipApplicationPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(EMPTY);
  const [employmentStatuses, setEmploymentStatuses] = useState<string[]>(['']);
  const [files, setFiles] = useState<Record<string, UploadedFile>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const set = (key: keyof FormData, val: string) => setForm(f => ({ ...f, [key]: val }));

  const numEarners = form.incomeEarners === '5+' ? 5 : (parseInt(form.incomeEarners) || 1);

  const handleIncomeEarnersChange = (val: string) => {
    set('incomeEarners', val);
    const n = val === '5+' ? 5 : (parseInt(val) || 1);
    setEmploymentStatuses(prev => Array.from({ length: n }, (_, i) => prev[i] || ''));
  };

  const setEmploymentStatus = (index: number, val: string) => {
    setEmploymentStatuses(prev => {
      const next = [...prev];
      next[index] = val;
      return next;
    });
  };

  // ── File handling ─────────────────────────────────────────────────────────
  const handleFileSelect = async (key: string, file: File) => {
    setFiles(prev => ({ ...prev, [key]: { file, label: key, uploading: true } }));
    try {
      const res = await storage.createFile(buckets.scholarshipDocuments, ID.unique(), file);
      setFiles(prev => ({ ...prev, [key]: { file, label: key, fileId: res.$id, uploading: false } }));
    } catch (e: any) {
      setFiles(prev => ({ ...prev, [key]: { file, label: key, uploading: false, error: e.message || 'Upload failed' } }));
    }
  };

  const handleFileRemove = (key: string) => {
    setFiles(prev => { const copy = { ...prev }; delete copy[key]; return copy; });
  };

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = (): string => {
    if (step === 0) {
      if (!form.applicantFirstName.trim()) return 'First name is required';
      if (!form.applicantLastName.trim())  return 'Last name is required';
      if (!form.applicantDOB)              return 'Date of birth is required';
      if (!form.applicantEmail.trim())     return 'Email address is required';
      if (!form.applicantPhone.trim())     return 'Phone number is required';
      if (!form.applicantAddress.trim())   return 'Street address is required';
      if (!form.applicantCity.trim())      return 'City is required';
      if (!form.applicantState.trim())     return 'State is required';
      if (!form.applicantZip.trim())       return 'ZIP code is required';
    }
    if (step === 1) {
      if (!form.playerFirstName.trim()) return "Player's first name is required";
      if (!form.playerLastName.trim())  return "Player's last name is required";
      if (!form.playerDOB)              return "Player's date of birth is required";
      if (!form.playerGrade)            return 'Grade is required';
      if (!form.playerSchool.trim())    return 'School name is required';
    }
    if (step === 2) {
      if (!form.householdSize)            return 'Household size is required';
      if (!form.incomeEarners)            return 'Number of income earners is required';
      if (form.dependants === '')         return 'Number of dependants is required';
      if (!form.annualHouseholdIncome)    return 'Annual household income is required';
      for (let i = 0; i < numEarners; i++) {
        if (!employmentStatuses[i]) {
          return numEarners === 1
            ? 'Employment status is required'
            : `Employment status for Income Earner ${i + 1} is required`;
        }
      }
      if (!form.receivesAssistance) return 'Please indicate if your family receives government assistance';
    }
    if (step === 3) {
      if (!form.personalStatement.trim()) return 'Personal statement is required';
      for (const slot of DOC_SLOTS.filter(s => s.required)) {
        const f = files[slot.key];
        if (!f || f.uploading || f.error) return `Please attach: ${slot.label}`;
      }
    }
    return '';
  };

  const next = () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError('');
    setStep(s => s + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const back = () => { setError(''); setStep(s => s - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const uploadedIds = Object.values(files)
        .filter(f => f.fileId)
        .map(f => `${f.label}:${f.fileId}`)
        .join(',');

      await databases.createDocument(databaseId, collections.scholarshipApplications, ID.unique(), {
        ...form,
        employmentStatus: employmentStatuses.join(' | '),
        documentFileIds: uploadedIds,
        status: 'pending',
        submittedAt: new Date().toISOString(),
      });
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: any) {
      setError(e.message || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Confirmation ──────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-black flex flex-col font-lt-wave">
        <Navigation />
        <div className="flex-1 flex items-center justify-center px-4 py-24">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-6 mx-auto">
              <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-white text-3xl font-bold mb-4">Application Submitted</h2>
            <p className="text-gray-400 text-base leading-relaxed mb-8">
              Thank you, {form.applicantFirstName}. Our scholarship committee will review your application and contact you at{' '}
              <span className="text-white">{form.applicantEmail}</span> within 2–3 weeks.
            </p>
            <button
              onClick={() => navigate('/scholarships')}
              className="px-8 py-3 bg-white hover:bg-gray-100 text-black font-semibold rounded-xl transition-colors text-sm"
            >
              Back to Scholarships
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col font-lt-wave">
      <Navigation />

      <div className="pt-24 pb-16 px-4">
        <div className="max-w-2xl mx-auto">

          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <button
              onClick={() => navigate('/scholarships')}
              className="p-2 text-gray-500 hover:text-white transition-colors rounded-lg hover:bg-white/5 flex-shrink-0"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-widest mb-0.5">
                Step {step + 1} of {STEPS.length}
              </p>
              <h1 className="text-white text-2xl font-bold">{STEPS[step]}</h1>
            </div>
          </div>

          <ProgressBar step={step + 1} total={STEPS.length} />

          {error && (
            <div className="mb-6 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* ── Step 0: Applicant ── */}
          {step === 0 && (
            <div className="space-y-4">
              <p className="text-gray-500 text-sm mb-4">Information about the parent or guardian submitting this application. All fields are required.</p>
              <div className="grid grid-cols-2 gap-4">
                <Field label="First Name" required>
                  <Input value={form.applicantFirstName} onChange={e => set('applicantFirstName', e.target.value)} placeholder="Jane" />
                </Field>
                <Field label="Last Name" required>
                  <Input value={form.applicantLastName} onChange={e => set('applicantLastName', e.target.value)} placeholder="Smith" />
                </Field>
              </div>
              <Field label="Date of Birth" required>
                <Input type="date" value={form.applicantDOB} onChange={e => set('applicantDOB', e.target.value)} />
              </Field>
              <Field label="Email Address" required>
                <Input type="email" value={form.applicantEmail} onChange={e => set('applicantEmail', e.target.value)} placeholder="jane@example.com" />
              </Field>
              <Field label="Phone Number" required>
                <Input type="tel" value={form.applicantPhone} onChange={e => set('applicantPhone', e.target.value)} placeholder="(555) 000-0000" />
              </Field>
              <Field label="Street Address" required>
                <Input value={form.applicantAddress} onChange={e => set('applicantAddress', e.target.value)} placeholder="123 Main St" />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="City" required>
                  <Input value={form.applicantCity} onChange={e => set('applicantCity', e.target.value)} placeholder="City" />
                </Field>
                <Field label="State" required>
                  <Input value={form.applicantState} onChange={e => set('applicantState', e.target.value)} placeholder="MD" maxLength={2} />
                </Field>
                <Field label="ZIP" required>
                  <Input value={form.applicantZip} onChange={e => set('applicantZip', e.target.value)} placeholder="20001" maxLength={10} />
                </Field>
              </div>
            </div>
          )}

          {/* ── Step 1: Player ── */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-gray-500 text-sm mb-4">Information about the player applying for the scholarship.</p>
              <div className="grid grid-cols-2 gap-4">
                <Field label="First Name" required>
                  <Input value={form.playerFirstName} onChange={e => set('playerFirstName', e.target.value)} placeholder="Alex" />
                </Field>
                <Field label="Last Name" required>
                  <Input value={form.playerLastName} onChange={e => set('playerLastName', e.target.value)} placeholder="Smith" />
                </Field>
              </div>
              <Field label="Date of Birth" required>
                <Input type="date" value={form.playerDOB} onChange={e => set('playerDOB', e.target.value)} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Grade" required>
                  <Select value={form.playerGrade} onChange={e => set('playerGrade', e.target.value)}>
                    <option value="">Select grade</option>
                    {['K','1','2','3','4','5','6','7','8','9','10','11','12'].map(g => (
                      <option key={g} value={g}>Grade {g}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Club Team">
                  <Input value={form.clubTeam} onChange={e => set('clubTeam', e.target.value)} placeholder="Club name (optional)" />
                </Field>
              </div>
              <Field label="School" required>
                <SchoolAutocomplete value={form.playerSchool} onChange={v => set('playerSchool', v)} />
              </Field>
              <Field label="Training History">
                <Textarea
                  rows={4}
                  value={form.trainingHistory}
                  onChange={e => set('trainingHistory', e.target.value)}
                  placeholder="Briefly describe the player's soccer experience, clubs, and any previous training programs…"
                />
              </Field>
            </div>
          )}

          {/* ── Step 2: Financial ── */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-gray-500 text-sm mb-4">All financial information is kept strictly confidential and used only for scholarship review. All fields are required.</p>

              <div className="grid grid-cols-3 gap-4">
                <Field label="Household Size" required>
                  <Select value={form.householdSize} onChange={e => set('householdSize', e.target.value)}>
                    <option value="">Select</option>
                    {['1','2','3','4','5','6','7','8','9','10+'].map(n => (
                      <option key={n} value={n}>{n} {n === '1' ? 'person' : 'people'}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Income Earners" required>
                  <Select value={form.incomeEarners} onChange={e => handleIncomeEarnersChange(e.target.value)}>
                    <option value="">Select</option>
                    {['1','2','3','4','5+'].map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Dependants" required>
                  <Select value={form.dependants} onChange={e => set('dependants', e.target.value)}>
                    <option value="">Select</option>
                    {['0','1','2','3','4','5','6','7','8+'].map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </Select>
                </Field>
              </div>

              <Field label="Annual Household Income" required>
                <Select value={form.annualHouseholdIncome} onChange={e => set('annualHouseholdIncome', e.target.value)}>
                  <option value="">Select range</option>
                  {INCOME_BRACKETS.map(r => <option key={r} value={r}>{r}</option>)}
                </Select>
              </Field>

              {/* Employment status — one per earner */}
              {form.incomeEarners && (
                <div className="space-y-3">
                  {Array.from({ length: numEarners }).map((_, i) => (
                    <Field
                      key={i}
                      label={numEarners === 1 ? 'Employment Status' : `Income Earner ${i + 1} — Employment Status`}
                      required
                    >
                      <Select value={employmentStatuses[i] || ''} onChange={e => setEmploymentStatus(i, e.target.value)}>
                        <option value="">Select</option>
                        {EMPLOYMENT_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                      </Select>
                    </Field>
                  ))}
                </div>
              )}

              <Field label="Does your family currently receive government assistance?" required>
                <Select value={form.receivesAssistance} onChange={e => set('receivesAssistance', e.target.value)}>
                  <option value="">Select</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </Select>
              </Field>

              {form.receivesAssistance === 'yes' && (
                <Field label="Please specify (e.g. SNAP, Medicaid, WIC, Section 8…)">
                  <Textarea
                    rows={2}
                    value={form.assistanceDetails}
                    onChange={e => set('assistanceDetails', e.target.value)}
                    placeholder="List any programs"
                  />
                </Field>
              )}
            </div>
          )}

          {/* ── Step 3: Statement & Docs ── */}
          {step === 3 && (
            <div className="space-y-5">
              <Field label="Personal Statement" required>
                <Textarea
                  rows={7}
                  value={form.personalStatement}
                  onChange={e => set('personalStatement', e.target.value)}
                  placeholder="Explain why you are applying for this scholarship, what this opportunity would mean for your player, and any other context you'd like the committee to consider…"
                />
                <p className="text-gray-600 text-xs mt-1">{form.personalStatement.length} / 4000 characters</p>
              </Field>

              <Field label="Coach or Reference Name (optional)">
                <Input value={form.coachReference} onChange={e => set('coachReference', e.target.value)} placeholder="Full name" />
              </Field>

              <div>
                <p className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-3">Supporting Documents</p>
                <div className="space-y-2.5">
                  {DOC_SLOTS.map(slot => (
                    <FileUploadSlot
                      key={slot.key}
                      slotKey={slot.key}
                      label={slot.label}
                      required={slot.required}
                      uploadedFile={files[slot.key]}
                      onFileSelect={handleFileSelect}
                      onRemove={handleFileRemove}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 4: Review ── */}
          {step === 4 && (
            <div className="space-y-5">
              <p className="text-gray-400 text-sm">Please review your application before submitting. You can go back to make changes.</p>

              {[
                {
                  title: 'Applicant',
                  rows: [
                    ['Name',    `${form.applicantFirstName} ${form.applicantLastName}`],
                    ['DOB',     form.applicantDOB],
                    ['Email',   form.applicantEmail],
                    ['Phone',   form.applicantPhone],
                    ['Address', [form.applicantAddress, form.applicantCity, form.applicantState, form.applicantZip].filter(Boolean).join(', ')],
                  ] as [string, string][],
                },
                {
                  title: 'Player',
                  rows: [
                    ['Name',     `${form.playerFirstName} ${form.playerLastName}`],
                    ['DOB',      form.playerDOB],
                    ['Grade',    form.playerGrade],
                    ['School',   form.playerSchool],
                    ['Club Team',form.clubTeam],
                    ['Training History', form.trainingHistory.slice(0, 120) + (form.trainingHistory.length > 120 ? '…' : '')],
                  ] as [string, string][],
                },
                {
                  title: 'Financial',
                  rows: [
                    ['Household Size',   form.householdSize],
                    ['Income Earners',   form.incomeEarners],
                    ['Dependants',       form.dependants],
                    ['Annual Income',    form.annualHouseholdIncome],
                    ['Employment',       employmentStatuses.length === 1
                      ? employmentStatuses[0]
                      : employmentStatuses.map((s, i) => `Earner ${i + 1}: ${s}`).join(' · ')],
                    ['Govt. Assistance', form.receivesAssistance],
                    ['Assistance Details', form.assistanceDetails],
                  ] as [string, string][],
                },
                {
                  title: 'Statement',
                  rows: [
                    ['Reference',  form.coachReference],
                    ['Statement',  form.personalStatement.slice(0, 200) + (form.personalStatement.length > 200 ? '…' : '')],
                  ] as [string, string][],
                },
              ].map(section => (
                <div key={section.title} className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-xl px-4 py-3">
                  <p className="text-gray-500 text-xs uppercase tracking-wider font-medium mb-2">{section.title}</p>
                  {section.rows.map(([label, value]) => (
                    <ReviewRow key={label} label={label} value={value} />
                  ))}
                </div>
              ))}

              {/* Uploaded docs */}
              <div className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-xl px-4 py-3">
                <p className="text-gray-500 text-xs uppercase tracking-wider font-medium mb-2">Documents</p>
                {DOC_SLOTS.map(slot => {
                  const f = files[slot.key];
                  return (
                    <div key={slot.key} className="flex items-center justify-between py-1.5 border-b border-[#1a1a1a] last:border-0">
                      <span className="text-gray-500 text-xs w-52 flex-shrink-0">{slot.label}</span>
                      {f?.fileId ? (
                        <span className="text-green-400 text-xs flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          {f.file.name}
                        </span>
                      ) : (
                        <span className="text-gray-600 text-xs">{slot.required ? '⚠ Missing' : 'Not provided'}</span>
                      )}
                    </div>
                  );
                })}
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" id="consent" className="mt-0.5 accent-blue-600" required />
                <span className="text-gray-400 text-xs leading-relaxed">
                  I certify that all information provided is accurate and complete to the best of my knowledge.
                  I understand that false or misleading information may result in disqualification.
                </span>
              </label>
            </div>
          )}

          {/* ── Navigation ── */}
          <div className="flex gap-3 mt-10">
            {step > 0 ? (
              <button type="button" onClick={back}
                className="px-5 py-3 text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-xl transition-colors">
                ← Back
              </button>
            ) : (
              <button type="button" onClick={() => navigate('/scholarships')}
                className="px-5 py-3 text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-xl transition-colors">
                Cancel
              </button>
            )}

            {step < STEPS.length - 1 ? (
              <button type="button" onClick={next}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors text-sm">
                Continue →
              </button>
            ) : (
              <button type="button" onClick={handleSubmit} disabled={submitting}
                className="flex-1 py-3 bg-white hover:bg-gray-100 text-black font-semibold rounded-xl transition-colors text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                {submitting && <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />}
                {submitting ? 'Submitting…' : 'Submit Application'}
              </button>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
