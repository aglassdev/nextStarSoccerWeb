import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ID } from 'appwrite';
import Navigation from '../components/layout/Navigation';
import Footer from '../components/layout/Footer';
import { databases, databaseId, collections } from '../services/appwrite';

// ── Types ────────────────────────────────────────────────────────────────────

interface ExperienceEntry {
  type: string;
  name: string;
  years: string;
}

interface FormState {
  // Personal
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  gender: string;
  location: string;
  // Playing experience (up to 3)
  playingExp: ExperienceEntry[];
  // Coaching experience (up to 3)
  coachingExp: ExperienceEntry[];
  // Profile
  yearsCoaching: string;
  hasLicense: boolean;
  licenseType: string;
  willingToCommute: string;
  whyNSS: string;
  // Agreements
  agreeTerms: boolean;
  agreePrivacy: boolean;
}

const EMPTY_EXP: ExperienceEntry = { type: '', name: '', years: '' };

const PLAYING_TYPES = ['Professional Club', 'College', 'National Team'];
const COACHING_TYPES = ['Youth Club', 'College', 'Professional Club', 'National / Youth National Team', 'Private Training', 'Overseas Academy'];
const YEARS_OPTIONS = ['<1', '2', '3', '4', '5', '6+'];
const LICENSE_OPTIONS = ['USSF E License', 'USSF D License', 'USSF C License', 'USSF B License', 'USSF A License', 'USSF Pro License', 'UEFA License', 'Other'];

const CRITERIA = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    title: 'DMV Area',
    desc: 'You must live in the D.C., Maryland, or Virginia area — or be fully willing to commute to it for training sessions.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
      </svg>
    ),
    title: 'Playing Background',
    desc: 'Applicants must have past professional or collegiate playing experience. We are looking for coaches who have competed at a high level.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    title: 'Player-First Mentality',
    desc: 'We want coaches who are genuinely invested in developing young players — technically, tactically, and as people.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    title: 'Commitment to Excellence',
    desc: 'Next Star coaches hold themselves to the same standard they ask of their players — prepared, punctual, and passionate about the craft.',
  },
];

// ── Shared input components ──────────────────────────────────────────────────

const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...props}
    className="w-full px-3.5 py-2.5 bg-white/[0.05] border border-white/10 rounded-lg text-white text-sm placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-white/30 transition-colors"
  />
);

const Select = ({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) => (
  <select
    {...props}
    className="w-full px-3.5 py-2.5 bg-white/[0.05] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-white/30 transition-colors appearance-none"
  >
    {children}
  </select>
);

const Textarea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea
    {...props}
    className="w-full px-3.5 py-2.5 bg-white/[0.05] border border-white/10 rounded-lg text-white text-sm placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-white/30 transition-colors resize-none"
  />
);

const Label = ({ children, required }: { children: React.ReactNode; required?: boolean }) => (
  <label className="block text-white/50 text-xs font-medium mb-1.5 uppercase tracking-wider">
    {children}{required && <span className="text-white/30 ml-0.5">*</span>}
  </label>
);

const SectionHeading = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-center gap-3 mb-5">
    <h3 className="text-white font-semibold text-sm uppercase tracking-widest whitespace-nowrap">{children}</h3>
    <div className="flex-1 h-px bg-white/10" />
  </div>
);

// ── Experience row ───────────────────────────────────────────────────────────

