import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { account, databases, databaseId } from '@/services/appwrite';
import { SIGN_IN_PATH } from '@/constants/features';
import { useAccount } from '../AccountContext';
import { AlertBox, AppModal, FieldBox, SaveButton, SectionCard } from './ui';
import { addressDetails, searchAddresses } from './search';
import { canDeleteAccount, deleteProfileDocument } from './accountDeletion';
import type { GooglePlacesPrediction } from '@/services/googlePlaces';

// The app's Account Details screen (settings/PersonalInformationScreen.tsx),
// opened from Settings → Account Information: login details (email, password),
// personal details (name, phone, address — each editable once a year, tracked
// per device like the app's AsyncStorage record), and the Danger Zone.

type PersonalField = 'firstName' | 'lastName' | 'phone' | 'address';
const LABELS: Record<PersonalField, string> = { firstName: 'First Name', lastName: 'Last Name', phone: 'Phone', address: 'Address' };
const ONE_YEAR = 365 * 24 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

const formatPhone = (phone: string) => {
  const d = (phone || '').replace(/\D/g, '');
  if (d.length >= 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 10)}`;
  if (d.length >= 6) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length >= 3) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return d;
};

const streetOf = (address: string) => (address ? address.split(',')[0].trim() : 'Not set');

const storageKey = (userId?: string) => `user_modifications_${userId || 'unknown'}`;
const readDates = (userId?: string): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(storageKey(userId)) || '{}') || {};
  } catch {
    return {};
  }
};

const darkInput = 'w-full h-[45px] px-[15px] rounded-lg bg-[#2a2a2a] border border-[#444] text-white text-base placeholder:text-[#666] focus:outline-none focus:ring-2 focus:ring-white/25';

const EyeIcon = ({ off }: { off: boolean }) => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3" strokeWidth={1.8} />
    {off && <path strokeLinecap="round" strokeWidth={1.8} d="M4 4l16 16" />}
  </svg>
);

const Rule = ({ ok, text }: { ok: boolean; text: string }) => (
  <p className={`flex items-center gap-2 text-sm mb-1.5 ${ok ? 'text-white' : 'text-[#666]'}`}>
    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d={ok ? 'M5 13l4 4L19 7' : 'M9 5l7 7-7 7'} />
    </svg>
    {text}
  </p>
);

const PasswordInput = ({ label, value, onChange, error, errorText }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error: boolean;
  errorText?: string;
}) => {
  const [show, setShow] = useState(false);
  return (
    <label className="block">
      <span className="block text-white text-base font-medium mb-2">{label}</span>
      <span className={`flex items-center rounded-lg bg-[#2a2a2a] border px-[15px] ${error ? 'border-[#ff4444]' : 'border-[#444]'}`}>
        <input
          type={show ? 'text' : 'password'}
          value={value}
          placeholder={label}
          autoComplete={label === 'Current Password' ? 'current-password' : 'new-password'}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 min-w-0 bg-transparent py-3 text-white text-base placeholder:text-[#666] focus:outline-none"
        />
        <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}
          className="p-1 text-[#666] hover:text-white">
          <EyeIcon off={show} />
        </button>
      </span>
      {error && errorText && <span className="block text-[#ff4444] text-xs mt-1.5">{errorText}</span>}
    </label>
  );
};

const ChangePasswordModal = ({ onClose, onDone, onFail }: {
  onClose: () => void;
  onDone: () => void;
  onFail: (message: string) => void;
}) => {
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState({ old: false, new: false, confirm: false });
  const [oldWrong, setOldWrong] = useState(false);
  const [saving, setSaving] = useState(false);

  const rules = useMemo(() => ({
    min: newPw.length >= 8,
    upper: /[A-Z]/.test(newPw),
    lower: /[a-z]/.test(newPw),
    number: /\d/.test(newPw),
  }), [newPw]);
  const match = newPw === confirm && confirm !== '';
  const valid = oldPw.trim() !== '' && rules.min && rules.upper && rules.lower && rules.number && match;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) {
      setErrors({ old: !oldPw.trim(), new: !(rules.min && rules.upper && rules.lower && rules.number), confirm: !match });
      return;
    }
    setSaving(true);
    try {
      await account.updatePassword(newPw, oldPw);
      onDone();
    } catch (err: any) {
      const msg = String(err?.message || '');
      if (err?.code === 401 || /oldPassword|invalid credentials/i.test(msg)) {
        setOldWrong(true);
        setErrors((x) => ({ ...x, old: true }));
      } else if (err?.code === 400) {
        onFail('Invalid password format. Please check password requirements.');
      } else {
        onFail('Failed to update password. Please try again.');
      }
      setSaving(false);
    }
  };

  return (
    <AppModal title="Change Password" onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-5">
        <PasswordInput
          label="Current Password"
          value={oldPw}
          onChange={(v) => { setOldPw(v); setOldWrong(false); setErrors((x) => ({ ...x, old: false })); }}
          error={errors.old}
          errorText={oldPw.trim() === '' ? 'Current password is required' : oldWrong ? 'Current password is incorrect' : undefined}
        />
        <div>
          <PasswordInput label="New Password" value={newPw} error={errors.new}
            onChange={(v) => { setNewPw(v); setErrors((x) => ({ ...x, new: false })); }} />
          <div className="mt-2.5">
            <Rule ok={rules.min} text="Minimum eight characters" />
            <Rule ok={rules.upper} text="Minimum one upper case letter" />
            <Rule ok={rules.lower} text="Minimum one lower case letter" />
            <Rule ok={rules.number} text="Minimum one number" />
          </div>
        </div>
        <div>
          <PasswordInput label="Confirm New Password" value={confirm} error={errors.confirm}
            onChange={(v) => { setConfirm(v); setErrors((x) => ({ ...x, confirm: false })); }} />
          <div className="mt-2.5"><Rule ok={match} text="Passwords match" /></div>
        </div>
        <button
          type="submit"
          disabled={saving}
          className={`w-full py-3 rounded-lg text-base font-medium transition-colors ${valid ? 'bg-white/60 hover:bg-white/75 text-black' : 'bg-white/30 text-[#666]'}`}
        >
          {saving ? 'Updating...' : 'Update Password'}
        </button>
      </form>
    </AppModal>
  );
};

