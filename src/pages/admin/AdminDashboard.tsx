import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { databases, databaseId, collections } from '../../services/appwrite';
import { Query } from 'appwrite';
import { googleCalendarService } from '../../services/googleCalendar';
import PlayersSection from './sections/PlayersSection';
import CoachesSection from './sections/CoachesSection';
import ParentsSection from './sections/ParentsSection';
import BillsSection from './sections/BillsSection';
import PaymentsSection from './sections/PaymentsSection';
import MessagesSection from './sections/MessagesSection';

const ALLOWED_EMAILS = [
  'amartyaglasses@gmail.com',
  'seba@taso-group.com',
  'info@nextstarsoccer.com',
];

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const REQUEST_TYPES = [
  'Individual',
  'Two Person',
  'Small Group',
  'Large Group',
  'Game Analysis',
  'Player Report',
];

type Section = 'players' | 'coaches' | 'parents' | 'bills' | 'payments' | 'messages';

interface CalEvent {
  id: string; title: string; startDateTime: string;
  endDateTime: string; location?: string | null; dateOnly?: boolean;
}

// ─── SVG Bar Chart ──────────────────────────────────────────────────────────
const BarChart = ({ data }: { data: { label: string; value: number; highlight?: boolean }[] }) => {
  const max = Math.max(...data.map(d => d.value), 1);
  const chartH = 80;
  const barW = 34;
  const gap = 10;
  const svgW = data.length * (barW + gap) - gap;

  return (
    <svg viewBox={`0 0 ${svgW} ${chartH + 28}`} className="w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="barGradH" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
        <linearGradient id="barGradN" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#374151" />
          <stop offset="100%" stopColor="#1e2535" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map(pct => (
        <line
          key={pct}
          x1={0} y1={chartH - pct * chartH}
          x2={svgW} y2={chartH - pct * chartH}
          stroke="#1f2937" strokeWidth={1}
        />
      ))}
      {data.map((d, i) => {
        const barH = Math.max((d.value / max) * chartH, 3);
        const x = i * (barW + gap);
        const y = chartH - barH;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={barH} rx={5}
              fill={d.highlight ? 'url(#barGradH)' : 'url(#barGradN)'} />
            <text x={x + barW / 2} y={chartH + 18}
              textAnchor="middle" fill="#4b5563" fontSize={10} fontFamily="system-ui">
              {d.label}
            </text>
            {d.value > 0 && (
              <text x={x + barW / 2} y={y - 5}
                textAnchor="middle" fill={d.highlight ? '#93c5fd' : '#6b7280'} fontSize={8} fontFamily="system-ui">
                ${d.value >= 1000 ? `${(d.value / 1000).toFixed(0)}k` : d.value}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
};

// ─── SVG Donut Chart ────────────────────────────────────────────────────────
const DonutChart = ({
  segments, centerLabel, centerSub,
}: {
  segments: { label: string; value: number; color: string }[];
  centerLabel: string;
  centerSub: string;
}) => {
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  const r = 38;
  const cx = 55, cy = 55;
  const circ = 2 * Math.PI * r;

  let cumulative = 0;
  return (
    <svg width="110" height="110" viewBox="0 0 110 110">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1c1c1c" strokeWidth={14} />
      {segments.filter(s => s.value > 0).map((seg, i) => {
        const pct = seg.value / total;
        const dash = pct * circ;
        const gap = circ - dash;
        const rot = (cumulative / total) * 360 - 90;
        cumulative += seg.value;
        return (
          <circle
            key={i} cx={cx} cy={cy} r={r}
            fill="none" stroke={seg.color} strokeWidth={14}
            strokeDasharray={`${dash} ${gap}`}
            transform={`rotate(${rot} ${cx} ${cy})`}
            strokeLinecap="butt"
          />
        );
      })}
      <text x={cx} y={cy - 5} textAnchor="middle" fill="white"
        fontSize={15} fontWeight="700" fontFamily="system-ui">{centerLabel}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill="#6b7280"
        fontSize={8} fontFamily="system-ui">{centerSub}</text>
    </svg>
  );
};

// ─── Sidebar nav items ────────────────────────────────────────────────────────
const navItems: { section: Section | null; label: string; icon: React.ReactNode }[] = [
  {
    section: null, label: 'Dashboard',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <rect x="3" y="3" width="7" height="7" rx="1.5" strokeWidth={1.5} />
        <rect x="14" y="3" width="7" height="7" rx="1.5" strokeWidth={1.5} />
        <rect x="3" y="14" width="7" height="7" rx="1.5" strokeWidth={1.5} />
        <rect x="14" y="14" width="7" height="7" rx="1.5" strokeWidth={1.5} />
      </svg>
    ),
  },
  {
    section: 'players', label: 'Players',
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  },
  {
    section: 'coaches', label: 'Coaches',
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>,
  },
  {
    section: 'parents', label: 'Parents',
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  },
  {
    section: 'messages', label: 'Messages',
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
  },
  {
    section: 'payments', label: 'Payments',
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>,
  },
  {
    section: 'bills', label: 'Bills',
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  },
];

// ─── Event Card Component ─────────────────────────────────────────────────────
const EventCard = ({
  title, events, loading,
}: {
  title: string;
  events: (CalEvent & { signups: number; coaches: number })[];
  loading: boolean;
}) => (
  <div className="bg-[#0e0e0e] rounded-xl border border-[#1c1c1c] overflow-hidden flex-1">
    <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1a1a]">
      <p className="text-white text-sm font-medium">{title}</p>
      <span className="text-xs text-gray-600 bg-[#1a1a1a] px-2 py-0.5 rounded-full">
        {loading ? '...' : `${events.length} scheduled`}
      </span>
    </div>
    <div className="px-5 py-3">
      {loading ? (
        <div className="h-20 flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      ) : events.length === 0 ? (
        <div className="h-20 flex items-center justify-center">
          <p className="text-gray-700 text-sm">No events today</p>
        </div>
      ) : (
        <div className="divide-y divide-[#1a1a1a]">
          {events.map(ev => {
            const past = new Date() > new Date(ev.endDateTime);
            const fmtTime = ev.dateOnly
              ? 'All Day'
              : new Date(ev.startDateTime).toLocaleTimeString('en-US', {
                  hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York',
                });
            return (
              <div key={ev.id} className={`flex items-center justify-between py-3 ${past ? 'opacity-35' : ''}`}>
                <div className="min-w-0 flex-1 mr-4">
                  <p className="text-white text-sm truncate leading-snug">{ev.title}</p>
                  <p className="text-gray-600 text-xs mt-0.5">{fmtTime}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-[11px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded font-medium">
                    {ev.signups}p
                  </span>
                  <span className="text-[11px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-medium">
                    {ev.coaches}c
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  </div>
);

// ─── Main Dashboard ───────────────────────────────────────────────────────────
const SECTION_FROM_PATH: Record<string, Section> = {
  '/admin/players': 'players',
  '/admin/coaches': 'coaches',
  '/admin/parents': 'parents',
  '/admin/messages': 'messages',
  '/admin/payments': 'payments',
  '/admin/bills': 'bills',
};

const AdminDashboard = () => {
  const { user, logout, initialized } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const activeSection: Section | null = SECTION_FROM_PATH[location.pathname] || null;
  const setActiveSection = (s: Section | null) => navigate(s ? `/admin/${s}` : '/admin/dashboard');

  // Display name fetched from user's collection
  const [displayName, setDisplayName] = useState('');

  // Stats
  const [stats, setStats] = useState({
    unreadMessages: 0, outstandingBills: 0,
    loading: true,
  });
  const [revenueData, setRevenueData] = useState<{ label: string; value: number; highlight: boolean }[]>([]);
  const [billsStatus, setBillsStatus] = useState({ paid: 0, pending: 0, overdue: 0 });
  const [todayPublicEvents, setTodayPublicEvents] = useState<(CalEvent & { signups: number; coaches: number })[]>([]);
  const [todayPrivateEvents, setTodayPrivateEvents] = useState<(CalEvent & { signups: number; coaches: number })[]>([]);
  const [recentMessages, setRecentMessages] = useState<any[]>([]);
  const [requestCounts, setRequestCounts] = useState<Record<string, number>>({});
  const [dataLoading, setDataLoading] = useState(true);

  // Auth guard
  useEffect(() => {
    if (!initialized) return;
    if (!user) { navigate('/admin'); return; }
    if (!ALLOWED_EMAILS.includes(user.email.toLowerCase().trim())) {
      logout().then(() => navigate('/admin'));
    }
  }, [user, initialized]);

  // Fetch user's real name from their collection
  useEffect(() => {
    if (!user) return;
    (async () => {
      const lookupCollections = [
        collections.coaches,
        collections.parentUsers,
        collections.youthPlayers,
        collections.collegiatePlayers,
        collections.professionalPlayers,
      ].filter(Boolean) as string[];

      for (const colId of lookupCollections) {
        try {
          const res = await databases.listDocuments(databaseId, colId, [
            Query.equal('userId', user.$id), Query.limit(1),
          ]);
          if (res.documents.length > 0) {
            const doc = res.documents[0] as any;
            const fn = doc.firstName || '';
            const ln = doc.lastName || '';
            const full = `${fn} ${ln}`.trim();
            if (full) { setDisplayName(full); return; }
          }
        } catch { /* try next */ }
      }
      // Fallback
      setDisplayName(user.name || user.email.split('@')[0] || 'Admin');
    })();
  }, [user]);

  // Fetch all dashboard data
  useEffect(() => {
    (async () => {
      try {
        const now = new Date();
        const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

        // ── Unread messages + outstanding bills
        const [unread, outstanding] = await Promise.all([
          collections.messages
            ? databases.listDocuments(databaseId, collections.messages, [Query.equal('read', false), Query.limit(1)]).catch(() => ({ total: 0 }))
            : { total: 0 },
          collections.bills
            ? databases.listDocuments(databaseId, collections.bills, [Query.equal('status', 'pending'), Query.limit(1)]).catch(() => ({ total: 0 }))
            : { total: 0 },
        ]);

        setStats({
          unreadMessages: (unread as any).total,
          outstandingBills: (outstanding as any).total,
          loading: false,
        });

        // ── Revenue — last 6 months
        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString();
        const allPayments = collections.payments
          ? await databases.listDocuments(databaseId, collections.payments, [
              Query.greaterThanEqual('$createdAt', sixMonthsAgo),
              Query.limit(5000),
            ]).catch(() => ({ documents: [] }))
          : { documents: [] };

        const monthly: Record<string, number> = {};
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          monthly[key] = 0;
        }
        (allPayments as any).documents.forEach((p: any) => {
          const d = new Date(p.$createdAt);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          if (key in monthly) monthly[key] += (p.price || 0);
        });
        const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        setRevenueData(Object.entries(monthly).map(([k, v]) => ({
          label: MONTHS[parseInt(k.split('-')[1]) - 1],
          value: v,
          highlight: k === currentKey,
        })));

        // ── Bills status — fetch ALL bills, derive overdue from dueDate
        if (collections.bills) {
          const allBills = await databases.listDocuments(databaseId, collections.bills, [
            Query.limit(5000),
          ]).catch(() => ({ documents: [] }));
          const docs = (allBills as any).documents as any[];
          const today = Date.now();
          let paid = 0, pending = 0, overdue = 0;
          docs.forEach((b: any) => {
            if (b.status === 'paid' || b.status === 'cancelled') {
              if (b.status === 'paid') paid++;
              return;
            }
            // Parse dueDate — if it has passed, count as overdue
            const dueMs = b.dueDate ? Date.parse(b.dueDate) : NaN;
            if (!isNaN(dueMs) && dueMs < today) {
              overdue++;
            } else {
              pending++;
            }
          });
          setBillsStatus({ paid, pending, overdue });
        }

        // ── Today's calendar events — separate public and private
        const [pubAll, privAll] = await Promise.all([
          googleCalendarService.getEventsForMonth(now.getFullYear(), now.getMonth(), 'public').catch(() => []),
          googleCalendarService.getEventsForMonth(now.getFullYear(), now.getMonth(), 'private').catch(() => []),
        ]);
        const toDate = (dt: string) => new Date(dt).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
        const todayPublic = (pubAll as CalEvent[]).filter(e => toDate(e.startDateTime) === todayStr);
        const todayPrivate = (privAll as CalEvent[]).filter(e => toDate(e.startDateTime) === todayStr);

        const enrichEvents = async (evts: CalEvent[]) =>
          Promise.all(evts.map(async ev => {
            const [s, c] = await Promise.all([
              collections.signups ? databases.listDocuments(databaseId, collections.signups, [Query.equal('eventID', ev.id), Query.limit(1)]).catch(() => ({ total: 0 })) : { total: 0 },
              collections.coachSignups ? databases.listDocuments(databaseId, collections.coachSignups, [Query.equal('eventID', ev.id), Query.limit(1)]).catch(() => ({ total: 0 })) : { total: 0 },
            ]);
            return { ...ev, signups: (s as any).total, coaches: (c as any).total };
          }));

        const [enrichedPublic, enrichedPrivate] = await Promise.all([
          enrichEvents(todayPublic),
          enrichEvents(todayPrivate),
        ]);
        setTodayPublicEvents(enrichedPublic);
        setTodayPrivateEvents(enrichedPrivate);

        // ── Recent messages (from Website Inquiries, exclude trashed)
        if (collections.websiteInquiries) {
          const msgs = await databases.listDocuments(databaseId, collections.websiteInquiries, [
            Query.orderDesc('$createdAt'), Query.limit(50),
          ]).catch(() => ({ documents: [] }));
          const nonTrashed = (msgs as any).documents.filter((m: any) => !m.trashed);
          setRecentMessages(nonTrashed.slice(0, 8));
        }

        // ── Request type counts (try from websiteInquiries by subject/type)
        const counts: Record<string, number> = {};
        for (const rt of REQUEST_TYPES) {
          counts[rt] = 0;
        }
        if (collections.websiteInquiries) {
          try {
            const allInquiries = await databases.listDocuments(databaseId, collections.websiteInquiries, [
              Query.limit(5000),
            ]).catch(() => ({ documents: [] }));
            const docs = (allInquiries as any).documents as any[];
            docs.forEach((doc: any) => {
              const type = (doc.type || doc.subject || doc.serviceType || doc.requestType || '').toLowerCase();
              for (const rt of REQUEST_TYPES) {
                if (type.includes(rt.toLowerCase())) {
                  counts[rt]++;
                }
              }
            });
          } catch { /* ignore */ }
        }
        setRequestCounts(counts);

      } catch (e) {
        console.error(e);
      } finally {
        setDataLoading(false);
      }
    })();
  }, []);

  const handleLogout = async () => { await logout(); navigate('/admin'); };

  if (!initialized) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
    </div>
  );

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/New_York' });
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const sectionComponents: Record<Section, React.ReactNode> = {
    players: <PlayersSection />,
    coaches: <CoachesSection />,
    parents: <ParentsSection />,
    bills: <BillsSection />,
    payments: <PaymentsSection />,
    messages: <MessagesSection />,
  };

  const totalRevenue = revenueData.reduce((s, d) => s + d.value, 0);

  return (
    <div className="flex h-screen bg-[#050505] text-white overflow-hidden">

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside className="w-52 bg-[#080808] border-r border-[#161616] flex flex-col flex-shrink-0">
        {/* Brand — user name + centered ball logo */}
        <div className="px-5 pt-6 pb-5 border-b border-[#161616]">
          <button
            onClick={() => setActiveSection(null)}
            className="w-full flex items-center justify-between hover:opacity-80 transition-opacity"
          >
            <p className="text-white font-semibold text-sm truncate">{displayName || user?.email?.split('@')[0] || 'Admin'}</p>
            <img
              src="/assets/images/NextStarBall.png"
              alt="Next Star"
              className="w-7 h-7 flex-shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2.5 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ section, label, icon }) => {
            const active = activeSection === section;
            return (
              <button
                key={label}
                onClick={() => setActiveSection(section)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all text-left ${
                  active
                    ? 'bg-white/[0.07] text-white border-l-2 border-blue-500 pl-[10px]'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]'
                }`}
              >
                {icon}
                <span>{label}</span>
                {label === 'Messages' && stats.unreadMessages > 0 && !active && (
                  <span className="ml-auto text-[10px] bg-blue-500 text-white rounded-full px-1.5 py-0.5 font-medium">
                    {stats.unreadMessages}
                  </span>
                )}
                {label === 'Bills' && stats.outstandingBills > 0 && !active && (
                  <span className="ml-auto text-[10px] bg-amber-500 text-black rounded-full px-1.5 py-0.5 font-medium">
                    {stats.outstandingBills}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="px-2.5 py-3 border-t border-[#161616]">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-600 hover:text-red-400 hover:bg-red-500/[0.06] transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>
      </aside>

      {/* ── Main ──────────────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto bg-[#060606]">

        {activeSection ? (
          /* ── Section view ── */
          <div>
            <div className="sticky top-0 z-10 bg-[#060606]/90 backdrop-blur border-b border-[#161616] px-6 h-12 flex items-center gap-3">
              <button onClick={() => setActiveSection(null)} className="text-gray-600 hover:text-white transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-gray-700 text-xs">/</span>
              <span className="text-white text-sm font-medium">
                {navItems.find(n => n.section === activeSection)?.label}
              </span>
            </div>
            {sectionComponents[activeSection]}
          </div>

        ) : (
          /* ── Dashboard Hub ── */
          <div className="px-7 py-7 max-w-[1400px] mx-auto space-y-5">

            {/* Header */}
            <div>
              <h1 className="text-white text-2xl font-semibold tracking-tight">{greeting}</h1>
              <p className="text-gray-600 text-sm mt-0.5">{dateStr}</p>
            </div>

            {/* ── Request Type Tabs ── */}
            <div className="flex flex-wrap gap-2">
              {REQUEST_TYPES.map(rt => (
                <div
                  key={rt}
                  className="bg-[#0e0e0e] border border-[#1c1c1c] rounded-lg px-4 py-2.5 flex items-center gap-3 min-w-0"
                >
                  <span className="text-gray-400 text-xs font-medium whitespace-nowrap">{rt}</span>
                  <span className="text-white text-sm font-semibold tabular-nums">
                    {dataLoading ? '—' : (requestCounts[rt] || 0)}
                  </span>
                </div>
              ))}
            </div>

            {/* ── Main Content: Left area + Messages on right ── */}
            <div className="flex gap-4">

              {/* Left content area */}
              <div className="flex-1 min-w-0 space-y-4">

                {/* Charts Row */}
                <div className="grid grid-cols-3 gap-4">
                  {/* Revenue bar chart */}
                  <div className="col-span-2 bg-[#0e0e0e] rounded-xl p-5 border border-[#1c1c1c]">
                    <div className="flex items-start justify-between mb-5">
                      <div>
                        <p className="text-white text-sm font-medium">Revenue</p>
                        <p className="text-gray-600 text-xs mt-0.5">Last 6 months</p>
                      </div>
                      <div className="text-right">
                        {!dataLoading && (
                          <>
                            <p className="text-white text-lg font-semibold">
                              ${totalRevenue >= 1000 ? `${(totalRevenue / 1000).toFixed(1)}k` : totalRevenue.toLocaleString()}
                            </p>
                            <p className="text-gray-600 text-xs">total collected</p>
                          </>
                        )}
                      </div>
                    </div>
                    {dataLoading ? (
                      <div className="h-28 flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      </div>
                    ) : (
                      <BarChart data={revenueData} />
                    )}
                  </div>

                  {/* Bills donut */}
                  <div className="bg-[#0e0e0e] rounded-xl p-5 border border-[#1c1c1c]">
                    <p className="text-white text-sm font-medium mb-4">Bills Status</p>
                    {dataLoading ? (
                      <div className="h-28 flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-4">
                        <DonutChart
                          segments={[
                            { label: 'Paid', value: billsStatus.paid, color: '#10b981' },
                            { label: 'Pending', value: billsStatus.pending, color: '#f59e0b' },
                            { label: 'Overdue', value: billsStatus.overdue, color: '#ef4444' },
                          ]}
                          centerLabel={String(billsStatus.paid + billsStatus.pending + billsStatus.overdue)}
                          centerSub="total"
                        />
                        <div className="w-full space-y-2">
                          {[
                            { label: 'Paid', value: billsStatus.paid, dot: 'bg-emerald-500' },
                            { label: 'Pending', value: billsStatus.pending, dot: 'bg-amber-500' },
                            { label: 'Overdue', value: billsStatus.overdue, dot: 'bg-red-500' },
                          ].map(s => (
                            <div key={s.label} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${s.dot}`} />
                                <span className="text-gray-500 text-xs">{s.label}</span>
                              </div>
                              <span className="text-white text-xs font-medium tabular-nums">{s.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Events Row — Public + Private side by side */}
                <div className="flex gap-4">
                  <EventCard title="Public Events" events={todayPublicEvents} loading={dataLoading} />
                  <EventCard title="Private Events" events={todayPrivateEvents} loading={dataLoading} />
                </div>
              </div>

              {/* Right: Tall Messages Card */}
              <div className="w-72 flex-shrink-0 bg-[#0e0e0e] rounded-xl border border-[#1c1c1c] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1a1a]">
                  <p className="text-white text-sm font-medium">Recent Messages</p>
                  <button
                    onClick={() => setActiveSection('messages')}
                    className="text-blue-500 text-xs hover:text-blue-400 transition-colors"
                  >
                    View all
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto px-5 py-3">
                  {dataLoading ? (
                    <div className="h-20 flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    </div>
                  ) : recentMessages.length === 0 ? (
                    <div className="h-20 flex items-center justify-center">
                      <p className="text-gray-700 text-sm">No messages</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-[#1a1a1a]">
                      {recentMessages.map(msg => {
                        const diff = Date.now() - new Date(msg.$createdAt).getTime();
                        const d = Math.floor(diff / 86400000);
                        const h = Math.floor(diff / 3600000);
                        const m = Math.floor(diff / 60000);
                        const ago = d > 0 ? `${d}d` : h > 0 ? `${h}h` : m > 0 ? `${m}m` : 'now';
                        const name = `${msg.firstName || ''} ${msg.lastName || ''}`.trim() || 'Unknown';
                        const preview = msg.message || '';
                        const unread = msg.read === false;
                        const senderEmail = msg.email || '';

                        const replyUrl = senderEmail
                          ? `mailto:${senderEmail}?subject=${encodeURIComponent('Re: ' + (msg.subject || 'Your Inquiry'))}&body=${encodeURIComponent('\n\n\n────────────────────\nOriginal message from ' + name + ' (' + senderEmail + '):\nSubject: ' + (msg.subject || '—') + '\n\n' + (msg.message || ''))}`
                          : '';

                        return (
                          <div key={msg.$id} className="flex items-start gap-3 py-3">
                            <div className="w-7 h-7 rounded-full bg-[#1e1e1e] flex items-center justify-center flex-shrink-0 mt-0.5 border border-[#2a2a2a]">
                              <span className="text-gray-400 text-xs font-medium">
                                {(name[0] || '?').toUpperCase()}
                              </span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className={`text-xs font-medium truncate ${unread ? 'text-white' : 'text-gray-500'}`}>
                                  {name}
                                </span>
                                <span className="text-gray-700 text-xs flex-shrink-0">{ago}</span>
                              </div>
                              <p className="text-gray-600 text-xs mt-0.5 truncate">{preview || '—'}</p>
                              {replyUrl && (
                                <a
                                  href={replyUrl}
                                  className="inline-flex items-center gap-1 mt-1.5 text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10l9 6 9-6M21 10v8a2 2 0 01-2 2H5a2 2 0 01-2-2v-8" />
                                  </svg>
                                  Reply
                                </a>
                              )}
                            </div>
                            {unread && (
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0 mt-2" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;