function ExperienceRow({
  entry,
  typeOptions,
  onChange,
  onRemove,
  label,
}: {
  entry: ExperienceEntry;
  typeOptions: string[];
  onChange: (e: ExperienceEntry) => void;
  onRemove: () => void;
  label: string;
}) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-white/30 text-xs font-mono">{label}</span>
        <button type="button" onClick={onRemove} className="text-white/20 hover:text-red-400 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <Label>Type</Label>
          <Select value={entry.type} onChange={e => onChange({ ...entry, type: e.target.value })}>
            <option value="">Select type</option>
            {typeOptions.map(t => <option key={t} value={t}>{t}</option>)}
          </Select>
        </div>
        <div>
          <Label>Club / Program</Label>
          <Input
            value={entry.name}
            onChange={e => onChange({ ...entry, name: e.target.value })}
            placeholder="e.g. D.C. United"
          />
        </div>
        <div>
          <Label>Years</Label>
          <Select value={entry.years} onChange={e => onChange({ ...entry, years: e.target.value })}>
            <option value="">Select</option>
            {YEARS_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
          </Select>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function CoachApplyPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>({
    firstName: '', lastName: '', email: '', phone: '', gender: '', location: '',
    playingExp: [{ ...EMPTY_EXP }],
    coachingExp: [{ ...EMPTY_EXP }],
    yearsCoaching: '', hasLicense: false, licenseType: '',
    willingToCommute: '', whyNSS: '',
    agreeTerms: false, agreePrivacy: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm(f => ({ ...f, [key]: val }));

  const updatePlayingExp = (i: number, e: ExperienceEntry) =>
    set('playingExp', form.playingExp.map((x, j) => j === i ? e : x));
  const addPlayingExp = () =>
    form.playingExp.length < 3 && set('playingExp', [...form.playingExp, { ...EMPTY_EXP }]);
  const removePlayingExp = (i: number) =>
    set('playingExp', form.playingExp.filter((_, j) => j !== i));

  const updateCoachingExp = (i: number, e: ExperienceEntry) =>
    set('coachingExp', form.coachingExp.map((x, j) => j === i ? e : x));
  const addCoachingExp = () =>
    form.coachingExp.length < 3 && set('coachingExp', [...form.coachingExp, { ...EMPTY_EXP }]);
  const removeCoachingExp = (i: number) =>
    set('coachingExp', form.coachingExp.filter((_, j) => j !== i));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.agreeTerms || !form.agreePrivacy) {
      setError('Please agree to the Terms & Conditions and Privacy Policy.');
      return;
    }
    if (!form.firstName.trim() || !form.email.trim()) {
      setError('Please fill in your name and email.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await databases.createDocument(databaseId, collections.coachApplications!, ID.unique(), {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        gender: form.gender,
        location: form.location,
        playingExperience: JSON.stringify(form.playingExp.filter(e => e.type || e.name)),
        coachingExperience: JSON.stringify(form.coachingExp.filter(e => e.type || e.name)),
        yearsCoaching: form.yearsCoaching,
        hasLicense: form.hasLicense,
        licenseType: form.licenseType,
        willingToCommute: form.willingToCommute,
        whyNSS: form.whyNSS,
        status: 'pending',
        submittedAt: new Date().toISOString(),
      });
      setSubmitted(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Submission failed. Please try again.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-black flex flex-col font-lt-wave">
        <Navigation />
        <div className="flex-1 flex items-center justify-center px-6 py-32">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-white text-2xl font-bold mb-3">Application Submitted</h2>
            <p className="text-white/50 text-sm leading-relaxed mb-8">
              Thank you, {form.firstName}. We've received your application and will be in touch at <span className="text-white">{form.email}</span> if you're a good fit.
            </p>
            <button
              onClick={() => navigate('/')}
              className="px-8 py-3 bg-white text-black font-semibold rounded-xl text-sm hover:bg-white/90 transition-colors"
            >
              Back to Home
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

      {/* ── Hero / Criteria ── */}
      <div className="pt-32 pb-16 px-6 md:px-10 lg:px-14 border-b border-white/[0.06]">
        <div className="max-w-[1560px] mx-auto">
          <p className="text-white/30 text-[11px] uppercase tracking-[0.22em] mb-4 font-lt-wave">Join the Staff</p>
          <h1 className="text-white font-bold leading-none mb-6" style={{ fontSize: '29px' }}>
            Coach at Next Star
          </h1>
          <p className="text-white/50 text-base max-w-2xl leading-relaxed mb-12">
            We're always looking for exceptional coaches to join our team. If you've competed at a high level and are passionate about developing the next generation of players, we want to hear from you.
          </p>

          {/* Criteria cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {CRITERIA.map((c, i) => (
              <div key={i} className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5">
                <div className="w-9 h-9 rounded-xl bg-white/[0.06] flex items-center justify-center text-white/60 mb-4">
                  {c.icon}
                </div>
                <h3 className="text-white font-semibold text-sm mb-2">{c.title}</h3>
                <p className="text-white/40 text-[13px] leading-relaxed">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Application Form ── */}
      <div className="flex-1 px-6 md:px-10 lg:px-14 py-16">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-white font-bold text-xl mb-8">Application</h2>

          <form onSubmit={handleSubmit} className="space-y-10">

            {/* Personal info */}
            <div>
              <SectionHeading>Personal Information</SectionHeading>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label required>First Name</Label>
                    <Input value={form.firstName} onChange={e => set('firstName', e.target.value)} placeholder="Jane" />
                  </div>
                  <div>
                    <Label required>Last Name</Label>
                    <Input value={form.lastName} onChange={e => set('lastName', e.target.value)} placeholder="Smith" />
                  </div>
                </div>
                <div>
                  <Label required>Email Address</Label>
                  <Input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="jane@example.com" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Phone Number</Label>
                    <Input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="(555) 000-0000" />
                  </div>
                  <div>
                    <Label>Gender</Label>
                    <Select value={form.gender} onChange={e => set('gender', e.target.value)}>
                      <option value="">Select</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>City / Location</Label>
                  <Input value={form.location} onChange={e => set('location', e.target.value)} placeholder="e.g. Bethesda, MD" />
                </div>
              </div>
            </div>

            {/* Playing experience */}
            <div>
              <SectionHeading>Playing Experience</SectionHeading>
              <p className="text-white/30 text-xs mb-4">List your highest level of playing experience (up to 3 entries).</p>
              <div className="space-y-3">
                {form.playingExp.map((entry, i) => (
                  <ExperienceRow
                    key={i}
                    entry={entry}
                    typeOptions={PLAYING_TYPES}
                    onChange={e => updatePlayingExp(i, e)}
                    onRemove={() => removePlayingExp(i)}
                    label={`Entry ${i + 1}`}
                  />
                ))}
              </div>
              {form.playingExp.length < 3 && (
                <button
                  type="button"
                  onClick={addPlayingExp}
                  className="mt-3 flex items-center gap-2 text-white/40 hover:text-white text-sm transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add entry
                </button>
              )}
            </div>

            {/* Coaching experience */}
            <div>
              <SectionHeading>Coaching Experience</SectionHeading>
              <p className="text-white/30 text-xs mb-4">List your coaching experience (up to 3 entries).</p>
              <div className="space-y-3">
                {form.coachingExp.map((entry, i) => (
                  <ExperienceRow
                    key={i}
                    entry={entry}
                    typeOptions={COACHING_TYPES}
                    onChange={e => updateCoachingExp(i, e)}
                    onRemove={() => removeCoachingExp(i)}
                    label={`Entry ${i + 1}`}
                  />
                ))}
              </div>
              {form.coachingExp.length < 3 && (
                <button
                  type="button"
                  onClick={addCoachingExp}
                  className="mt-3 flex items-center gap-2 text-white/40 hover:text-white text-sm transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add entry
                </button>
              )}
            </div>

            {/* Profile */}
            <div>
              <SectionHeading>Coaching Profile</SectionHeading>
              <div className="space-y-4">
                <div>
                  <Label>Years of Coaching Experience</Label>
                  <Select value={form.yearsCoaching} onChange={e => set('yearsCoaching', e.target.value)}>
                    <option value="">Select</option>
                    {YEARS_OPTIONS.map(y => <option key={y} value={y}>{y} year{y !== '1' ? 's' : ''}</option>)}
                  </Select>
                </div>

                <div>
                  <Label>Do you have a coaching license?</Label>
                  <div className="flex items-center gap-3 mt-1">
                    {['Yes', 'No'].map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => set('hasLicense', opt === 'Yes')}
                        className={`px-5 py-2 rounded-lg border text-sm font-medium transition-colors ${
                          (opt === 'Yes') === form.hasLicense
                            ? 'bg-white text-black border-white'
                            : 'bg-transparent text-white/40 border-white/10 hover:border-white/30'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                {form.hasLicense && (
                  <div>
                    <Label>License Type</Label>
                    <Select value={form.licenseType} onChange={e => set('licenseType', e.target.value)}>
                      <option value="">Select license</option>
                      {LICENSE_OPTIONS.map(l => <option key={l} value={l}>{l}</option>)}
                    </Select>
                  </div>
                )}

                <div>
                  <Label>Are you in the DMV area or willing to commute?</Label>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {['I live in the DMV', 'Willing to commute', 'Neither'].map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => set('willingToCommute', opt)}
                        className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                          form.willingToCommute === opt
                            ? 'bg-white text-black border-white'
                            : 'bg-transparent text-white/40 border-white/10 hover:border-white/30'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Why do you want to coach at Next Star Soccer?</Label>
                  <Textarea
                    rows={5}
                    value={form.whyNSS}
                    onChange={e => set('whyNSS', e.target.value)}
                    placeholder="Tell us what drives you, your coaching philosophy, and why Next Star is the right fit…"
                  />
                  <p className="text-white/20 text-xs mt-1">{form.whyNSS.length} / 3000</p>
                </div>
              </div>
            </div>

            {/* Agreements */}
            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.agreeTerms}
                  onChange={e => set('agreeTerms', e.target.checked)}
                  className="mt-0.5 accent-white"
                />
                <span className="text-white/40 text-xs leading-relaxed">
                  I have read and agreed to the Next Star Soccer{' '}
                  <a href="/terms" target="_blank" className="text-white/70 underline hover:text-white">Terms & Conditions</a>.
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.agreePrivacy}
                  onChange={e => set('agreePrivacy', e.target.checked)}
                  className="mt-0.5 accent-white"
                />
                <span className="text-white/40 text-xs leading-relaxed">
                  I have read and agreed to the Next Star Soccer{' '}
                  <a href="/privacy" target="_blank" className="text-white/70 underline hover:text-white">Privacy Policy</a>.
                </span>
              </label>
            </div>

            {error && (
              <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 rounded-xl bg-white hover:bg-white/90 text-black font-semibold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting && <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />}
              {submitting ? 'Submitting…' : 'Submit Application'}
            </button>

          </form>
        </div>
      </div>

      <Footer />
    </div>
  );
}
