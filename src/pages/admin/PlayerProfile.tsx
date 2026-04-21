import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Query } from 'appwrite';
import { databases, databaseId, collections } from '../../services/appwrite';

type PlayerType = 'Youth' | 'Collegiate' | 'Professional';

interface PlayerRecord {
  $id: string;
  $createdAt: string;
  userId?: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  position?: string;
  // Youth
  grade?: string;
  school?: string;
  parentId?: string;
  emergencyContact?: string;
  medicalInfo?: string;
  // Collegiate
  college?: string;
  major?: string;
  graduationYear?: string;
  // Professional / misc
  club?: string;
  league?: string;
  [key: string]: any;
}

interface FamilyMember { $id: string; name: string; }

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ── Multi-line SVG Graph ──────────────────────────────────────────────────────
const LineGraph = ({ series }: {
  series: { label: string; color: string; counts: number[] }[];
  months: string[];
}) => {
  const W = 500; const H = 90; const padL = 8; const padR = 8; const padT = 10; const padB = 22;
  const innerW = W - padL - padR; const innerH = H - padT - padB;
  const n = series[0]?.counts.length || 6;
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
      {Array.from({ length: n }, (_, i) => (
        <text key={i} x={getX(i)} y={H - 4} textAnchor="middle"
          fill="rgba(255,255,255,0.3)" fontSize={8} fontFamily="system-ui">
          {MONTHS_SHORT[new Date(new Date().getFullYear(), new Date().getMonth() - (n - 1 - i), 1).getMonth()]}
        </text>
      ))}
    </svg>
  );
};

