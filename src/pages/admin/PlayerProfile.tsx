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
  billingApproved?: boolean;
  scholarshipTier?: string;
  loyaltyTier?: string;
  [key: string]: any;
}

interface FamilyMember { $id: string; name: string; }

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// System / personal fields — never shown in Player Profile
const SKIP_FIELDS = new Set([
  '$id','$createdAt','$updatedAt','$permissions','$collectionId','$databaseId',
  'userId','firstName','lastName','type',
  'email','phone',
  'address','streetAddress','city','state','zip','zipCode',
  'gender','dateOfBirth','birthDate','dob','birthdate',
  'stripeCustomerId','stripeId','stripe_id','stripeID',
  'billingApproved','scholarshipTier','loyaltyTier',
  'parentId','parentUserId',
]);

// ── SVG Graph with Y-axis ────────────────────────────────────────────────────
const LineGraph = ({ series, months }: {
  series: { label: string; color: string; counts: number[] }[];
  months: string[];
}) => {
  const W = 500; const H = 100; const padL = 30; const padR = 8; const padT = 8; const padB = 22;
  const innerW = W - padL - padR; const innerH = H - padT - padB;
  const n = months.length || 6;
  const allCounts = series.flatMap(s => s.counts);
  const max = Math.max(...allCounts, 1);

  const getX = (i: number) => padL + (i / (n - 1 || 1)) * innerW;
  const getY = (v: number) => padT + (1 - v / max) * innerH;

  const yTicks = Array.from(new Set([0, Math.round(max / 2), max]));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
      {yTicks.map(tick => (
        <g key={tick}>
          <line x1={padL} y1={getY(tick)} x2={W - padR} y2={getY(tick)}
            stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
          <text x={padL - 4} y={getY(tick) + 3} textAnchor="end"
            fill="rgba(255,255,255,0.3)" fontSize={8} fontFamily="system-ui">
            {tick}
          </text>
        </g>
      ))}
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

// ── Card ─────────────────────────────────────────────────────────────────────
const Card = ({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) => (
  <div className={`bg-[#1d1c21] border border-white/[0.08] rounded-xl p-5 ${className}`}>
    <p className="text-white/50 text-[11px] font-medium tracking-widest uppercase mb-4">{title}</p>
    {children}
  </div>
);

// Only renders if value is non-empty
const InfoRow = ({ label, value }: { label: string; value?: string | null }) => {
  if (!value || value.trim() === '') return null;
  return (
    <div>
      <p className="text-white/40 text-[10px] uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-white text-sm">{value}</p>
    </div>
  );
};

// Editable tier field — shows current value, save button appears on change
const TierInput = ({
  label, value, fieldName, onSave, disabled,
}: { label: string; value: string; fieldName: string; onSave: (field: string, v: string) => void; disabled: boolean; }) => {
  const [val, setVal] = useState(value);
  const dirty = val !== value;

  useEffect(() => { setVal(value); }, [value]);

  return (
    <div>
      <p className="text-white/40 text-[10px] uppercase tracking-wider mb-1.5">{label}</p>
      <div className="flex gap-2">
        <input
          type="text"
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && dirty) onSave(fieldName, val); }}
          placeholder="—"
          className="flex-1 min-w-0 bg-white/[0.04] border border-white/10 rounded px-2.5 py-1.5 text-white text-xs placeholder-white/20 focus:outline-none focus:border-white/25 transition-colors"
        />
        {dirty && (
          <button
            onClick={() => onSave(fieldName, val)}
            disabled={disabled}
            className="px-2.5 py-1.5 bg-blue-600/20 border border-blue-500/30 text-blue-300 rounded text-[11px] hover:bg-blue-600/30 transition-colors disabled:opacity-50 flex-shrink-0"
          >
            Save
          </button>
        )}
      </div>
    </div>
  );
};

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
  const [months, setMonths] = useState<string[]>([]);
  const [billingApproved, setBillingApproved] = useState(false);
  const [scholarshipTier, setScholarshipTier] = useState('');
  const [loyaltyTier, setLoyaltyTier] = useState('');
  const [saving, setSaving] = useState(false);
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
        setBillingApproved(p.billingApproved ?? false);
        setScholarshipTier(p.scholarshipTier || '');
        setLoyaltyTier(p.loyaltyTier || '');

        const now = new Date();
        const mo: string[] = [];
        for (let i = 5; i >= 0; i--) {
          mo.push(MONTHS_SHORT[new Date(now.getFullYear(), now.getMonth() - i, 1).getMonth()]);
        }
        setMonths(mo);

        const uid = p.userId || p.$id;

        const [signupsRes, checkinsRes, billsRes, relRes] = await Promise.all([
          collections.signups
            ? databases.listDocuments(databaseId, collections.signups, [Query.equal('userId', uid), Query.limit(5000)]).catch(() => ({ documents: [] }))
            : { documents: [] },
          collections.checkins
            ? databases.listDocuments(databaseId, collections.checkins, [Query.equal('userId', uid), Query.limit(5000)]).catch(() => ({ documents: [] }))
            : { documents: [] },
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

        const checkedEventIds = new Set(allCheckins.map((c: any) => c.eventId || c.eventID || c.eventid));
        setSignups(allSignups.filter((s: any) => {
          const eid = s.eventId || s.eventID || s.eventid;
          return !checkedEventIds.has(eid);
        }));

        const counts = Array(6).fill(0);
        allCheckins.forEach((c: any) => {
          const d = new Date(c.$createdAt || c.checkinTime);
          for (let i = 0; i < 6; i++) {
            const target = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
            if (d.getFullYear() === target.getFullYear() && d.getMonth() === target.getMonth()) counts[i]++;
          }
        });
        setMonthCounts(counts);

        const rels = (relRes as any).documents as any[];
        const playerRels = rels.filter((r: any) => r.childId === id || r.childId === uid || r.youthPlayerId === id);
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

  const updateField = async (field: string, value: any) => {
    if (!id || !type || !player) return;
    setSaving(true);
    const collMap: Record<string, string | undefined> = {
      youth: collections.youthPlayers,
      collegiate: collections.collegiatePlayers,
      professional: collections.professionalPlayers,
    };
    const collId = collMap[type.toLowerCase()];
    if (!collId) { setSaving(false); return; }
    try {
      await databases.updateDocument(databaseId, collId, id, { [field]: value });
      setPlayer(prev => prev ? { ...prev, [field]: value } : null);
      if (field === 'billingApproved') setBillingApproved(value as boolean);
      if (field === 'scholarshipTier') setScholarshipTier(value as string);
      if (field === 'loyaltyTier') setLoyaltyTier(value as string);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border border-white/10 border-t-white/40 rounded-full animate-spin" />
    </div>
  );
  if (!player) return <div className="p-6 text-white/40 text-sm">Player not found.</div>;

  const fullName = `${player.firstName} ${player.lastName}`;
  const unpaidBills = bills.filter(b => b.status !== 'paid' && b.status !== 'cancelled');
  const overdueCount = unpaidBills.filter(b => b.dueDate && Date.parse(b.dueDate) < Date.now()).length;
  const upcomingSignups = signups.filter(s => s.status !== 'cancelled' && (s.status === 'confirmed' || s.status === 'pending' || !s.status));
  const fmtDate = (str?: string) => str ? new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;

  // Resolve personal fields — try multiple attribute name variants
  const birthDateRaw = player.dateOfBirth || player.birthDate || player.dob || player.birthdate || null;
  const address = [
    player.address || player.streetAddress,
    player.city, player.state,
    player.zip || player.zipCode,
  ].filter(Boolean).join(', ') || null;
  const stripeId = player.stripeCustomerId || player.stripeId || player.stripe_id || player.stripeID || null;

  // Player Profile: all non-null, non-skip, non-boolean fields from the Appwrite doc
  const profileFields = Object.entries(player).filter(([k, v]) => {
    if (SKIP_FIELDS.has(k)) return false;
    if (v === null || v === undefined || v === '') return false;
    if (typeof v === 'boolean') return false;
    if (typeof v === 'object') return false;
    return true;
  });

  const labelFor = (k: string) => k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();

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
        {saving && <span className="text-white/30 text-xs">saving…</span>}
      </div>

      {/* Row 1: Graph + Billing Status */}
      <div className="grid grid-cols-3 gap-4">
        <Card title="Sessions Over Time" className="col-span-2">
          <LineGraph
            series={[{ label: fullName, color: 'white', counts: monthCounts }]}
            months={months}
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

      {/* Row 2: Sessions */}
      <Card title="Sessions">
        <div className="grid grid-cols-2 gap-6">
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
                      <p className="text-white/40 text-[10px] mt-0.5">{fmtDate(s.signupDate || s.$createdAt) || '—'}</p>
                    </div>
                    {s.status && (
                      <span className="text-[10px] text-white/40 border border-white/10 rounded px-1.5 py-0.5 flex-shrink-0">{s.status}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

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
                      <p className="text-white/40 text-[10px] mt-0.5">{fmtDate(c.checkinTime || c.$createdAt) || '—'}</p>
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

      {/* Row 3: Player Profile | Personal Info | [Admin Controls + Family] */}
      <div className="grid grid-cols-3 gap-4 items-start">

        {/* Player Profile: all non-null sport fields from Appwrite doc */}
        <Card title="Player Profile">
          {profileFields.length === 0 ? (
            <p className="text-white/20 text-sm">No profile data</p>
          ) : (
            <div className="space-y-3">
              {profileFields.map(([k, v]) => (
                <div key={k}>
                  <p className="text-white/40 text-[10px] uppercase tracking-wider mb-0.5">{labelFor(k)}</p>
                  <p className="text-white text-sm">{String(v)}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Personal Info */}
        <Card title="Personal Info">
          <div className="space-y-3">
            <InfoRow label="Email" value={player.email} />
            <InfoRow label="Phone" value={player.phone} />
            <InfoRow label="Address" value={address} />
            <InfoRow label="Gender" value={player.gender} />
            <InfoRow label="Date of Birth" value={birthDateRaw ? fmtDate(birthDateRaw) : null} />
            <InfoRow label="Member Since" value={fmtDate(player.$createdAt)} />
            <InfoRow label="Account ID" value={player.userId || player.$id} />
            <InfoRow label="Stripe ID" value={stripeId} />
          </div>
        </Card>

        {/* Right column: Admin Controls + Family stacked */}
        <div className="flex flex-col gap-4">

          {/* Admin Controls */}
          <div className="bg-[#1d1c21] border border-white/[0.08] rounded-xl p-5">
            <p className="text-white/50 text-[11px] font-medium tracking-widest uppercase mb-4">Admin Controls</p>
            <div className="space-y-4">

              <div>
                <p className="text-white/40 text-[10px] uppercase tracking-wider mb-2">Billing Approval</p>
                <button
                  onClick={() => updateField('billingApproved', !billingApproved)}
                  disabled={saving}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all disabled:opacity-50 ${
                    billingApproved
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25'
                      : 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${billingApproved ? 'bg-emerald-400' : 'bg-red-400'}`} />
                  {billingApproved ? 'Approved' : 'Unapproved'}
                </button>
              </div>

              <TierInput
                label="Scholarship Tier"
                value={scholarshipTier}
                fieldName="scholarshipTier"
                onSave={updateField}
                disabled={saving}
              />

              <TierInput
                label="Loyalty Tier"
                value={loyaltyTier}
                fieldName="loyaltyTier"
                onSave={updateField}
                disabled={saving}
              />

            </div>
          </div>

          {/* Family */}
          <div className="bg-[#1d1c21] border border-white/[0.08] rounded-xl p-5">
            <p className="text-white/50 text-[11px] font-medium tracking-widest uppercase mb-4">Family</p>
            {family.length === 0 ? (
              <p className="text-white/20 text-sm">No connections found</p>
            ) : (
              <div className="space-y-2">
                {family.map(m => (
                  <div key={m.$id}
                    onClick={() => navigate(`/admin/parents/${m.$id}`)}
                    className="flex items-center gap-3 p-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] cursor-pointer transition-colors border border-white/[0.06]">
                    <div className="w-7 h-7 rounded-full bg-white/[0.08] flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs font-medium">{m.name[0]?.toUpperCase()}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-white text-xs truncate">{m.name}</p>
                      <p className="text-white/40 text-[10px]">Parent · tap to view</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default PlayerProfile;
