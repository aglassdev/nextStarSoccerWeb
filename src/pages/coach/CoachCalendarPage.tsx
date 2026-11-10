import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { isEventCancelled, type CalendarEvent } from '@/services/googleCalendar';
import { CalendarView } from '../CalendarPage';
import { useAccount } from '../account/AccountContext';
import { AccountPageHeader } from '../account/AccountLayout';
import { isSignedUpToCoach, sessionEnded, signUpToCoach } from './coachData';

// Coach Dashboard → Calendar: the website's calendar (the month grid, a list
// on phones). An event's window has the app's coach sign-up (CoachEventDetail):
// Sign Up, ✓ Signed Up (with a link to the session's page) or Event Ended.

const CoachSignUp = ({ event, close, refreshCoaches }: { event: CalendarEvent; close: () => void; refreshCoaches: () => void }) => {
  const { user } = useAuth();
  const { profile } = useAccount();
  const uid = user?.$id || '';
  const coachName = (user?.name || `${profile?.firstName || ''} ${profile?.lastName || ''}`).trim();
  const [signedUp, setSignedUp] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    setSignedUp(null);
    setError('');
    isSignedUpToCoach(event.id, uid)
      .then((v) => live && setSignedUp(v))
      .catch(() => live && setSignedUp(false));
    return () => { live = false; };
  }, [event.id, uid]);

  const over = sessionEnded(event);
  const cancelled = isEventCancelled(event);

  const signUp = async () => {
    setBusy(true);
    setError('');
    try {
      await signUpToCoach(event, uid, coachName);
      setSignedUp(true);
      refreshCoaches();
    } catch (e) {
      console.error('Sign up failed:', e);
      setError('Failed to sign up. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const base = 'px-6 py-3 rounded-lg text-sm font-semibold';
  let action: React.ReactNode;
  if (signedUp === null) action = <span className={`${base} bg-white/10 text-white/40`}>…</span>;
  else if (cancelled) action = <span className={`${base} bg-white/10 text-white/50`}>Cancelled</span>;
  else if (signedUp) action = <span className={`${base} bg-white/10 text-white`}>✓ Signed Up</span>;
  else if (over) action = <span className={`${base} bg-white/10 text-white/50`}>Event Ended</span>;
  else {
    action = (
      <button type="button" onClick={signUp} disabled={busy} className={`${base} bg-white text-black hover:bg-white/85 disabled:opacity-50`}>
        {busy ? 'Signing up…' : 'Sign Up'}
      </button>
    );
  }

  return (
    <div className="mt-6 pt-5 border-t border-white/10 flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="text-white font-semibold">Coach this session</p>
        <p className="text-gray-400 text-sm mt-0.5">
          {signedUp ? 'You’re signed up to coach it.' : over ? 'This session is over.' : 'Sign up and you’ll be reminded to take attendance when it starts.'}
        </p>
        {error && <p className="text-red-400 text-sm mt-1">{error}</p>}
      </div>
      <div className="flex items-center gap-3">
        {signedUp && (
          <Link
            to={`/coach/session/${encodeURIComponent(event.id)}`}
            state={{ event }}
            onClick={close}
            className="text-white text-sm underline underline-offset-4 hover:text-gray-300"
          >
            Open session
          </Link>
        )}
        {action}
      </div>
    </div>
  );
};

const CoachCalendarPage = () => (
  <div>
    <AccountPageHeader title="Calendar" />
    <CalendarView
      embedded
      eventExtra={(event, { close, refreshCoaches }) => (
        <CoachSignUp key={event.id} event={event} close={close} refreshCoaches={refreshCoaches} />
      )}
    />
  </div>
);

export default CoachCalendarPage;
