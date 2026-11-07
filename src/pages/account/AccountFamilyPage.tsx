import { useEffect, useRef, useState } from 'react';
import { ID, Query } from 'appwrite';
import { useAuth } from '../../contexts/AuthContext';
import { databases, databaseId, collections } from '../../services/appwrite';
import type { ParentChild } from '../../services/clinicRegistration';
import { useAccount } from './AccountContext';
import { AccountPageHeader, AccountSpinner } from './AccountLayout';
import { AppModal, ChevronDownIcon, Overlay, SaveButton, SmallSpinner } from './profile/ui';

// The app's My Family screen (screens/main/account/MyFamilyScreen.tsx): a
// parent's players as big square cards (temporary accounts carry the yellow
// "Temp Account" bar), Remove on each, and Add Family Member, which either
// connects a child's existing account or creates a temporary (proxy) profile —
// a proxy child plus an active parent-child relationship, exactly as the app's
// proxyAccountService.createProxyChild does.

const MAX_PROXY_CHILDREN = 10; // proxyAccountService.validateParentCanCreateProxy

/** The app's DependentCard font size, from the name's length. */
const nameFontSize = (displayName: string) => {
  const words = displayName.split(' ');
  const first = words[0] || '';
  const last = words[words.length - 1] || '';
  if (first.length <= 5 && last.length <= 5) return 42;
  const n = displayName.length;
  if (n <= 8) return 36;
  if (n <= 12) return 32;
  if (n <= 15) return 28;
  if (n <= 20) return 24;
  return 20;
};

/** Birth dates are stored as MM/DD/YYYY; shown as "Mar 4, 2013". */
const formatBirthDate = (s?: string) => {
  if (!s) return '';
  const parts = s.split('/');
  if (parts.length !== 3) return s;
  const [m, d, y] = parts.map((p) => parseInt(p, 10));
  const date = new Date(y, m - 1, d);
  if (isNaN(date.getTime())) return s;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const InfoIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="9.25" stroke="#333" strokeWidth="1.5" />
    <path d="M12 10.5v6" stroke="#333" strokeWidth="1.8" strokeLinecap="round" />
    <circle cx="12" cy="7.5" r="1.1" fill="#333" />
  </svg>
);

const DependentCard = ({ child, birthDate, onRemove, onInfo }: {
  child: ParentChild;
  birthDate?: string;
  onRemove: () => void;
  onInfo: () => void;
}) => {
  const displayName = `${child.firstName} ${child.lastName}`.trim();
  const size = nameFontSize(displayName);
  const proxy = child.kind === 'proxy';
  return (
    <div className="relative aspect-square rounded-2xl bg-[#1e1e1e] overflow-hidden flex flex-col shadow-[0_2px_4px_rgba(0,0,0,0.25)]">
      {proxy && (
        <div className="relative h-[20%] flex-shrink-0 bg-[#FFD54F] flex items-center justify-center px-2">
          <span className="text-[#333] text-[13px] md:text-[15px] font-medium">Temp Account</span>
          <button type="button" onClick={onInfo} aria-label="What is a temporary account?"
            className="absolute right-2 p-1 rounded-full hover:bg-black/10 transition-colors">
            <InfoIcon />
          </button>
        </div>
      )}
      <div className={`flex-1 min-h-0 px-4 md:px-6 ${proxy ? 'pt-2 md:pt-4' : 'pt-6 md:pt-8'} flex flex-col justify-center`}>
        <div
          className="text-white font-medium leading-[0.92] break-words text-[length:var(--fs)] md:text-[length:var(--fs-md)]"
          style={{ ['--fs' as any]: `${size}px`, ['--fs-md' as any]: `${Math.round(size * 1.3)}px` }}
        >
          {displayName.split(' ').map((w, i) => <span key={i} className="block">{w}</span>)}
        </div>
        {birthDate && <p className="text-white/70 text-[13px] md:text-sm mt-1.5 md:mt-2.5">{formatBirthDate(birthDate)}</p>}
      </div>
      <div className="flex-shrink-0 pb-3 md:pb-5 px-4 text-center">
        <button type="button" onClick={onRemove} className="text-white text-[13px] md:text-sm underline underline-offset-2 hover:text-gray-300">
          Remove
        </button>
      </div>
    </div>
  );
};

