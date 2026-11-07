import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Query } from 'appwrite';
import { databases, databaseId, collections } from '@/services/appwrite';
import { useAccount } from './AccountContext';
import { AccountPageHeader, AccountSpinner } from './AccountLayout';
import ProfileView, { ProfileKind } from './profile/ProfileView';
import { profilePhotoUrl, uploadProfilePhoto } from './profile/photo';
import { AppModal, Avatar, ErrorNote, SaveButton } from './profile/ui';
import { SWITCH_TARGETS, TYPE_LABELS } from './profile/fields';
import type { ParentChild } from '@/services/clinicRegistration';

// The app's Profile screen (screens/main/account/settings/ProfileScreen.tsx):
// a player's or coach's photo, name and club, then their soccer details by
// account type, each field opening the same picker the app uses and saving
// straight to their profile document.
//
// Parents have no soccer profile of their own; in the app they reach their
// players' profiles from the Account page's player cards (a temporary
// account's opens its editable profile; a linked account manages its own).
// Here a parent sees those players and their profiles.

const isPlayerKind = (t: string | null): t is ProfileKind =>
  t === 'youth' || t === 'collegiate' || t === 'professional' || t === 'coach';

const Message = ({ text }: { text: string }) => (
  <div className="flex items-center justify-center min-h-[40vh]">
    <p className="text-[#ff4444] text-base text-center">{text}</p>
  </div>
);

/** The app's Switch Account Type button. Switching moves the profile to another
 *  collection and signs the user out, so it stays in the app. */
const SwitchAccountType = ({ current }: { current: string }) => {
  const [open, setOpen] = useState(false);
  const targets = SWITCH_TARGETS[current] || [];
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full md:w-auto md:min-w-[320px] py-[15px] md:px-10 rounded-lg bg-[#F4F2EE] hover:bg-white text-black text-base font-medium transition-colors"
      >
        Switch Account Type
      </button>
      {open && (
        <AppModal title="Switch Account Type" onClose={() => setOpen(false)}>
          <div className="space-y-2.5 mb-5">
            {targets.map((t) => (
              <div key={t} className="w-full py-3.5 rounded-lg border border-white/25 text-center text-white/60 text-base">
                {TYPE_LABELS[t]}
              </div>
            ))}
          </div>
          <p className="text-[#ccc] text-sm leading-relaxed text-center mb-5">
            Switching account type is done in the Next Star app: open <span className="text-white">Account → Profile → Switch
            Account Type</span>. It moves your details to the new account type and signs you out, and you can't switch back
            to a {TYPE_LABELS[current] || current} account afterwards.
          </p>
          <SaveButton onClick={() => setOpen(false)}>OK</SaveButton>
        </AppModal>
      )}
    </>
  );
};

