import { Fragment, useEffect, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { AccountPageHeader, AccountSpinner } from '../AccountLayout';
import { LockedResource } from './AccountPlayerCenterPage';
import {
  canOpen,
  loadTrainingProgram,
  type ProgramGroup,
  type ProgramQuote,
  type ProgramSection,
  type TrainingProgram,
} from '../../../services/playerCenter';

// The Training Program 2026 (Paul Torres's PDF) as a page: the philosophy and
// the coach's note, the week day by day, then conditioning, wellness, goals,
// the mental game, recovery, positions and the self-assessment log. The
// content comes from the account-resources function (unlocked accounts only).

/** "*TIMED* on either day": the PDF's *starred* words, emphasised. */
const Rich = ({ text }: { text: string }) => (
  <>
    {text.split(/(\*[^*]+\*)/).map((part, i) =>
      part.startsWith('*') && part.endsWith('*') && part.length > 2
        ? <em key={i} className="not-italic font-semibold text-white">{part.slice(1, -1)}</em>
        : <Fragment key={i}>{part}</Fragment>,
    )}
  </>
);

/** "Hamstrings: 20-30 seconds each leg" → "Hamstrings" in bold; long sentences stay as they are. */
const Item = ({ text }: { text: string }) => {
  const i = text.indexOf(': ');
  const label = i > 0 && i <= 30 && !text.slice(0, i).includes(',') ? text.slice(0, i) : null;
  return label ? (
    <><span className="text-white font-medium">{label}:</span> <Rich text={text.slice(i + 2)} /></>
  ) : (
    <Rich text={text} />
  );
};

const Quote = ({ quote, className = '' }: { quote: ProgramQuote; className?: string }) => (
  <figure className={`text-center max-w-2xl mx-auto ${className}`}>
    <blockquote className="text-white/75 text-[17px] italic leading-relaxed">“{quote.text}”</blockquote>
    <figcaption className="text-[#888] text-xs uppercase tracking-[0.18em] mt-3">{quote.by}</figcaption>
  </figure>
);

const card = 'bg-[#111] border border-[#222] rounded-2xl';

const GroupCard = ({ group }: { group: ProgramGroup }) => (
  <div className={`${card} p-5 md:p-6`}>
    <p className="text-white text-[13px] font-semibold uppercase tracking-[0.14em]">{group.title}</p>
    {group.subtitle && <p className="text-[#888] text-xs mt-1">{group.subtitle}</p>}
    <ul className="mt-4 space-y-2.5">
      {group.items.map((it) => (
        <li key={it} className="flex gap-3 text-white/70 text-[15px] leading-relaxed">
          <span aria-hidden="true" className="mt-[11px] w-1 h-1 rounded-full bg-white/40 flex-shrink-0" />
          <span><Item text={it} /></span>
        </li>
      ))}
    </ul>
  </div>
);

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-white text-2xl md:text-[28px] font-bold">{children}</h3>
);

const Section = ({ section }: { section: ProgramSection }) => (
  <section id={section.id} className="scroll-mt-36 pt-16">
    <SectionTitle>{section.title}</SectionTitle>
    {section.quoteTop && <Quote quote={section.quoteTop} className="mt-6 mb-2" />}
    {section.intro && <p className="text-white/60 text-[15px] leading-relaxed mt-3 max-w-3xl">{section.intro}</p>}
    <div className={`grid gap-4 mt-6 ${section.groups.length === 3 ? 'lg:grid-cols-3' : 'md:grid-cols-2'}`}>
      {section.groups.map((g) => (
        <Fragment key={g.title}>
          {g.before && (
            <p className={`italic text-[#888] text-sm pt-2 ${section.groups.length === 3 ? 'lg:col-span-3' : 'md:col-span-2'}`}>{g.before}</p>
          )}
          <GroupCard group={g} />
        </Fragment>
      ))}
    </div>
    {section.quote && <Quote quote={section.quote} className="mt-10" />}
  </section>
);

// Monday → 0 … Friday → 4; the weekend shares one page.
const todayIndex = () => {
  const d = new Date().getDay();
  return d === 0 || d === 6 ? 5 : d - 1;
};

