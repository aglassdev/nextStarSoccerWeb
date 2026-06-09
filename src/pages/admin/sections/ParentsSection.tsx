import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  childNames: string[];
  [key: string]: any;
}

const ParentsSection = () => {
  const navigate = useNavigate();
  const [parents, setParents] = useState<ParentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => { fetchParents(); }, []);

  const fetchParents = async () => {
    setLoading(true); setError('');
    try {
      // proxy_children have parentUserId directly — one fetch gives us all names
      const [parentsRes, proxyRes] = await Promise.all([
        databases.listDocuments(databaseId, collections.parentUsers, [Query.limit(5000)]),
        databases.listDocuments(databaseId, collections.proxyChildren, [Query.limit(5000)]),
      ]);

      // Group proxy child names by parentUserId
      const childNamesByParent: Record<string, string[]> = {};
      for (const doc of proxyRes.documents as any[]) {
        const pid = doc.parentUserId;
        if (!pid) continue;
        const name = `${doc.firstName || ''} ${doc.lastName || ''}`.trim();
        if (!name) continue;
        if (!childNamesByParent[pid]) childNamesByParent[pid] = [];
        childNamesByParent[pid].push(name);
      }

      setParents(parentsRes.documents.map((d: any) => {
        const childNames = childNamesByParent[d.$id] || [];
        return { ...d, dependantCount: childNames.length, childNames };
      }));
    } catch (err: any) {
      setError('Failed to load parents: ' + (err.message || 'Unknown error'));
    } finally { setLoading(false); }
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

      <div className="mb-6">
        <input type="text" placeholder="Search parents..." value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-md px-4 py-2 bg-[#1d1c21] border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-white/20" />
      </div>

      {loading && <div className="flex items-center justify-center h-48"><div className="w-6 h-6 border border-white/10 border-t-white/40 rounded-full animate-spin" /></div>}
      {error && <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm mb-4">{error}</div>}

      {!loading && !error && (
        <div className="bg-[#1d1c21] rounded-lg border border-white/[0.08] overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.07]">
                <th className="text-left px-4 py-3 text-white/40 text-xs font-medium uppercase tracking-wider">Name</th>
                <th className="text-left px-4 py-3 text-white/40 text-xs font-medium uppercase tracking-wider">Email</th>
                <th className="text-left px-4 py-3 text-white/40 text-xs font-medium uppercase tracking-wider">Children</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {filtered.length === 0 ? (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-white/20 text-sm">No parents found</td></tr>
              ) : (
                filtered.map(parent => (
                  <tr key={parent.$id}
                    onClick={() => navigate(`/admin/parents/${parent.$id}`)}
                    className="hover:bg-white/[0.03] cursor-pointer transition-colors">
                    <td className="px-4 py-3 text-white text-sm">{getDisplayName(parent)}</td>
                    <td className="px-4 py-3 text-white/50 text-sm">{parent.email || '—'}</td>
                    <td className="px-4 py-3 text-sm">
                      {parent.childNames.length === 0 ? (
                        <span className="text-white/25">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {parent.childNames.map((name, i) => (
                            <span key={i} className="inline-block bg-white/[0.06] border border-white/[0.08] rounded-full px-2.5 py-0.5 text-white/70 text-[12px]">
                              {name}
                            </span>
                          ))}
                        </div>
                      )}
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

export default ParentsSection;
