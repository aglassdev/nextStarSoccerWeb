import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Query } from 'appwrite';
import { databases, databaseId, collections } from '../../services/appwrite';

const TYPE_PATH: Record<string, string> = { Youth: 'youth', Collegiate: 'collegiate', Professional: 'professional' };
const BILLING_OPTIONS = ['unapproved', 'approved'] as const;

interface ParentRecord {
  $id: string; $createdAt: string;
  firstName?: string; lastName?: string; name?: string;
  email?: string; phone?: string; userId?: string;
  billing?: string;
  [key: string]: any;
}

interface ChildData {
  $id: string;
  name: string;
  type: string;
}

// ── Card / InfoRow ────────────────────────────────────────────────────────────
const Card = ({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) => (
  <div className={`bg-[#1d1c21] border border-white/[0.08] rounded-xl p-5 ${className}`}>
    <p className="text-white/50 text-[11px] font-medium tracking-widest uppercase mb-4">{title}</p>
    {children}
  </div>
);

const InfoRow = ({ label, value }: { label: string; value?: string | null }) => {
  if (!value || value.trim() === '') return null;
  return (
    <div>
      <p className="text-white/40 text-[10px] uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-white text-sm break-words">{value}</p>
    </div>
  );
};

// ── Main ──────────────────────────────────────────────────────────────────────
const ParentProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [parent, setParent]       = useState<ParentRecord | null>(null);
  const [childrenData, setChildrenData] = useState<ChildData[]>([]);
  const [bills, setBills]         = useState<any[]>([]);
  const [billing, setBilling]     = useState<string>('unapproved');
  const [saving, setSaving]       = useState(false);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        if (!collections.parentUsers) return;
        const doc = await databases.getDocument(databaseId, collections.parentUsers, id);
        const parentData = doc as any as ParentRecord;
        setParent(parentData);
        setBilling(parentData.billing || 'unapproved');

        // Bills
        if (collections.bills) {
          try {
            const res = await databases.listDocuments(databaseId, collections.bills, [
              Query.equal('parentId', id), Query.limit(5000),
            ]);
            setBills(res.documents as any[]);
          } catch {
            try {
              const res = await databases.listDocuments(databaseId, collections.bills, [
                Query.equal('userId', parentData.userId || id), Query.limit(5000),
              ]);
              setBills(res.documents as any[]);
            } catch { /* none */ }
          }
        }

        // Family
        if (!collections.familyRelationships) { setLoading(false); return; }
        const relRes = await databases.listDocuments(databaseId, collections.familyRelationships, [
          Query.limit(5000),
        ]).catch(() => ({ documents: [] }));

        const rels = (relRes.documents as any[]).filter((r: any) =>
          r.parentId === id || r.parentUserId === id
        );

        const collectionPairs: [string, string][] = ([
          ['Youth',        collections.youthPlayers],
          ['Collegiate',   collections.collegiatePlayers],
          ['Professional', collections.professionalPlayers],
        ] as [string, string | undefined][])
          .filter((pair): pair is [string, string] => !!pair[1]);

        const resolved: ChildData[] = [];
        await Promise.all(rels.map(async (rel: any) => {
          const playerId = rel.childId || rel.youthPlayerId || rel.playerId;
          if (!playerId) return;
          let playerDoc: any = null;
          let playerType = 'Youth';
          for (const [typeName, collId] of collectionPairs) {
            try {
              playerDoc = await databases.getDocument(databaseId, collId, playerId);
              playerType = typeName;
              break;
            } catch { /* try next */ }
          }
          if (!playerDoc) return;
          const childName = `${playerDoc.firstName || ''} ${playerDoc.lastName || ''}`.trim() || playerId;
          resolved.push({ $id: playerId, name: childName, type: playerType });
        }));
        setChildrenData(resolved);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const updateField = async (field: string, value: any) => {
    if (!id || !parent || !collections.parentUsers) return;
    setSaving(true);
    try {
      await databases.updateDocument(databaseId, collections.parentUsers, id, { [field]: value });
      setParent(prev => prev ? { ...prev, [field]: value } : null);
      if (field === 'billing') setBilling(value as string);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border border-white/10 border-t-white/40 rounded-full animate-spin" />
    </div>
  );
  if (!parent) return <div className="p-6 text-white/40 text-sm">Parent not found.</div>;

  const displayName = (parent.firstName || parent.lastName)
    ? `${parent.firstName || ''} ${parent.lastName || ''}`.trim()
    : parent.name || parent.email || 'Unknown';

  const fmtDate = (str?: string) =>
    str ? new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;

  const unpaidBills   = bills.filter(b => b.status !== 'paid' && b.status !== 'cancelled');
  const overdueCount  = unpaidBills.filter(b => b.dueDate && Date.parse(b.dueDate) < Date.now()).length;

  // Personal-info attribute resolution — try multiple variants (matches PlayerProfile)
  const address = [
    parent.address || parent.streetAddress,
    parent.city, parent.state,
    parent.zip || parent.zipCode,
  ].filter(Boolean).join(', ') || null;
  const stripeId = parent.stripeCustomerId || parent.stripeId || parent.stripe_id || parent.stripeID || null;

  return (
    <div className="p-6 space-y-4 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-white/30 hover:text-white transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-white text-xl font-semibold">{displayName}</h2>
        <span className="text-[11px] text-white/40 border border-white/15 rounded px-2 py-0.5 uppercase tracking-wider font-semibold">
          Parent
        </span>
        {saving && <span className="text-white/30 text-xs">saving…</span>}
      </div>

      {/* Single row: Personal Info | Family | Billing Status */}
      <div className="grid grid-cols-3 gap-4 items-start">

        {/* Personal Info */}
        <Card title="Personal Info">
          <div className="space-y-3">
            <InfoRow label="Email" value={parent.email} />
            <InfoRow label="Phone" value={parent.phone} />
            <InfoRow label="Address" value={address} />
            <InfoRow label="Gender" value={parent.gender} />
            <InfoRow label="Member Since" value={fmtDate(parent.$createdAt)} />
            <InfoRow label="Appwrite ID" value={parent.$id} />
            <InfoRow label="Stripe ID" value={stripeId} />
          </div>
        </Card>

        {/* Family */}
        <Card title="Family">
          {childrenData.length === 0 ? (
            <p className="text-white/20 text-sm">No children connected</p>
          ) : (
            <div className="space-y-2">
              {childrenData.map(child => (
                <div key={child.$id}
                  onClick={() => navigate(`/admin/players/${TYPE_PATH[child.type] || 'youth'}/${child.$id}`)}
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] cursor-pointer transition-colors border border-white/[0.06]">
                  <div className="w-8 h-8 rounded-full bg-white/[0.08] flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs font-medium">{child.name[0]?.toUpperCase()}</span>
                  </div>
                  <p className="text-white text-sm truncate">{child.name}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Billing Status */}
        <Card title="Billing Status">
          <div className="space-y-4">
            {bills.length > 0 && (
              <div className="space-y-2">
                {[
                  { label: 'Total',       val: String(bills.length),       warn: false },
                  { label: 'Outstanding', val: String(unpaidBills.length), warn: false },
                  { label: 'Overdue',     val: String(overdueCount),       warn: overdueCount > 0 },
                ].map(row => (
                  <div key={row.label} className="flex justify-between items-center">
                    <span className="text-white/50 text-sm">{row.label}</span>
                    <span className={`text-sm font-medium ${row.warn ? 'text-red-400' : 'text-white'}`}>{row.val}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Billing approval toggle */}
            <div>
              <p className="text-white/40 text-[10px] uppercase tracking-wider mb-2">Billing</p>
              <div className="flex gap-1.5">
                {BILLING_OPTIONS.map(opt => {
                  const selected = billing === opt;
                  return (
                    <button
                      key={opt}
                      onClick={() => updateField('billing', opt)}
                      disabled={saving || selected}
                      className={`flex-1 px-2.5 py-1.5 rounded text-[11px] font-medium border transition-all capitalize ${
                        selected
                          ? 'bg-white/10 border-white/40 text-white'
                          : 'bg-white/[0.04] border-white/10 text-white/45 hover:text-white hover:border-white/25'
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ParentProfile;