const Week = ({ program }: { program: TrainingProgram }) => {
  const [i, setI] = useState(() => Math.min(todayIndex(), program.week.length - 1));
  const day = program.week[i];
  return (
    <section id="week" className="scroll-mt-36 pt-16">
      <SectionTitle>The Week</SectionTitle>
      <div role="tablist" aria-label="Day" className="mt-5 flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {program.week.map((d, j) => (
          <button
            key={d.day}
            role="tab"
            aria-selected={j === i}
            onClick={() => setI(j)}
            className={`flex-shrink-0 h-10 px-4 rounded-full text-sm border transition-colors ${
              j === i ? 'bg-white text-black border-white font-semibold' : 'border-white/15 text-white/60 hover:text-white hover:border-white/35'
            }`}
          >
            {d.short}
          </button>
        ))}
      </div>

      <div className={`${card} mt-5 p-5 md:p-8`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-white text-xl md:text-2xl font-bold">{day.day}</p>
          {day.note && <p className="italic text-[#888] text-sm">{day.note}</p>}
        </div>
        <ol className="mt-6 divide-y divide-white/[0.08]">
          {day.blocks.map((b, n) => (
            <li key={n} className="flex gap-5 py-5 first:pt-0 last:pb-0">
              <span className="w-8 flex-shrink-0 text-white text-[28px] font-bold leading-none tabular-nums">{n + 1}</span>
              <div className="min-w-0 pt-0.5">
                {b.title && <p className="text-white text-[13px] font-semibold uppercase tracking-[0.14em] mb-2">{b.title}</p>}
                <ul className="space-y-1.5">
                  {b.lines.map((l) => (
                    <li key={l} className="text-white/70 text-[15px] leading-relaxed"><Rich text={l} /></li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
};

const SelfAssessment = ({ program }: { program: TrainingProgram }) => {
  const s = program.selfAssessment;
  return (
    <section id="self-assessment" className="scroll-mt-36 pt-16">
      <SectionTitle>{s.title}</SectionTitle>
      <p className="text-white/60 text-[15px] leading-relaxed mt-3 max-w-3xl">{s.intro}</p>
      <div className={`${card} mt-6 overflow-x-auto`}>
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left text-[#888] text-[11px] font-semibold uppercase tracking-[0.14em] px-5 py-3.5">Category</th>
              {Array.from({ length: s.weeks }, (_, w) => (
                <th key={w} className="text-[#888] text-[11px] font-semibold uppercase tracking-[0.14em] px-3 py-3.5 w-[16%]">Week {w + 1}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {s.categories.map((c) => (
              <tr key={c} className="border-b border-white/[0.06] last:border-0">
                <td className="text-white/80 px-5 py-3">{c}</td>
                {Array.from({ length: s.weeks }, (_, w) => (
                  <td key={w} className="px-3 py-3 text-center text-white/15">–</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-white text-[13px] font-semibold uppercase tracking-[0.14em] mt-8">{s.focusLabel}</p>
      <div className="mt-2 max-w-3xl">
        {[0, 1, 2].map((n) => <div key={n} className="h-10 border-b border-white/10" />)}
      </div>
    </section>
  );
};

const NAV = (program: TrainingProgram) => [
  { id: 'philosophy', label: 'Philosophy' },
  { id: 'week', label: 'The Week' },
  ...program.sections.map((s) => ({ id: s.id, label: s.title.replace('Physical ', '').replace(' & Recovery', '').replace('Position-Specific Tips', 'Positions') })),
  { id: 'self-assessment', label: 'Self-Assessment' },
];

const AccountTrainingProgramPage = () => {
  const { user } = useAuth();
  const allowed = canOpen(user, 'training-program');
  const [program, setProgram] = useState<TrainingProgram | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!allowed) return;
    let live = true;
    setError('');
    loadTrainingProgram()
      .then((p) => live && setProgram(p))
      .catch((e) => live && setError(e.message));
    return () => { live = false; };
  }, [allowed, attempt]);

  const title = 'Training Program 2026';
  if (!allowed) return <LockedResource title={title} />;
  if (error) {
    return (
      <div>
        <AccountPageHeader title={title} back="/account/player-center" />
        <div className={`${card} p-8 text-center max-w-xl`}>
          <p className="text-white/80 text-sm">{error}</p>
          <button onClick={() => setAttempt((a) => a + 1)} className="mt-4 text-white text-sm underline underline-offset-4">Try again</button>
        </div>
      </div>
    );
  }
  if (!program) return <AccountSpinner />;

  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="max-w-5xl">
      <AccountPageHeader title={title} back="/account/player-center" />
      <p className="-mt-5 text-[#888] text-sm">Next Star Soccer · {program.contact.name}</p>

      {/* The program's parts, kept in reach as the page scrolls */}
      <nav aria-label="Training Program" className="sticky top-16 z-10 -mx-1 mt-6 bg-black/95 backdrop-blur py-3">
        <div className="flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {NAV(program).map((n) => (
            <button
              key={n.id}
              onClick={() => jump(n.id)}
              className="flex-shrink-0 h-8 px-3.5 rounded-full border border-white/12 text-white/60 text-[13px] hover:text-white hover:border-white/35 transition-colors"
            >
              {n.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Philosophy and the coach's note */}
      <section id="philosophy" className="scroll-mt-36 pt-10">
        <SectionTitle>Philosophy</SectionTitle>
        <figure className="mt-6">
          <blockquote className="text-white/80 text-[17px] md:text-[19px] italic leading-[1.75]">
            <span aria-hidden="true" className="block text-white/25 text-6xl leading-none not-italic -mb-3">“</span>
            {program.philosophy.quote}
          </blockquote>
          <figcaption className="text-[#888] text-xs uppercase tracking-[0.18em] mt-5">{program.philosophy.by}</figcaption>
        </figure>

        <div className={`${card} mt-10 p-6 md:p-8`}>
          <p className="text-white text-[13px] font-semibold uppercase tracking-[0.14em]">{program.note.title}</p>
          <p className="text-white/75 text-[15px] md:text-base leading-relaxed mt-4">{program.note.text}</p>
          <p className="text-white/75 italic mt-4">{program.note.signoff}</p>
          <p className="text-white text-sm font-medium mt-5">— {program.contact.name}</p>
        </div>
      </section>

      <Week program={program} />

      {program.sections.map((s) => <Section key={s.id} section={s} />)}

      <SelfAssessment program={program} />

      <Quote quote={program.closing} className="mt-20" />

      <footer className="mt-16 pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <p className="text-white/70 text-sm">
          {program.contact.name} ·{' '}
          <a href={`tel:${program.contact.phone.replace(/\D/g, '')}`} className="hover:text-white underline-offset-4 hover:underline">{program.contact.phone}</a> ·{' '}
          <a href={`mailto:${program.contact.email}`} className="hover:text-white underline-offset-4 hover:underline">{program.contact.email}</a>
        </p>
        <p className="text-[#666] text-xs max-w-md">{program.disclaimer}</p>
      </footer>
    </div>
  );
};

export default AccountTrainingProgramPage;
