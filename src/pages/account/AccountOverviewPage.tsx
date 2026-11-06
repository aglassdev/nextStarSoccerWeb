import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Query } from 'appwrite';
import { useAuth } from '../../contexts/AuthContext';
import { databases, databaseId, collections, storage } from '../../services/appwrite';
import {
  Bill,
  getUserBills,
  formatMoney,
  formatBillDate,
  formatSessionDate,
  calculateLateFee,
} from '../../services/payment/billingService';
import { useAccount } from './AccountContext';
import { AccountSpinner } from './AccountLayout';

const PROFILE_PHOTOS_BUCKET = 'profile-photos';

interface Signup {
  $id: string;
  eventTitle: string;
  eventDate: string;
  firstName?: string;
}

const Card = ({ title, to, action, children }: { title: string; to?: string; action?: string; children: React.ReactNode }) => (
  <section className="bg-[#111] border border-white/10 rounded-2xl p-5 flex flex-col">
    <div className="flex items-center justify-between mb-4">
      <p className="text-gray-500 text-xs uppercase tracking-wider">{title}</p>
      {to && (
        <Link to={to} className="text-xs text-gray-400 hover:text-white transition-colors">
          {action || 'View'} →
        </Link>
      )}
    </div>
    {children}
  </section>
);

const Avatar = ({ name, photoId }: { name: string; photoId?: string | null }) => {
  const initials = name.split(' ').map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  if (photoId) {
    return (
      <img
        src={storage.getFileView(PROFILE_PHOTOS_BUCKET, photoId)}
        alt={name}
        className="w-12 h-12 rounded-full object-cover bg-white/5"
      />
    );
  }
  return (
    <div className="w-12 h-12 rounded-full bg-white/[0.08] flex items-center justify-center text-white text-sm font-semibold">
      {initials || '•'}
    </div>
  );
};

const AccountOverviewPage = () => {
  const { user } = useAuth();
  const { loading, profile, userType, children } = useAccount();
  const [bills, setBills] = useState<Bill[] | null>(null);
  const [sessions, setSessions] = useState<Signup[] | null>(null);

  useEffect(() => {
    if (!user) return;
    getUserBills(user.$id).then(setBills).catch(() => setBills([]));
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    databases
      .listDocuments(databaseId, collections.signups, [
        Query.equal('userId', user.$id),
        Query.greaterThanEqual('eventDate', today),
        Query.orderAsc('eventDate'),
        Query.limit(5),
      ])
      .then((r) => setSessions(r.documents as any))
      .catch(() => setSessions([]));
  }, [user]);

  const pending = useMemo(() => (bills || []).filter((b) => b.status === 'pending'), [bills]);
  const outstanding = pending.reduce((s, b) => s + b.totalAmount + calculateLateFee(b), 0);
  const nextDue = [...pending].sort((a, b) => Date.parse(a.dueDate || '') - Date.parse(b.dueDate || ''))[0];

  if (loading) return <AccountSpinner />;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = (profile?.firstName || '').trim();
  const isParent = userType === 'parent';

  const people = isParent
    ? children.map((c) => ({ key: c.id, name: `${c.firstName} ${c.lastName}`.trim(), sub: c.kind === 'proxy' ? 'Managed by you' : 'Linked account', photoId: null }))
    : profile
      ? [{
          key: profile.$id,
          name: `${profile.firstName || ''} ${profile.lastName || ''}`.trim(),
          sub: profile.currentClub || profile.currentCollege || profile.club || '',
          photoId: profile.profilePhotoId,
        }]
      : [];

  return (
    <div className="space-y-8">
      <h2 className="text-2xl md:text-3xl font-bold text-white">
        {greeting}{firstName ? `, ${firstName}` : ''}
      </h2>

      {!profile && (
        <div className="p-4 bg-[#111] border border-white/10 rounded-xl text-gray-400 text-sm">
          We couldn't find a player or parent profile for this account. Finish setting up your account in the
          Next Star app, then come back here.
        </div>
      )}

      {/* Profile cards: each child for a parent, the player themselves otherwise */}
      {people.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold text-lg">{isParent ? 'My Players' : 'My Profile'}</h3>
            <Link to={isParent ? '/account/family' : '/account/settings'} className="text-xs text-gray-400 hover:text-white transition-colors">
              {isParent ? 'Manage family' : 'Edit profile'} →
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {people.map((p) => (
              <div key={p.key} className="bg-[#111] border border-white/10 rounded-xl p-4 flex items-center gap-3">
                <Avatar name={p.name} photoId={p.photoId} />
                <div className="min-w-0">
                  <p className="text-white font-medium truncate">{p.name}</p>
                  {p.sub && <p className="text-gray-500 text-xs truncate mt-0.5">{p.sub}</p>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      {isParent && children.length === 0 && (
        <div className="bg-[#111] border border-white/10 rounded-xl p-4 text-sm text-gray-400">
          No players on your account yet. <Link to="/account/family" className="text-white underline underline-offset-2">Add a player</Link>.
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Payment Center" to="/account/payments" action="Open">
          {bills === null ? (
            <div className="h-16 flex items-center"><div className="w-4 h-4 border-2 border-white/40 border-t-transparent rounded-full animate-spin" /></div>
          ) : pending.length === 0 ? (
            <div>
              <p className="text-green-400 font-medium">You're all caught up</p>
              <p className="text-gray-500 text-sm mt-1">No outstanding bills.</p>
            </div>
          ) : (
            <div>
              <p className="text-3xl font-bold text-white">{formatMoney(outstanding)}</p>
              <p className="text-gray-500 text-sm mt-1">
                {pending.length} unpaid bill{pending.length === 1 ? '' : 's'}
                {nextDue?.dueDate ? ` · next due ${formatBillDate(nextDue.dueDate)}` : ''}
              </p>
            </div>
          )}
        </Card>

        <Card title="Upcoming Sessions">
          {sessions === null ? (
            <div className="h-16 flex items-center"><div className="w-4 h-4 border-2 border-white/40 border-t-transparent rounded-full animate-spin" /></div>
          ) : sessions.length === 0 ? (
            <p className="text-gray-500 text-sm">Nothing booked. Sign up for sessions in the Next Star app or on the <Link to="/calendar" className="text-white underline underline-offset-2">calendar</Link>.</p>
          ) : (
            <div className="divide-y divide-white/[0.06] -my-2">
              {sessions.map((s) => (
                <div key={s.$id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-white text-sm truncate">{s.eventTitle}</p>
                    <p className="text-gray-500 text-xs mt-0.5">
                      {formatSessionDate(s.eventDate)}
                      {isParent && s.firstName ? ` · ${s.firstName}` : ''}
                    </p>
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

export default AccountOverviewPage;
