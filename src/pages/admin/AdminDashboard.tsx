import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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

// ─── EventsPreviewCard ─────────────────────────────────────────────────────
interface CalEvent { id: string; title: string; startDateTime: string; endDateTime: string; location?: string | null; dateOnly?: boolean; }
interface SignupCounts { [id: string]: { players: number; coaches: number } }

const EventsPreviewCard = () => {
  const [publicEvents, setPublicEvents] = useState<CalEvent[]>([]);
  const [privateEvents, setPrivateEvents] = useState<CalEvent[]>([]);
  const [signups, setSignups] = useState<SignupCounts>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const now = new Date();
        const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); // YYYY-MM-DD
        const y = now.getFullYear();
        const m = now.getMonth(); // 0-indexed

        const [pubAll, privAll] = await Promise.all([
          googleCalendarService.getEventsForMonth(y, m, 'public'),
          googleCalendarService.getEventsForMonth(y, m, 'private').catch(() => []),
        ]);

        const toDateStr = (dt: string) => new Date(dt).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
        const todayPub = (pubAll as CalEvent[]).filter(e => toDateStr(e.startDateTime) === todayStr);
        const todayPriv = (privAll as CalEvent[]).filter(e => toDateStr(e.startDateTime) === todayStr);

        setPublicEvents(todayPub);
        setPrivateEvents(todayPriv);

        // Fetch signups for today's events
        const allIds = [...todayPub.map(e => e.id), ...todayPriv.map(e => e.id)];
        if (allIds.length > 0 && collections.signups && collections.coachSignups) {
          const counts: SignupCounts = {};
          await Promise.all(allIds.map(async id => {
            const [p, c] = await Promise.all([
              databases.listDocuments(databaseId, collections.signups!, [Query.equal('eventID', id)]).catch(() => ({ total: 0 })),
              databases.listDocuments(databaseId, collections.coachSignups!, [Query.equal('eventID', id)]).catch(() => ({ total: 0 })),
            ]);
            counts[id] = { players: (p as any).total, coaches: (c as any).total };
          }));
          setSignups(counts);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const fmtTime = (start: string, end: string, dateOnly?: boolean) => {
    if (dateOnly) return 'All Day';
    const fmt = (d: string) => new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York' });
    return `${fmt(start)} – ${fmt(end)}`;
  };
  const fmtLoc = (loc?: string | null) => loc ? loc.split(',')[0].trim() : 'TBD';
  const isPast = (end: string) => new Date() > new Date(end);

  if (loading) return (
    <div className="bg-[#1a1a1a] rounded-xl p-5 mb-4 min-h-[140px] flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
    </div>
  );

  const EventCol = ({ label, events }: { label: string; events: CalEvent[] }) => (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#333]">
        <span className="text-white text-sm font-medium">{label}</span>
        <span className="text-white text-sm font-medium">{events.length}</span>
      </div>
      {events.length === 0 ? (
        <p className="text-gray-500 text-sm italic text-center py-4">No events</p>
      ) : events.map(ev => {
        const past = isPast(ev.endDateTime);
        const s = signups[ev.id] || { players: 0, coaches: 0 };
        return (
          <div key={ev.id} className={`pb-3 mb-3 border-b border-[#2a2a2a] last:border-0 ${past ? 'opacity-50' : ''}`}>
            <p className={`text-sm font-medium mb-1 ${past ? 'text-gray-400' : 'text-white'}`}>{ev.title}</p>
            <p className="text-gray-400 text-xs mb-1">{s.players} {s.players === 1 ? 'player' : 'players'} | {s.coaches} {s.coaches === 1 ? 'coach' : 'coaches'}</p>
            <p className="text-gray-400 text-xs">{fmtTime(ev.startDateTime, ev.endDateTime, ev.dateOnly)} | {fmtLoc(ev.location)}</p>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="bg-[#1a1a1a] rounded-xl p-5 mb-4">
      <div className="flex gap-4">
        <EventCol label="Public" events={publicEvents} />
        <div className="w-px bg-[#333]" />
        <EventCol label="Private" events={privateEvents} />
      </div>
    </div>
  );
};

// ─── InboxPreviewCard ──────────────────────────────────────────────────────
const InboxPreviewCard = () => {
  const [stats, setStats] = useState({ sessions: 0, messages: 0, analysis: 0, teamTraining: 0, loading: true });

  useEffect(() => {
    (async () => {
      try {
        const msgCount = collections.messages
          ? await databases.listDocuments(databaseId, collections.messages, [Query.equal('read', false), Query.limit(1)]).catch(() => ({ total: 0 }))
          : { total: 0 };
        const ttCount = collections.teamTraining
          ? await databases.listDocuments(databaseId, collections.teamTraining, [Query.equal('read', false), Query.limit(1)]).catch(() => ({ total: 0 }))
          : { total: 0 };
        setStats({ sessions: 0, messages: (msgCount as any).total, analysis: 0, teamTraining: (ttCount as any).total, loading: false });
      } catch { setStats(p => ({ ...p, loading: false })); }
    })();
  }, []);

  if (stats.loading) return (
    <div className="bg-[#1a1a1a] rounded-xl p-4 mb-4 min-h-[100px] flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
    </div>
  );

  const StatBox = ({ label, value }: { label: string; value: number }) => (
    <div className="flex-1">
      <p className="text-white text-sm mb-2">{label}</p>
      <p className="text-white text-2xl font-medium">{value}</p>
    </div>
  );

  return (
    <div className="bg-[#1a1a1a] rounded-xl p-4 mb-4">
      <div className="flex gap-4 mb-5">
        <StatBox label="Session Requests" value={stats.sessions} />
        <StatBox label="Messages" value={stats.messages} />
      </div>
      <div className="flex gap-4">
        <StatBox label="Analysis Requests" value={stats.analysis} />
        <StatBox label="Team Training Requests" value={stats.teamTraining} />
      </div>
    </div>
  );
};

// ─── PaymentsPreviewCard ───────────────────────────────────────────────────
const PaymentsPreviewCard = () => {
  const [stats, setStats] = useState({ paidBills: 0, outstandingBills: 0, paymentsGross: 0, billsGross: 0, loading: true });

  useEffect(() => {
    (async () => {
      try {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

        const [paid, pending, allPayments, allBills] = await Promise.all([
          collections.bills ? databases.listDocuments(databaseId, collections.bills, [Query.equal('status', 'paid'), Query.limit(1)]).catch(() => ({ total: 0, documents: [] })) : { total: 0, documents: [] },
          collections.bills ? databases.listDocuments(databaseId, collections.bills, [Query.equal('status', 'pending'), Query.limit(1)]).catch(() => ({ total: 0, documents: [] })) : { total: 0, documents: [] },
          collections.payments ? databases.listDocuments(databaseId, collections.payments, [Query.limit(5000)]).catch(() => ({ documents: [] })) : { documents: [] },
          collections.bills ? databases.listDocuments(databaseId, collections.bills, [Query.equal('status', 'paid'), Query.limit(5000)]).catch(() => ({ documents: [] })) : { documents: [] },
        ]);

        const paymentsGross = (allPayments as any).documents
          .filter((p: any) => p.$createdAt >= monthStart && p.$createdAt <= monthEnd)
          .reduce((s: number, p: any) => s + (p.price || 0), 0);
        const billsGross = (allBills as any).documents
          .filter((b: any) => b.$createdAt >= monthStart && b.$createdAt <= monthEnd)
          .reduce((s: number, b: any) => s + ((b.totalAmount || 0) - (b.couponValue || 0)), 0);

        setStats({ paidBills: (paid as any).total, outstandingBills: (pending as any).total, paymentsGross, billsGross, loading: false });
      } catch { setStats(p => ({ ...p, loading: false })); }
    })();
  }, []);

  if (stats.loading) return (
    <div className="bg-[#1a1a1a] rounded-xl p-4 mb-4 min-h-[100px] flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="bg-[#1a1a1a] rounded-xl p-4 mb-4">
      <div className="flex gap-4 mb-5">
        <div style={{ flex: 0.4 }}>
          <p className="text-white text-sm mb-2">Paid Bills</p>
          <p className="text-white text-2xl font-medium">{stats.paidBills}</p>
        </div>
        <div style={{ flex: 0.6 }}>
          <p className="text-white text-sm mb-2">Payments, Monthly Gross</p>
          <p className="text-white text-2xl font-medium">${stats.paymentsGross.toLocaleString()}</p>
        </div>
      </div>
      <div className="flex gap-4">
        <div style={{ flex: 0.4 }}>
          <p className="text-white text-sm mb-2">Outstanding Bills</p>
          <p className="text-white text-2xl font-medium">{stats.outstandingBills}</p>
        </div>
        <div style={{ flex: 0.6 }}>
          <p className="text-white text-sm mb-2">Bills, Monthly Gross</p>
          <p className="text-white text-2xl font-medium">${stats.billsGross.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
};

// ─── Main Dashboard ────────────────────────────────────────────────────────
type Section = 'players' | 'coaches' | 'parents' | 'bills' | 'payments' | 'messages';

const sectionLabels: Record<Section, string> = {
  players: 'Player Directory',
  coaches: 'Coach Directory',
  parents: 'Parent Directory',
  bills: 'Bill Manager',
  payments: 'Payment Log',
  messages: 'Message Inbox',
};

const AdminDashboard = () => {
  const { user, logout, initialized } = useAuth();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<Section | null>(null);
  const [counts, setCounts] = useState({ players: 0, coaches: 0, parents: 0, loading: true });

  useEffect(() => {
    if (!initialized) return;
    if (!user) { navigate('/admin'); return; }
    if (!ALLOWED_EMAILS.includes(user.email.toLowerCase().trim())) {
      logout().then(() => navigate('/admin'));
    }
  }, [user, initialized]);

  useEffect(() => {
    (async () => {
      try {
        const [y, col, pro, coach, parent] = await Promise.all([
          databases.listDocuments(databaseId, collections.youthPlayers!, [Query.limit(1)]).catch(() => ({ total: 0 })),
          databases.listDocuments(databaseId, collections.collegiatePlayers!, [Query.limit(1)]).catch(() => ({ total: 0 })),
          databases.listDocuments(databaseId, collections.professionalPlayers!, [Query.limit(1)]).catch(() => ({ total: 0 })),
          databases.listDocuments(databaseId, collections.coaches!, [Query.limit(1)]).catch(() => ({ total: 0 })),
          databases.listDocuments(databaseId, collections.parentUsers!, [Query.limit(1)]).catch(() => ({ total: 0 })),
        ]);
        setCounts({ players: (y as any).total + (col as any).total + (pro as any).total, coaches: (coach as any).total, parents: (parent as any).total, loading: false });
      } catch { setCounts(p => ({ ...p, loading: false })); }
    })();
  }, []);

  const handleLogout = async () => { await logout(); navigate('/admin'); };

  if (!initialized) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
    </div>
  );

  // ── Section view ──
  if (activeSection) {
    const sectionMap: Record<Section, React.ReactNode> = {
      players: <PlayersSection />,
      coaches: <CoachesSection />,
      parents: <ParentsSection />,
      bills: <BillsSection />,
      payments: <PaymentsSection />,
      messages: <MessagesSection />,
    };
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="sticky top-0 z-10 bg-black border-b border-gray-800 px-4 h-14 flex items-center gap-4">
          <button onClick={() => setActiveSection(null)} className="text-white hover:text-gray-300 transition-colors flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm">Dashboard</span>
          </button>
          <h1 className="text-white font-medium">{sectionLabels[activeSection]}</h1>
        </div>
        <div>{sectionMap[activeSection]}</div>
      </div>
    );
  }

  // ── Hub view ──
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' });

  const ActionBtn = ({ label, section }: { label: string; section: Section }) => (
    <button
      onClick={() => setActiveSection(section)}
      className="flex-1 h-[72px] bg-[#1a1a1a] rounded-xl flex items-center justify-center hover:bg-[#242424] transition-colors cursor-pointer"
    >
      <span className="text-white text-sm font-medium">{label}</span>
    </button>
  );

  const DirectoryCard = ({ label, count, section }: { label: string; count: number; section: Section }) => (
    <button
      onClick={() => setActiveSection(section)}
      className="flex-1 aspect-square bg-[#1a1a1a] rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-[#242424] transition-colors cursor-pointer p-4"
    >
      <span className="text-white text-sm font-medium">{label}</span>
      {counts.loading
        ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        : <span className="text-white text-4xl font-medium">{count}</span>
      }
    </button>
  );

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-black border-b border-gray-800 px-4 h-14 flex items-center justify-between">
        <h1 className="text-white font-medium">Admin Dashboard</h1>
        <button onClick={handleLogout} className="text-gray-400 hover:text-white text-sm transition-colors">Logout</button>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">

        {/* ── Event Management ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white text-xl font-medium">Event Management</h2>
            <span className="text-gray-400 text-sm">{dateStr}</span>
          </div>
          <EventsPreviewCard />
          <div className="flex gap-3">
            <ActionBtn label="Calendar Centre" section="messages" />
            <ActionBtn label="Event Assistant" section="messages" />
          </div>
        </section>

        {/* ── Message Management ── */}
        <section>
          <h2 className="text-white text-xl font-medium mb-4">Message Management</h2>
          <InboxPreviewCard />
          <div className="flex gap-3">
            <ActionBtn label="Message Inbox" section="messages" />
            <ActionBtn label="Request Inbox" section="messages" />
          </div>
        </section>

        {/* ── Financial Management ── */}
        <section>
          <h2 className="text-white text-xl font-medium mb-4">Financial Management</h2>
          <PaymentsPreviewCard />
          <div className="flex gap-3">
            <ActionBtn label="Payment Log" section="payments" />
            <ActionBtn label="Bill Manager" section="bills" />
          </div>
        </section>

        {/* ── User Management ── */}
        <section>
          <h2 className="text-white text-xl font-medium mb-4">User Management</h2>
          <div className="flex gap-3">
            <DirectoryCard label="Players" count={counts.players} section="players" />
            <DirectoryCard label="Coaches" count={counts.coaches} section="coaches" />
            <DirectoryCard label="Parents" count={counts.parents} section="parents" />
          </div>
        </section>

      </div>
    </div>
  );
};

export default AdminDashboard;
