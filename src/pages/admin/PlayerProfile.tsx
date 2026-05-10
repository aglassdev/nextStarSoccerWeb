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
  tier?: string;
  billing?: string;
  scholarship?: string;
  [key: string]: any;
}

interface FamilyMember { $id: string; name: string; }

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Mobile-app field values (services/billingService.ts + admin screens)
const TIER_OPTIONS = ['Basic', 'Plus', 'Loyalty'] as const;
const BILLING_OPTIONS = ['unapproved', 'approved'] as const;
const SCHOLARSHIP_OPTIONS = ['none', 'tier1', 'tier2'] as const;
const SCHOLARSHIP_DISPLAY: Record<string, string> = { none: 'None', tier1: 'Tier 1', tier2: 'Tier 2' };

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

// ── Profile sub-section (groups inside Player Profile card) ─────────────────
const SubSection = ({ title, fields }: { title: string; fields: { label: string; value: any }[] }) => {
  const visible = fields.filter(f => {
    if (f.value === null || f.value === undefined) return false;
    if (Array.isArray(f.value)) return f.value.length > 0;
    if (typeof f.value === 'string') return f.value.trim() !== '';
    return true;
  });
  if (visible.length === 0) return null;
  const fmt = (v: any) => Array.isArray(v) ? v.join(', ') : String(v);
  return (
    <div>
      <p className="text-white/30 text-[10px] uppercase tracking-widest font-mono mb-2">{title}</p>
      <div className="space-y-2.5">
        {visible.map(f => (
          <div key={f.label}>
            <p className="text-white/40 text-[10px] uppercase tracking-wider mb-0.5">{f.label}</p>
            <p className="text-white text-sm">{fmt(f.value)}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// Only renders if value is non-empty
const InfoRow = ({ label, value }: { label: string; value?: string | null }) => {
  if (!value || value.trim() === '') return null;
  return (
    <div>
      <p className="text-white/40 text-[10px] uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-white text-sm break-words">{value}</p>
    </div>
  );
};

// ── Option-row picker (white-only active state, no colors) ──────────────────
const OptionRow = <T extends string>({
  label, options, value, displayMap, onChange, disabled,
}: {
  label: string;
  options: readonly T[];
  value: T;
  displayMap?: Record<string, string>;
  onChange: (v: T) => void;
  disabled: boolean;
}) => (
  <div>
    <p className="text-white/40 text-[10px] uppercase tracking-wider mb-2">{label}</p>
    <div className="flex gap-1.5">
      {options.map(opt => {
        const selected = value === opt;
        return (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            disabled={disabled || selected}
            className={`flex-1 px-2.5 py-1.5 rounded text-[11px] font-medium border transition-all capitalize ${
              selected
                ? 'bg-white/10 border-white/40 text-white'
                : 'bg-white/[0.04] border-white/10 text-white/45 hover:text-white hover:border-white/25'
            }`}
            style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
          >
            {displayMap?.[opt] ?? opt}
          </button>
        );
      })}
    </div>
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
  const [months, setMonths] = useState<string[]>([]);
  const [tier, setTier] = useState<string>('Basic');
  const [billing, setBilling] = useState<string>('unapproved');
  const [scholarship, setScholarship] = useState<string>('none');
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
        setTier(p.tier || 'Basic');
        setBilling(p.billing || 'unapproved');
        setScholarship(p.scholarship || 'none');

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
      if (field === 'tier') setTier(value);
      if (field === 'billing') setBilling(value);
      if (field === 'scholarship') setScholarship(value);
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
  // Only signups for events whose start time is in the future (not all signups)
  const nowMs = Date.now();
  const upcomingSignups = signups
    .filter(s => s.status !== 'cancelled')
    .filter(s => {
      const raw = s.eventDate || s.eventStartDate || s.signupDate;
      if (!raw) return false;
      const t = Date.parse(raw);
      return !isNaN(t) && t >= nowMs;
    })
    .sort((a, b) => Date.parse(a.eventDate || a.signupDate || '') - Date.parse(b.eventDate || b.signupDate || ''));
  const fmtDate = (str?: string) => str ? new Date(str).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;

  // Personal info attribute resolution
  const birthDateRaw = player.birthDate || player.dateOfBirth || player.dob || player.birthdate || null;
  const address = [
    player.address || player.streetAddress,
    player.city, player.state,
    player.zip || player.zipCode,
  ].filter(Boolean).join(', ') || null;
  const stripeId = player.stripeCustomerId || player.stripeId || player.stripe_id || player.stripeID || null;

  // ── Player profile sub-sections — match mobile Profile screen groupings ──
  const hasNationalTeam = !!player.nation || !!player.level;
  const profileType = player.type;

  const youthSections = [
    { title: 'Position', fields: [{ label: 'Position(s)', value: player.positions || player.position }] },
    { title: 'Club', fields: [
      { label: 'Current Club', value: player.currentClub || player.club || player.clubTeam },
      { label: 'Age Group', value: player.ageGroup },
      { label: 'League', value: player.league },
    ] },
    { title: 'School', fields: [
      { label: 'School', value: player.school },
      { label: 'Graduation Year', value: player.gradYear || player.graduationYear },
    ] },
    { title: 'Professional Club', fields: [
      { label: 'Club', value: player.club !== player.currentClub ? player.club : null },
    ] },
    ...(hasNationalTeam ? [{ title: 'National Team', fields: [
      { label: 'Nation', value: player.nation },
      { label: 'Level', value: player.level },
    ] }] : []),
  ];

  const collegiateSections = [
    { title: 'Position', fields: [{ label: 'Position(s)', value: player.positions || player.position }] },
    { title: 'School', fields: [
      { label: 'College', value: player.college },
      { label: 'Year', value: player.year || player.graduationYear || player.gradYear },
    ] },
    { title: 'Clubs', fields: [
      { label: 'Youth Club', value: player.youthClub },
      { label: 'Professional Club', value: player.professionalClub || player.club },
    ] },
    ...(hasNationalTeam ? [{ title: 'National Team', fields: [
      { label: 'Nation', value: player.nation },
      { label: 'Level', value: player.level },
    ] }] : []),
  ];

  const professionalSections = [
    { title: 'Player', fields: [
      { label: 'Current Club', value: player.currentClub || player.club || player.clubTeam },
      { label: 'Position(s)', value: player.positions || player.position },
      { label: 'Youth Club', value: player.youthClub },
    ] },
    ...(hasNationalTeam ? [{ title: 'National Team', fields: [
      { label: 'Nation', value: player.nation },
      { label: 'Level', value: player.level },
    ] }] : []),
    { title: 'College', fields: [
      { label: 'College', value: player.college },
      { label: 'Graduation Year', value: player.graduationYear || player.gradYear },
    ] },
  ];

  const sections =
    profileType === 'Youth' ? youthSections :
    profileType === 'Collegiate' ? collegiateSections :
    profileType === 'Professional' ? professionalSections :
    [];

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

        {/* Player Profile — mobile-app sub-sections */}
        <Card title="Player Profile">
          {sections.length === 0 ? (
            <p className="text-white/20 text-sm">No profile data</p>
          ) : (
            <div className="space-y-5">
              {sections.map(s => (
                <SubSection key={s.title} title={s.title} fields={s.fields} />
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
            <InfoRow label="Appwrite ID" value={player.$id} />
            <InfoRow label="Stripe ID" value={stripeId} />
          </div>
        </Card>

        {/* Right column: Admin Controls + Family stacked */}
        <div className="flex flex-col gap-4">

          {/* Admin Controls */}
          <div className="bg-[#1d1c21] border border-white/[0.08] rounded-xl p-5">
            <p className="text-white/50 text-[11px] font-medium tracking-widest uppercase mb-4">Admin Controls</p>
            <div className="space-y-4">
              <OptionRow
                label="Billing"
                options={BILLING_OPTIONS}
                value={billing as any}
                onChange={v => updateField('billing', v)}
                disabled={saving}
              />
              <OptionRow
                label="Tier"
                options={TIER_OPTIONS}
                value={tier as any}
                onChange={v => updateField('tier', v)}
                disabled={saving}
              />
              <OptionRow
                label="Scholarship"
                options={SCHOLARSHIP_OPTIONS}
                value={scholarship as any}
                displayMap={SCHOLARSHIP_DISPLAY}
                onChange={v => updateField('scholarship', v)}
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
                    <p className="text-white text-xs truncate">{m.name}</p>
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
