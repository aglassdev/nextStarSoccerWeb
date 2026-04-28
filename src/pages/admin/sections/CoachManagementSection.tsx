import { useState, useEffect } from 'react';
import { Query } from 'appwrite';
import { databases, databaseId, collections } from '../../../services/appwrite';

interface CoachDoc {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
  userId?: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  gender?: string;
  birthDate?: string;
  address?: string;
  isVerified?: boolean;
  tier?: string;
  license?: string;
  experience?: string;
  coachingPositions?: string[];
  playingExperience?: string[];
  signupsCount: number;
  checkinsCount: number;
}

// ── Detail Panel ──────────────────────────────────────────────────────────────
const CoachDetailPanel = ({
  coach,
  onClose,
  onVerifyToggle,
}: {
  coach: CoachDoc;
  onClose: () => void;
  onVerifyToggle: (id: string, verified: boolean) => Promise<void>;
}) => {
  const [verifying, setVerifying] = useState(false);

  const handleVerify = async () => {
    setVerifying(true);
    await onVerifyToggle(coach.$id, !coach.isVerified);
    setVerifying(false);
  };

  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', {
      timeZone: 'America/New_York', month: 'long', day: 'numeric', year: 'numeric',
    });

  const Field = ({ label, value }: { label: string; value?: string | string[] | null }) => {
    if (!value || (Array.isArray(value) && value.length === 0)) return null;
    const display = Array.isArray(value) ? value.join(', ') : value;
    return (
      <div>
        <p className="text-white/35 text-[10px] uppercase tracking-widest font-mono mb-0.5">{label}</p>
        <p className="text-white text-[13px] leading-snug">{display}</p>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}>
      <div
        className="bg-[#141214] border border-white/[0.09] rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-white/[0.07]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-white/[0.06] border border-white/[0.10] flex items-center justify-center flex-shrink-0">
              <span className="text-white text-base font-semibold">
                {(coach.firstName[0] || '?').toUpperCase()}
              </span>
            </div>
            <div>
              <h2 className="text-white text-[15px] font-semibold leading-tight">
                {coach.firstName} {coach.lastName}
              </h2>
              {coach.email && <p className="text-white/40 text-[12px] mt-0.5">{coach.email}</p>}
            </div>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors mt-0.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Verify button */}
        <div className="px-6 py-3 border-b border-white/[0.07] flex items-center justify-between">
          <div className="flex items-center gap-2">
            {coach.isVerified ? (
              <>
                <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                <span className="text-green-400 text-[12px] font-medium">Verified coach</span>
              </>
            ) : (
              <>
                <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                <span className="text-white/40 text-[12px]">Not verified</span>
              </>
            )}
          </div>
          <button
            onClick={handleVerify}
            disabled={verifying}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors disabled:opacity-40 ${
              coach.isVerified
                ? 'border border-white/[0.12] text-white/60 hover:text-white hover:border-white/20'
                : 'bg-green-500/15 border border-green-500/30 text-green-400 hover:bg-green-500/25'
            }`}
          >
            {verifying ? (
              <div className="w-3 h-3 border border-current/30 border-t-current rounded-full animate-spin" />
            ) : coach.isVerified ? (
              <>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Revoke verification
              </>
            ) : (
              <>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Verify coach
              </>
            )}
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

          {/* Personal info */}
          <div>
            <p className="text-white/20 text-[10px] uppercase tracking-widest font-mono mb-3">Personal</p>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Gender" value={coach.gender} />
              <Field label="Date of Birth" value={coach.birthDate ? fmt(coach.birthDate) : undefined} />
              <Field label="Phone" value={coach.phone} />
              <Field label="Tier" value={coach.tier} />
              <div className="col-span-2">
                <Field label="Address" value={coach.address} />
              </div>
            </div>
          </div>

          {/* Coaching info */}
          <div>
            <p className="text-white/20 text-[10px] uppercase tracking-widest font-mono mb-3">Coaching</p>
            <div className="space-y-3">
              <Field label="License" value={coach.license} />
              <Field label="Experience" value={coach.experience} />
              <Field label="Coaching Positions" value={coach.coachingPositions} />
              <Field label="Playing Experience" value={coach.playingExperience} />
            </div>
          </div>

          {/* Activity stats */}
          <div>
            <p className="text-white/20 text-[10px] uppercase tracking-widest font-mono mb-3">Activity</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/[0.04] border border-white/[0.07] rounded-lg px-4 py-3">
                <p className="text-white text-xl font-semibold tabular-nums leading-none">{coach.signupsCount}</p>
                <p className="text-white/35 text-[11px] mt-1">Sessions signed up</p>
              </div>
              <div className="bg-white/[0.04] border border-white/[0.07] rounded-lg px-4 py-3">
                <p className="text-white text-xl font-semibold tabular-nums leading-none">{coach.checkinsCount}</p>
                <p className="text-white/35 text-[11px] mt-1">Sessions attended</p>
              </div>
            </div>
          </div>

          {/* Meta */}
          <div>
            <p className="text-white/20 text-[10px] uppercase tracking-widest font-mono mb-3">Account</p>
            <div className="space-y-2 text-[12px] font-mono">
              <div className="flex items-center gap-3">
                <span className="text-white/25 w-20 flex-shrink-0">Doc ID</span>
                <span className="text-white/50 truncate">{coach.$id}</span>
              </div>
              {coach.userId && (
                <div className="flex items-center gap-3">
                  <span className="text-white/25 w-20 flex-shrink-0">User ID</span>
                  <span className="text-white/50 truncate">{coach.userId}</span>
                </div>
              )}
              <div className="flex items-center gap-3">
                <span className="text-white/25 w-20 flex-shrink-0">Joined</span>
                <span className="text-white/50">{fmt(coach.$createdAt)}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-white/25 w-20 flex-shrink-0">Updated</span>
                <span className="text-white/50">{fmt(coach.$updatedAt)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Main ──────────────────────────────────────────────────────────────────────
const CoachManagementSection = () => {
  const [coaches, setCoaches] = useState<CoachDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterVerified, setFilterVerified] = useState<'all' | 'verified' | 'unverified'>('all');
  const [selectedCoach, setSelectedCoach] = useState<CoachDoc | null>(null);

  const fetchCoaches = async () => {
    setLoading(true);
    setError('');
    try {
      const coachRes = await databases.listDocuments(databaseId, collections.coaches, [Query.limit(5000)]);
      const coachList = await Promise.all(
        coachRes.documents.map(async (coach: any) => {
          const [signups, checkins] = await Promise.all([
            collections.coachSignups
              ? databases.listDocuments(databaseId, collections.coachSignups, [
                  Query.equal('coachId', coach.$id), Query.limit(1),
                ]).catch(() => ({ total: 0 }))
              : { total: 0 },
            collections.coachCheckins
              ? databases.listDocuments(databaseId, collections.coachCheckins, [
                  Query.equal('coachId', coach.$id), Query.limit(1),
                ]).catch(() => ({ total: 0 }))
              : { total: 0 },
          ]);
          return {
            $id: coach.$id,
            $createdAt: coach.$createdAt,
            $updatedAt: coach.$updatedAt,
            userId: coach.userId,
            firstName: coach.firstName || '',
            lastName: coach.lastName || '',
            email: coach.email,
            phone: coach.phone,
            gender: coach.gender,
            birthDate: coach.birthDate,
            address: coach.address,
            isVerified: coach.isVerified,
            tier: coach.tier,
            license: coach.license,
            experience: coach.experience,
            coachingPositions: coach.coachingPositions,
            playingExperience: coach.playingExperience,
            signupsCount: (signups as any).total,
            checkinsCount: (checkins as any).total,
          };
        })
      );
      setCoaches(coachList);
    } catch (err: any) {
      setError('Failed to load coaches: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCoaches(); }, []);

  const handleVerifyToggle = async (id: string, verified: boolean) => {
    await databases.updateDocument(databaseId, collections.coaches, id, { isVerified: verified });
    setCoaches(prev => prev.map(c => c.$id === id ? { ...c, isVerified: verified } : c));
    setSelectedCoach(prev => prev && prev.$id === id ? { ...prev, isVerified: verified } : prev);
  };

  const filtered = coaches.filter(c => {
    if (filterVerified === 'verified' && !c.isVerified) return false;
    if (filterVerified === 'unverified' && c.isVerified) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q)
    );
  });

  const verifiedCount = coaches.filter(c => c.isVerified).length;
  const unverifiedCount = coaches.length - verifiedCount;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border border-white/10 border-t-white/40 rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="p-6">
      <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>
    </div>
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-white text-[15px] font-medium">Coach Management</h2>
          <p className="text-white/30 text-[12px] mt-0.5">
            {coaches.length} coaches · {verifiedCount} verified · {unverifiedCount} unverified
          </p>
        </div>
        <button onClick={fetchCoaches} className="text-white/30 hover:text-white transition-colors text-xs font-mono">
          refresh
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search coaches…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg pl-9 pr-4 py-2 text-white text-[13px] placeholder-white/25 focus:outline-none focus:border-white/20"
          />
        </div>
        <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.08] rounded-lg p-1">
          {(['all', 'verified', 'unverified'] as const).map(f => (
            <button key={f} onClick={() => setFilterVerified(f)}
              className={`px-3 py-1.5 rounded-md text-[12px] font-medium capitalize transition-colors ${
                filterVerified === f ? 'bg-white/[0.10] text-white' : 'text-white/40 hover:text-white'
              }`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {filtered.map(coach => (
          <button
            key={coach.$id}
            onClick={() => setSelectedCoach(coach)}
            className="bg-[#1d1c21] border border-white/[0.08] rounded-xl p-5 text-left hover:border-white/[0.18] hover:bg-[#242228] transition-all group"
          >
            {/* Avatar + name */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-white/[0.06] border border-white/[0.1] flex items-center justify-center flex-shrink-0">
                <span className="text-white text-sm font-semibold">
                  {(coach.firstName[0] || '?').toUpperCase()}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-white text-sm font-medium truncate group-hover:text-white transition-colors">
                  {coach.firstName} {coach.lastName}
                </p>
                {coach.email && (
                  <p className="text-white/40 text-[11px] truncate mt-0.5">{coach.email}</p>
                )}
              </div>
              <svg className="w-3.5 h-3.5 text-white/20 group-hover:text-white/40 flex-shrink-0 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>

            {/* Verified badge */}
            <div className="mb-4">
              {coach.isVerified ? (
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                  <span className="text-green-400 text-[11px] font-medium">Verified</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-white/15 flex-shrink-0" />
                  <span className="text-white/30 text-[11px]">Not verified</span>
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/[0.06]">
              <div>
                <p className="text-white text-lg font-semibold tabular-nums leading-none">{coach.signupsCount}</p>
                <p className="text-white/35 text-[11px] mt-1">Signed up</p>
              </div>
              <div>
                <p className="text-white text-lg font-semibold tabular-nums leading-none">{coach.checkinsCount}</p>
                <p className="text-white/35 text-[11px] mt-1">Attended</p>
              </div>
            </div>
          </button>
        ))}

        {filtered.length === 0 && (
          <div className="col-span-full text-center py-16 text-white/20 text-sm">
            {search || filterVerified !== 'all' ? 'No coaches match your filters.' : 'No coaches found.'}
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selectedCoach && (
        <CoachDetailPanel
          coach={selectedCoach}
          onClose={() => setSelectedCoach(null)}
          onVerifyToggle={handleVerifyToggle}
        />
      )}
    </div>
  );
};

export default CoachManagementSection;
