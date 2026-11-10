import { Link } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { AccountPageHeader } from '../AccountLayout';
import { LockIcon } from '../../../components/layout/AccountMenu';
import { RESOURCES, canOpen, type ResourceId } from '../../../services/playerCenter';

// The Player Center: the Training Program and the Journal, each locked until
// an admin unlocks it for the account.

const KICKER: Record<ResourceId, string> = { 'training-program': 'Program', journal: 'Journal' };

const AccountPlayerCenterPage = () => {
  const { user } = useAuth();

  return (
    <div>
      <AccountPageHeader title="Player Center" />
      <div className="grid md:grid-cols-2 gap-4 max-w-4xl">
        {RESOURCES.map((r) => {
          const open = canOpen(user, r.id);
          const body = (
            <div
              className={`h-full flex flex-col bg-[#111] border rounded-2xl p-6 transition-colors ${
                open ? 'border-[#222] group-hover:border-white/25' : 'border-[#1a1a1a]'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-[#888] text-[11px] font-semibold uppercase tracking-[0.18em]">{KICKER[r.id]}</p>
                {!open && (
                  <span className="inline-flex items-center gap-1.5 text-white/45 text-xs">
                    <LockIcon />
                    Locked
                  </span>
                )}
              </div>
              <p className={`text-xl font-semibold mt-3 ${open ? 'text-white' : 'text-white/45'}`}>{r.title}</p>
              <p className={`text-sm leading-relaxed mt-2 ${open ? 'text-[#999]' : 'text-[#666]'}`}>{r.blurb}</p>
              <p className={`text-sm mt-auto pt-6 ${open ? 'text-white' : 'text-white/35'}`}>
                {open ? <span className="group-hover:underline underline-offset-4">Open →</span> : 'Ask your coach to unlock it for your account.'}
              </p>
            </div>
          );
          return open ? (
            <Link key={r.id} to={r.to} className="group block">{body}</Link>
          ) : (
            <div key={r.id} aria-disabled="true">{body}</div>
          );
        })}
      </div>
    </div>
  );
};

export default AccountPlayerCenterPage;

/** Shown in place of a resource the account can't open yet. */
export const LockedResource = ({ title }: { title: string }) => (
  <div>
    <AccountPageHeader title={title} back="/account/player-center" />
    <div className="bg-[#111] border border-[#222] rounded-2xl p-10 text-center max-w-xl">
      <span className="inline-flex text-white/60 mb-3 [&_svg]:w-6 [&_svg]:h-6"><LockIcon /></span>
      <p className="text-white font-medium">Locked</p>
      <p className="text-[#888] text-sm mt-1">Ask your coach to unlock it for your account.</p>
    </div>
  </div>
);
