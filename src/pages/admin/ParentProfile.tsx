import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Query } from 'appwrite';
import { databases, databaseId, collections } from '../../services/appwrite';

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const CHILD_COLORS = ['#60a5fa','#34d399','#f472b6','#fb923c','#a78bfa','#facc15'];
const TYPE_PATH: Record<string, string> = { Youth: 'youth', Collegiate: 'collegiate', Professional: 'professional' };

interface ParentRecord {
  $id: string; $createdAt: string;
  firstName?: string; lastName?: string; name?: string;
  email?: string; phone?: string; userId?: string;
  [key: string]: any;
}

interface ChildData {
  $id: string;
  name: string;
  type: string;
  color: string;
  signups: any[];
  checkins: any[];
  signupCount: number;
  checkinCount: number;
}

// ── Multi-line SVG Graph ──────────────────────────────────────────────────────
const LineGraph = ({ series, months }: {
  series: { label: string; color: string; counts: number[] }[];
  months: string[];
}) => {
  const W = 500; const H = 90; const padL = 8; const padR = 8; const padT = 10; const padB = 22;
  const innerW = W - padL - padR; const innerH = H - padT - padB;
  const n = months.length || 6;
  const allCounts = series.flatMap(s => s.counts);
  const max = Math.max(...allCounts, 1);

  const getX = (i: number) => padL + (i / (n - 1 || 1)) * innerW;
  const getY = (v: number) => padT + (1 - v / max) * innerH;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
      {series.map((s, si) => {
        const pts = s.counts.map((v, i) => ({ x: getX(i), y: getY(v) }));
        const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
        return (
          <g key={si}>
            <path d={pathD} fill="none" stroke={s.color} strokeWidth={1.5} strokeOpacity={0.7} strokeLinejoin="round" />
            {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={s.color} fillOpacity={0.9} />)}
          </g>
        );
      })}
      {months.map((m, i) => (
        <text key={i} x={getX(i)} y={H - 4} textAnchor="middle"
          fill="rgba(255,255,255,0.3)" fontSize={8} fontFamily="system-ui">{m}</text>
      ))}
    </svg>
  );
};