// ── Card shell ────────────────────────────────────────────────────────────────
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
const PlayerProfile = () => {
  const { type, id } = useParams<{ type: string; id: string }>();
  const navigate = useNavigate();

  const [player, setPlayer] = useState<PlayerRecord | null>(null);
  const [signups, setSignups] = useState<any[]>([]);
  const [checkins, setCheckins] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [family, setFamily] = useState<FamilyMember[]>([]);
  const [monthCounts, setMonthCounts] = useState<number[]>(Array(6).fill(0));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !type) return;
    (async () => {
      try {
        const collMap: Record<string, string | undefined> = {
          youth: collections.youthPlayers,
          collegiate: collections.collegiatePlayers,
          professional: collections.professionalPlayers,
        };
        const collId = collMap[type.toLowerCase()];
        if (!collId) return;

        const doc = await databases.getDocument(databaseId, collId, id);
        const p: PlayerRecord = { ...(doc as any), type: (type.charAt(0).toUpperCase() + type.slice(1)) as PlayerType };
        setPlayer(p);

        // userId is the link to signups/checkins/bills
        const uid = p.userId || p.$id;

        const [signupsRes, checkinsRes, billsRes, relRes] = await Promise.all([
          collections.signups
            ? databases.listDocuments(databaseId, collections.signups, [Query.equal('userId', uid), Query.limit(5000)]).catch(() => ({ documents: [] }))
            : { documents: [] },
          collections.checkins
            ? databases.listDocuments(databaseId, collections.checkins, [Query.equal('userId', uid), Query.limit(5000)]).catch(() => ({ documents: [] }))
            : { documents: [] },
          // Bills are on parent for youth; try userId fallback
          collections.bills
            ? databases.listDocuments(databaseId, collections.bills, [Query.equal('userId', uid), Query.limit(5000)]).catch(() => ({ documents: [] }))
            : { documents: [] },
          collections.familyRelationships
            ? databases.listDocuments(databaseId, collections.familyRelationships, [Query.limit(5000)]).catch(() => ({ documents: [] }))
            : { documents: [] },
        ]);

        const allSignups = (signupsRes as any).documents as any[];
        const allCheckins = (checkinsRes as any).documents as any[];
        setCheckins(allCheckins);
        setBills((billsRes as any).documents);

        // Filter signups: exclude those that also have a checkin for same event
        const checkedEventIds = new Set(allCheckins.map((c: any) => c.eventId || c.eventID || c.eventid));
        setSignups(allSignups.filter((s: any) => {
          const eid = s.eventId || s.eventID || s.eventid;
          return !checkedEventIds.has(eid);
        }));

        // Monthly checkin counts (last 6 months)
        const now = new Date();
        const counts = Array(6).fill(0);
        allCheckins.forEach((c: any) => {
          const d = new Date(c.$createdAt || c.checkinTime);
          for (let i = 0; i < 6; i++) {
            const target = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
            if (d.getFullYear() === target.getFullYear() && d.getMonth() === target.getMonth()) {
              counts[i]++;
            }
          }
        });
        setMonthCounts(counts);

        // Family: find parents of this player
        const rels = (relRes as any).documents as any[];
        const playerRels = rels.filter((r: any) =>
          r.childId === id || r.childId === uid || r.youthPlayerId === id
        );
        const parents: FamilyMember[] = [];
        await Promise.all(playerRels.map(async (rel: any) => {
          const parentId = rel.parentId || rel.parentUserId;
          if (!parentId || !collections.parentUsers) return;
          try {
            const pd = await databases.getDocument(databaseId, collections.parentUsers, parentId);
            const name = `${(pd as any).firstName || ''} ${(pd as any).lastName || ''}`.trim() || (pd as any).email || 'Parent';
            parents.push({ $id: parentId, name });
          } catch { /* ignore */ }
        }));
        setFamily(parents);

      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [id, type]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border border-white/10 border-t-white/40 rounded-full animate-spin" />
    </div>
  );
  if (!player) return <div className="p-6 text-white/40 text-sm">Player not found.</div>;

  const fullName = `${player.firstName} ${player.lastName}`;
  const unpaidBills = bills.filter(b => b.status !== 'paid' && b.status !== 'cancelled');
  const overdueCount = unpaidBills.filter(b => b.dueDate && Date.parse(b.dueDate) < Date.now()).length;

  // Upcoming signups: status confirmed/pending and not yet past
  const upcomingSignups = signups.filter(s =>
    s.status !== 'cancelled' && (s.status === 'confirmed' || s.status === 'pending' || !s.status)
  );

  const fmtDate = (str?: string) => str ? new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  return (
    <div className="p-6 space-y-4 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-white/30 hover:text-white transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-white text-xl font-semibold">{fullName}</h2>
        <span className="text-[11px] text-white/40 border border-white/15 rounded px-2 py-0.5 uppercase tracking-wider font-semibold">
          {player.type}
        </span>
      </div>

      {/* Row 1: Graph + Billing */}
      <div className="grid grid-cols-3 gap-4">
        <Card title="Sessions Over Time" className="col-span-2">
          <LineGraph
            series={[{ label: fullName, color: 'white', counts: monthCounts }]}
            months={Array.from({ length: 6 }, (_, i) => MONTHS_SHORT[new Date(new Date().getFullYear(), new Date().getMonth() - (5 - i), 1).getMonth()])}
          />
          <p className="text-white/25 text-[11px] mt-1 text-center">Check-ins per month · last 6 months</p>
        </Card>

        <Card title="Billing Status">
          {bills.length === 0 ? (
            <p className="text-white/20 text-sm">No bills</p>
          ) : (
            <div className="space-y-3">
              {[
                { label: 'Total', val: String(bills.length) },
                { label: 'Outstanding', val: String(unpaidBills.length) },
                { label: 'Overdue', val: String(overdueCount), warn: overdueCount > 0 },
              ].map(row => (
                <div key={row.label} className="flex justify-between items-center">
                  <span className="text-white/50 text-sm">{row.label}</span>
                  <span className={`text-sm font-medium ${row.warn ? 'text-red-400' : 'text-white'}`}>{row.val}</span>
                </div>
              ))}
              {unpaidBills.length > 0 && (
                <div className="pt-3 mt-1 border-t border-white/[0.06] space-y-2">
                  {unpaidBills.slice(0, 5).map((b: any) => (
                    <div key={b.$id} className="flex justify-between text-[11px]">
                      <span className="text-white truncate">{b.description || b.title || 'Bill'}</span>
                      <span className="text-white/50 ml-2 flex-shrink-0">${(b.amount || b.totalAmount || 0).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* Row 2: Sessions 2-col */}
      <Card title="Sessions">
        <div className="grid grid-cols-2 gap-6">
          {/* Left: upcoming / ongoing signups */}
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
                      <p className="text-white/40 text-[10px] mt-0.5">{fmtDate(s.signupDate || s.$createdAt)}</p>
                    </div>
                    {s.status && (
                      <span className="text-[10px] text-white/40 border border-white/10 rounded px-1.5 py-0.5 flex-shrink-0">{s.status}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: checked in */}
          <div>
            <p className="text-white/40 text-[11px] uppercase tracking-wider mb-3">
              Attended · Checked In ({checkins.length})
            </p>
            {checkins.length === 0 ? (
              <p className="text-white/20 text-xs">None</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {checkins.slice().reverse().map((c: any) => (
                  <div key={c.$id} className="flex items-start justify-between gap-2 py-2 border-b border-white/[0.05]">
                    <div className="min-w-0">
                      <p className="text-white text-xs truncate">{c.eventTitle || c.eventId || c.eventID || '—'}</p>
                      <p className="text-white/40 text-[10px] mt-0.5">{fmtDate(c.checkinTime || c.$createdAt)}</p>
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

      {/* Row 3: Profile card + Personal info + Family */}
      <div className="grid grid-cols-3 gap-4">

        {/* Profile details (type-specific) */}
        <Card title="Player Profile">
          <div className="space-y-3">
            <InfoRow label="Date of Birth" value={player.dateOfBirth ? fmtDate(player.dateOfBirth) : null} />
            <InfoRow label="Position" value={player.position} />
            {player.type === 'Youth' && <>
              <InfoRow label="Grade" value={player.grade} />
              <InfoRow label="School" value={player.school} />
              <InfoRow label="Emergency Contact" value={player.emergencyContact} />
              <InfoRow label="Medical Info" value={player.medicalInfo} />
            </>}
            {player.type === 'Collegiate' && <>
              <InfoRow label="College" value={player.college} />
              <InfoRow label="Major" value={player.major} />
              <InfoRow label="Graduation Year" value={player.graduationYear} />
            </>}
            {player.type === 'Professional' && <>
              <InfoRow label="Club" value={player.club} />
              <InfoRow label="League" value={player.league} />
            </>}
          </div>
        </Card>

        {/* Personal info */}
        <Card title="Personal Info">
          <div className="space-y-3">
            <InfoRow label="Email" value={player.email} />
            <InfoRow label="Phone" value={player.phone} />
            <InfoRow label="Member Since" value={fmtDate(player.$createdAt)} />
            {/* Show any extra top-level string fields from Appwrite doc */}
            {Object.entries(player)
              .filter(([k, v]) =>
                !['$id','$createdAt','$updatedAt','$permissions','$collectionId','$databaseId',
                  'userId','firstName','lastName','dateOfBirth','position','grade','school',
                  'parentId','emergencyContact','medicalInfo','college','major','graduationYear',
                  'club','league','email','phone','type'].includes(k)
                && typeof v === 'string' && v.length > 0
              )
              .slice(0, 6)
              .map(([k, v]) => (
                <InfoRow key={k} label={k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())} value={v} />
              ))
            }
          </div>
        </Card>

        {/* Family */}
        <Card title="Family">
          {family.length === 0 ? (
            <p className="text-white/20 text-sm">No connections found</p>
          ) : (
            <div className="space-y-3">
              {family.map(m => (
                <div key={m.$id}
                  onClick={() => navigate(`/admin/parents/${m.$id}`)}
                  className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] cursor-pointer transition-colors border border-white/[0.06]">
                  <div className="w-8 h-8 rounded-full bg-white/[0.08] flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs font-medium">{m.name[0]?.toUpperCase()}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-white text-sm truncate">{m.name}</p>
                    <p className="text-white/40 text-[11px]">Parent · tap to view</p>
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

export default PlayerProfile;
