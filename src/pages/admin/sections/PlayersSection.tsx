import { useState, useEffect } from 'react';
import { Query } from 'appwrite';
import { databases, databaseId, collections } from '../../../services/appwrite';

type PlayerType = 'Youth' | 'Collegiate' | 'Professional';

interface PlayerRecord {
  $id: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  email?: string;
  phone?: string;
  position?: string;
  type: PlayerType;
  // Youth-specific
  grade?: string;
  school?: string;
  parentId?: string;
  emergencyContact?: string;
  medicalInfo?: string;
  // Collegiate-specific
  college?: string;
  major?: string;
  graduationYear?: string;
  // Professional-specific
  club?: string;
  league?: string;
  contractExpiry?: string;
  [key: string]: any;
}

const PlayersSection = () => {
  const [players, setPlayers] = useState<PlayerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [activeFilters, setActiveFilters] = useState<PlayerType[]>(['Youth', 'Collegiate', 'Professional']);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerRecord | null>(null);

  useEffect(() => {
    fetchPlayers();
  }, []);

  const fetchPlayers = async () => {
    setLoading(true);
    setError('');
    try {
      const [youthRes, collegiateRes, professionalRes] = await Promise.all([
        databases.listDocuments(databaseId, collections.youthPlayers, [Query.limit(5000)]),
        databases.listDocuments(databaseId, collections.collegiatePlayers, [Query.limit(5000)]),
        databases.listDocuments(databaseId, collections.professionalPlayers, [Query.limit(5000)]),
      ]);

      const youth: PlayerRecord[] = youthRes.documents.map((d: any) => ({ ...d, type: 'Youth' as PlayerType }));
      const collegiate: PlayerRecord[] = collegiateRes.documents.map((d: any) => ({ ...d, type: 'Collegiate' as PlayerType }));
      const professional: PlayerRecord[] = professionalRes.documents.map((d: any) => ({ ...d, type: 'Professional' as PlayerType }));

      setPlayers([...youth, ...collegiate, ...professional]);
    } catch (err: any) {
      setError('Failed to load players: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const toggleFilter = (type: PlayerType) => {
    setActiveFilters(prev =>
      prev.includes(type) ? prev.filter(f => f !== type) : [...prev, type]
    );
  };

  const filtered = players.filter(p => {
    const name = `${p.firstName} ${p.lastName}`.toLowerCase();
    const matchesSearch = name.includes(search.toLowerCase());
    const matchesFilter = activeFilters.includes(p.type);
    return matchesSearch && matchesFilter;
  });

  const typeBadge = (type: PlayerType) => {
    const map: Record<PlayerType, string> = {
      Youth: 'bg-green-500/20 text-green-400 border border-green-500/30',
      Collegiate: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
      Professional: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
    };
    return map[type];
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-white mb-6">Players</h2>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search players..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-md px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
        />
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 mb-6">
        {(['Youth', 'Collegiate', 'Professional'] as PlayerType[]).map(type => (
          <button
            key={type}
            onClick={() => toggleFilter(type)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeFilters.includes(type)
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {type}
          </button>
        ))}
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
                <th className="text-left px-4 py-3 text-gray-400 text-sm font-medium">Birth Date</th>
                <th className="text-left px-4 py-3 text-gray-400 text-sm font-medium">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                    No players found
                  </td>
                </tr>
              ) : (
                filtered.map(player => (
                  <tr
                    key={player.$id}
                    onClick={() => setSelectedPlayer(player)}
                    className="hover:bg-gray-800/50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 text-white">
                      {player.firstName} {player.lastName}
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {player.dateOfBirth ? new Date(player.dateOfBirth).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${typeBadge(player.type)}`}>
                        {player.type}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Slide-in Detail Panel */}
      {selectedPlayer && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setSelectedPlayer(null)}
          />
          <div className="fixed right-0 top-0 h-full w-96 bg-gray-900 border-l border-gray-700 z-50 overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">
                  {selectedPlayer.firstName} {selectedPlayer.lastName}
                </h3>
                <button
                  onClick={() => setSelectedPlayer(null)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${typeBadge(selectedPlayer.type)}`}>
                    {selectedPlayer.type} Player
                  </span>
                </div>

                <DetailRow label="Email" value={selectedPlayer.email} />
                <DetailRow label="Phone" value={selectedPlayer.phone} />
                <DetailRow
                  label="Date of Birth"
                  value={selectedPlayer.dateOfBirth ? new Date(selectedPlayer.dateOfBirth).toLocaleDateString() : undefined}
                />
                <DetailRow label="Position" value={selectedPlayer.position} />

                {selectedPlayer.type === 'Youth' && (
                  <>
                    <hr className="border-gray-700" />
                    <p className="text-gray-500 text-xs uppercase tracking-wider">Youth Details</p>
                    <DetailRow label="Grade" value={selectedPlayer.grade} />
                    <DetailRow label="School" value={selectedPlayer.school} />
                    <DetailRow label="Emergency Contact" value={selectedPlayer.emergencyContact} />
                    <DetailRow label="Medical Info" value={selectedPlayer.medicalInfo} />
                  </>
                )}

                {selectedPlayer.type === 'Collegiate' && (
                  <>
                    <hr className="border-gray-700" />
                    <p className="text-gray-500 text-xs uppercase tracking-wider">Collegiate Details</p>
                    <DetailRow label="College" value={selectedPlayer.college} />
                    <DetailRow label="Major" value={selectedPlayer.major} />
                    <DetailRow label="Graduation Year" value={selectedPlayer.graduationYear} />
                  </>
                )}

                {selectedPlayer.type === 'Professional' && (
                  <>
                    <hr className="border-gray-700" />
                    <p className="text-gray-500 text-xs uppercase tracking-wider">Professional Details</p>
                    <DetailRow label="Club" value={selectedPlayer.club} />
                    <DetailRow label="League" value={selectedPlayer.league} />
                    <DetailRow label="Contract Expiry" value={selectedPlayer.contractExpiry} />
                  </>
                )}
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

export default PlayersSection;
