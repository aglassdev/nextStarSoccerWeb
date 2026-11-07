import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { account, databases, databaseId } from '../../services/appwrite';
import { useAccount } from './AccountContext';
import { AccountPageHeader, AccountSpinner } from './AccountLayout';
import { SIGN_IN_PATH } from '../../constants/features';

const inputClass =
  'w-full px-4 py-2.5 bg-[#1a1a1a] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-50';

type Field = { key: string; label: string; list?: boolean };

const PERSONAL: Field[] = [
  { key: 'firstName', label: 'First name' },
  { key: 'lastName', label: 'Last name' },
  { key: 'phone', label: 'Phone' },
  { key: 'address', label: 'Address' },
];

// The soccer details the app's Profile screen edits, per player type. Only
// fields the profile actually has are shown.
const PLAYER_FIELDS: Record<string, Field[]> = {
  youth: [
    { key: 'positions', label: 'Positions', list: true },
    { key: 'currentClub', label: 'Club' },
    { key: 'league', label: 'League' },
    { key: 'ageGroup', label: 'Age group' },
    { key: 'school', label: 'School' },
    { key: 'gradYear', label: 'Graduation year' },
  ],
  collegiate: [
    { key: 'positions', label: 'Positions', list: true },
    { key: 'currentCollege', label: 'College' },
    { key: 'year', label: 'Year' },
    { key: 'youthClub', label: 'Youth club' },
  ],
  professional: [
    { key: 'positions', label: 'Positions', list: true },
    { key: 'currentClub', label: 'Club' },
    { key: 'college', label: 'College' },
    { key: 'youthClub', label: 'Youth club' },
  ],
};

const toText = (v: any) => (Array.isArray(v) ? v.join(', ') : v ?? '');

const FieldForm = ({ title, fields, profile, onSave }: {
  title: string;
  fields: Field[];
  profile: any;
  onSave: (changes: Record<string, any>) => Promise<void>;
}) => {
  const initial = () => Object.fromEntries(fields.map((f) => [f.key, toText(profile?.[f.key])]));
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState('');
  useEffect(() => setValues(initial()), [profile]); // eslint-disable-line react-hooks/exhaustive-deps

  const changed = fields.filter((f) => values[f.key] !== toText(profile?.[f.key]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (changed.length === 0) return;
    if (changed.some((f) => (f.key === 'firstName' || f.key === 'lastName') && !values[f.key].trim())) {
      setError('Name fields can’t be empty.');
      return;
    }
    setState('saving');
    setError('');
    try {
      await onSave(Object.fromEntries(changed.map((f) => [
        f.key,
        f.list ? values[f.key].split(',').map((s) => s.trim()).filter(Boolean) : values[f.key].trim(),
      ])));
      setState('saved');
      setTimeout(() => setState('idle'), 2000);
    } catch (err: any) {
      setError(err?.message || 'Could not save.');
      setState('idle');
    }
  };

  return (
    <form onSubmit={submit} className="bg-[#111] border border-white/10 rounded-2xl p-5 space-y-4">
      <p className="text-white font-semibold">{title}</p>
      <div className="grid sm:grid-cols-2 gap-3">
        {fields.map((f) => (
          <label key={f.key} className={`block ${f.key === 'address' ? 'sm:col-span-2' : ''}`}>
            <span className="block text-gray-500 text-xs mb-1">{f.label}{f.list ? ' (comma separated)' : ''}</span>
            <input className={inputClass} value={values[f.key]} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
          </label>
        ))}
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <button type="submit" disabled={changed.length === 0 || state === 'saving'}
        className="px-6 py-2 text-sm bg-white hover:bg-gray-200 text-black font-semibold rounded-lg transition-colors disabled:opacity-40">
        {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : 'Save changes'}
      </button>
    </form>
  );
};

const PasswordForm = () => {
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (newPw.length < 8) return setMsg({ ok: false, text: 'New password must be at least 8 characters.' });
    if (newPw !== confirm) return setMsg({ ok: false, text: 'The new passwords don’t match.' });
    setSaving(true);
    try {
      await account.updatePassword(newPw, oldPw);
      setOldPw(''); setNewPw(''); setConfirm('');
      setMsg({ ok: true, text: 'Password updated.' });
    } catch (err: any) {
      setMsg({ ok: false, text: err?.message || 'Could not update the password.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="bg-[#111] border border-white/10 rounded-2xl p-5 space-y-4">
      <p className="text-white font-semibold">Password</p>
      <div className="grid sm:grid-cols-3 gap-3">
        <input type="password" className={inputClass} placeholder="Current password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} />
        <input type="password" className={inputClass} placeholder="New password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
        <input type="password" className={inputClass} placeholder="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </div>
      {msg && <p className={`text-sm ${msg.ok ? 'text-green-400' : 'text-red-400'}`}>{msg.text}</p>}
      <button type="submit" disabled={saving || !oldPw || !newPw}
        className="px-6 py-2 text-sm bg-white hover:bg-gray-200 text-black font-semibold rounded-lg transition-colors disabled:opacity-40">
        {saving ? 'Updating…' : 'Update password'}
      </button>
    </form>
  );
};

const AccountSettingsPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { loading, profile, collectionId, userType, refresh } = useAccount();
  if (loading) return <AccountSpinner />;

  const save = async (changes: Record<string, any>) => {
    if (!profile || !collectionId) throw new Error('No profile to update.');
    await databases.updateDocument(databaseId, collectionId, profile.$id, changes);
    await refresh();
  };
  const playerFields = (PLAYER_FIELDS[userType || ''] || []).filter((f) => profile && f.key in profile);

  return (
    <div className="space-y-6">
      <AccountPageHeader title="Settings" />

      <div className="bg-[#111] border border-white/10 rounded-2xl p-5">
        <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Email</p>
        <p className="text-white text-sm">{user?.email}</p>
        <p className="text-gray-600 text-xs mt-1">Your email is your login. Contact us to change it.</p>
      </div>

      {profile ? (
        <>
          <FieldForm title="Personal information" fields={PERSONAL.filter((f) => f.key in profile || f.key === 'phone' || f.key === 'address')} profile={profile} onSave={save} />
          {playerFields.length > 0 && <FieldForm title="Player profile" fields={playerFields} profile={profile} onSave={save} />}
        </>
      ) : (
        <p className="text-gray-500 text-sm">No profile found for this account.</p>
      )}

      <PasswordForm />

      <button
        onClick={async () => { await logout(); navigate(SIGN_IN_PATH); }}
        className="w-full bg-[#111] border border-[#222] hover:border-[#3a3a3a] rounded-2xl px-7 py-6 text-left text-white text-xl font-medium transition-colors"
      >
        Sign Out
      </button>
    </div>
  );
};

export default AccountSettingsPage;
