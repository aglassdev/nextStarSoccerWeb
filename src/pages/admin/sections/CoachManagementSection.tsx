import { useState, useEffect } from 'react';
import { Query } from 'appwrite';
import { databases, databaseId, collections } from '../../../services/appwrite';

interface CoachStats {
  $id: string;
  firstName: string;
  lastName: string;
  email?: string;
  isVerified?: boolean;
  signupsCount: number;
  checkinsCount: number;
}

const CoachManagementSection = () => {
  const [coaches, setCoaches] = useState<CoachStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
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
              firstName: coach.firstName || '',
              lastName: coach.lastName || '',
              email: coach.email,
              isVerified: coach.isVerified,
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
    })();
  }, []);

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
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-white text-xl font-semibold">Coach Management</h2>
        <p className="text-white/40 text-sm mt-1">{coaches.length} coaches</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {coaches.map(coach => (
          <div key={coach.$id} className="bg-[#1d1c21] border border-white/[0.08] rounded-xl p-5">

            {/* Avatar + name */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-white/[0.06] border border-white/[0.1] flex items-center justify-center flex-shrink-0">
                <span className="text-white text-sm font-semibold">
                  {(coach.firstName[0] || '?').toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-white text-sm font-medium truncate">
                  {coach.firstName} {coach.lastName}
                </p>
                {coach.email && (
                  <p className="text-white/40 text-[11px] truncate mt-0.5">{coach.email}</p>
                )}
              </div>
            </div>

            {/* Verified badge */}
            <div className="mb-4">
              {coach.isVerified ? (
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/60 border border-white/20 rounded px-2 py-0.5">
                  Verified
                </span>
              ) : (
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/25 border border-white/10 rounded px-2 py-0.5">
                  Unverified
                </span>
              )}
            </div>

            {/* Session stats — 2 columns */}
            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/[0.06]">
              <div>
                <p className="text-white text-lg font-semibold tabular-nums leading-none">
                  {coach.signupsCount}
                </p>
                <p className="text-white/40 text-[11px] mt-1 leading-snug">Sessions signed up</p>
              </div>
              <div>
                <p className="text-white text-lg font-semibold tabular-nums leading-none">
                  {coach.checkinsCount}
                </p>
                <p className="text-white/40 text-[11px] mt-1 leading-snug">Sessions attended</p>
              </div>
            </div>
          </div>
        ))}

        {coaches.length === 0 && (
          <div className="col-span-full text-center py-16 text-white/20 text-sm">No coaches found</div>
        )}
      </div>
    </div>
  );
};

export default CoachManagementSection;