/** A signed-in player's or coach's own profile. */
const OwnProfile = ({ kind }: { kind: ProfileKind }) => {
  const { profile, collectionId, refresh } = useAccount();
  const [doc, setDoc] = useState<any>(profile);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => setDoc(profile), [profile]);

  const saveField = async (field: string, value: any) => {
    if (!doc || !collectionId) throw new Error('No profile to update.');
    await databases.updateDocument(databaseId, collectionId, doc.$id, { [field]: value });
    setDoc((d: any) => ({ ...d, [field]: value }));
    refresh().catch(() => {});
  };

  const pickPhoto = async (file: File) => {
    setUploading(true);
    setError('');
    try {
      const id = await uploadProfilePhoto(file, doc?.profilePhotoId);
      await saveField('profilePhotoId', id);
    } catch (e: any) {
      setError(e?.message || "We couldn't update your profile photo. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  if (!doc) return <Message text="Profile data not found" />;
  return (
    <ProfileView
      kind={kind}
      doc={doc}
      onSaveField={saveField}
      photoUrl={profilePhotoUrl(doc.profilePhotoId)}
      onPickPhoto={pickPhoto}
      uploadingPhoto={uploading}
      notice={error ? <ErrorNote text={error} onDismiss={() => setError('')} /> : undefined}
      footer={<div className="pt-2"><SwitchAccountType current={kind} /></div>}
    />
  );
};

type ChildProfile = { kind: ProfileKind; doc: any; collectionId: string; editable: boolean };

async function loadChildProfile(child: ParentChild): Promise<ChildProfile | null> {
  if (child.kind === 'proxy') {
    const r = await databases.listDocuments(databaseId, collections.proxyChildren, [
      Query.equal('proxyId', child.id),
      Query.limit(1),
    ]);
    const doc = r.documents[0];
    return doc ? { kind: 'youth', doc, collectionId: collections.proxyChildren, editable: true } : null;
  }
  const lookups: [ProfileKind, string | undefined][] = [
    ['youth', collections.youthPlayers],
    ['collegiate', collections.collegiatePlayers],
    ['professional', collections.professionalPlayers],
  ];
  for (const [kind, collectionId] of lookups) {
    if (!collectionId) continue;
    const r = await databases.listDocuments(databaseId, collectionId, [Query.equal('userId', child.id), Query.limit(1)]);
    if (r.documents[0]) return { kind, doc: r.documents[0], collectionId, editable: false };
  }
  return null;
}

/** The app's Account-page player card. */
const PlayerCard = ({ child, active, onClick }: { child: ParentChild; active: boolean; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`w-full flex items-center gap-3.5 rounded-2xl border px-4 py-3.5 text-left transition-colors ${
      active ? 'bg-[#1a1a1a] border-white/60' : 'bg-[#111] border-[#222] hover:border-[#3a3a3a]'
    }`}
  >
    <Avatar url={profilePhotoUrl(child.photoId)} sizeClass="w-12 h-12" />
    <span className="min-w-0 flex-1">
      <span className="block text-white text-base font-medium truncate">{child.firstName} {child.lastName}</span>
      <span className="block text-[#888] text-[13px] truncate">{child.club || 'No club set'}</span>
    </span>
    {child.kind === 'proxy' && (
      <span className="flex-shrink-0 rounded-full bg-[#FFD54F] px-2 py-0.5 text-[11px] font-medium text-[#333]">Temp</span>
    )}
  </button>
);

/** A parent's view: their players' cards, and the chosen player's profile. */
const FamilyProfiles = () => {
  const { children, refresh } = useAccount();
  const [selectedId, setSelectedId] = useState<string | null>(children[0]?.id ?? null);
  const [state, setState] = useState<{ loading: boolean; profile: ChildProfile | null; error: string }>({
    loading: true, profile: null, error: '',
  });
  const selected = children.find((c) => c.id === selectedId) || children[0] || null;

  const load = useCallback(async (child: ParentChild | null) => {
    if (!child) return;
    setState({ loading: true, profile: null, error: '' });
    try {
      setState({ loading: false, profile: await loadChildProfile(child), error: '' });
    } catch (e: any) {
      setState({ loading: false, profile: null, error: e?.message || 'Could not load this profile.' });
    }
  }, []);
  useEffect(() => { load(selected); }, [selected?.id, selected?.kind]); // eslint-disable-line react-hooks/exhaustive-deps

  if (children.length === 0) {
    return (
      <div className="bg-[#111] border border-[#222] rounded-2xl px-6 py-14 text-center">
        <p className="text-white text-lg font-medium">No players on your account yet</p>
        <p className="text-[#888] text-sm mt-1.5">Add your player in My Family to set up their profile.</p>
        <Link to="/account/family" className="inline-block mt-6 px-8 py-3.5 rounded-lg bg-[#F4F2EE] hover:bg-white text-black font-medium transition-colors">
          My Family
        </Link>
      </div>
    );
  }

  const p = state.profile;
  const saveField = async (field: string, value: any) => {
    if (!p) throw new Error('No profile to update.');
    await databases.updateDocument(databaseId, p.collectionId, p.doc.$id, { [field]: value });
    setState((s) => (s.profile ? { ...s, profile: { ...s.profile, doc: { ...s.profile.doc, [field]: value } } } : s));
    refresh().catch(() => {});
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-8 items-start">
      <div className="space-y-2.5 lg:sticky lg:top-24">
        <p className="text-[#888] text-xs uppercase tracking-wider mb-1">Players</p>
        {children.map((c) => (
          <PlayerCard key={`${c.kind}-${c.id}`} child={c} active={c.id === selected?.id} onClick={() => setSelectedId(c.id)} />
        ))}
      </div>
      <div className="min-w-0">
        {state.loading ? (
          <AccountSpinner />
        ) : !p ? (
          <Message text={state.error || 'Profile data not found'} />
        ) : (
          <ProfileView
            key={p.doc.$id}
            kind={p.kind}
            doc={p.doc}
            onSaveField={p.editable ? saveField : undefined}
            photoUrl={profilePhotoUrl(p.doc.profilePhotoId)}
            notice={
              p.editable ? (
                <p className="text-[#888] text-sm px-1">
                  <span className="inline-block rounded-full bg-[#FFD54F] px-2 py-0.5 mr-2 text-[11px] font-medium text-[#333] align-middle">
                    Temp Account
                  </span>
                  You manage {p.doc.firstName}'s profile until they create their own account.
                </p>
              ) : (
                <p className="text-[#888] text-sm px-1">
                  This is a connected account. {p.doc.firstName || 'They'} manages their own profile settings.
                </p>
              )
            }
          />
        )}
      </div>
    </div>
  );
};

const AccountProfilePage = () => {
  const { loading, userType } = useAccount();
  if (loading) return <AccountSpinner />;

  return (
    <div>
      <AccountPageHeader title="Profile" />
      {userType === 'parent' ? (
        <FamilyProfiles />
      ) : isPlayerKind(userType) ? (
        <OwnProfile kind={userType} />
      ) : (
        <Message text="Profile not available for this account type" />
      )}
    </div>
  );
};

export default AccountProfilePage;
