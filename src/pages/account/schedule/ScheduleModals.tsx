import { useEffect, useState } from 'react';
import { isEventCancelled } from '@/services/googleCalendar';
import type { ParentChild } from '@/services/clinicRegistration';
import { formatClock, formatDateWithOrdinal, locationName, resolveCoachName, toInstant, type ScheduleEvent } from './scheduleData';

// The dialogs My Sessions opens, styled as the app's: the cancel confirmation,
// the parent's player picker, error alerts, and (standing in for the app's
// event page) a session's details.

const useDialog = (onClose: () => void, locked = false) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !locked) onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, locked]);
};

const Overlay = ({ onClose, dim = 'bg-black/70', children, locked }: { onClose: () => void; dim?: string; children: React.ReactNode; locked?: boolean }) => {
  useDialog(onClose, locked);
  return (
    <div className={`fixed inset-0 z-[60] flex items-center justify-center px-6 ${dim}`} onClick={locked ? undefined : onClose}>
      <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} className="w-full flex justify-center">
        {children}
      </div>
    </div>
  );
};

/** Non-parents: "Confirm event cancellation?" */
export const ConfirmCancelModal = ({ busy, onClose, onConfirm }: { busy: boolean; onClose: () => void; onConfirm: () => void }) => (
  <Overlay onClose={onClose} locked={busy}>
    <div className="w-full max-w-sm bg-[#1e1e1e] rounded-2xl p-6">
      <p className="text-white text-lg font-bold text-center mb-6">Confirm event cancellation?</p>
      <div className="flex gap-3">
        <button type="button" onClick={onClose} disabled={busy} className="flex-1 py-3 rounded-lg text-white text-base hover:bg-white/5 disabled:opacity-50">
          Cancel
        </button>
        <button type="button" onClick={onConfirm} disabled={busy} className="flex-1 py-3 rounded-lg text-white text-base hover:bg-white/5 disabled:opacity-50">
          {busy ? 'Cancelling…' : 'Confirm'}
        </button>
      </div>
    </div>
  </Overlay>
);

/** Parents: pick which players to take off the session (signed-up players start selected). */
export const ChildSelectionModal = ({
  players,
  initialSelected,
  busy,
  onClose,
  onConfirm,
}: {
  players: ParentChild[];
  initialSelected: string[];
  busy: boolean;
  onClose: () => void;
  onConfirm: (ids: string[]) => void;
}) => {
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const toggle = (id: string) => setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  return (
    <Overlay onClose={onClose} dim="bg-black/80" locked={busy}>
      <div className="w-full max-w-[400px] max-h-[70vh] flex flex-col bg-[#1e1e1e] rounded-2xl p-6">
        <div className="max-h-[300px] overflow-y-auto flex flex-col gap-3">
          {players.map((c) => {
            const on = selected.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggle(c.id)}
                aria-pressed={on}
                disabled={busy}
                className={`py-4 px-4 rounded-lg border text-base text-center transition-colors ${
                  on ? 'bg-[#F4F2EE] border-[#F4F2EE] text-[#666]' : 'bg-[#1e1e1e] border-white text-white hover:bg-white/5'
                }`}
              >
                {c.firstName} {c.lastName}
              </button>
            );
          })}
        </div>
        <div className="flex gap-3 mt-6">
          <button type="button" onClick={onClose} disabled={busy} className="flex-1 py-3.5 rounded-lg text-white text-base font-medium hover:bg-white/5 disabled:opacity-50">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(selected)}
            disabled={selected.length === 0 || busy}
            className="flex-1 py-3.5 rounded-lg text-white text-base font-medium hover:bg-white/5 disabled:opacity-50 disabled:hover:bg-transparent"
          >
            {busy ? 'Cancelling…' : 'Confirm'}
          </button>
        </div>
      </div>
    </Overlay>
  );
};

/** The app's Alert.alert("Error", …). */
export const ErrorModal = ({ message, onClose }: { message: string; onClose: () => void }) => (
  <Overlay onClose={onClose}>
    <div className="w-full max-w-sm bg-[#1e1e1e] rounded-2xl p-6 text-center">
      <p className="text-white text-lg font-bold mb-2">Error</p>
      <p className="text-[#aaa] text-base mb-6">{message}</p>
      <button type="button" onClick={onClose} className="w-full py-3 rounded-lg text-white text-base font-medium hover:bg-white/5">
        OK
      </button>
    </div>
  </Overlay>
);

/**
 * A session's details: in the app, tapping a card opens the event page; on
 * the website it opens here, with the same date line, title, time / location
 * / coach box, details and map.
 */