// ── Card / InfoRow ────────────────────────────────────────────────────────────
const Card = ({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) => (
  <div className={`bg-[#1d1c21] border border-white/[0.08] rounded-xl p-5 ${className}`}>
    <p className="text-white/50 text-[11px] font-medium tracking-widest uppercase mb-4">{title}</p>
    {children}
  </div>
);

const InfoRow = ({ label, value }: { label: string; value?: string | null }) => (
  <div>
    <p className="text-white/40 text-[10px] uppercase tracking-wider mb-0.5">{label}</p>
    <p className="text-white text-sm">{value || '—'}</p>
  </div>
);

// ── Main ──────────────────────────────────────────────────────────────────────
const ParentProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [parent, setParent]       = useState<ParentRecord | null>(null);
  const [childrenData, setChildrenData] = useState<ChildData[]>([]);
  const [bills, setBills]         = useState<any[]>([]);
  const [months, setMonths]       = useState<string[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        if (!collections.parentUsers) return;
        const doc = await databases.getDocument(databaseId, collections.parentUsers, id);
        const parentData = doc as any as ParentRecord;
        setParent(parentData);

        // Build last-6-months labels
        const now = new Date();
        const mo: string[] = [];
        for (let i = 5; i >= 0; i--) {
          mo.push(MONTHS_SHORT[new Date(now.getFullYear(), now.getMonth() - i, 1).getMonth()]);
        }
        setMonths(mo);

        // Bills: try parentId first, fall back to userId
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
            } catch { /* no bills */ }
          }
        }

        // Family relationships
        if (!collections.familyRelationships) { setLoading(false); return; }
        const relRes = await databases.listDocuments(databaseId, collections.familyRelationships, [
          Query.limit(5000),
        ]).catch(() => ({ documents: [] }));

        const rels = (relRes.documents as any[]).filter((r: any) =>
          r.parentId === id || r.parentUserId === id
        );

        const collectionPairs: [string, string][] = ([
          ['Youth',       collections.youthPlayers],
          ['Collegiate',  collections.collegiatePlayers],
          ['Professional',collections.professionalPlayers],
        ] as [string, string | undefined][])
          .filter((pair): pair is [string, string] => !!pair[1]);

        const resolved: ChildData[] = [];
        await Promise.all(rels.map(async (rel: any, idx: number) => {
          const playerId = rel.childId || rel.youthPlayerId || rel.playerId;
          if (!playerId) return;

          // Find player doc across collections
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
          const childUserId = playerDoc.userId || playerId;
          const color = CHILD_COLORS[idx % CHILD_COLORS.length];

          // Load signups for this child (by playerId, fallback userId)
          let childSignups: any[] = [];
          if (collections.signups) {
            try {
              const r = await databases.listDocuments(databaseId, collections.signups, [
                Query.equal('playerId', playerId), Query.limit(5000),
              ]);
              childSignups = r.documents as any[];
            } catch {
              try {
                const r = await databases.listDocuments(databaseId, collections.signups!, [
                  Query.equal('userId', childUserId), Query.limit(5000),
                ]);
                childSignups = r.documents as any[];
              } catch { /* none */ }
            }
          }

          // Load checkins for this child (by playerId, fallback userId)
          let childCheckins: any[] = [];
          if (collections.checkins) {
            try {
              const r = await databases.listDocuments(databaseId, collections.checkins, [
                Query.equal('playerId', playerId), Query.limit(5000),
              ]);
              childCheckins = r.documents as any[];
            } catch {
              try {
                const r = await databases.listDocuments(databaseId, collections.checkins!, [
                  Query.equal('userId', childUserId), Query.limit(5000),
                ]);
                childCheckins = r.documents as any[];
              } catch { /* none */ }
            }
          }

          resolved.push({
            $id: playerId,
            name: childName,
            type: playerType,
            color,
            signups: childSignups,
            checkins: childCheckins,
            signupCount: childSignups.length,
            checkinCount: childCheckins.length,
          });
        }));

        setChildrenData(resolved);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border border-white/10 border-t-white/40 rounded-full animate-spin" />
    </div>
  );
  if (!parent) return <div className="p-6 text-white/40 text-sm">Parent not found.</div>;

  const displayName = (parent.firstName || parent.lastName)
    ? `${parent.firstName || ''} ${parent.lastName || ''}`.trim()
    : parent.name || parent.email || 'Unknown';

  const now = new Date();
  const fmtDate = (str?: string) =>
    str ? new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  const unpaidBills   = bills.filter(b => b.status !== 'paid' && b.status !== 'cancelled');
  const overdueCount  = unpaidBills.filter(b => b.dueDate && Date.parse(b.dueDate) < Date.now()).length;

  // Build graph series (one line per child; single white if only one or no children)
  const graphSeries = childrenData.length > 0
    ? childrenData.map(child => {
        const counts = Array(6).fill(0);
        child.checkins.forEach((c: any) => {
          const d = new Date(c.checkinTime || c.$createdAt);
          for (let i = 0; i < 6; i++) {
            const t = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
            if (d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth()) counts[i]++;
          }
        });
        return { label: child.name, color: child.color, counts };
      })
    : [{ label: displayName, color: 'rgba(255,255,255,0.6)', counts: Array(6).fill(0) }];

  // Flatten signups & checkins with child metadata
  const allSignupsTagged = childrenData.flatMap(child =>
    child.signups.map((s: any) => ({ ...s, _childName: child.name, _childColor: child.color }))
  );
  const allCheckinsTagged = childrenData.flatMap(child =>
    child.checkins.map((c: any) => ({ ...c, _childName: child.name, _childColor: child.color }))
  );

  // Dedup: signups that also have a checkin for the same event go to the right column only
  const checkedEventIds = new Set(allCheckinsTagged.map((c: any) => c.eventId || c.eventID || c.eventid));
  const upcomingSignups = allSignupsTagged.filter((s: any) => {
    const eid = s.eventId || s.eventID || s.eventid;
    return s.status !== 'cancelled' && !checkedEventIds.has(eid);
  });

  // Try to match a bill to a child by childId/playerId field
  const getChildForBill = (b: any): ChildData | null => {
    const cid = b.childId || b.playerId || b.youthPlayerId;
    if (!cid) return null;
    return childrenData.find(c => c.$id === cid) ?? null;
  };

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
      </div>

      {/* Row 1: Graph (col-span-2) + Billing */}
      <div className="grid grid-cols-3 gap-4">
        <Card title="Sessions Over Time" className="col-span-2">
          <LineGraph series={graphSeries} months={months} />
          {childrenData.length > 1 && (
            <div className="flex flex-wrap gap-4 mt-2 justify-center">
              {childrenData.map(child => (
                <div key={child.$id} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: child.color }} />
                  <span className="text-[11px] text-white/40">{child.name}</span>
                </div>
              ))}
            </div>
          )}
          <p className="text-white/25 text-[11px] mt-1 text-center">Check-ins per month · last 6 months</p>
        </Card>

        <Card title="Billing Status">
          {bills.length === 0 ? (
            <p className="text-white/20 text-sm">No bills</p>
          ) : (
            <div className="space-y-3">
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
              {unpaidBills.length > 0 && (
                <div className="pt-3 mt-1 border-t border-white/[0.06] space-y-2">
                  {unpaidBills.slice(0, 6).map((b: any) => {
                    const child = getChildForBill(b);
                    return (
                      <div key={b.$id}>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-white truncate">{b.description || b.title || 'Bill'}</span>
                          <span className="text-white/50 ml-2 flex-shrink-0">
                            ${(b.amount || b.totalAmount || 0).toFixed(2)}
                          </span>
                        </div>
                        {child && (
                          <p className="text-[10px] mt-0.5" style={{ color: child.color + 'bb' }}>{child.name}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* Row 2: Sessions 2-col */}
      <Card title="Sessions">
        <div className="grid grid-cols-2 gap-6">

          {/* Left: upcoming / pending signups */}
          <div>
            <p className="text-white/40 text-[11px] uppercase tracking-wider mb-3">
              Signed Up · Upcoming ({upcomingSignups.length})
            </p>
            {upcomingSignups.length === 0 ? (
              <p className="text-white/20 text-xs">None</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {upcomingSignups.map((s: any) => (
                  <div key={s.$id} className="flex items-start justify-between gap-2 py-2 border-b border-white/[0.05]">
                    <div className="min-w-0">
                      <p className="text-white text-xs truncate">{s.eventTitle || s.eventId || s.eventID || '—'}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: s._childColor }} />
                        <span className="text-[10px]" style={{ color: s._childColor + 'cc' }}>{s._childName}</span>
                        <span className="text-white/25 text-[10px]">·</span>
                        <span className="text-white/40 text-[10px]">{fmtDate(s.signupDate || s.$createdAt)}</span>
                      </div>
                    </div>
                    {s.status && (
                      <span className="text-[10px] text-white/40 border border-white/10 rounded px-1.5 py-0.5 flex-shrink-0">
                        {s.status}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: checked in */}
          <div>
            <p className="text-white/40 text-[11px] uppercase tracking-wider mb-3">
              Attended · Checked In ({allCheckinsTagged.length})
            </p>
            {allCheckinsTagged.length === 0 ? (
              <p className="text-white/20 text-xs">None</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {allCheckinsTagged.slice().reverse().map((c: any) => (
                  <div key={c.$id} className="flex items-start justify-between gap-2 py-2 border-b border-white/[0.05]">
                    <div className="min-w-0">
                      <p className="text-white text-xs truncate">{c.eventTitle || c.eventId || c.eventID || '—'}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: c._childColor }} />
                        <span className="text-[10px]" style={{ color: c._childColor + 'cc' }}>{c._childName}</span>
                        <span className="text-white/25 text-[10px]">·</span>
                        <span className="text-white/40 text-[10px]">{fmtDate(c.checkinTime || c.$createdAt)}</span>
                      </div>
                    </div>
                    {c.checkoutTime && (
                      <span className="text-[10px] text-white/30 flex-shrink-0">out {fmtDate(c.checkoutTime)}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Bottom row: Parent Info + Family */}
      <div className="grid grid-cols-2 gap-4">

        <Card title="Parent Information">
          <div className="space-y-3">
            <InfoRow label="Email"        value={parent.email} />
            <InfoRow label="Phone"        value={parent.phone} />
            <InfoRow label="Children"     value={String(childrenData.length)} />
            <InfoRow label="Member Since" value={fmtDate(parent.$createdAt)} />
          </div>
        </Card>

        <Card title="Family">
          {childrenData.length === 0 ? (
            <p className="text-white/20 text-sm">No children connected</p>
          ) : (
            <div className="space-y-3">
              {childrenData.map(child => (
                <div key={child.$id}
                  onClick={() => navigate(`/admin/players/${TYPE_PATH[child.type] || 'youth'}/${child.$id}`)}
                  className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] cursor-pointer transition-colors border border-white/[0.06]">
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: child.color + '22', border: `1px solid ${child.color}44` }}>
                    <span className="text-sm font-medium" style={{ color: child.color }}>
                      {child.name[0]?.toUpperCase()}
                    </span>
                  </div>
                  {/* Name + type */}
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-sm truncate">{child.name}</p>
                    <p className="text-white/40 text-[11px]">{child.type}</p>
                  </div>
                  {/* Stats */}
                  <div className="flex gap-4 flex-shrink-0 text-right">
                    <div>
                      <p className="text-white text-xs font-medium">{child.signupCount}</p>
                      <p className="text-white/30 text-[10px]">signed up</p>
                    </div>
                    <div>
                      <p className="text-white text-xs font-medium">{child.checkinCount}</p>
                      <p className="text-white/30 text-[10px]">attended</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

      </div>
    </div>
  );
};

export default ParentProfile;
