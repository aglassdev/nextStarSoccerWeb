import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Query } from 'appwrite';
import { databases, databaseId, collections } from '../../../services/appwrite';

type PlayerType = 'Youth' | 'Collegiate' | 'Professional';

interface PlayerRecord {
  $id: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  type: PlayerType;
  isProxy?: boolean;
  parentName?: string;
  [key: string]: any;
}

const PlayersSection = () => {
  const navigate = useNavigate();
  const [players, setPlayers] = useState<PlayerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [activeFilters, setActiveFilters] = useState<PlayerType[]>(['Youth', 'Collegiate', 'Professional']);

  useEffect(() => { fetchPlayers(); }, []);

  const fetchPlayers = async () => {
    setLoading(true); setError('');
    try {
      const [youthRes, collegiateRes, professionalRes, proxyRes, parentsRes, relRes] = await Promise.all([
        databases.listDocuments(databaseId, collections.youthPlayers, [Query.limit(5000)]),
        databases.listDocuments(databaseId, collections.collegiatePlayers, [Query.limit(5000)]),
        databases.listDocuments(databaseId, collections.professionalPlayers, [Query.limit(5000)]),
        collections.proxyChildren
          ? databases.listDocuments(databaseId, collections.proxyChildren, [Query.limit(5000)])
          : Promise.resolve({ documents: [] }),
        databases.listDocuments(databaseId, collections.parentUsers, [Query.limit(5000)]),
        databases.listDocuments(databaseId, collections.familyRelationships, [Query.limit(5000)]),
      ]);

      // Build parent ID → display name lookup
      const parentNameById: Record<string, string> = {};
      for (const p of parentsRes.documents as any[]) {
        const name = p.firstName || p.lastName
          ? `${p.firstName || ''} ${p.lastName || ''}`.trim()
          : p.name || p.email || '';
        if (name) parentNameById[p.$id] = name;
      }

      // Build player ID → parent name from family_relationships
      const parentByPlayerId: Record<string, string> = {};
      for (const rel of relRes.documents as any[]) {
        const pname = parentNameById[rel.parentUserId];
        if (!pname) continue;
        if (rel.childUserId) parentByPlayerId[rel.childUserId] = pname;
        if (rel.childProxyId) parentByPlayerId[rel.childProxyId] = pname;
      }

      // Also map proxy children via their direct parentUserId field
      for (const doc of proxyRes.documents as any[]) {
        if (doc.parentUserId && parentNameById[doc.parentUserId]) {
          parentByPlayerId[doc.$id] = parentNameById[doc.parentUserId];
        }
      }

      const normDob = (d: any) => ({ ...d, dateOfBirth: d.dateOfBirth || d.birthDate || d.dob || d.birthdate });
      const youth: PlayerRecord[] = youthRes.documents.map((d: any) => ({ ...normDob(d), type: 'Youth' as PlayerType, parentName: parentByPlayerId[d.$id] }));
      const collegiate: PlayerRecord[] = collegiateRes.documents.map((d: any) => ({ ...normDob(d), type: 'Collegiate' as PlayerType, parentName: parentByPlayerId[d.$id] }));
      const professional: PlayerRecord[] = professionalRes.documents.map((d: any) => ({ ...normDob(d), type: 'Professional' as PlayerType, parentName: parentByPlayerId[d.$id] }));
      const proxy: PlayerRecord[] = proxyRes.documents.map((d: any) => ({
        ...d,
        dateOfBirth: d.birthDate ?? d.dateOfBirth,
        type: 'Youth' as PlayerType,
        isProxy: true,
        parentName: parentByPlayerId[d.$id],
      }));
      setPlayers([...youth, ...collegiate, ...professional, ...proxy]);
    } catch (err: any) {
      setError('Failed to load players: ' + (err.message || 'Unknown error'));
    } finally { setLoading(false); }
  };

  const toggleFilter = (type: PlayerType) => {
    setActiveFilters(prev => prev.includes(type) ? prev.filter(f => f !== type) : [...prev, type]);
  };

  const filtered = players.filter(p => {
    const name = `${p.firstName} ${p.lastName}`.toLowerCase();
    return name.includes(search.toLowerCase()) && activeFilters.includes(p.type);
  });

  const typeBadge = (type: PlayerType) => {
    const map: Record<PlayerType, string> = {
      Youth: 'bg-green-500/20 text-green-400 border border-green-500/30',
      Collegiate: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
      Professional: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
    };
    return map[type];
  };

  const typeToPath: Record<PlayerType, string> = {
    Youth: 'youth', Collegiate: 'collegiate', Professional: 'professional',
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-white mb-6">Players</h2>

      <div className="mb-4">
        <input type="text" placeholder="Search players..." value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-md px-4 py-2 bg-[#1d1c21] border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-white/20" />
      </div>

      <div className="flex gap-2 mb-6">
        {(['Youth', 'Collegiate', 'Professional'] as PlayerType[]).map(type => (
          <button key={type} onClick={() => toggleFilter(type)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeFilters.includes(type) ? 'bg-white text-black' : 'bg-white/[0.06] text-white/50 hover:bg-white/10'
            }`}>
            {type}
          </button>
        ))}
      </div>

      {loading && <div className="flex items-center justify-center h-48"><div className="w-6 h-6 border border-white/10 border-t-white/40 rounded-full animate-spin" /></div>}
      {error && <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm mb-4">{error}</div>}

      {!loading && !error && (
        <div className="bg-[#1d1c21] rounded-lg border border-white/[0.08] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.07]">
                <th className="text-left px-4 py-3 text-white/40 text-xs font-medium uppercase tracking-wider">Name</th>
                <th className="text-left px-4 py-3 text-white/40 text-xs font-medium uppercase tracking-wider">Birth Date</th>
                <th className="text-left px-4 py-3 text-white/40 text-xs font-medium uppercase tracking-wider">Parent</th>
                <th className="text-left px-4 py-3 text-white/40 text-xs font-medium uppercase tracking-wider">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {filtered.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-white/20 text-sm">No players found</td></tr>
              ) : (
                filtered.map(player => (
                  <tr key={player.$id}
                    onClick={() => navigate(
                      player.isProxy
                        ? `/admin/players/proxy/${player.$id}`
                        : `/admin/players/${typeToPath[player.type]}/${player.$id}`
                    )}
                    className="transition-colors hover:bg-white/[0.03] cursor-pointer">
                    <td className="px-4 py-3 text-white text-sm">{player.firstName} {player.lastName}</td>
                    <td className="px-4 py-3 text-white/50 text-sm">
                      {player.dateOfBirth
                        ? (() => {
                            const raw = player.dateOfBirth as string;
                            // MM/DD/YYYY → already human-readable, return as-is
                            if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(raw)) return raw;
                            const d = new Date(raw);
                            return isNaN(d.getTime()) ? raw : d.toLocaleDateString();
                          })()
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {player.parentName
                        ? <span className="inline-block bg-white/[0.06] border border-white/[0.08] rounded-full px-2.5 py-0.5 text-white/70 text-[12px]">{player.parentName}</span>
                        : <span className="text-white/25">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${typeBadge(player.type)}`}>{player.type}</span>
                        {player.isProxy && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-white/[0.06] text-white/40 border border-white/10">Proxy</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default PlayersSection;
