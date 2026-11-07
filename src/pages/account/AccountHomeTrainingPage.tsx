import { useMemo, useState } from 'react';
import { useAccount } from './AccountContext';
import { AccountPageHeader, AccountSpinner } from './AccountLayout';
import { FITNESS_CARDS, TECHNICAL_CARDS, type IconKey, type TrainingCard } from '../../constants/homeTrainingData';

// At-Home Training, as in the app (HomeTrainingScreen): Technical / Fitness
// tabs, a search box and the drill cards. Still in progress in the app too,
// so it's open to admins only for now; everyone else sees it locked in the
// account menu.

const ASSETS = '/assets/home-training';
const THUMB: Record<IconKey, string> = {
  onevones: '1v1s',
  passing: 'passing',
  dribbling: 'dribbling',
  shooting: 'shooting',
  juggling: 'juggling',
  running: 'running',
  situps: 'situps',
  pushups: 'pushups',
  jumping: 'jumping',
  stretching: 'stretching',
};

const peopleIcon = (people: string) => {
  const p = people.toLowerCase();
  if (p.includes('individual') || p.includes('1')) return 'individual';
  if (p.startsWith('2')) return 'twoPerson';
  return 'threeFour';
};

// The app tints its tag icons light grey; a CSS mask does the same here.
const TagPill = ({ icon, label }: { icon: string; label: string }) => (
  <span className="inline-flex items-center gap-1 whitespace-nowrap">
    <span
      aria-hidden="true"
      className="w-3 h-3 flex-shrink-0 bg-[#bbb]"
      style={{
        WebkitMaskImage: `url(${ASSETS}/${icon}.png)`,
        maskImage: `url(${ASSETS}/${icon}.png)`,
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
      }}
    />
    <span className="text-[#bbb] text-[11px]">{label}</span>
  </span>
);

const Card = ({ card }: { card: TrainingCard }) => (
  <div className="flex items-center bg-[#111] border border-[#222] rounded-[14px] p-2.5 min-w-0">
    <div className="w-[52px] h-[52px] rounded-lg bg-white mr-3 overflow-hidden flex-shrink-0">
      <img src={`${ASSETS}/${THUMB[card.icon]}.png`} alt="" className="w-full h-full object-cover" />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-[#888] text-[11px] mb-0.5">{card.level}</p>
      <p className="text-white text-[15px] leading-snug mb-1.5 line-clamp-2">{card.name}</p>
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <TagPill icon="time" label={`${card.durationMinutes} min`} />
        <TagPill icon={peopleIcon(card.people)} label={card.people} />
        <TagPill icon="equipment" label={card.equipment} />
      </div>
    </div>
  </div>
);

type Tab = 'technical' | 'fitness';

const AccountHomeTrainingPage = () => {
  const { loading, isAdmin } = useAccount();
  const [tab, setTab] = useState<Tab>('technical');
  const [query, setQuery] = useState('');

  const cards = useMemo(() => {
    const list = tab === 'technical' ? TECHNICAL_CARDS : FITNESS_CARDS;
    const q = query.trim().toLowerCase();
    return q ? list.filter((c) => c.name.toLowerCase().includes(q)) : list;
  }, [tab, query]);

  if (loading) return <AccountSpinner />;
  if (!isAdmin) {
    return (
      <div>
        <AccountPageHeader title="At-Home Training" />
        <div className="bg-[#111] border border-[#222] rounded-2xl p-10 text-center">
          <p className="text-white font-medium">Coming soon</p>
          <p className="text-[#888] text-sm mt-1">At-home training drills are on their way.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <AccountPageHeader title="At-Home Training" />

      {/* Tabs with the sliding underline */}
      <div className="relative flex mb-4 max-w-xl">
        {(['technical', 'fitness'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 pb-3 text-base transition-colors ${tab === t ? 'text-white font-bold' : 'text-[#777]'}`}
          >
            {t === 'technical' ? 'Technical' : 'Fitness'}
          </button>
        ))}
        <span
          className="absolute bottom-0 left-0 h-[3px] w-1/2 bg-white transition-transform duration-300 ease-out"
          style={{ transform: tab === 'fitness' ? 'translateX(100%)' : 'translateX(0)' }}
        />
      </div>

      {/* Search */}
      <div className="flex items-center border-b border-white mb-6 max-w-xl">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search"
          className="flex-1 bg-transparent text-white text-[15px] py-2.5 placeholder:text-[#666] focus:outline-none"
        />
        <svg className="w-[18px] h-[18px] text-white ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="7" strokeWidth={2} />
          <path strokeLinecap="round" strokeWidth={2} d="M20 20l-3.5-3.5" />
        </svg>
      </div>

      {cards.length === 0 ? (
        <p className="text-[#888] text-sm">No drills match “{query}”.</p>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
          {cards.map((c) => <Card key={c.id} card={c} />)}
        </div>
      )}
    </div>
  );
};

export default AccountHomeTrainingPage;
