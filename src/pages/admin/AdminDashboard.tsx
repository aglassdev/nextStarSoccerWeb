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
import RequestsSection from './sections/RequestsSection';
import CalendarSection from './sections/CalendarSection';
import EventAssistantSection from './sections/EventAssistantSection';
import CoachManagementSection from './sections/CoachManagementSection';

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

type Section = 'players' | 'coaches' | 'parents' | 'bills' | 'payments' | 'messages' | 'requests' | 'calendar' | 'eventAssistant' | 'coachManagement';

type NavGroup = 'Directory' | 'Messages' | 'Payments' | 'Events';

const SECTION_TO_GROUP: Partial<Record<Section, NavGroup>> = {
  players: 'Directory', coaches: 'Directory', parents: 'Directory', coachManagement: 'Directory',
  messages: 'Messages', requests: 'Messages',
  bills: 'Payments', payments: 'Payments',
  calendar: 'Events', eventAssistant: 'Events',
};

const SECTION_LABELS: Partial<Record<Section, string>> = {
  messages: 'Chats',
  bills: 'Billing',
  coachManagement: 'Coach Management',
};

interface CalEvent {
  id: string; title: string; startDateTime: string;
  endDateTime: string; location?: string | null; dateOnly?: boolean;
}

// ─── SVG Bar Chart ──────────────────────────────────────────────────────────
const BarChart = ({ data }: { data: { label: string; value: number; highlight?: boolean }[] }) => {
  const max = Math.max(...data.map(d => d.value), 1);
  const chartH = 72;
  const barW = 28;
  const gap = 14;
  const svgW = data.length * (barW + gap) - gap;

  return (
    <svg viewBox={`0 0 ${svgW} ${chartH + 22}`} className="w-full" preserveAspectRatio="none">
      {[0.5, 1].map(pct => (
        <line key={pct} x1={0} y1={chartH - pct * chartH} x2={svgW} y2={chartH - pct * chartH}
          stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
      ))}
      {data.map((d, i) => {
        const barH = Math.max((d.value / max) * chartH, 2);
        const x = i * (barW + gap);
        const y = chartH - barH;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={barH} rx={2}
              fill="white" fillOpacity={d.highlight ? 0.75 : 0.18} />
            <text x={x + barW / 2} y={chartH + 15} textAnchor="middle"
              fill="rgba(255,255,255,0.35)" fontSize={9} fontFamily="system-ui">{d.label}</text>
            {d.value > 0 && (
              <text x={x + barW / 2} y={y - 4} textAnchor="middle"
                fill={d.highlight ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)'}
                fontSize={8} fontFamily="system-ui">
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
const DonutChart = ({ segments, centerLabel, centerSub }: {
  segments: { label: string; value: number; color: string }[];
  centerLabel: string; centerSub: string;
}) => {
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  const r = 36; const cx = 52; const cy = 52; const circ = 2 * Math.PI * r;
  let cumulative = 0;
  return (
    <svg width="104" height="104" viewBox="0 0 104 104">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={11} />
      {segments.filter(s => s.value > 0).map((seg, i) => {
        const pct = seg.value / total;
        const dash = pct * circ; const gap = circ - dash;
        const rot = (cumulative / total) * 360 - 90;
        cumulative += seg.value;
        return (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth={11}
            strokeDasharray={`${dash} ${gap}`} transform={`rotate(${rot} ${cx} ${cy})`} strokeLinecap="butt" />
        );
      })}
      <text x={cx} y={cy - 3} textAnchor="middle" fill="white" fontSize={14} fontWeight="600" fontFamily="system-ui">{centerLabel}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize={8} fontFamily="system-ui">{centerSub}</text>
    </svg>
  );
};

// ─── Chevron ─────────────────────────────────────────────────────────────────
const Chevron = ({ open }: { open: boolean }) => (
  <svg className="w-3 h-3 flex-shrink-0 transition-transform duration-200"
    style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
    fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

// ─── Event Card ───────────────────────────────────────────────────────────────
const EventCard = ({ title, events, loading }: {
  title: string;
  events: (CalEvent & { signups: number; coaches: number })[];
  loading: boolean;
}) => (
  <div className="bg-[#1d1c21] rounded-lg border border-white/[0.08] overflow-hidden flex-1">
    <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06]">
      <p className="text-white text-[11px] font-medium tracking-widest uppercase">{title}</p>
      <span className="text-white text-[11px]">{loading ? '…' : `${events.length} today`}</span>
    </div>
    <div className="px-5 py-2">
      {loading ? (
        <div className="h-16 flex items-center justify-center">
          <div className="w-3.5 h-3.5 border border-white/10 border-t-white/40 rounded-full animate-spin" />
        </div>
      ) : events.length === 0 ? (
        <div className="h-16 flex items-center justify-center">
          <p className="text-white text-xs">Nothing scheduled</p>
        </div>
      ) : (
        <div className="divide-y divide-white/[0.05]">
          {events.map(ev => {
            const past = new Date() > new Date(ev.endDateTime);
            const fmtTime = ev.dateOnly ? 'All Day'
              : new Date(ev.startDateTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York' });
            return (
              <div key={ev.id} className={`flex items-center justify-between py-3 ${past ? 'opacity-30' : ''}`}>
                <div className="min-w-0 flex-1 mr-4">
                  <p className="text-white text-xs truncate leading-snug">{ev.title}</p>
                  <p className="text-white text-[11px] mt-0.5 opacity-60">{fmtTime}</p>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  <span className="text-[11px] text-white tabular-nums">{ev.signups}p</span>
                  <span className="text-[11px] text-white opacity-50 tabular-nums">{ev.coaches}c</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  </div>
);

// ─── Route → Section mapping ──────────────────────────────────────────────────
const SECTION_FROM_PATH: Record<string, Section> = {
  '/admin/players': 'players',
  '/admin/coaches': 'coaches',
  '/admin/parents': 'parents',
  '/admin/messages': 'messages',
  '/admin/payments': 'payments',
  '/admin/bills': 'bills',
  '/admin/requests': 'requests',
  '/admin/calendar': 'calendar',
  '/admin/event-assistant': 'eventAssistant',
  '/admin/coach-management': 'coachManagement',
};

const AdminDashboard = () => {
  const { user, logout, initialized } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const activeSection: Section | null = SECTION_FROM_PATH[location.pathname] || null;

  const SECTION_TO_PATH: Record<Section, string> = {
    players: '/admin/players',
    coaches: '/admin/coaches',
    parents: '/admin/parents',
    messages: '/admin/messages',
    payments: '/admin/payments',
    bills: '/admin/bills',
    requests: '/admin/requests',
    calendar: '/admin/calendar',
    eventAssistant: '/admin/event-assistant',
    coachManagement: '/admin/coach-management',
  };
  const setActiveSection = (s: Section | null) => navigate(s ? SECTION_TO_PATH[s] : '/admin/dashboard');

  const [displayName, setDisplayName] = useState('');
  const [openGroups, setOpenGroups] = useState<Set<NavGroup>>(new Set());

  const toggleGroup = (group: NavGroup) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group); else next.add(group);
      return next;
    });
  };

  const [stats, setStats] = useState({ unreadMessages: 0, outstandingBills: 0, loading: true });
  const [revenueData, setRevenueData] = useState<{ label: string; value: number; highlight: boolean }[]>([]);
  const [billsStatus, setBillsStatus] = useState({ paid: 0, pending: 0, overdue: 0 });
  const [todayPublicEvents, setTodayPublicEvents] = useState<(CalEvent & { signups: number; coaches: number })[]>([]);
  const [todayPrivateEvents, setTodayPrivateEvents] = useState<(CalEvent & { signups: number; coaches: number })[]>([]);
  const [todayAnalysisEvents, setTodayAnalysisEvents] = useState<(CalEvent & { signups: number; coaches: number })[]>([]);
  const [recentMessages, setRecentMessages] = useState<any[]>([]);
  const [requestCounts, setRequestCounts] = useState<Record<string, number>>({});
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (activeSection) {
      const group = SECTION_TO_GROUP[activeSection];
      if (group) setOpenGroups(prev => new Set(prev).add(group));
    }
  }, [activeSection]);

  useEffect(() => {
    if (!initialized) return;
    if (!user) { navigate('/admin'); return; }
    if (!ALLOWED_EMAILS.includes(user.email.toLowerCase().trim())) {
      logout().then(() => navigate('/admin'));
    }
  }, [user, initialized]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const lookupCollections = [
        collections.coaches, collections.parentUsers, collections.youthPlayers,
        collections.collegiatePlayers, collections.professionalPlayers,
      ].filter(Boolean) as string[];
      for (const colId of lookupCollections) {
        try {
          const res = await databases.listDocuments(databaseId, colId, [Query.equal('userId', user.$id), Query.limit(1)]);
          if (res.documents.length > 0) {
            const doc = res.documents[0] as any;
            const full = `${doc.firstName || ''} ${doc.lastName || ''}`.trim();
            if (full) { setDisplayName(full); return; }
          }
        } catch { /* try next */ }
      }
      setDisplayName(user.name || user.email.split('@')[0] || 'Admin');
    })();
  }, [user]);

  useEffect(() => {
    (async () => {
      try {
        const now = new Date();
        const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

        const [unread, outstanding] = await Promise.all([
          collections.messages
            ? databases.listDocuments(databaseId, collections.messages, [Query.equal('read', false), Query.limit(1)]).catch(() => ({ total: 0 }))
            : { total: 0 },
          collections.bills
            ? databases.listDocuments(databaseId, collections.bills, [Query.equal('status', 'pending'), Query.limit(1)]).catch(() => ({ total: 0 }))
            : { total: 0 },
        ]);
        setStats({ unreadMessages: (unread as any).total, outstandingBills: (outstanding as any).total, loading: false });

        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString();
        const allPayments = collections.payments
          ? await databases.listDocuments(databaseId, collections.payments, [Query.greaterThanEqual('$createdAt', sixMonthsAgo), Query.limit(5000)]).catch(() => ({ documents: [] }))
          : { documents: [] };

        const monthly: Record<string, number> = {};
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          monthly[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`] = 0;
        }
        (allPayments as any).documents.forEach((p: any) => {
          const d = new Date(p.$createdAt);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          if (key in monthly) monthly[key] += (p.price || 0);
        });
        const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        setRevenueData(Object.entries(monthly).map(([k, v]) => ({
          label: MONTHS[parseInt(k.split('-')[1]) - 1], value: v, highlight: k === currentKey,
        })));

        if (collections.bills) {
          const allBills = await databases.listDocuments(databaseId, collections.bills, [Query.limit(5000)]).catch(() => ({ documents: [] }));
          const today = Date.now(); let paid = 0, pending = 0, overdue = 0;
          (allBills as any).documents.forEach((b: any) => {
            if (b.status === 'paid' || b.status === 'cancelled') { if (b.status === 'paid') paid++; return; }
            const dueMs = b.dueDate ? Date.parse(b.dueDate) : NaN;
            if (!isNaN(dueMs) && dueMs < today) overdue++; else pending++;
          });
          setBillsStatus({ paid, pending, overdue });
        }

        const [pubAll, privAll, analysisAll] = await Promise.all([
          googleCalendarService.getEventsForMonth(now.getFullYear(), now.getMonth(), 'public').catch(() => []),
          googleCalendarService.getEventsForMonth(now.getFullYear(), now.getMonth(), 'private').catch(() => []),
          googleCalendarService.getEventsForMonth(now.getFullYear(), now.getMonth(), 'analysis').catch(() => []),
        ]);
        const toDate = (dt: string) => new Date(dt).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

        const enrichEvents = async (evts: CalEvent[]) =>
          Promise.all(evts.map(async ev => {
            const [s, c] = await Promise.all([
              collections.signups ? databases.listDocuments(databaseId, collections.signups, [Query.equal('eventID', ev.id), Query.limit(1)]).catch(() => ({ total: 0 })) : { total: 0 },
              collections.coachSignups ? databases.listDocuments(databaseId, collections.coachSignups, [Query.equal('eventID', ev.id), Query.limit(1)]).catch(() => ({ total: 0 })) : { total: 0 },
            ]);
            return { ...ev, signups: (s as any).total, coaches: (c as any).total };
          }));

        const [enrichedPublic, enrichedPrivate, enrichedAnalysis] = await Promise.all([
          enrichEvents((pubAll as CalEvent[]).filter(e => toDate(e.startDateTime) === todayStr)),
          enrichEvents((privAll as CalEvent[]).filter(e => toDate(e.startDateTime) === todayStr)),
          enrichEvents((analysisAll as CalEvent[]).filter(e => toDate(e.startDateTime) === todayStr)),
        ]);
        setTodayPublicEvents(enrichedPublic);
        setTodayPrivateEvents(enrichedPrivate);
        setTodayAnalysisEvents(enrichedAnalysis);

        if (collections.websiteInquiries) {
          const msgs = await databases.listDocuments(databaseId, collections.websiteInquiries, [Query.orderDesc('$createdAt'), Query.limit(50)]).catch(() => ({ documents: [] }));
          setRecentMessages((msgs as any).documents.filter((m: any) => !m.trashed).slice(0, 3));
        }

        const counts: Record<string, number> = {};
        for (const rt of REQUEST_TYPES) counts[rt] = 0;
        if (collections.websiteInquiries) {
          try {
            const allInquiries = await databases.listDocuments(databaseId, collections.websiteInquiries, [Query.limit(5000)]).catch(() => ({ documents: [] }));
            (allInquiries as any).documents.forEach((doc: any) => {
              const type = (doc.type || doc.subject || doc.serviceType || doc.requestType || '').toLowerCase();
              for (const rt of REQUEST_TYPES) { if (type.includes(rt.toLowerCase())) counts[rt]++; }
            });
          } catch { /* ignore */ }
        }
        setRequestCounts(counts);

      } catch (e) { console.error(e); }
      finally { setDataLoading(false); }
    })();
  }, []);

  const handleLogout = async () => { await logout(); navigate('/admin'); };

  if (!initialized) return (
    <div className="min-h-screen bg-[#0d0b09] flex items-center justify-center">
      <div className="w-6 h-6 border border-white/10 border-t-white/40 rounded-full animate-spin" />
    </div>
  );

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/New_York' });
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = displayName.split(' ')[0] || user?.email?.split('@')[0] || 'Admin';
  const totalRevenue = revenueData.reduce((s, d) => s + d.value, 0);
  const activeSectionLabel = activeSection ? (SECTION_LABELS[activeSection] ?? activeSection.charAt(0).toUpperCase() + activeSection.slice(1)) : null;

  const sectionComponents: Record<Section, React.ReactNode> = {
    players: <PlayersSection />,
    coaches: <CoachesSection />,
    parents: <ParentsSection />,
    bills: <BillsSection />,
    payments: <PaymentsSection />,
    messages: <MessagesSection />,
    requests: <RequestsSection />,
    calendar: <CalendarSection />,
    eventAssistant: <EventAssistantSection />,
    coachManagement: <CoachManagementSection />,
  };

  return (
    <div className="flex h-screen bg-[#0d0b09] text-white overflow-hidden">

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside className="w-[210px] bg-[#0f0d0b] border-r border-white/[0.08] flex flex-col flex-shrink-0">

        {/* Brand */}
        <div className="px-5 pt-5 pb-4 border-b border-white/[0.07]">
          <button onClick={() => setActiveSection(null)}
            className="w-full flex items-center justify-between hover:opacity-75 transition-opacity">
            <div className="min-w-0">
              <p className="text-white font-medium text-[13px] truncate">
                {displayName || user?.email?.split('@')[0] || 'Admin'}
              </p>
              <p className="text-white/25 text-[11px] mt-0.5">Next Star Soccer</p>
            </div>
            <img src="/assets/images/NextStarBall.png" alt="NSS"
              className="w-6 h-6 flex-shrink-0 ml-3 opacity-40"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-px">

          {/* Dashboard */}
          <button onClick={() => setActiveSection(null)}
            className={`w-full flex items-center gap-2.5 px-3 py-[7px] rounded-md text-[13px] transition-all duration-150 text-left ${
              activeSection === null ? 'bg-white/[0.08] text-white' : 'text-white/50 hover:text-white hover:bg-white/[0.05]'
            }`}>
            <svg className="w-[15px] h-[15px] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="3" y="3" width="7" height="7" rx="1.5" strokeWidth={1.5} />
              <rect x="14" y="3" width="7" height="7" rx="1.5" strokeWidth={1.5} />
              <rect x="3" y="14" width="7" height="7" rx="1.5" strokeWidth={1.5} />
              <rect x="14" y="14" width="7" height="7" rx="1.5" strokeWidth={1.5} />
            </svg>
            <span>Dashboard</span>
          </button>

          {/* Directory */}
          <NavGroupItem label="Directory" open={openGroups.has('Directory')} onToggle={() => toggleGroup('Directory')}
            icon={<svg className="w-[15px] h-[15px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}>
            <NavChild section="players" label="Players" active={activeSection === 'players'} onSelect={setActiveSection}
              icon={<svg className="w-[13px] h-[13px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>} />
            <NavChild section="parents" label="Parents" active={activeSection === 'parents'} onSelect={setActiveSection}
              icon={<svg className="w-[13px] h-[13px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>} />
            <NavChild section="coaches" label="Coaches" active={activeSection === 'coaches'} onSelect={setActiveSection}
              icon={<svg className="w-[13px] h-[13px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>} />
          </NavGroupItem>

          {/* Coach Management — standalone */}
          <button
            onClick={() => setActiveSection('coachManagement')}
            className={`w-full flex items-center gap-2.5 px-3 py-[7px] rounded-md text-[13px] transition-all duration-150 text-left ${
              activeSection === 'coachManagement'
                ? 'bg-white/[0.08] text-white'
                : 'text-white/50 hover:text-white hover:bg-white/[0.05]'
            }`}
          >
            <svg className="w-[15px] h-[15px] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Coach Management</span>
          </button>

          {/* Messages */}
          <NavGroupItem label="Messages" open={openGroups.has('Messages')} onToggle={() => toggleGroup('Messages')}
            badge={stats.unreadMessages > 0 ? stats.unreadMessages : undefined}
            icon={<svg className="w-[15px] h-[15px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}>
            <NavChild section="messages" label="Chats" active={activeSection === 'messages'} onSelect={setActiveSection}
              icon={<svg className="w-[13px] h-[13px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>} />
            <NavChild section="requests" label="Requests" active={activeSection === 'requests'} onSelect={setActiveSection}
              icon={<svg className="w-[13px] h-[13px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>} />
          </NavGroupItem>

          {/* Payments */}
          <NavGroupItem label="Payments" open={openGroups.has('Payments')} onToggle={() => toggleGroup('Payments')}
            badge={stats.outstandingBills > 0 ? stats.outstandingBills : undefined}
            icon={<svg className="w-[15px] h-[15px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>}>
            <NavChild section="bills" label="Billing" active={activeSection === 'bills'} onSelect={setActiveSection}
              icon={<svg className="w-[13px] h-[13px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>} />
            <NavChild section="payments" label="Payments" active={activeSection === 'payments'} onSelect={setActiveSection}
              icon={<svg className="w-[13px] h-[13px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
          </NavGroupItem>

          {/* Events */}
          <NavGroupItem label="Events" open={openGroups.has('Events')} onToggle={() => toggleGroup('Events')}
            icon={<svg className="w-[15px] h-[15px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}>
            <NavChild section="calendar" label="Calendar" active={activeSection === 'calendar'} onSelect={setActiveSection}
              icon={<svg className="w-[13px] h-[13px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>} />
            <NavChild section="eventAssistant" label="Event Assistant" active={activeSection === 'eventAssistant'} onSelect={setActiveSection}
              icon={<svg className="w-[13px] h-[13px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>} />
          </NavGroupItem>

        </nav>

        {/* Sign out */}
        <div className="px-3 py-3 border-t border-white/[0.07]">
          <button onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-[7px] rounded-md text-[13px] text-white/25 hover:text-white hover:bg-white/[0.05] transition-all duration-150">
            <svg className="w-[15px] h-[15px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main ──────────────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto bg-[#0d0b09]">
        {activeSection ? (
          <div>
            <div className="sticky top-0 z-10 bg-[#0d0b09]/95 backdrop-blur border-b border-white/[0.07] px-6 h-11 flex items-center gap-3">
              <button onClick={() => setActiveSection(null)} className="text-white/30 hover:text-white transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-white/20 text-xs">—</span>
              <span className="text-white text-[13px]">{activeSectionLabel}</span>
            </div>
            {sectionComponents[activeSection]}
          </div>
        ) : (
          <div className="px-8 py-7 max-w-[1400px] mx-auto space-y-5">

            {/* Header */}
            <div className="flex items-end justify-between">
              <div>
                <h1 className="text-white text-[22px] font-semibold tracking-tight leading-none">
                  {greeting}, {firstName}
                </h1>
                <p className="text-white/40 text-sm mt-1.5">{dateStr}</p>
              </div>
              <div className="flex items-center gap-7">
                <div className="text-right">
                  <p className="text-white text-lg font-semibold tabular-nums leading-none">
                    {dataLoading ? '—' : stats.unreadMessages}
                  </p>
                  <p className="text-white/40 text-[11px] mt-1">unread</p>
                </div>
                <div className="w-px h-7 bg-white/[0.08]" />
                <div className="text-right">
                  <p className="text-white text-lg font-semibold tabular-nums leading-none">
                    {dataLoading ? '—' : stats.outstandingBills}
                  </p>
                  <p className="text-white/40 text-[11px] mt-1">outstanding</p>
                </div>
              </div>
            </div>

            {/* ── Row 1: Revenue + Bills + Messages (same height) ── */}
            <div className="grid grid-cols-4 gap-4">

              {/* Revenue — 2 cols */}
              <div className="col-span-2 bg-[#1d1c21] rounded-lg p-5 border border-white/[0.08]">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <p className="text-white text-[13px] font-medium">Revenue</p>
                    <p className="text-white text-[11px] mt-0.5 opacity-50">Past 6 months</p>
                  </div>
                  {!dataLoading && (
                    <div className="text-right">
                      <p className="text-white text-xl font-semibold tabular-nums leading-none">
                        ${totalRevenue >= 1000 ? `${(totalRevenue / 1000).toFixed(1)}k` : totalRevenue.toLocaleString()}
                      </p>
                      <p className="text-white text-[11px] mt-1 opacity-50">collected</p>
                    </div>
                  )}
                </div>
                {dataLoading ? (
                  <div className="h-24 flex items-center justify-center">
                    <div className="w-4 h-4 border border-white/10 border-t-white/40 rounded-full animate-spin" />
                  </div>
                ) : (
                  <BarChart data={revenueData} />
                )}
              </div>

              {/* Bills */}
              <div className="bg-[#1d1c21] rounded-lg p-5 border border-white/[0.08]">
                <p className="text-white text-[13px] font-medium mb-5">Bills</p>
                {dataLoading ? (
                  <div className="h-24 flex items-center justify-center">
                    <div className="w-4 h-4 border border-white/10 border-t-white/40 rounded-full animate-spin" />
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <DonutChart
                      segments={[
                        { label: 'Paid', value: billsStatus.paid, color: '#2a8f6a' },
                        { label: 'Pending', value: billsStatus.pending, color: '#8f7a2a' },
                        { label: 'Overdue', value: billsStatus.overdue, color: '#8f2a2a' },
                      ]}
                      centerLabel={String(billsStatus.paid + billsStatus.pending + billsStatus.overdue)}
                      centerSub="total"
                    />
                    <div className="w-full space-y-2.5">
                      {[
                        { label: 'Paid', value: billsStatus.paid, color: '#2a8f6a' },
                        { label: 'Pending', value: billsStatus.pending, color: '#8f7a2a' },
                        { label: 'Overdue', value: billsStatus.overdue, color: '#8f2a2a' },
                      ].map(s => (
                        <div key={s.label} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                            <span className="text-white text-xs">{s.label}</span>
                          </div>
                          <span className="text-white text-xs font-medium tabular-nums">{s.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Messages */}
              <div className="bg-[#1d1c21] rounded-lg border border-white/[0.08] overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06]">
                  <p className="text-white text-[11px] font-medium tracking-widest uppercase">Messages</p>
                  <button onClick={() => setActiveSection('messages')} className="text-white text-xs opacity-40 hover:opacity-100 transition-opacity">
                    View all
                  </button>
                </div>
                <div className="px-5 py-2">
                  {dataLoading ? (
                    <div className="h-16 flex items-center justify-center">
                      <div className="w-3.5 h-3.5 border border-white/10 border-t-white/40 rounded-full animate-spin" />
                    </div>
                  ) : recentMessages.length === 0 ? (
                    <div className="h-16 flex items-center justify-center">
                      <p className="text-white text-xs opacity-30">No messages</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-white/[0.05]">
                      {recentMessages.map(msg => {
                        const diff = Date.now() - new Date(msg.$createdAt).getTime();
                        const d = Math.floor(diff / 86400000); const h = Math.floor(diff / 3600000); const m = Math.floor(diff / 60000);
                        const ago = d > 0 ? `${d}d` : h > 0 ? `${h}h` : m > 0 ? `${m}m` : 'now';
                        const name = `${msg.firstName || ''} ${msg.lastName || ''}`.trim() || 'Unknown';
                        const unread = msg.read === false;
                        const senderEmail = msg.email || '';
                        const replyUrl = senderEmail
                          ? `mailto:${senderEmail}?subject=${encodeURIComponent('Re: ' + (msg.subject || 'Your Inquiry'))}&body=${encodeURIComponent('\n\n\n────────────────────\nOriginal message from ' + name + ' (' + senderEmail + '):\n\n' + (msg.message || ''))}`
                          : '';
                        return (
                          <div key={msg.$id} className="flex items-start gap-3 py-3">
                            <div className="w-6 h-6 rounded-full bg-white/[0.06] flex items-center justify-center flex-shrink-0 mt-0.5 border border-white/[0.08]">
                              <span className="text-white text-[10px] font-medium">{(name[0] || '?').toUpperCase()}</span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className={`text-xs font-medium truncate ${unread ? 'text-white' : 'text-white opacity-50'}`}>{name}</span>
                                <span className="text-white text-[11px] opacity-25 flex-shrink-0">{ago}</span>
                              </div>
                              <p className="text-white text-[11px] mt-0.5 truncate opacity-40">{msg.message || '—'}</p>
                              {replyUrl && (
                                <a href={replyUrl} className="inline-flex items-center gap-1 mt-1.5 text-[10px] text-white opacity-40 hover:opacity-100 transition-opacity"
                                  onClick={(e) => e.stopPropagation()}>
                                  Reply ↗
                                </a>
                              )}
                            </div>
                            {unread && <div className="w-1 h-1 rounded-full bg-white/60 flex-shrink-0 mt-2.5" />}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Row 2: 3 Event Cards full width ── */}
            <div className="grid grid-cols-3 gap-4">
              <EventCard title="Public Events" events={todayPublicEvents} loading={dataLoading} />
              <EventCard title="Private Events" events={todayPrivateEvents} loading={dataLoading} />
              <EventCard title="Analysis Events" events={todayAnalysisEvents} loading={dataLoading} />
            </div>

            {/* ── Request Types ── */}
            <div className="grid grid-cols-6 gap-3">
              {REQUEST_TYPES.map(rt => (
                <div key={rt} className="bg-[#1d1c21] border border-white/[0.08] rounded-lg px-4 py-3.5">
                  <p className="text-white text-xl font-semibold tabular-nums leading-none">
                    {dataLoading ? '—' : (requestCounts[rt] || 0)}
                  </p>
                  <p className="text-white text-[11px] mt-2 leading-snug opacity-50">{rt}</p>
                </div>
              ))}
            </div>

          </div>
        )}
      </main>
    </div>
  );
};

// ─── Nav Group (collapsible) ─────────────────────────────────────────────────
const NavGroupItem = ({ label, icon, open, onToggle, badge, children }: {
  label: string; icon: React.ReactNode; open: boolean; onToggle: () => void;
  badge?: number; children: React.ReactNode;
}) => (
  <div>
    <button onClick={onToggle}
      className="w-full flex items-center gap-2.5 px-3 py-[7px] rounded-md text-[13px] transition-all duration-150 text-left text-white/50 hover:text-white hover:bg-white/[0.05]">
      {icon}
      <span className="flex-1 leading-none">{label}</span>
      {badge !== undefined && !open && (
        <span className="w-[18px] h-[18px] rounded-full bg-white flex items-center justify-center flex-shrink-0 mr-1">
          <span className="text-black text-[10px] font-bold leading-none">{badge}</span>
        </span>
      )}
      <Chevron open={open} />
    </button>
    {open && <div className="ml-3 mt-px space-y-px">{children}</div>}
  </div>
);

// ─── Nav Child ───────────────────────────────────────────────────────────────
const NavChild = ({ section, label, active, onSelect, icon }: {
  section: Section; label: string; active: boolean; onSelect: (s: Section) => void; icon: React.ReactNode;
}) => (
  <button onClick={() => onSelect(section)}
    className={`w-full flex items-center gap-2 pl-3 pr-3 py-[6px] rounded-md text-[12px] transition-all duration-150 text-left ${
      active ? 'bg-white/[0.08] text-white' : 'text-white/40 hover:text-white hover:bg-white/[0.04]'
    }`}>
    {icon}
    <span>{label}</span>
  </button>
);

export default AdminDashboard;
