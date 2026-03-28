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

// ─── Types ─────────────────────────────────────────────────────────────────
type Section = 'players' | 'coaches' | 'parents' | 'bills' | 'payments' | 'messages';

interface CalEvent {
  id: string; title: string; startDateTime: string;
  endDateTime: string; location?: string | null; dateOnly?: boolean;
}
interface SignupCounts { [id: string]: { players: number; coaches: number } }

// ─── EventsPreviewCard ─────────────────────────────────────────────────────
const EventsPreviewCard = () => {
  const [publicEvents, setPublicEvents] = useState<CalEvent[]>([]);
  const [privateEvents, setPrivateEvents] = useState<CalEvent[]>([]);
  const [signups, setSignups] = useState<SignupCounts>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const now = new Date();
        const todayStr = now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
        const y = now.getFullYear();
        const m = now.getMonth();

        const [pubAll, privAll] = await Promise.all([
          googleCalendarService.getEventsForMonth(y, m, 'public'),
          googleCalendarService.getEventsForMonth(y, m, 'private').catch(() => []),
        ]);

        const toDateStr = (dt: string) =>
          new Date(dt).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

        const todayPub = (pubAll as CalEvent[]).filter(e => toDateStr(e.startDateTime) === todayStr);
        const todayPriv = (privAll as CalEvent[]).filter(e => toDateStr(e.startDateTime) === todayStr);

        setPublicEvents(todayPub);
        setPrivateEvents(todayPriv);

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
    const fmt = (d: string) => new Date(d).toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York',
    });
    return `${fmt(start)} – ${fmt(end)}`;
  };
  const fmtLoc = (loc?: string | null) => loc ? loc.split(',')[0].trim() : 'TBD';
  const isPast = (end: string) => new Date() > new Date(end);

  if (loading) return (
    <div className="bg-[#111] rounded-xl p-5 min-h-[120px] flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
    </div>
  );

  const EventCol = ({ label, events }: { label: string; events: CalEvent[] }) => (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#2a2a2a]">
        <span className="text-gray-300 text-xs font-medium uppercase tracking-wider">{label}</span>
        <span className="text-gray-400 text-xs">{events.length}</span>
      </div>
      {events.length === 0 ? (
        <p className="text-gray-600 text-xs italic py-3">No events today</p>
      ) : events.map(ev => {
        const past = isPast(ev.endDateTime);
        const s = signups[ev.id] || { players: 0, coaches: 0 };
        return (
          <div key={ev.id} className={`pb-3 mb-3 border-b border-[#1e1e1e] last:border-0 ${past ? 'opacity-40' : ''}`}>
            <p className="text-white text-sm font-medium mb-1 leading-tight">{ev.title}</p>
            <p className="text-gray-500 text-xs">{s.players}p · {s.coaches}c · {fmtTime(ev.startDateTime, ev.endDateTime, ev.dateOnly)}</p>
            <p className="text-gray-600 text-xs">{fmtLoc(ev.location)}</p>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="bg-[#111] rounded-xl p-5">
      <div className="flex gap-5">
        <EventCol label="Public" events={publicEvents} />
        <div className="w-px bg-[#2a2a2a]" />
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
        const [msg, tt] = await Promise.all([
          collections.messages
            ? databases.listDocuments(databaseId, collections.messages, [Query.equal('read', false), Query.limit(1)]).catch(() => ({ total: 0 }))
            : { total: 0 },
          collections.teamTraining
            ? databases.listDocuments(databaseId, collections.teamTraining, [Query.equal('read', false), Query.limit(1)]).catch(() => ({ total: 0 }))
            : { total: 0 },
        ]);
        setStats({ sessions: 0, messages: (msg as any).total, analysis: 0, teamTraining: (tt as any).total, loading: false });
      } catch { setStats(p => ({ ...p, loading: false })); }
    })();
  }, []);

  if (stats.loading) return (
    <div className="bg-[#111] rounded-xl p-4 min-h-[80px] flex items-center justify-center">
      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
    </div>
  );

  const S = ({ label, value }: { label: string; value: number }) => (
    <div>
      <p className="text-gray-500 text-xs mb-1">{label}</p>
      <p className="text-white text-xl font-medium">{value}</p>
    </div>
  );

  return (
    <div className="bg-[#111] rounded-xl p-4">
      <div className="grid grid-cols-2 gap-x-4 gap-y-4">
        <S label="Session Requests" value={stats.sessions} />
        <S label="Messages" value={stats.messages} />
        <S label="Analysis Requests" value={stats.analysis} />
        <S label="Team Training" value={stats.teamTraining} />
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
    <div className="bg-[#111] rounded-xl p-4 min-h-[80px] flex items-center justify-center">
      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
    </div>
  );

  const S = ({ label, value }: { label: string; value: string | number }) => (
    <div>
      <p className="text-gray-500 text-xs mb-1">{label}</p>
      <p className="text-white text-xl font-medium">{value}</p>
    </div>
  );

  return (
    <div className="bg-[#111] rounded-xl p-4">
      <div className="grid grid-cols-2 gap-x-4 gap-y-4">
        <S label="Paid Bills" value={stats.paidBills} />
        <S label="Payments Gross" value={`$${stats.paymentsGross.toLocaleString()}`} />
        <S label="Outstanding Bills" value={stats.outstandingBills} />
        <S label="Bills Gross" value={`$${stats.billsGross.toLocaleString()}`} />
      </div>
    </div>
  );
};

