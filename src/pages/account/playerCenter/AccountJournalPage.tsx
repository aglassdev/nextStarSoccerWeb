import { useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { AccountPageHeader } from '../AccountLayout';
import { LockedResource } from './AccountPlayerCenterPage';
import { canOpen } from '../../../services/playerCenter';

// The Next Star Soccer Journal (the PDF): its daily training, game day and
// weekly review pages as forms. View only for now: the fields can't be
// filled in yet.

const card = 'bg-[#111] border border-[#222] rounded-2xl p-5 md:p-7';
const box = 'w-full rounded-lg border border-white/10 bg-white/[0.02] text-white/40 text-sm px-3 cursor-not-allowed';

/** A labelled field; `rows` makes it a notes box. */
const Field = ({ label, rows, suffix, className = '' }: { label: string; rows?: number; suffix?: string; className?: string }) => (
  <label className={`block ${className}`}>
    <span className="block text-[#999] text-[13px] mb-1.5">{label}</span>
    {rows ? (
      <textarea disabled rows={rows} className={`${box} py-2.5 resize-none block`} />
    ) : (
      <span className="flex items-center gap-2">
        <input disabled className={`${box} h-10`} />
        {suffix && <span className="text-[#888] text-sm flex-shrink-0">{suffix}</span>}
      </span>
    )}
  </label>
);

/** "Passes completed: ___ / ___". */
const OutOf = ({ label }: { label: string }) => (
  <div>
    <span className="block text-[#999] text-[13px] mb-1.5">{label}</span>
    <span className="flex items-center gap-2">
      <input disabled aria-label={`${label}, made`} className={`${box} h-10 w-20`} />
      <span className="text-[#888]">/</span>
      <input disabled aria-label={`${label}, tried`} className={`${box} h-10 w-20`} />
    </span>
  </div>
);

const NumberedList = ({ label, count }: { label: string; count: number }) => (
  <div>
    <p className="text-[#999] text-[13px] mb-1.5">{label}</p>
    <ol className="space-y-2">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="flex items-center gap-3">
          <span className="w-4 text-[#777] text-sm tabular-nums">{i + 1}.</span>
          <input disabled aria-label={`${label} ${i + 1}`} className={`${box} h-10`} />
        </li>
      ))}
    </ol>
  </div>
);

const PageTitle = ({ children }: { children: React.ReactNode }) => (
  <p className="text-white text-xl font-bold">{children}</p>
);

const Part = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="pt-6 mt-6 border-t border-white/[0.08] first:border-0 first:pt-0 first:mt-0">
    <p className="text-white text-[13px] font-semibold uppercase tracking-[0.14em] mb-4">{title}</p>
    <div className="space-y-4">{children}</div>
  </div>
);

const Pair = ({ children }: { children: React.ReactNode }) => <div className="grid sm:grid-cols-2 gap-4">{children}</div>;

/** Passing, Tactics, Dribbling, Shooting: time, the drill, notes. */
const Drill = ({ title, kind }: { title: string; kind: string }) => (
  <Part title={title}>
    <Pair>
      <Field label="Time spent" />
      <Field label={kind} />
    </Pair>
    <Field label="Notes" rows={2} />
  </Part>
);

const DailyPages = () => (
  <div className="space-y-5">
    <div className={card}>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <PageTitle>Morning</PageTitle>
        <Field label="Date" className="w-40" />
      </div>
      <div className="space-y-4">
        <Field label="Inspirational quote" rows={2} />
        <Pair>
          <Field label="Time of wake up" />
          <Field label="Hours of sleep" />
        </Pair>
      </div>
    </div>

    <div className={card}>
      <PageTitle>Daily Training Review</PageTitle>
      <div className="grid grid-cols-3 gap-4 mt-6 mb-2 max-w-md">
        <Field label="Preparation" suffix="/10" />
        <Field label="Effort" suffix="/10" />
        <Field label="Execution" suffix="/10" />
      </div>
      <div className="mt-6">
        <Drill title="Passing" kind="Type of passing drill" />
        <Drill title="Tactics" kind="Type of tactical focus" />
        <Drill title="Dribbling" kind="Type of dribbling drill" />
        <Drill title="Shooting" kind="Type of shooting drill" />
        <Part title="Conditioning">
          <Pair>
            <Field label="Time spent" />
            <Field label="Type of exercise" />
          </Pair>
        </Part>
        <Part title="Physical">
          <Pair>
            <Field label="Time spent" />
            <Field label="Type of workout" />
          </Pair>
        </Part>
        <Drill title="Extra Individual Training" kind="Type of drill" />
        <Part title="Total">
          <Field label="Total training time" className="sm:w-1/2" />
          <Field label="Notes" rows={2} />
        </Part>
      </div>
    </div>
  </div>
);

