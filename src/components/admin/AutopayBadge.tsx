// Autopay on/off, as the monthly autopay run sees it (functions/autopay-monthly):
// the `autoPay` field on a profile is "true" when on. A proxy child is always
// charged to their parent; a real player linked to a parent (linkedParentId) is
// charged to the parent when the parent has autopay on, otherwise to themselves
// if they have it on.

export type AutopayState = { on: boolean; via: 'self' | 'parent' | null };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Profile = Record<string, any>;

export const autopayOn = (profile: Profile | null | undefined) => profile?.autoPay === 'true';

export function playerAutopay(
  player: Profile,
  parentAutopayById: Record<string, boolean>,
): AutopayState {
  if (player.isProxy) {
    const on = !!(player.parentUserId && parentAutopayById[player.parentUserId]);
    return { on, via: on ? 'parent' : null };
  }
  if (player.linkedParentId && parentAutopayById[player.linkedParentId]) return { on: true, via: 'parent' };
  if (autopayOn(player)) return { on: true, via: 'self' };
  return { on: false, via: null };
}

export type AutopayFilter = 'all' | 'on' | 'off';

export const AutopayBadge = ({ state }: { state: AutopayState }) =>
  state.on ? (
    <span className="inline-flex items-center gap-1.5 bg-green-500/20 text-green-400 border border-green-500/30 rounded-full px-2.5 py-0.5 text-[12px] font-medium whitespace-nowrap">
      <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
      On{state.via === 'parent' ? ' · parent' : ''}
    </span>
  ) : (
    <span className="inline-flex items-center bg-white/[0.06] text-white/40 border border-white/[0.08] rounded-full px-2.5 py-0.5 text-[12px] font-medium">
      Off
    </span>
  );

/** All / Autopay on / Autopay off chips, with counts. */
export const AutopayFilterChips = ({
  value, onChange, onCount, offCount,
}: { value: AutopayFilter; onChange: (v: AutopayFilter) => void; onCount: number; offCount: number }) => (
  <div className="flex gap-2">
    {([
      ['all', 'All'],
      ['on', `Autopay on · ${onCount}`],
      ['off', `Autopay off · ${offCount}`],
    ] as [AutopayFilter, string][]).map(([v, label]) => (
      <button key={v} type="button" onClick={() => onChange(v)}
        className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
          value === v ? 'bg-white text-black' : 'bg-white/[0.06] text-white/50 hover:bg-white/10'
        }`}>
        {label}
      </button>
    ))}
  </div>
);