export const EventDetailsModal = ({ event, players, onClose }: { event: ScheduleEvent; players: string[]; onClose: () => void }) => {
  const [coach, setCoach] = useState<string | null | undefined>(undefined);
  const cancelled = isEventCancelled(event);
  const isCamp = (event.title || '').toLowerCase().includes('camp');

  useEffect(() => {
    let live = true;
    resolveCoachName(event).then((n) => live && setCoach(n));
    return () => {
      live = false;
    };
  }, [event]);

  // The coach shows as TBD until 24 hours before the start, as in the app.
  const startMs = toInstant(event.startDateTime).getTime();
  const revealed = Number.isFinite(startMs) && Date.now() >= startMs - 24 * 60 * 60 * 1000;
  const coachDisplay = coach === undefined ? '…' : revealed ? coach || 'TBD' : 'TBD';
  const showDetails = !!event.description && !cancelled && isCamp;
  const mapsUrl = event.location ? `https://maps.google.com/?q=${encodeURIComponent(event.location)}` : '';

  return (
    <Overlay onClose={onClose}>
      <div className="relative w-full max-w-xl max-h-[88vh] overflow-y-auto bg-[#111] border border-[#222] rounded-2xl p-6 md:p-8">
        <button type="button" onClick={onClose} aria-label="Close" className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full text-[#888] hover:text-white hover:bg-white/10">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <p className="text-white text-[13px] font-medium uppercase tracking-[2px] mb-2 pr-10">{formatDateWithOrdinal(event)}</p>
        <h3 className="text-white text-[28px] md:text-[32px] leading-tight font-bold mb-6 pr-6">{event.title || 'Untitled Event'}</h3>

        {cancelled && (
          <div className="mb-6 py-2.5 bg-[#DC2626] rounded-xl text-center text-white text-lg font-bold tracking-[2px]">CANCELLED</div>
        )}

        <div className="border border-white/25 rounded-xl overflow-hidden mb-6">
          <div className="flex">
            <div className="flex-1 py-3.5 px-3 border-r border-white/25 flex flex-col items-center justify-center text-center">
              {event.dateOnly ? (
                <span className="text-white text-sm font-medium">All Day</span>
              ) : (
                <>
                  <span className="text-white text-sm font-medium">{formatClock(event.startDateTime)}</span>
                  <span className="text-white/40 text-[10px] my-0.5">to</span>
                  <span className="text-white text-sm font-medium">{formatClock(event.endDateTime)}</span>
                </>
              )}
            </div>
            <div className="flex-1 py-3.5 px-3 flex flex-col items-center justify-center text-center">
              <span className="text-white text-sm font-medium line-clamp-2 mb-1">{locationName(event.location) || 'TBD'}</span>
              <span className="text-white/40 text-[10px]">Location</span>
            </div>
          </div>
          {!cancelled && (
            <div className="border-t border-white/25 py-3.5 px-3 flex flex-col items-center text-center">
              <span className="text-white text-sm font-medium line-clamp-2 mb-1">{coachDisplay}</span>
              <span className="text-white/40 text-[10px] uppercase tracking-[1px]">Coach</span>
            </div>
          )}
        </div>

        {players.length > 0 && (
          <div className="mb-6">
            <p className="text-white/50 text-[13px] font-medium uppercase tracking-[1px] mb-2">Players</p>
            <p className="text-white text-base font-bold">{players.join(', ')}</p>
          </div>
        )}

        {showDetails && (
          <div className="mb-6">
            <p className="text-white/50 text-[13px] font-medium uppercase tracking-[1px] mb-2">Details</p>
            <p className="text-white/85 text-base leading-6 whitespace-pre-line">{event.description}</p>
          </div>
        )}

        {event.location && (
          <div className="bg-[#1a1a1a] rounded-2xl overflow-hidden">
            <div className="h-40 md:h-48 bg-[#1f2937]">
              <iframe
                title={`Map of ${locationName(event.location)}`}
                src={`https://maps.google.com/maps?q=${encodeURIComponent(event.location)}&t=k&z=16&output=embed`}
                className="w-full h-full border-0 pointer-events-none"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
            <div className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="text-white text-base font-medium truncate">{locationName(event.location)}</p>
                <p className="text-white/50 text-[13px] truncate">{event.location}</p>
              </div>
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 bg-[#F4F2EE] hover:bg-white text-black text-sm font-medium px-4 py-2 rounded-full"
              >
                Directions
              </a>
            </div>
          </div>
        )}
      </div>
    </Overlay>
  );
};