// ─── Sidebar ───────────────────────────────────────────────────────────────
const navItems: { section: Section | null; label: string; icon: React.ReactNode }[] = [
  {
    section: null, label: 'Dashboard',
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
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

// ─── Main Dashboard ────────────────────────────────────────────────────────
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
        setCounts({
          players: (y as any).total + (col as any).total + (pro as any).total,
          coaches: (coach as any).total,
          parents: (parent as any).total,
          loading: false,
        });
      } catch { setCounts(p => ({ ...p, loading: false })); }
    })();
  }, []);

  const handleLogout = async () => { await logout(); navigate('/admin'); };

  if (!initialized) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
    </div>
  );

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' });

  const sectionComponents: Record<Section, React.ReactNode> = {
    players: <PlayersSection />,
    coaches: <CoachesSection />,
    parents: <ParentsSection />,
    bills: <BillsSection />,
    payments: <PaymentsSection />,
    messages: <MessagesSection />,
  };

  const ActionBtn = ({ label, section }: { label: string; section: Section }) => (
    <button
      onClick={() => setActiveSection(section)}
      className="flex-1 h-14 bg-[#1a1a1a] rounded-lg flex items-center justify-center hover:bg-[#222] transition-colors"
    >
      <span className="text-gray-300 text-xs font-medium">{label}</span>
    </button>
  );

  const DirectoryCard = ({ label, count, section }: { label: string; count: number; section: Section }) => (
    <button
      onClick={() => setActiveSection(section)}
      className="flex-1 aspect-square bg-[#111] rounded-xl flex flex-col items-center justify-center gap-2 hover:bg-[#1a1a1a] transition-colors p-4 border border-[#1e1e1e]"
    >
      <span className="text-gray-400 text-xs font-medium uppercase tracking-wider">{label}</span>
      {counts.loading
        ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        : <span className="text-white text-4xl font-medium">{count}</span>
      }
    </button>
  );

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden">

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className="w-52 bg-[#080808] border-r border-[#1a1a1a] flex flex-col flex-shrink-0">
        {/* Logo / title */}
        <div className="px-5 py-6 border-b border-[#1a1a1a]">
          <button
            onClick={() => setActiveSection(null)}
            className="text-white font-semibold text-sm leading-tight hover:text-gray-300 transition-colors text-left"
          >
            Admin<br />
            <span className="text-gray-500 font-normal">Next Star Soccer</span>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ section, label, icon }) => {
            const active = activeSection === section;
            return (
              <button
                key={label}
                onClick={() => setActiveSection(section)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left ${
                  active
                    ? 'bg-white/[0.08] text-white border-l-2 border-blue-500 pl-[10px]'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]'
                }`}
              >
                {icon}
                {label}
              </button>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="px-3 py-4 border-t border-[#1a1a1a]">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-500 hover:text-red-400 hover:bg-red-500/[0.06] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">

        {activeSection ? (
          /* Section view */
          <div>
            <div className="sticky top-0 z-10 bg-black/90 backdrop-blur border-b border-[#1a1a1a] px-6 h-12 flex items-center gap-3">
              <button
                onClick={() => setActiveSection(null)}
                className="text-gray-500 hover:text-white transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-gray-400 text-xs">/</span>
              <span className="text-white text-sm font-medium">
                {navItems.find(n => n.section === activeSection)?.label}
              </span>
            </div>
            {sectionComponents[activeSection]}
          </div>
        ) : (
          /* Hub view */
          <div className="px-8 py-8 max-w-5xl mx-auto space-y-6">

            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-white text-2xl font-semibold">Dashboard</h1>
                <p className="text-gray-600 text-sm mt-0.5">{dateStr}</p>
              </div>
            </div>

            {/* Row 1: Event Management (full width) */}
            <section>
              <h2 className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-3">Event Management</h2>
              <EventsPreviewCard />
              <div className="flex gap-3 mt-3">
                <ActionBtn label="Calendar Centre" section="messages" />
                <ActionBtn label="Event Assistant" section="messages" />
              </div>
            </section>

            {/* Row 2: Message Management + Financial Management side by side */}
            <div className="grid grid-cols-2 gap-5">

              <section>
                <h2 className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-3">Message Management</h2>
                <InboxPreviewCard />
                <div className="flex gap-2 mt-3">
                  <ActionBtn label="Message Inbox" section="messages" />
                  <ActionBtn label="Request Inbox" section="messages" />
                </div>
              </section>

              <section>
                <h2 className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-3">Financial Management</h2>
                <PaymentsPreviewCard />
                <div className="flex gap-2 mt-3">
                  <ActionBtn label="Payment Log" section="payments" />
                  <ActionBtn label="Bill Manager" section="bills" />
                </div>
              </section>

            </div>

            {/* Row 3: User Management */}
            <section>
              <h2 className="text-gray-400 text-xs font-medium uppercase tracking-wider mb-3">User Management</h2>
              <div className="flex gap-4">
                <DirectoryCard label="Players" count={counts.players} section="players" />
                <DirectoryCard label="Coaches" count={counts.coaches} section="coaches" />
                <DirectoryCard label="Parents" count={counts.parents} section="parents" />
              </div>
            </section>

          </div>
        )}
      </main>
    </div>
  );
};

export default AdminDashboard;
