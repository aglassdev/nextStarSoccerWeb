import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Query } from 'appwrite';
import { databases, databaseId, collections } from '../../services/appwrite';

interface ParentRecord {
  $id: string; $createdAt: string;
  firstName?: string; lastName?: string; name?: string;
  email?: string; phone?: string; userId?: string;
  [key: string]: any;
}

interface ChildMember { $id: string; name: string; type: string; }
interface SessionPoint { month: string; count: number; }

// ── Line Graph ────────────────────────────────────────────────────────────────
const LineGraph = ({ data }: { data: SessionPoint[] }) => {
  if (data.length === 0) return <div className="h-28 flex items-center justify-center text-white/20 text-xs">No data</div>;
  const max = Math.max(...data.map(d => d.count), 1);
  const W = 400; const H = 80; const padL = 8; const padR = 8; const padT = 10; const padB = 22;
  const innerW = W - padL - padR; const innerH = H - padT - padB;
  const pts = data.map((d, i) => ({
    x: padL + (i / (data.length - 1 || 1)) * innerW,
    y: padT + (1 - d.count / max) * innerH,
  }));
  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaD = `${pathD} L ${pts[pts.length - 1].x} ${H - padB} L ${pts[0].x} ${H - padB} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="pg_grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0.15" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#pg_grad)" />
      <path d={pathD} fill="none" stroke="white" strokeWidth={1.5} strokeOpacity={0.6} strokeLinejoin="round" />
      {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="white" fillOpacity={0.8} />)}
      {data.map((d, i) => (
        <text key={i} x={pts[i].x} y={H - 4} textAnchor="middle"
          fill="rgba(255,255,255,0.35)" fontSize={8} fontFamily="system-ui">{d.month}</text>
      ))}
    </svg>
  );
};

// ── Family Tree ───────────────────────────────────────────────────────────────
const FamilyTree = ({ children, parentName }: { children: ChildMember[]; parentName: string }) => (
  <div className="flex flex-col items-center gap-4 py-4">
    {/* Parent (center) */}
    <div className="flex flex-col items-center gap-1">
      <div className="w-14 h-14 rounded-full bg-white/[0.1] border border-white/30 flex items-center justify-center">
        <span className="text-white text-base font-semibold">{parentName[0]?.toUpperCase()}</span>
      </div>
      <p className="text-white text-[12px] font-medium">{parentName}</p>
      <p className="text-white/40 text-[10px]">Parent</p>
    </div>

    {children.length > 0 && <div className="w-px h-5 bg-white/20" />}

    {/* Children row */}
    {children.length > 0 && (
      <div className="flex flex-wrap justify-center gap-6">
        {children.map(c => (
          <div key={c.$id} className="flex flex-col items-center gap-1">
            <div className="w-12 h-12 rounded-full bg-white/[0.06] border border-white/[0.15] flex items-center justify-center">
              <span className="text-white text-sm font-medium">{c.name[0]?.toUpperCase()}</span>
            </div>
            <p className="text-white text-[11px] text-center max-w-[80px] truncate">{c.name}</p>
            <p className="text-white/40 text-[10px]">{c.type}</p>
          </div>
        ))}
      </div>
    )}

    {children.length === 0 && (
      <p className="text-white/20 text-xs py-4">No children connected</p>
    )}
  </div>
);

const InfoRow = ({ label, value }: { label: string; value?: string }) => (
  <div>
    <p className="text-white/40 text-[11px] uppercase tracking-wider mb-1">{label}</p>
    <p className="text-white text-sm">{value || '—'}</p>
  </div>
);

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="bg-[#1d1c21] border border-white/[0.08] rounded-xl p-5">
    <p className="text-white text-[11px] font-medium tracking-widest uppercase mb-4 opacity-60">{title}</p>
    {children}
  </div>
);

const ParentProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [parent, setParent] = useState<ParentRecord | null>(null);
  const [children, setChildren] = useState<ChildMember[]>([]);
  const [signups, setSignups] = useState<any[]>([]);
  const [checkins, setCheckins] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [sessionPoints, setSessionPoints] = useState<SessionPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        if (!collections.parentUsers) return;
        const doc = await databases.getDocument(databaseId, collections.parentUsers, id);
        const parentData = doc as any as ParentRecord;
        setParent(parentData);

        const userId = parentData.userId || parentData.$id;

        const [signupsRes, checkinsRes, billsRes, relRes] = await Promise.all([
          collections.signups
            ? databases.listDocuments(databaseId, collections.signups, [Query.equal('userId', userId), Query.limit(5000)]).catch(() => ({ documents: [] }))
            : { documents: [] },
          collections.checkins
            ? databases.listDocuments(databaseId, collections.checkins, [Query.equal('userId', userId), Query.limit(5000)]).catch(() => ({ documents: [] }))
            : { documents: [] },
          collections.bills
            ? databases.listDocuments(databaseId, collections.bills, [Query.equal('userId', userId), Query.limit(5000)]).catch(() => ({ documents: [] }))
            : { documents: [] },
          collections.familyRelationships
            ? databases.listDocuments(databaseId, collections.familyRelationships, [
                Query.equal('parentUserId', id), Query.limit(5000),
              ]).catch(() => ({ documents: [] }))
            : { documents: [] },
        ]);

        setSignups((signupsRes as any).documents);
        setCheckins((checkinsRes as any).documents);
        setBills((billsRes as any).documents);

        // Session timeline from checkins
        const monthCounts: Record<string, number> = {};
        (checkinsRes as any).documents.forEach((c: any) => {
          const d = new Date(c.$createdAt);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          monthCounts[key] = (monthCounts[key] || 0) + 1;
        });
        const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const now = new Date();
        const points: SessionPoint[] = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          points.push({ month: MONTHS[d.getMonth()], count: monthCounts[key] || 0 });
        }
        setSessionPoints(points);

        // Resolve children from relationships
        const rels = (relRes as any).documents as any[];
        const collectionPairs: [string, string][] = [
          ['youth', collections.youthPlayers],
          ['collegiate', collections.collegiatePlayers],
          ['professional', collections.professionalPlayers],
        ].filter(([, c]) => !!c) as [string, string][];

        const childMembers: ChildMember[] = [];
        await Promise.all(rels.map(async (rel: any) => {
          const playerId = rel.youthPlayerId || rel.playerId;
          if (!playerId) return;
          for (const [typeName, collId] of collectionPairs) {
            try {
              const p = await databases.getDocument(databaseId, collId, playerId);
              const name = `${(p as any).firstName || ''} ${(p as any).lastName || ''}`.trim() || playerId;
              childMembers.push({ $id: playerId, name, type: typeName.charAt(0).toUpperCase() + typeName.slice(1) });
              return;
            } catch { /* try next collection */ }
          }
        }));
        setChildren(childMembers);

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

  const displayName = parent.firstName || parent.lastName
    ? `${parent.firstName || ''} ${parent.lastName || ''}`.trim()
    : parent.name || parent.email || 'Unknown';

  const unpaidBills = bills.filter(b => b.status !== 'paid' && b.status !== 'cancelled');
  const overdueCount = unpaidBills.filter(b => b.dueDate && Date.parse(b.dueDate) < Date.now()).length;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">

      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => navigate(-1)} className="text-white/30 hover:text-white transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-white text-xl font-semibold">{displayName}</h2>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40 border border-white/15 rounded px-2 py-0.5">
          Parent
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Left */}
        <div className="lg:col-span-2 space-y-4">

          <Card title="Parent Information">
            <div className="grid grid-cols-2 gap-4">
              <InfoRow label="Email" value={parent.email} />
              <InfoRow label="Phone" value={parent.phone} />
              <InfoRow label="Children" value={String(children.length)} />
              <InfoRow label="Member Since" value={new Date(parent.$createdAt).toLocaleDateString()} />
            </div>
          </Card>

          <Card title="Sessions">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-white text-2xl font-semibold tabular-nums">{signups.length}</p>
                <p className="text-white/40 text-xs mt-1">Signed up</p>
              </div>
              <div>
                <p className="text-white text-2xl font-semibold tabular-nums">{checkins.length}</p>
                <p className="text-white/40 text-xs mt-1">Attended (checked in)</p>
              </div>
            </div>
            {signups.length > 0 && (
              <div className="mt-3 pt-3 border-t border-white/[0.06]">
                <p className="text-white/40 text-[11px] uppercase tracking-wider mb-2">Recent sign-ups</p>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {signups.slice(0, 10).map((s: any) => (
                    <div key={s.$id} className="flex items-center justify-between text-xs">
                      <span className="text-white truncate">{s.eventTitle || s.eventID || '—'}</span>
                      <span className="text-white/40 flex-shrink-0 ml-3">{new Date(s.$createdAt).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <Card title="Sessions Over Time">
            <LineGraph data={sessionPoints} />
            <p className="text-white/25 text-[11px] mt-2 text-center">Check-ins per month (last 6 months)</p>
          </Card>

        </div>

        {/* Right */}
        <div className="space-y-4">

          <Card title="Billing Status">
            {bills.length === 0 ? (
              <p className="text-white/20 text-sm">No bills found</p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-white/60 text-sm">Total bills</span>
                  <span className="text-white text-sm font-medium">{bills.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/60 text-sm">Outstanding</span>
                  <span className={`text-sm font-medium ${unpaidBills.length > 0 ? 'text-white' : 'text-white/40'}`}>{unpaidBills.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/60 text-sm">Overdue</span>
                  <span className={`text-sm font-semibold ${overdueCount > 0 ? 'text-red-400' : 'text-white/40'}`}>{overdueCount}</span>
                </div>
                {unpaidBills.length > 0 && (
                  <div className="pt-2 mt-2 border-t border-white/[0.06] space-y-1.5">
                    {unpaidBills.slice(0, 5).map((b: any) => (
                      <div key={b.$id} className="flex items-center justify-between text-[11px]">
                        <span className="text-white truncate">{b.description || b.title || 'Bill'}</span>
                        <span className="text-white/50 flex-shrink-0 ml-2">${(b.amount || b.total || 0).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>

          <Card title="Family">
            <FamilyTree children={children} parentName={displayName} />
          </Card>

        </div>
      </div>
    </div>
  );
};

export default ParentProfile;
