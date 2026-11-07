import { useState } from 'react';
import { ID } from 'appwrite';
import { useAuth } from '../../contexts/AuthContext';
import { databases, databaseId, collections } from '../../services/appwrite';
import { useAccount } from './AccountContext';
import { AccountPageHeader, AccountSpinner } from './AccountLayout';

const inputClass =
  'w-full px-4 py-2.5 bg-[#1a1a1a] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20';

/** "2012-05-09" → "05/09/2012", the birth date format proxy players use. */
const toProxyBirthDate = (iso: string) => {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[2]}/${m[3]}/${m[1]}` : '';
};

// A parent's players, as in the app's My Family. New players are created the
// same way as the app's "Create New Account": a proxy child plus an active
// parent-child relationship.
const AccountFamilyPage = () => {
  const { user } = useAuth();
  const { loading, userType, profile, children, refresh } = useAccount();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', birthDate: '', gender: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (loading) return <AccountSpinner />;
  if (userType !== 'parent') {
    return <p className="text-gray-400 text-sm">My Family is for parent accounts.</p>;
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const birthDate = toProxyBirthDate(form.birthDate);
    if (!form.firstName.trim() || !form.lastName.trim() || !birthDate) {
      setError('First name, last name and date of birth are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const proxyId = ID.unique();
      await databases.createDocument(databaseId, collections.proxyChildren, ID.unique(), {
        proxyId,
        parentUserId: user.$id,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        gender: form.gender,
        birthDate,
        userType: 'youth',
        accountStatus: 'proxy',
        tier: profile?.tier || 'Basic',
        positions: [],
        currentClub: '',
        ageGroup: '',
        league: '',
        school: '',
        gradYear: '',
        club: '',
        nation: '',
        level: '',
      });
      await databases.createDocument(databaseId, collections.familyRelationships001, ID.unique(), {
        relationshipId: ID.unique(),
        parentUserId: user.$id,
        relationshipType: 'parent-child',
        status: 'active',
        childProxyId: proxyId,
      });
      await refresh();
      setForm({ firstName: '', lastName: '', birthDate: '', gender: '' });
      setAdding(false);
    } catch (err: any) {
      setError(err?.message || 'Could not add the player.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <AccountPageHeader
        title="My Family"
        right={!adding && (
          <button
            onClick={() => setAdding(true)}
            className="px-5 py-2.5 bg-white hover:bg-gray-200 text-black text-sm font-semibold rounded-lg transition-colors"
          >
            Add a player
          </button>
        )}
      />

      {adding && (
        <form onSubmit={save} className="bg-[#111] border border-white/10 rounded-2xl p-5 space-y-4">
          <p className="text-white font-semibold">New player</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <input className={inputClass} placeholder="First name" value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            <input className={inputClass} placeholder="Last name" value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            <label className="block">
              <span className="block text-gray-500 text-xs mb-1">Date of birth</span>
              <input type="date" className={`${inputClass} [color-scheme:dark]`} value={form.birthDate}
                onChange={(e) => setForm({ ...form, birthDate: e.target.value })} />
            </label>
            <label className="block">
              <span className="block text-gray-500 text-xs mb-1">Gender (optional)</span>
              <select className={inputClass} value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                <option value="">—</option>
                <option>Male</option>
                <option>Female</option>
              </select>
            </label>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={() => { setAdding(false); setError(''); }}
              className="px-5 py-2 text-sm text-gray-400 hover:text-white border border-white/10 hover:border-white/30 rounded-lg transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="px-6 py-2 text-sm bg-white hover:bg-gray-200 text-black font-semibold rounded-lg transition-colors disabled:opacity-50">
              {saving ? 'Adding…' : 'Add player'}
            </button>
          </div>
          <p className="text-gray-600 text-xs">
            This creates a player managed from your account. When your player is old enough for their own login, they
            can create it in the app and claim this profile.
          </p>
        </form>
      )}

      {children.length === 0 ? (
        <p className="text-gray-500 text-sm">No players on your account yet.</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {children.map((c) => (
            <div key={c.id} className="bg-[#111] border border-[#222] rounded-2xl px-6 py-5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-white text-xl font-medium truncate">{c.firstName} {c.lastName}</p>
                <p className="text-gray-500 text-xs mt-0.5">
                  {c.kind === 'proxy' ? 'Managed by you' : 'Linked account — manages their own profile'}
                </p>
              </div>
              {c.kind === 'proxy' && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-yellow-500/15 text-yellow-300 border border-yellow-500/30 flex-shrink-0">
                  Temporary account
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-gray-600 text-xs">
        To connect a child's existing Next Star account, use My Family → Connect in the app (it pairs with a QR code).
      </p>
    </div>
  );
};

export default AccountFamilyPage;