const AddButton = ({ onClick }: { onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex items-center justify-center gap-3 rounded-lg bg-[#F4F2EE] hover:bg-white px-10 py-4 text-black text-lg font-medium transition-colors"
  >
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeWidth={2.4} d="M12 5v14M5 12h14" />
    </svg>
    Add Family Member
  </button>
);

/** "0513" → "05/13", as the app's birth date field formats while typing. */
const formatDobInput = (raw: string) => {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
};

const validDob = (s: string) => {
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return false;
  const [mo, d, y] = [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
  const date = new Date(y, mo - 1, d);
  return date.getMonth() === mo - 1 && date.getDate() === d && date.getFullYear() === y && date <= new Date() && y >= 1900;
};

const fieldClass = (error: boolean) =>
  `w-full h-12 px-4 rounded-lg bg-transparent border text-white text-base placeholder:text-[rgba(253,253,249,0.7)] focus:outline-none focus:ring-2 focus:ring-white/30 ${
    error ? 'border-[#ff4444]' : 'border-white'
  }`;

/** The app's CreateChildPersonal screen, as the modal's second step. */
const CreateChildForm = ({ onCreated }: { onCreated: (firstName: string) => void }) => {
  const { user } = useAuth();
  const { profile } = useAccount();
  const [form, setForm] = useState({ firstName: '', lastName: '', gender: '', birthDate: '' });
  const [errors, setErrors] = useState({ firstName: false, lastName: false, birthDate: false });
  const [genderOpen, setGenderOpen] = useState(false);
  const [seenWarning, setSeenWarning] = useState(false);
  const [warning, setWarning] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const valid = !!form.firstName.trim() && !!form.lastName.trim() && validDob(form.birthDate);

  const create = async () => {
    const e = { firstName: !form.firstName.trim(), lastName: !form.lastName.trim(), birthDate: !validDob(form.birthDate) };
    setErrors(e);
    if (!valid) { setError('Please fill in all required fields correctly.'); return; }
    if (!seenWarning) { setWarning(true); return; }
    if (!user) return;
    setCreating(true);
    setError('');
    try {
      const existing = await databases.listDocuments(databaseId, collections.proxyChildren, [
        Query.equal('parentUserId', user.$id),
        Query.equal('accountStatus', 'proxy'),
        Query.limit(MAX_PROXY_CHILDREN),
      ]);
      if (existing.total >= MAX_PROXY_CHILDREN) throw new Error('Maximum number of proxy children reached');

      const proxyId = ID.unique();
      await databases.createDocument(databaseId, collections.proxyChildren, ID.unique(), {
        proxyId,
        parentUserId: user.$id,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        gender: form.gender,
        birthDate: form.birthDate,
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
      onCreated(form.firstName.trim());
    } catch (err: any) {
      setError(err?.message || 'Failed to create account. Please try again.');
      setCreating(false);
    }
  };

  return (
    <div className="text-left">
      <div className="space-y-4">
        {(['firstName', 'lastName'] as const).map((k) => (
          <label key={k} className="block">
            <span className="block text-white text-base font-medium mb-2">
              {k === 'firstName' ? 'First Name' : 'Last Name'} <span className="text-[#ff4444]">*</span>
            </span>
            <input
              className={fieldClass(errors[k])}
              placeholder={k === 'firstName' ? 'First Name' : 'Last Name'}
              value={form[k]}
              autoComplete="off"
              onChange={(e) => { setForm({ ...form, [k]: e.target.value }); setErrors({ ...errors, [k]: false }); }}
            />
          </label>
        ))}
        <div>
          <span className="block text-white text-base font-medium mb-2">Gender</span>
          <div className="relative">
            <button type="button" onClick={() => setGenderOpen(!genderOpen)}
              className={`${fieldClass(false)} flex items-center justify-between text-left`}>
              <span className={form.gender ? 'text-white' : 'text-[rgba(253,253,249,0.7)]'}>{form.gender || 'Select Gender'}</span>
              <ChevronDownIcon className={`w-3 h-3 transition-transform ${genderOpen ? 'rotate-180' : ''}`} />
            </button>
            {genderOpen && (
              <div className="absolute left-0 right-0 top-12 z-10 rounded bg-[#F4F2EE] shadow-lg overflow-hidden">
                {['Male', 'Female'].map((g) => (
                  <button key={g} type="button" onClick={() => { setForm({ ...form, gender: g }); setGenderOpen(false); }}
                    className="w-full h-[45px] px-3 text-left text-black hover:bg-black/[0.06]">
                    {g}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <label className="block">
          <span className="block text-white text-base font-medium mb-2">
            Birth Date <span className="text-[#ff4444]">*</span>
          </span>
          <input
            className={fieldClass(errors.birthDate)}
            placeholder="MM/DD/YYYY"
            inputMode="numeric"
            maxLength={10}
            value={form.birthDate}
            onChange={(e) => { setForm({ ...form, birthDate: formatDobInput(e.target.value) }); setErrors({ ...errors, birthDate: false }); }}
          />
        </label>
      </div>
      {error && <p className="text-[#ff4444] text-sm mt-4 text-center">{error}</p>}
      <SaveButton onClick={create} disabled={creating} className={`mt-6 ${valid ? '' : '!bg-[#F4F2EE]/50'}`}>
        {creating ? 'Creating Account...' : 'Create Account'}
      </SaveButton>

      {warning && (
        <Overlay dim="bg-black/80">
          <div role="alertdialog" aria-modal="true" className="w-full max-w-[360px] rounded-2xl border border-white bg-black px-6 py-6 text-center">
            <p className="text-white text-xl font-medium mb-3">WARNING</p>
            <p className="text-white/90 text-[15px] leading-[22px] mb-6">
              Make sure your child's personal information (Name &amp; Birthdate) are correct as if not, when they eventually
              make their own account, the migration process will fail.
            </p>
            <SaveButton onClick={() => { setWarning(false); setSeenWarning(true); }}>Ok</SaveButton>
          </div>
        </Overlay>
      )}
    </div>
  );
};

type AddStep = 'choose' | 'connect' | 'create' | { done: string };

const AddFamilyMemberModal = ({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) => {
  const [step, setStep] = useState<AddStep>('choose');
  const createdRef = useRef(onCreated);
  createdRef.current = onCreated;

  // The app shows the success message briefly, then returns to My Family.
  useEffect(() => {
    if (typeof step === 'object') {
      const t = setTimeout(() => createdRef.current(), 1500);
      return () => clearTimeout(t);
    }
  }, [step]);

  if (step === 'create' || typeof step === 'object') {
    return (
      <AppModal title="Personal Information" onClose={() => (typeof step === 'object' ? onCreated() : setStep('choose'))}>
        {typeof step === 'object' ? (
          <div className="flex flex-col items-center py-8 gap-4">
            <SmallSpinner className="w-8 h-8" />
            <p className="text-white text-base text-center">{step.done}'s account created successfully!</p>
          </div>
        ) : (
          <CreateChildForm onCreated={(name) => setStep({ done: name })} />
        )}
      </AppModal>
    );
  }

  return (
    <Overlay onClose={onClose} dim="bg-black/80">
      <div role="dialog" aria-modal="true" aria-label="Add Family Member"
        className="relative w-full max-w-[420px] min-h-[300px] rounded-2xl bg-[#3a3a3a] p-6 flex flex-col items-center justify-center">
        {step === 'choose' ? (
          <>
            <h3 className="text-white text-2xl font-medium text-center mb-10">Add Family Member</h3>
            <div className="w-full space-y-5">
              <button type="button" onClick={() => setStep('connect')}
                className="w-full rounded-lg border border-white bg-[#F4F2EE] hover:bg-white px-4 py-4 text-center transition-colors">
                <span className="block text-black text-base font-medium mb-1">Connect your child's existing account.</span>
                <span className="block text-[#666] text-[13px]">Set up your child's account.</span>
              </button>
              <button type="button" onClick={() => setStep('create')}
                className="w-full rounded-lg border border-white bg-[#F4F2EE] hover:bg-white px-4 py-4 text-center transition-colors">
                <span className="block text-black text-base font-medium mb-1">Create New Account</span>
                <span className="block text-[#666] text-[13px]">Set up a temporary profile</span>
              </button>
            </div>
          </>
        ) : (
          <>
            <button type="button" onClick={() => setStep('choose')} aria-label="Back"
              className="absolute top-5 left-5 p-1 text-white hover:text-gray-300">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <h3 className="text-white text-2xl font-medium text-center mb-6">Connect Account</h3>
            <div className="w-40 h-40 rounded-2xl border-2 border-dashed border-white/30 flex items-center justify-center mb-6">
              <svg className="w-16 h-16 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h2m4 0v2m-6 4h2m2-4h2v4h-4" />
              </svg>
            </div>
            <p className="text-white text-[17px] text-center leading-snug mb-3">
              Connecting is done with a QR code in the Next Star app.
            </p>
            <p className="text-[#ccc] text-sm text-center leading-relaxed">
              On your phone, open <span className="text-white">Account → My Family → Add Family Member → Connect your
              child's existing account</span>, then have your child scan the code on their phone.
            </p>
          </>
        )}
      </div>
    </Overlay>
  );
};

const AccountFamilyPage = () => {
  const { user } = useAuth();
  const { loading, userType, children, refresh } = useAccount();
  const [birthDates, setBirthDates] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(false);
  const [toRemove, setToRemove] = useState<ParentChild | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState('');
  const [info, setInfo] = useState(false);

  // Birth dates for the cards (the shared child list doesn't carry them).
  const idsKey = children.map((c) => `${c.kind}:${c.id}`).join(',');
  useEffect(() => {
    let live = true;
    const proxyIds = children.filter((c) => c.kind === 'proxy').map((c) => c.id);
    const realIds = children.filter((c) => c.kind === 'real').map((c) => c.id);
    (async () => {
      const out: Record<string, string> = {};
      try {
        if (proxyIds.length) {
          const r = await databases.listDocuments(databaseId, collections.proxyChildren, [
            Query.equal('proxyId', proxyIds), Query.limit(100),
          ]);
          for (const d of r.documents as any[]) if (d.birthDate) out[d.proxyId] = d.birthDate;
        }
        if (realIds.length) {
          const cols = [collections.youthPlayers, collections.collegiatePlayers, collections.professionalPlayers].filter(Boolean) as string[];
          const res = await Promise.all(cols.map((c) =>
            databases.listDocuments(databaseId, c, [Query.equal('userId', realIds), Query.limit(100)]).catch(() => null)));
          for (const r of res) for (const d of (r?.documents || []) as any[]) if (d.birthDate) out[d.userId] = d.birthDate;
        }
      } catch {
        // Cards still show without a birth date.
      }
      if (live) setBirthDates(out);
    })();
    return () => { live = false; };
  }, [idsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <AccountSpinner />;
  if (userType !== 'parent') {
    return (
      <div>
        <AccountPageHeader title="My Family" />
        <p className="text-[#888] text-base">My Family is for parent accounts.</p>
      </div>
    );
  }

  // As the app: a temporary account is deleted with its relationships (never
  // once it has been claimed); a linked account is unlinked.
  const confirmRemove = async () => {
    if (!toRemove || !user) return;
    setRemoving(true);
    setRemoveError('');
    try {
      if (toRemove.kind === 'proxy') {
        const r = await databases.listDocuments(databaseId, collections.proxyChildren, [
          Query.equal('proxyId', toRemove.id), Query.limit(1),
        ]);
        const proxy: any = r.documents[0];
        if (!proxy) throw new Error('Proxy child not found');
        if (proxy.migratedToUserId) throw new Error('Cannot delete proxy child that has been migrated to real account');
        const rels = await databases.listDocuments(databaseId, collections.familyRelationships001, [
          Query.equal('childProxyId', toRemove.id), Query.limit(100),
        ]);
        for (const rel of rels.documents) {
          await databases.deleteDocument(databaseId, collections.familyRelationships001, rel.$id);
        }
        await databases.deleteDocument(databaseId, collections.proxyChildren, proxy.$id);
      } else {
        const rels = await databases.listDocuments(databaseId, collections.familyRelationships001, [
          Query.equal('parentUserId', user.$id), Query.equal('childUserId', toRemove.id), Query.limit(100),
        ]);
        for (const rel of rels.documents) {
          await databases.deleteDocument(databaseId, collections.familyRelationships001, rel.$id);
        }
      }
      setToRemove(null);
      await refresh();
    } catch (e: any) {
      setRemoveError(e?.message || 'Failed to remove family member');
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div>
      <AccountPageHeader title="My Family" />

      {children.length > 0 ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-3 md:gap-5">
            {children.map((c) => (
              <DependentCard
                key={`${c.kind}-${c.id}`}
                child={c}
                birthDate={birthDates[c.id]}
                onRemove={() => { setRemoveError(''); setToRemove(c); }}
                onInfo={() => setInfo(true)}
              />
            ))}
          </div>
          <div className="flex justify-center py-10">
            <AddButton onClick={() => setAdding(true)} />
          </div>
        </>
      ) : (
        <div className="flex justify-center pt-12">
          <AddButton onClick={() => setAdding(true)} />
        </div>
      )}

      {adding && (
        <AddFamilyMemberModal
          onClose={() => setAdding(false)}
          onCreated={() => { setAdding(false); refresh(); }}
        />
      )}

      {toRemove && (
        <Overlay onClose={() => !removing && setToRemove(null)} dim="bg-black/80">
          <div role="alertdialog" aria-modal="true" className="w-full max-w-[350px] rounded-2xl border border-white bg-black p-6 text-center">
            <p className="text-white text-base leading-[22px] mb-6">
              Are you sure you want to remove {toRemove.firstName} {toRemove.lastName} from your family?
            </p>
            {removeError && <p className="text-[#ff4444] text-sm mb-4">{removeError}</p>}
            <div className="flex justify-center gap-5">
              <button type="button" onClick={() => setToRemove(null)} disabled={removing}
                className="px-5 py-2.5 rounded-lg text-white font-medium hover:bg-white/10 disabled:opacity-40">Cancel</button>
              <button type="button" onClick={confirmRemove} disabled={removing}
                className="px-5 py-2.5 rounded-lg text-white font-medium hover:bg-white/10 disabled:opacity-40">
                {removing ? <SmallSpinner className="w-4 h-4 align-middle" /> : 'Remove'}
              </button>
            </div>
          </div>
        </Overlay>
      )}

      {info && (
        <Overlay onClose={() => setInfo(false)} dim="bg-black/80">
          <div role="dialog" aria-modal="true" className="w-full max-w-[400px] rounded-2xl bg-[#2a2a2a] p-6">
            <h3 className="text-white text-xl font-medium text-center mb-4">Temporary Account</h3>
            <p className="text-[#e9e9e9] text-[15px] leading-[22px]">
              A temporary account is a profile created by a parent or guardian for a family member who doesn't have their
              own account yet.
            </p>
            <p className="text-[#e9e9e9] text-[15px] leading-[22px] mt-[22px]">
              This allows you to manage their sessions and payment for them until they create their own account, at which
              point it will automatically replace the temporary account.
            </p>
          </div>
        </Overlay>
      )}
    </div>
  );
};

export default AccountFamilyPage;
