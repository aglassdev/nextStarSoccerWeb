import { useEffect, useState } from 'react';
import { RESOURCES, getUnlocks, setUnlocked, type ResourceId, type Unlocks } from '../../services/playerCenter';

// Admin Controls for the Player Center: lock or unlock the Training Program
// and the Journal for one account. The account sees the change the next
// time it opens the website.

const PlayerCenterAccess = ({ userId }: { userId?: string }) => {
  const [unlocks, setUnlocks] = useState<Unlocks | null>(null);
  const [busy, setBusy] = useState<ResourceId | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!userId) return;
    let live = true;
    setUnlocks(null);
    setError('');
    getUnlocks(userId)
      .then((u) => live && setUnlocks(u))
      .catch((e) => live && setError(e.message));
    return () => { live = false; };
  }, [userId]);

  const toggle = async (id: ResourceId) => {
    if (!userId || !unlocks) return;
    setBusy(id);
    setError('');
    try {
      setUnlocks(await setUnlocked(userId, id, !unlocks[id]));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="bg-[#1d1c21] border border-white/[0.08] rounded-xl p-5">
      <p className="text-white/50 text-[11px] font-medium tracking-widest uppercase mb-4">Player Center</p>
      {!userId ? (
        <p className="text-white/30 text-sm">No website account to unlock.</p>
      ) : (
        <div className="space-y-3">
          {RESOURCES.map((r) => {
            const on = !!unlocks?.[r.id];
            return (
              <div key={r.id} className="flex items-center justify-between gap-3">
                <span className="text-white/80 text-sm">{r.title.replace(' 2026', '').replace('The Next Star Soccer ', '')}</span>
                <button
                  onClick={() => toggle(r.id)}
                  disabled={!unlocks || busy !== null}
                  role="switch"
                  aria-checked={on}
                  aria-label={`${r.title}: ${on ? 'unlocked' : 'locked'}`}
                  className={`flex-shrink-0 px-3 py-1.5 rounded text-[11px] font-medium border transition-all min-w-[84px] ${
                    on ? 'bg-white/10 border-white/40 text-white' : 'bg-white/[0.04] border-white/10 text-white/45 hover:text-white hover:border-white/25'
                  } disabled:cursor-not-allowed`}
                >
                  {!unlocks ? '…' : busy === r.id ? 'Saving…' : on ? 'Unlocked' : 'Locked'}
                </button>
              </div>
            );
          })}
          {error && <p className="text-red-400 text-xs">{error}</p>}
        </div>
      )}
    </div>
  );
};

export default PlayerCenterAccess;
