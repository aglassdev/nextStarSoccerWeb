import { useCallback, useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { isEventCancelled, type CalendarEvent } from '@/services/googleCalendar';
import { useAccount } from '../account/AccountContext';
import { AccountPageHeader, AccountSpinner } from '../account/AccountLayout';
import { ConfirmCancelModal, ErrorModal, Overlay } from '../account/schedule/ScheduleModals';
import { dayKeyOf, formatClock, formatDateWithOrdinal, locationName, todayKey, toInstant } from '../account/schedule/scheduleData';
import {
  canCoachCheckIn,
  cancelCoaching,
  coachCheckIn,
  fetchSessionDetail,
  requestCancellation,
  saveSessionNote,
  signUpToCoach,
  type SessionDetail,
  type SessionPerson,
} from './coachData';

// One session, the app's Event Detail and Event Dashboard together: when and
// where, the coaches (checked in or not, the head coach), the players signed
// up and checked in, the session's notes, and the coach's actions (sign up,
// check in, cancel, ask an admin to cancel the session). Player check-ins
// are still taken in the app.

const MAPS_EMBED_KEY = 'AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8';
const card = 'bg-[#111] border border-[#222] rounded-2xl';
const label = 'text-[#888] text-[12px] font-semibold uppercase tracking-[0.14em]';

/** Calendar descriptions can carry HTML; show them as text. */
const plain = (html?: string) =>
  (html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim();

const ended = (ev: CalendarEvent) =>
  ev.dateOnly ? dayKeyOf(ev.startDateTime, true) < todayKey() : toInstant(ev.endDateTime).getTime() < Date.now();

const Fact = ({ name, value, sub }: { name: string; value: React.ReactNode; sub?: string }) => (
  <div className={`${card} px-5 py-4`}>
    <p className={label}>{name}</p>
    <p className="text-white text-lg font-semibold mt-1.5 leading-snug">{value}</p>
    {sub && <p className="text-[#888] text-sm mt-0.5 truncate">{sub}</p>}
  </div>
);

const PeopleList = ({ title, people, empty }: { title: string; people: SessionPerson[]; empty: string }) => (
  <div className="min-w-0">
    <div className="flex items-center justify-between pb-3 border-b border-white/10">
      <p className="text-white font-semibold">{title}</p>
      <span className="min-w-[28px] h-7 px-2 rounded-full bg-white/10 text-white text-sm font-semibold flex items-center justify-center">{people.length}</span>
    </div>
    {people.length === 0 ? (
      <p className="text-[#777] text-sm py-4">{empty}</p>
    ) : (
      <ul className="divide-y divide-white/[0.06]">
        {people.map((p) => (
          <li key={p.key} className="py-2.5 text-white/85 text-[15px] truncate">{p.name}</li>
        ))}
      </ul>
    )}
  </div>
);

const button = 'w-full py-3 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50';

const CoachSessionPage = () => {
  const { eventId = '' } = useParams<{ eventId: string }>();
  const id = decodeURIComponent(eventId);
  const known = (useLocation().state as { event?: CalendarEvent } | null)?.event ?? null;
  const { user } = useAuth();
  const { profile } = useAccount();
  const uid = user?.$id || '';
  const coachName = (user?.name || `${profile?.firstName || ''} ${profile?.lastName || ''}`).trim();

  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [savedAt, setSavedAt] = useState('');
  const [busy, setBusy] = useState('');
  const [confirm, setConfirm] = useState<'cancel' | 'request' | null>(null);
  const [message, setMessage] = useState<{ title?: string; text: string } | null>(null);

  const load = useCallback(async () => {
    if (!uid || !id) return;
    try {
      const d = await fetchSessionDetail(id, uid, known);
      setDetail(d);
      setNote(d.note?.content || '');
      setSavedAt(d.note ? d.note.$updatedAt : '');
      setError('');
    } catch (e) {
      console.error('Session failed to load:', e);
      setError('Failed to load this session. Please try again.');
    }
  }, [id, uid]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  const run = async (key: string, fn: () => Promise<unknown>, failure: string) => {
    setBusy(key);
    try {
      await fn();
      await load();
    } catch (e) {
      console.error(e);
      setMessage({ text: failure });
    } finally {
      setBusy('');
    }
  };

  if (error) {
    return (
      <div>
        <AccountPageHeader title="Session" back="/coach" />
        <div className={`${card} p-8 text-center max-w-xl`}>
          <p className="text-white/80 text-sm">{error}</p>
          <button onClick={load} className="mt-4 text-white text-sm underline underline-offset-4">Try again</button>
        </div>
      </div>
    );
  }
  if (!detail) return <AccountSpinner />;

  const ev = detail.event;
  if (!ev) {
    return (
      <div>
        <AccountPageHeader title="Session" back="/coach" />
        <p className="text-[#888]">This session couldn't be found.</p>
      </div>
    );
  }

  const isOver = ended(ev);
  const cancelled = isEventCancelled(ev);
  const signedUp = !!detail.mySignup;
  const time = ev.dateOnly ? 'All Day' : `${formatClock(ev.startDateTime)} – ${formatClock(ev.endDateTime)}`;
  const where = locationName(ev.location) || 'TBD';
  const address = ev.location && ev.location.includes(',') ? ev.location.split(',').slice(1).join(',').trim() : '';
  const description = plain(ev.description);
  const players = detail.signedUp.length + detail.checkedIn.length;
  const noteDirty = note.trim() !== (detail.note?.content || '').trim();

  const saveNote = async () => {
    setBusy('note');
    try {
      const saved = await saveSessionNote(ev, detail.note, note.trim(), uid, coachName);
      setDetail({ ...detail, note: saved });
      setSavedAt(saved.$updatedAt || new Date().toISOString());
    } catch (e) {
      console.error(e);
      setMessage({ text: 'Failed to save the note. Please try again.' });
    } finally {
      setBusy('');
    }
  };

  return (
    <div>
      <AccountPageHeader title={ev.title || 'Untitled Event'} back="/coach" />
      <p className="-mt-5 mb-8 text-[#888] text-sm uppercase tracking-[0.14em]">
        {formatDateWithOrdinal(ev)}
        {cancelled && <span className="ml-3 text-[#f87171] font-bold">Cancelled</span>}
      </p>

      <div className="grid gap-8 lg:gap-10 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <div className="space-y-8 min-w-0">
          <div className="grid grid-cols-2 gap-3">
            <Fact name="Time" value={time} />
            <Fact name="Location" value={where} sub={address} />
            <Fact name="Coaches" value={detail.coaches.length} />
            <Fact name="Players" value={players} sub={`${detail.checkedIn.length} checked in`} />
          </div>

          {description && (
            <section>
              <p className={`${label} mb-3`}>Details</p>
              <p className="text-white/75 text-[15px] leading-relaxed whitespace-pre-line">{description}</p>
            </section>
          )}

          <section className={`${card} p-5 md:p-6`}>
            <div className="grid sm:grid-cols-2 gap-6 sm:gap-8">
              <PeopleList title="Signups" people={detail.signedUp} empty="No one waiting to check in" />
              <PeopleList title="Checkins" people={detail.checkedIn} empty="No check-ins yet" />
            </div>
            <p className="text-[#666] text-xs mt-5">Players are checked in, and walk-ins added, in the app during the session.</p>
          </section>

          <section className={`${card} p-5 md:p-6`}>
            <p className="text-white font-semibold mb-3">Session Notes</p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={5}
              placeholder="Write notes about this session..."
              className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white text-[15px] leading-relaxed placeholder:text-[#666] focus:outline-none focus:border-white/30 resize-y"
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[#777] text-xs">
                {savedAt ? `Saved · ${new Date(savedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : 'Shared with the other coaches on this session.'}
              </p>
              <button
                type="button"
                onClick={saveNote}
                disabled={busy === 'note' || !noteDirty || !note.trim()}
                className="px-5 py-2.5 rounded-lg bg-[#2563eb] text-white text-sm font-semibold hover:bg-[#1d4ed8] disabled:opacity-40"
              >
                {busy === 'note' ? 'Saving…' : 'Save Note'}
              </button>
            </div>
          </section>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24">
          {/* The coach's part in it */}
          <div className={`${card} p-5`}>
            <p className={label}>You</p>
            <p className="text-white text-[15px] mt-2">
              {cancelled
                ? 'This session was cancelled.'
                : signedUp
                  ? detail.myCheckin
                    ? 'You’re coaching this session and you’re checked in.'
                    : 'You’re coaching this session.'
                  : isOver
                    ? 'You didn’t coach this session.'
                    : 'You’re not signed up to coach this session.'}
            </p>
            {detail.mySignup?.isHeadCoach && <p className="text-[#c4b5fd] text-sm font-semibold mt-1">Head Coach</p>}

            {!cancelled && !isOver && (
              <div className="mt-5 space-y-2.5">
                {!signedUp && (
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => run('signup', () => signUpToCoach(ev, uid, coachName), 'Failed to sign up. Please try again.')}
                    className={`${button} bg-white text-black hover:bg-white/85`}
                  >
                    {busy === 'signup' ? 'Signing up…' : 'Sign Up'}
                  </button>
                )}
                {signedUp && !detail.myCheckin && canCoachCheckIn(ev) && (
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => run('checkin', () => coachCheckIn(ev, uid, coachName), 'Failed to check in. Please try again.')}
                    className={`${button} bg-white text-black hover:bg-white/85`}
                  >
                    {busy === 'checkin' ? 'Checking in…' : 'Check In'}
                  </button>
                )}
                {signedUp && !detail.myCheckin && (
                  <button type="button" disabled={!!busy} onClick={() => setConfirm('cancel')} className={`${button} border border-white/15 text-white hover:border-white/35`}>
                    Cancel My Spot
                  </button>
                )}
                {signedUp && (
                  <button type="button" disabled={!!busy} onClick={() => setConfirm('request')} className={`${button} bg-[#DC2626] text-white hover:bg-[#b91c1c]`}>
                    Cancel Event
                  </button>
                )}
              </div>
            )}
          </div>

          <div className={`${card} p-5`}>
            <p className={`${label} mb-3`}>Coaches</p>
            {detail.coaches.length === 0 ? (
              <p className="text-[#777] text-sm">No coaches signed up</p>
            ) : (
              <ul className="space-y-2.5">
                {detail.coaches.map((c) => (
                  <li key={c.userId} className="flex items-center justify-between gap-3">
                    <span className="text-white text-[15px] truncate">
                      {c.name}
                      {c.isHeadCoach && <span className="ml-2 px-1.5 py-0.5 rounded bg-[#7c3aed]/25 text-[#c4b5fd] text-[11px] font-semibold align-middle">Head Coach</span>}
                    </span>
                    <span className={`text-xs flex-shrink-0 ${c.checkedIn ? 'text-[#4ade80]' : 'text-[#777]'}`}>{c.checkedIn ? 'Checked in' : 'Not checked in'}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {ev.location && (
            <div className={`${card} overflow-hidden`}>
              <div className="aspect-[4/3] bg-neutral-900">
                <iframe
                  title={`Map of ${where}`}
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  src={`https://www.google.com/maps/embed/v1/place?key=${MAPS_EMBED_KEY}&q=${encodeURIComponent(ev.location)}&maptype=satellite`}
                  loading="lazy"
                  allowFullScreen
                />
              </div>
              <div className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-white text-[15px] font-medium truncate">{where}</p>
                  {address && <p className="text-[#888] text-sm truncate">{address}</p>}
                </div>
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(ev.location)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 px-3.5 py-1.5 rounded-full border border-white/20 text-white text-sm hover:border-white/40"
                >
                  Directions
                </a>
              </div>
            </div>
          )}
        </aside>
      </div>

      {confirm === 'cancel' && (
        <ConfirmCancelModal
          busy={busy === 'cancel'}
          onClose={() => !busy && setConfirm(null)}
          onConfirm={async () => {
            await run('cancel', () => cancelCoaching(ev.id, uid), 'Failed to cancel. Please try again.');
            setConfirm(null);
          }}
        />
      )}

      {confirm === 'request' && (
        <Overlay onClose={() => !busy && setConfirm(null)} locked={busy === 'request'}>
          <div className="w-full max-w-md bg-[#1e1e1e] rounded-2xl p-6">
            <p className="text-[#f87171] text-lg font-bold text-center">WARNING</p>
            <p className="text-white text-[15px] text-center mt-3">Only ask to cancel this event for one of these reasons:</p>
            <ul className="mt-4 space-y-2 text-white/80 text-sm list-disc pl-5">
              <li>No players have shown up 15 minutes after the start time</li>
              <li>Field or weather restrictions</li>
              <li>A coach or player emergency</li>
            </ul>
            <p className="text-[#888] text-xs mt-4 text-center">An admin reviews the request and cancels the session.</p>
            <div className="flex gap-3 mt-6">
              <button type="button" onClick={() => setConfirm(null)} disabled={busy === 'request'} className="flex-1 py-3 rounded-lg text-white hover:bg-white/5 disabled:opacity-50">
                Back
              </button>
              <button
                type="button"
                disabled={busy === 'request'}
                onClick={async () => {
                  setBusy('request');
                  try {
                    await requestCancellation(ev, uid, coachName);
                    setConfirm(null);
                    setMessage({ title: 'Request Submitted', text: 'Your cancellation request has been sent. An admin will review and process your request.' });
                  } catch (e) {
                    console.error(e);
                    setMessage({ text: 'Failed to send the request. Please try again.' });
                  } finally {
                    setBusy('');
                  }
                }}
                className="flex-1 py-3 rounded-lg bg-[#DC2626] text-white font-semibold hover:bg-[#b91c1c] disabled:opacity-50"
              >
                {busy === 'request' ? 'Sending…' : 'Request Cancellation'}
              </button>
            </div>
          </div>
        </Overlay>
      )}

      {message && <ErrorModal title={message.title} message={message.text} onClose={() => setMessage(null)} />}
    </div>
  );
};

export default CoachSessionPage;