const GameDayPages = () => (
  <div className="space-y-5">
    <div className={card}>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <PageTitle>Game Day Preparation</PageTitle>
        <Field label="Date" className="w-40" />
      </div>
      <div className="space-y-4">
        <Field label="Game opponent" className="sm:w-1/2" />
        <Field label="Inspirational quote" rows={2} />
        <Field label="Positive affirmation" />
        <Field label="Gratitude" />
      </div>
      <div className="mt-6">
        <Part title="Visualization">
          <Field label="Time spent" className="sm:w-1/2" />
          <Pair>
            <NumberedList label="Key things to focus on" count={5} />
            <NumberedList label="Process to get there" count={5} />
          </Pair>
        </Part>
      </div>
    </div>

    <div className={card}>
      <PageTitle>Game Day Review</PageTitle>
      <div className="space-y-4 mt-6">
        <Pair>
          <Field label="Result" />
          <Field label="Points" />
        </Pair>
        <Field label="Notes" rows={4} />
      </div>
      <div className="mt-6">
        <Part title="Your game">
          <div className="grid sm:grid-cols-[auto_1fr] gap-4 sm:items-end">
            <OutOf label="Passes completed" />
            <Field label="Notes" />
          </div>
          <div className="grid sm:grid-cols-[6rem_6rem_1fr] gap-4 sm:items-end">
            <Field label="Shots" />
            <Field label="On target" />
            <Field label="Notes" />
          </div>
          <div className="grid sm:grid-cols-[12.5rem_1fr] gap-4 sm:items-end">
            <Field label="Dribbles completed" />
            <Field label="Notes" />
          </div>
          <div className="grid sm:grid-cols-[auto_1fr] gap-4 sm:items-end">
            <OutOf label="Tackles / second balls won" />
            <Field label="Notes" />
          </div>
        </Part>
        <Part title="Looking back">
          <Pair>
            <NumberedList label="Areas for improvement" count={3} />
            <NumberedList label="Personal wins" count={3} />
          </Pair>
        </Part>
      </div>
    </div>
  </div>
);

const WeeklyPage = () => (
  <div className={card}>
    <PageTitle>Weekly Review</PageTitle>
    <div className="space-y-4 mt-6">
      <Pair>
        <Field label="Total hours of team training" />
        <Field label="Total hours of extra training" />
      </Pair>
      <Field label="Areas to improve on" rows={3} />
      <Field label="Areas to focus on" rows={3} />
      <Field label="Best moment this week" rows={3} />
      <Field label="Notes" rows={3} />
    </div>
  </div>
);

const TABS = [
  { id: 'daily', label: 'Daily Training', Page: DailyPages },
  { id: 'game', label: 'Game Day', Page: GameDayPages },
  { id: 'weekly', label: 'Weekly Review', Page: WeeklyPage },
] as const;

const AccountJournalPage = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('daily');
  const title = 'The Next Star Soccer Journal';
  if (!canOpen(user, 'journal')) return <LockedResource title={title} />;
  const { Page } = TABS.find((t) => t.id === tab)!;

  return (
    <div className="max-w-4xl">
      <AccountPageHeader title={title} back="/account/player-center" />

      {/* What's inside */}
      <div>
        <p className="text-white text-xl md:text-2xl font-semibold italic leading-snug">“If you cannot measure it, you cannot improve it.”</p>
        <p className="text-white/60 text-[15px] leading-relaxed mt-3 max-w-lg">
          A page for every training day and every game, and a review at the end of each week.
        </p>
        <span className="inline-block mt-4 text-[#999] text-xs border border-white/15 rounded-full px-3 py-1">
          View only for now: you can't fill it in here yet
        </span>
      </div>

      <div role="tablist" aria-label="Journal pages" className="mt-10 mb-5 flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`flex-shrink-0 h-10 px-4 rounded-full text-sm border transition-colors ${
              tab === t.id ? 'bg-white text-black border-white font-semibold' : 'border-white/15 text-white/60 hover:text-white hover:border-white/35'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Page />
    </div>
  );
};

export default AccountJournalPage;
