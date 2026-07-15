import { useEffect } from 'react';

// ── Status model ────────────────────────────────────────────────────────────────
type StatusKey = 'operational' | 'partial' | 'major' | 'maintenance';

const STATUS_META: Record<StatusKey, { label: string; dot: string; text: string; glow: string }> = {
  operational:  { label: 'Operational',       dot: 'bg-green-500',  text: 'text-green-400',  glow: 'shadow-[0_0_8px_2px_rgba(34,197,94,0.6)]' },
  partial:      { label: 'Partial Outage',     dot: 'bg-orange-500', text: 'text-orange-400', glow: 'shadow-[0_0_8px_2px_rgba(249,115,22,0.6)]' },
  major:        { label: 'Major Outage',       dot: 'bg-red-500',    text: 'text-red-400',    glow: 'shadow-[0_0_8px_2px_rgba(239,68,68,0.6)]' },
  maintenance:  { label: 'Under Maintenance',  dot: 'bg-blue-500',   text: 'text-blue-400',   glow: 'shadow-[0_0_8px_2px_rgba(59,130,246,0.6)]' },
};

interface Service { name: string; status: StatusKey; }
interface Section { title: string; items: Service[]; }

const SECTIONS: Section[] = [
  {
    title: 'General',
    items: [
      { name: 'Database', status: 'operational' },
      { name: 'Auth', status: 'operational' },
      { name: 'SMTP', status: 'operational' },
      { name: 'Functions', status: 'operational' },
      { name: 'APIs', status: 'operational' },
      { name: 'Storage', status: 'operational' },
    ],
  },
  {
    title: 'App',
    items: [
      { name: 'Main', status: 'operational' },
      { name: 'Requests', status: 'operational' },
      { name: 'Messaging', status: 'operational' },
      { name: 'Account', status: 'operational' },
      { name: 'Calendar', status: 'operational' },
      { name: 'Contact', status: 'operational' },
      { name: 'Account Linking', status: 'major' },
    ],
  },
  {
    title: 'Payments',
    items: [
      { name: 'Billing', status: 'operational' },
      { name: 'Checkout', status: 'operational' },
      { name: 'Credit Cards', status: 'operational' },
      { name: 'Bank Transfer', status: 'operational' },
      { name: 'GPay', status: 'partial' },
      { name: 'Apple Pay', status: 'major' },
    ],
  },
  {
    title: 'Website',
    items: [
      { name: 'Main', status: 'operational' },
      { name: 'Contact', status: 'operational' },
      { name: 'Calendar', status: 'operational' },
      { name: 'Payment Portal', status: 'operational' },
      { name: 'Scholarship Applications', status: 'operational' },
      { name: 'Documentation', status: 'operational' },
    ],
  },
];

// ── Overall banner (worst status wins) ──────────────────────────────────────────
const overallStatus = (): { key: StatusKey; headline: string } => {
  const all = SECTIONS.flatMap((s) => s.items.map((i) => i.status));
  if (all.includes('major')) return { key: 'major', headline: 'Some systems are experiencing a major outage' };
  if (all.includes('partial')) return { key: 'partial', headline: 'Some systems are experiencing a partial outage' };
  if (all.includes('maintenance')) return { key: 'maintenance', headline: 'Some systems are under maintenance' };
  return { key: 'operational', headline: 'All systems operational' };
};

const Dot = ({ status }: { status: StatusKey }) => {
  const meta = STATUS_META[status];
  return (
    <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
      {status !== 'operational' && (
        <span className={`absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping ${meta.dot}`} />
      )}
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${meta.dot} ${meta.glow}`} />
    </span>
  );
};

const StatusPage = () => {
  useEffect(() => {
    document.title = 'Next Star Soccer — System Status';
  }, []);

  const overall = overallStatus();
  const overallMeta = STATUS_META[overall.key];
  const updated = new Date().toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
    timeZone: 'America/New_York', timeZoneName: 'short',
  });

  return (
    <div className="min-h-screen bg-black font-lt-wave text-white">
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-10 md:py-16">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <img
            src="/assets/images/NextStarBall.png"
            alt="Next Star Soccer"
            className="w-9 h-9 object-contain"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <div>
            <h1 className="text-xl md:text-2xl font-bold leading-tight">Next Star Soccer</h1>
            <p className="text-white/40 text-xs md:text-sm">System Status</p>
          </div>
        </div>

        {/* Overall banner */}
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#141414] to-[#0b0b0b] p-6 mb-8 flex items-center gap-4">
          <Dot status={overall.key} />
          <div className="flex-1 min-w-0">
            <p className={`text-lg md:text-xl font-semibold ${overallMeta.text}`}>{overall.headline}</p>
            <p className="text-white/35 text-xs mt-0.5">Last updated {updated}</p>
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-8">
          {SECTIONS.map((section) => (
            <section key={section.title}>
              <h2 className="text-white/50 text-[11px] font-semibold tracking-[0.18em] uppercase mb-3 px-1">
                {section.title}
              </h2>
              <div className="rounded-2xl border border-white/10 bg-[#0f0f0f] overflow-hidden divide-y divide-white/[0.06]">
                {section.items.map((item) => {
                  const meta = STATUS_META[item.status];
                  return (
                    <div key={item.name} className="flex items-center justify-between gap-4 px-5 py-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <Dot status={item.status} />
                        <span className="text-white text-sm md:text-[15px] truncate">{item.name}</span>
                      </div>
                      <span className={`text-xs md:text-sm font-medium flex-shrink-0 ${meta.text}`}>
                        {meta.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2">
          {(Object.keys(STATUS_META) as StatusKey[]).map((k) => (
            <div key={k} className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${STATUS_META[k].dot}`} />
              <span className="text-white/40 text-xs">{STATUS_META[k].label}</span>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-white/25 text-xs">
          © {new Date().getFullYear()} Next Star Soccer
        </p>
      </div>
    </div>
  );
};

export default StatusPage;
