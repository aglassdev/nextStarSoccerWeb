import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Query } from 'appwrite';
import { useAuth } from '../../contexts/AuthContext';
import { databases, databaseId, collections, storage } from '../../services/appwrite';
import { Bill, getUserBills, formatMoney, isBillOverdue } from '../../services/payment/billingService';
import { VideoAnalysis, listMyAnalyses } from '../../services/videoAnalysis';
import { COACH_DASHBOARD_LIVE } from '../../services/accountProfile';
import { useAccount } from './AccountContext';
import { AccountSpinner } from './AccountLayout';

// The Account Center's Dashboard, the app's Account screen at desktop size:
// profile cards, the My Schedule and Payment Center cards, then a card for
// each section.

const PROFILE_PHOTOS_BUCKET = 'profile-photos';

interface Signup {
  $id: string;
  eventTitle: string;
  eventDate: string;
  firstName?: string;
}

const card = 'bg-[#111] border border-[#222] rounded-2xl hover:border-[#3a3a3a] transition-colors';

const fmtSession = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const day = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/New_York' });
  return /T\d{2}:\d{2}/.test(iso)
    ? `${day} · ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })}`
    : day;
};
const fmtDue = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' }) : 'TBD';

const Avatar = ({ photoId }: { photoId?: string | null }) => (
  <div className="w-16 h-16 rounded-full bg-[#1A1A1A] border border-[#2A2A2A] flex items-center justify-center overflow-hidden flex-shrink-0">
    {photoId ? (
      <img src={storage.getFileView(PROFILE_PHOTOS_BUCKET, photoId)} alt="" className="w-full h-full object-cover" />
    ) : (
      <svg className="w-7 h-7 text-[#888]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    )}
  </div>
);

const AccountOverviewPage = () => {
  const { user } = useAuth();
  const { loading, profile, userType, children, isCoach, isAdmin } = useAccount();
  const [bills, setBills] = useState<Bill[] | null>(null);
  const [nextSession, setNextSession] = useState<Signup | null | undefined>(undefined);
  const [analyses, setAnalyses] = useState<VideoAnalysis[]>([]);

  useEffect(() => {
    if (!user) return;
    getUserBills(user.$id).then(setBills).catch(() => setBills([]));
    listMyAnalyses(user.$id).then(setAnalyses).catch(() => {});
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    databases
      .listDocuments(databaseId, collections.signups, [
        Query.equal('userId', user.$id),
        Query.greaterThanEqual('eventDate', today),
        Query.orderAsc('eventDate'),
        Query.limit(1),
      ])
      .then((r) => setNextSession((r.documents[0] as any) || null))
      .catch(() => setNextSession(null));
  }, [user]);

  const nextDue = useMemo(
    () => (bills || []).filter((b) => b.status === 'pending').sort((a, b) => Date.parse(a.dueDate || '') - Date.parse(b.dueDate || ''))[0],
    [bills],
  );

  if (loading) return <AccountSpinner />;

  const isParent = userType === 'parent';
  const profiles = isParent
    ? children.map((c) => ({ key: c.id, name: `${c.firstName} ${c.lastName}`.trim(), club: c.club, photoId: c.photoId, to: '/account/family' }))
    : profile
      ? [{
          key: profile.$id,
          name: `${profile.firstName || ''} ${profile.lastName || ''}`.trim(),
          club: profile.currentClub || profile.currentCollege || profile.club,
          photoId: profile.profilePhotoId,
          to: '/account/settings',
        }]
      : [];

  const toUpload = analyses.filter((a) => a.status === 'awaiting_upload').length;
  const ready = analyses.filter((a) => a.status === 'completed').length;
  const withCoach = analyses.filter((a) => a.status === 'submitted' || a.status === 'in_review').length;
  const analysisNote = toUpload
    ? `${toUpload} film${toUpload === 1 ? '' : 's'} to upload`
    : ready
      ? `${ready} ready to watch`
      : withCoach
        ? `${withCoach} with your coach`
        : 'Your game film analyses';

  const menu = [
    { to: '/account/video-analysis', title: 'Video Analysis', note: analysisNote, show: userType !== 'coach' },
    { to: '/account/family', title: 'My Family', note: `${children.length} player${children.length === 1 ? '' : 's'}`, show: isParent },
    { to: '/account/settings', title: 'Settings', note: 'Account information and password', show: true },
  ].filter((m) => m.show);

  return (
    <div>
      <h1 className="text-white text-3xl md:text-4xl font-medium text-center">Dashboard</h1>

      {(isAdmin || (isCoach && COACH_DASHBOARD_LIVE)) && (
        <div className="flex justify-center gap-6 mt-4">
          {isAdmin && <Link to="/admin/dashboard" className="text-white text-base font-medium underline underline-offset-4 hover:text-gray-300">Switch to Admin</Link>}
          {isCoach && COACH_DASHBOARD_LIVE && (
            <Link to="/coach" className="text-white text-base font-medium underline underline-offset-4 hover:text-gray-300">Switch to Coaching</Link>
          )}
        </div>
      )}

      <div className="mt-10 space-y-4">
        {!profile && (
          <div className={`${card} p-6 text-gray-400`}>
            We couldn't find a player or parent profile for this account. Finish setting up your account in the Next Star app,
            then come back here.
          </div>
        )}

        {/* Profile cards */}
        {profiles.length > 0 && (
          <div className="grid md:grid-cols-2 gap-4">
            {profiles.map((p, i) => (
              <Link key={p.key} to={p.to}
                className={`${card} px-6 py-5 flex items-center gap-5 ${profiles.length % 2 === 1 && i === profiles.length - 1 ? 'md:col-span-2' : ''}`}>
                <Avatar photoId={p.photoId} />
                <div className="min-w-0">
                  <p className="text-white text-xl font-medium truncate">{p.name}</p>
                  <p className="text-[#aaa] text-[15px] mt-1 truncate">{p.club || 'No club set'}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
        {isParent && children.length === 0 && (
          <Link to="/account/family" className={`${card} block px-6 py-6 text-[#aaa]`}>
            No players on your account yet. <span className="text-white underline underline-offset-2">Add a player</span>
          </Link>
        )}

        {/* My Schedule + Payment Center */}
        <div className="grid md:grid-cols-2 gap-4">
          <Link to="/account/schedule" className={`${card} p-7 min-h-[220px] flex flex-col`}>
            <p className="text-white text-xl font-semibold">My Schedule</p>
            <div className="mt-6">
              <p className="text-white text-lg font-semibold mb-3">Upcoming</p>
              {nextSession === undefined ? (
                <div className="w-5 h-5 border-2 border-white/40 border-t-transparent rounded-full animate-spin" />
              ) : nextSession ? (
                <>
                  <p className="text-white text-base font-medium">{nextSession.eventTitle}</p>
                  <p className="text-white text-base mt-1.5">
                    {fmtSession(nextSession.eventDate)}
                    {isParent && nextSession.firstName ? ` · ${nextSession.firstName}` : ''}
                  </p>
                </>
              ) : (
                <p className="text-white/70 italic">You have no upcoming sessions</p>
              )}
            </div>
          </Link>

          <Link to="/account/payments" className={`${card} p-7 min-h-[220px] flex flex-col`}>
            <p className="text-white text-xl font-semibold">Payment Center</p>
            <div className="mt-6">
              {bills === null ? (
                <>
                  <p className="text-white text-lg font-semibold mb-3">Due</p>
                  <div className="w-5 h-5 border-2 border-white/40 border-t-transparent rounded-full animate-spin" />
                </>
              ) : nextDue ? (
                <>
                  <p className={`text-lg font-semibold mb-3 ${isBillOverdue(nextDue) ? 'text-red-500' : 'text-white'}`}>
                    {isBillOverdue(nextDue) ? 'Overdue' : 'Due'}
                  </p>
                  <p className="text-white text-base font-medium">Monthly Bill, {nextDue.monthName}</p>
                  <p className="text-white text-base mt-1.5">{fmtDue(nextDue.dueDate)} | {formatMoney(nextDue.totalAmount)}</p>
                </>
              ) : (
                <>
                  <p className="text-white text-lg font-semibold mb-3">Due</p>
                  <p className="text-white/70 italic">You have no due payments</p>
                </>
              )}
            </div>
          </Link>
        </div>

        {/* Sections */}
        <div className={`grid gap-4 ${menu.length >= 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
          {menu.map((m) => (
            <Link key={m.to} to={m.to} className={`${card} px-7 py-7 flex items-center justify-between gap-4`}>
              <div className="min-w-0">
                <p className="text-white text-xl font-medium">{m.title}</p>
                <p className="text-[#888] text-sm mt-1 truncate">{m.note}</p>
              </div>
              <svg className="w-5 h-5 text-[#666] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AccountOverviewPage;