const EditPersonalModal = ({ field, initial, onClose, onSave }: {
  field: PersonalField;
  initial: string;
  onClose: () => void;
  onSave: (value: string) => Promise<void>;
}) => {
  const [value, setValue] = useState(field === 'phone' ? formatPhone(initial) : initial);
  const [suggestions, setSuggestions] = useState<GooglePlacesPrediction[]>([]);
  const [loadingAddr, setLoadingAddr] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const change = (text: string) => {
    if (field === 'phone') {
      const d = text.replace(/\D/g, '');
      if (d.length <= 10) setValue(formatPhone(d));
      return;
    }
    setValue(text);
    if (field !== 'address') return;
    clearTimeout(timer.current);
    if (!text.trim()) { setSuggestions([]); setOpen(false); return; }
    setOpen(true);
    timer.current = setTimeout(async () => {
      setLoadingAddr(true);
      try {
        const s = await searchAddresses(text);
        setSuggestions(Array.isArray(s) ? s : []);
      } catch {
        setSuggestions([]);
      } finally {
        setLoadingAddr(false);
      }
    }, 250);
  };

  const pick = async (s: GooglePlacesPrediction) => {
    setOpen(false);
    setSuggestions([]);
    try {
      const details = await addressDetails(s.place_id);
      setValue(details?.formatted_address || s.description);
    } catch {
      setValue(s.description);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((field === 'firstName' || field === 'lastName') && !value.trim()) {
      setError(`${LABELS[field]} can't be empty.`);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave(field === 'phone' ? value.replace(/\D/g, '') : value.trim());
    } catch (err: any) {
      setError(err?.message || 'Could not save. Please try again.');
      setSaving(false);
    }
  };

  return (
    <AppModal title={`Edit ${LABELS[field]}`} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="relative mb-5">
          <input
            autoFocus
            className={darkInput}
            value={value}
            onChange={(e) => change(e.target.value)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder={`Enter ${LABELS[field]}`}
            inputMode={field === 'phone' ? 'tel' : undefined}
            maxLength={field === 'phone' ? 14 : undefined}
          />
          {field === 'address' && open && (loadingAddr || suggestions.length > 0) && (
            <div className="absolute left-0 right-0 top-[45px] z-10 max-h-[200px] overflow-y-auto rounded bg-[#F4F2EE] shadow-lg">
              {loadingAddr ? (
                <p className="px-3 py-3 text-sm italic text-[#666]">Loading addresses...</p>
              ) : suggestions.map((s) => (
                <button key={s.place_id} type="button" onMouseDown={(e) => { e.preventDefault(); pick(s); }}
                  className="w-full px-3 py-2.5 text-left text-black text-base border-b border-[#f0f0f0] last:border-0 hover:bg-black/[0.06] line-clamp-2">
                  {s.description}
                </button>
              ))}
            </div>
          )}
        </div>
        {error && <p className="text-[#ff4444] text-sm text-center mb-3">{error}</p>}
        <SaveButton type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</SaveButton>
      </form>
    </AppModal>
  );
};

const AccountDetails = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { profile, collectionId, refresh } = useAccount();
  const [dates, setDates] = useState<Record<string, string>>(() => readDates(user?.$id));
  useEffect(() => setDates(readDates(user?.$id)), [user?.$id]);
  const [local, setLocal] = useState<Record<string, string>>({});
  const [confirm, setConfirm] = useState<null | { kind: 'field'; field: PersonalField } | { kind: 'password' } | { kind: 'delete' }>(null);
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState<PersonalField | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const value = (f: PersonalField): string => (f in local ? local[f] : profile?.[f] || '');

  const canEdit = (f: string): { ok: boolean; daysLeft?: number } => {
    const last = dates[f];
    if (!last) return { ok: true };
    const diff = Date.now() - new Date(last).getTime();
    return diff >= ONE_YEAR ? { ok: true } : { ok: false, daysLeft: Math.ceil((ONE_YEAR - diff) / DAY) };
  };

  const markChanged = (f: string) => {
    const next = { ...dates, [f]: new Date().toISOString() };
    try { localStorage.setItem(storageKey(user?.$id), JSON.stringify(next)); } catch { /* private mode */ }
    setDates(next);
  };

  const pressField = (f: PersonalField) => {
    const c = canEdit(f);
    if (!c.ok) return setNotice(`You can change this field again in ${c.daysLeft} days.`);
    setConfirm({ kind: 'field', field: f });
  };

  const pressPassword = () => {
    const c = canEdit('password');
    if (!c.ok) return setNotice(`You can change your password again in ${c.daysLeft} days.`);
    setConfirm({ kind: 'password' });
  };

  const saveField = async (f: PersonalField, v: string) => {
    if (!profile || !collectionId) throw new Error('No profile to update.');
    await databases.updateDocument(databaseId, collectionId, profile.$id, { [f]: v });
    setLocal((l) => ({ ...l, [f]: v }));
    markChanged(f);
    setEditing(null);
    refresh().catch(() => {});
  };

  const deleteAccount = async () => {
    if (!user || !profile || !collectionId) return;
    setDeleting(true);
    try {
      const check = await canDeleteAccount(user.$id);
      if (!check.canDelete) {
        setConfirm(null);
        setNotice(check.reason || 'Cannot delete account at this time.');
        return;
      }
      await deleteProfileDocument(collectionId, profile.$id);
      setConfirm(null);
      try { await logout(); } catch { /* the profile is gone either way */ }
      navigate(SIGN_IN_PATH);
    } catch (e: any) {
      setConfirm(null);
      setNotice(e?.message || 'Failed to delete account. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const personal = (f: PersonalField) => {
    const v = value(f);
    const shown = f === 'address' ? streetOf(v) : f === 'phone' ? (v ? formatPhone(v) : 'Not set') : v || 'Not set';
    return (
      <FieldBox key={f} label={LABELS[f]} value={shown} muted={!canEdit(f).ok} onClick={profile ? () => pressField(f) : undefined} />
    );
  };

  return (
    <div className="space-y-5 md:space-y-6">
      <SectionCard title="Login Details">
        <div className="grid gap-5 md:grid-cols-2">
          <FieldBox label="Email" value={user?.email || ''} muted disabled />
          <FieldBox label="Password" value="••••••••" muted={!canEdit('password').ok} onClick={pressPassword} />
        </div>
      </SectionCard>

      <SectionCard title="Personal Details">
        {profile ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 md:gap-x-5">
            {personal('firstName')}
            {personal('lastName')}
            {personal('phone')}
            {personal('address')}
          </div>
        ) : (
          <p className="text-[#ff4444] text-base">User data not found</p>
        )}
      </SectionCard>

      {profile && (
        <section className="rounded-2xl border border-[#3a1a1a] bg-[#111] p-5 md:p-7">
          <h3 className="text-[#ff4444] text-xl font-medium mb-5">Danger Zone</h3>
          <div className="md:flex md:items-center md:gap-8">
            <button
              type="button"
              onClick={() => setConfirm({ kind: 'delete' })}
              className="w-full md:w-auto md:flex-shrink-0 md:px-12 py-[15px] rounded-lg bg-[#ff4444] hover:bg-[#ff5c5c] text-white text-base font-medium transition-colors"
            >
              Delete Account
            </button>
            <p className="text-[#999] text-sm leading-5 text-center md:text-left mt-4 md:mt-0">
              Deleting your account is permanent and cannot be undone. You will not be able to delete your account if you
              have outstanding bills, late bills, or unbilled sessions from this month.
            </p>
          </div>
        </section>
      )}

      {confirm?.kind === 'delete' && (
        <AlertBox
          message="Are you sure you want to delete your account? This action cannot be undone."
          onYes={deleteAccount}
          onNo={() => setConfirm(null)}
          busy={deleting}
        />
      )}
      {confirm?.kind === 'password' && (
        <AlertBox
          message="Password can only be changed once per year. Are you sure you want to continue?"
          onYes={() => { setConfirm(null); setChangingPassword(true); }}
          onNo={() => setConfirm(null)}
        />
      )}
      {confirm?.kind === 'field' && (
        <AlertBox
          message="This field can only be edited once per year. Are you sure you want to continue?"
          onYes={() => { setEditing(confirm.field); setConfirm(null); }}
          onNo={() => setConfirm(null)}
        />
      )}
      {notice && <AlertBox message={notice} onDismiss={() => setNotice('')} />}

      {editing && (
        <EditPersonalModal
          field={editing}
          initial={value(editing)}
          onClose={() => setEditing(null)}
          onSave={(v) => saveField(editing, v)}
        />
      )}
      {changingPassword && (
        <ChangePasswordModal
          onClose={() => setChangingPassword(false)}
          onDone={() => { markChanged('password'); setChangingPassword(false); setNotice('Your password has been updated.'); }}
          onFail={(m) => setNotice(m)}
        />
      )}
    </div>
  );
};

export default AccountDetails;
