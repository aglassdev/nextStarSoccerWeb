import { useState, useEffect } from 'react';
import { Query } from 'appwrite';
import { databases, databaseId, collections } from '../../../services/appwrite';

interface Coach {
  $id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  isVerified?: boolean;
  license?: string;
  coachingExperience?: string;
  playingExperience?: string;
  [key: string]: any;
}

type VerifiedFilter = 'all' | 'verified' | 'notVerified';

const CoachesSection = () => {
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<VerifiedFilter>('all');
  const [selectedCoach, setSelectedCoach] = useState<Coach | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    fetchCoaches();
  }, []);

  const fetchCoaches = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await databases.listDocuments(databaseId, collections.coaches, [Query.limit(5000)]);
      setCoaches(res.documents as unknown as Coach[]);
    } catch (err: any) {
      setError('Failed to load coaches: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const toggleVerified = async (coach: Coach) => {
    setUpdatingId(coach.$id);
    try {
      await databases.updateDocument(databaseId, collections.coaches, coach.$id, {
        isVerified: !coach.isVerified,
      });
      const updated = { ...coach, isVerified: !coach.isVerified };
      setCoaches(prev => prev.map(c => (c.$id === coach.$id ? updated : c)));
      if (selectedCoach?.$id === coach.$id) {
        setSelectedCoach(updated);
      }
    } catch (err: any) {
      alert('Failed to update: ' + (err.message || 'Unknown error'));
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = coaches.filter(c => {
    const name = `${c.firstName} ${c.lastName}`.toLowerCase();
    const matchesSearch = name.includes(search.toLowerCase());
    const matchesFilter =
      filter === 'all' ||
      (filter === 'verified' && c.isVerified) ||
      (filter === 'notVerified' && !c.isVerified);
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-white mb-6">Coaches</h2>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search coaches..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-md px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
        />
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 mb-6">
        {([['all', 'All'], ['verified', 'Verified'], ['notVerified', 'Not Verified']] as [VerifiedFilter, string][]).map(
          ([val, label]) => (
            <button
              key={val}
              onClick={() => setFilter(val)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === val
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {label}
            </button>
          )
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500 rounded-lg text-red-400 mb-4">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-950">
                <th className="text-left px-4 py-3 text-gray-400 text-sm font-medium">Name</th>
                <th className="text-left px-4 py-3 text-gray-400 text-sm font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-4 py-8 text-center text-gray-500">
                    No coaches found
                  </td>
                </tr>
              ) : (
                filtered.map(coach => (
                  <tr
                    key={coach.$id}
                    onClick={() => setSelectedCoach(coach)}
                    className="hover:bg-gray-800/50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 text-white">
                      {coach.firstName} {coach.lastName}
                    </td>
                    <td className="px-4 py-3">
                      {coach.isVerified ? (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                          Verified
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-700 text-gray-400 border border-gray-600">
                          Not Verified
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Slide-in Detail Panel */}
      {selectedCoach && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setSelectedCoach(null)}
          />
          <div className="fixed right-0 top-0 h-full w-96 bg-gray-900 border-l border-gray-700 z-50 overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">
                  {selectedCoach.firstName} {selectedCoach.lastName}
                </h3>
                <button
                  onClick={() => setSelectedCoach(null)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  {selectedCoach.isVerified ? (
                    <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                      Verified
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-700 text-gray-400 border border-gray-600">
                      Not Verified
                    </span>
                  )}
                  <button
                    onClick={() => toggleVerified(selectedCoach)}
                    disabled={updatingId === selectedCoach.$id}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                      selectedCoach.isVerified
                        ? 'bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-500/30'
                        : 'bg-green-600/20 text-green-400 hover:bg-green-600/30 border border-green-500/30'
                    }`}
                  >
                    {updatingId === selectedCoach.$id
                      ? 'Updating...'
                      : selectedCoach.isVerified
                      ? 'Revoke'
                      : 'Verify'}
                  </button>
                </div>

                <DetailRow label="Email" value={selectedCoach.email} />
                <DetailRow label="Phone" value={selectedCoach.phone} />
                <DetailRow label="License" value={selectedCoach.license} />
                <DetailRow label="Coaching Experience" value={selectedCoach.coachingExperience} />
                <DetailRow label="Playing Experience" value={selectedCoach.playingExperience} />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const DetailRow = ({ label, value }: { label: string; value?: string }) => (
  <div>
    <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">{label}</p>
    <p className="text-white">{value || '—'}</p>
  </div>
);

export default CoachesSection;
