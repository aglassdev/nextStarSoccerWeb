import { useState, useEffect } from 'react';
import { Query } from 'appwrite';
import { databases, databaseId, collections } from '../../../services/appwrite';

interface ParentRecord {
  $id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  phone?: string;
  dependantCount: number;
  [key: string]: any;
}

const ParentsSection = () => {
  const [parents, setParents] = useState<ParentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedParent, setSelectedParent] = useState<ParentRecord | null>(null);

  useEffect(() => {
    fetchParents();
  }, []);

  const fetchParents = async () => {
    setLoading(true);
    setError('');
    try {
      const [parentsRes, relationshipsRes] = await Promise.all([
        databases.listDocuments(databaseId, collections.parentUsers, [Query.limit(5000)]),
        databases.listDocuments(databaseId, collections.familyRelationships, [Query.limit(5000)]),
      ]);

      // Count dependants per parent using parentUserId field
      const dependantCounts: Record<string, number> = {};
      for (const rel of relationshipsRes.documents) {
        const pid = rel.parentUserId || rel.parentId;
        if (pid) {
          dependantCounts[pid] = (dependantCounts[pid] || 0) + 1;
        }
      }

      const parentList: ParentRecord[] = parentsRes.documents.map((d: any) => ({
        ...d,
        dependantCount: dependantCounts[d.$id] || 0,
      }));

      setParents(parentList);
    } catch (err: any) {
      setError('Failed to load parents: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const getDisplayName = (p: ParentRecord) => {
    if (p.firstName || p.lastName) return `${p.firstName || ''} ${p.lastName || ''}`.trim();
    if (p.name) return p.name;
    return p.email || 'Unknown';
  };

  const filtered = parents.filter(p => {
    const name = getDisplayName(p).toLowerCase();
    return name.includes(search.toLowerCase()) || (p.email || '').toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-white mb-6">Parents</h2>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search parents..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-md px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
        />
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
                <th className="text-left px-4 py-3 text-gray-400 text-sm font-medium">Dependants</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-4 py-8 text-center text-gray-500">
                    No parents found
                  </td>
                </tr>
              ) : (
                filtered.map(parent => (
                  <tr
                    key={parent.$id}
                    onClick={() => setSelectedParent(parent)}
                    className="hover:bg-gray-800/50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 text-white">{getDisplayName(parent)}</td>
                    <td className="px-4 py-3 text-gray-400">{parent.dependantCount}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Slide-in Detail Panel */}
      {selectedParent && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setSelectedParent(null)}
          />
          <div className="fixed right-0 top-0 h-full w-96 bg-gray-900 border-l border-gray-700 z-50 overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">{getDisplayName(selectedParent)}</h3>
                <button
                  onClick={() => setSelectedParent(null)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <DetailRow label="Email" value={selectedParent.email} />
                <DetailRow label="Phone" value={selectedParent.phone} />
                <DetailRow label="Dependants" value={String(selectedParent.dependantCount)} />
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

export default ParentsSection;
