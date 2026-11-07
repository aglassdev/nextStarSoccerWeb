import { useEffect, useState } from 'react';
import { Query } from 'appwrite';
import { useAuth } from '../../contexts/AuthContext';
import { databases, databaseId, collections } from '../../services/appwrite';
import { useAccount } from './AccountContext';
import { AccountPageHeader, AccountSpinner } from './AccountLayout';

// My Schedule, as in the app: every session this account (or a parent's
// player) is signed up for, upcoming first.

interface Signup {
  $id: string;
  eventTitle: string;
  eventDate: string;
  firstName?: string;
  lastName?: string;
}

const fmt = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { day: iso, time: '' };
  return {
    day: d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/New_York' }),
    time: /T\d{2}:\d{2}/.test(iso) ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) : '',
  };
};

const AccountSchedulePage = () => {
  const { user } = useAuth();
  const { userType } = useAccount();
  const [upcoming, setUpcoming] = useState<Signup[] | null>(null);
  const [past, setPast] = useState<Signup[]>([]);

  useEffect(() => {
    if (!user) return;
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    Promise.all([
      databases.listDocuments(databaseId, collections.signups, [
        Query.equal('userId', user.$id), Query.greaterThanEqual('eventDate', today), Query.orderAsc('eventDate'), Query.limit(50),
      ]),
      databases.listDocuments(databaseId, collections.signups, [
        Query.equal('userId', user.$id), Query.lessThan('eventDate', today), Query.orderDesc('eventDate'), Query.limit(10),
      ]),
    ])
      .then(([u, p]) => { setUpcoming(u.documents as any); setPast(p.documents as any); })
      .catch(() => setUpcoming([]));
  }, [user]);

  const Row = ({ s, dim }: { s: Signup; dim?: boolean }) => {
    const { day, time } = fmt(s.eventDate);
    return (
      <div className={`bg-[#111] border border-[#222] rounded-2xl px-6 py-5 flex flex-wrap items-center justify-between gap-3 ${dim ? 'opacity-60' : ''}`}>
        <div className="min-w-0">
          <p className="text-white text-lg font-medium truncate">{s.eventTitle}</p>
          <p className="text-[#aaa] text-sm mt-1">{day}{time ? ` · ${time}` : ''}</p>
        </div>
        {userType === 'parent' && s.firstName && <span className="text-[#aaa] text-sm">{s.firstName} {s.lastName}</span>}
      </div>
    );
  };

  return (
    <div>
      <AccountPageHeader title="My Schedule" />
      {upcoming === null ? (
        <AccountSpinner />
      ) : (
        <div className="space-y-8">
          <section>
            <p className="text-white text-lg font-semibold mb-3">Upcoming</p>
            {upcoming.length === 0 ? (
              <p className="text-white/70 italic">You have no upcoming sessions</p>
            ) : (
              <div className="grid md:grid-cols-2 gap-3">{upcoming.map((s) => <Row key={s.$id} s={s} />)}</div>
            )}
          </section>
          {past.length > 0 && (
            <section>
              <p className="text-white text-lg font-semibold mb-3">Past</p>
              <div className="grid md:grid-cols-2 gap-3">{past.map((s) => <Row key={s.$id} s={s} dim />)}</div>
            </section>
          )}
          <p className="text-[#666] text-sm">Sign up for sessions in the Next Star app.</p>
        </div>
      )}
    </div>
  );
};

export default AccountSchedulePage;
