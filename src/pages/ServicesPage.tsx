import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navigation from '../components/layout/Navigation';
import Footer from '../components/layout/Footer';

type Action = 'request-in-app' | 'calendar' | 'camps';

interface Service {
    id: string;
    name: string;
    image?: string;           // no image yet → placeholder tile
    containImage?: boolean;   // a document, not a photo — shown whole in the detail
    price: string;
    meta: string[];
    pricing: string[];
    description: string;
    action: Action;
    isNew?: boolean;
    category?: string;        // filled in when the categories are flattened
}

interface Category { label: string; services: Service[] }

const COMING_SOON = 'Details for this service are coming soon.';

const CATEGORIES: Category[] = [
    {
        label: 'Training',
        services: [
            { id: 'individual', name: 'Individual Session', image: '/assets/images/individual.png', price: '$200', meta: ['60 min', '1 player'], pricing: ['$200 per player'], action: 'request-in-app',
              description: "Private training offers a bespoke and results-driven approach to achieving your goals. One of our professional coaches will tailor each session to your specific needs, build on your strengths, and improve your weaknesses. Whether your goal is becoming a starter for your club or school, or to reach the collegiate or professional level, our private sessions ensure your development is aligned with the world's best practices and align with your personal objectives. In addition, we provide a comprehensive training plan and regularly evaluate your progress to ensure continuous development." },
            { id: 'two-person', name: 'Two Person Session', image: '/assets/images/twoPerson.png', price: '$125', meta: ['60 min', '2 players'], pricing: ['$125 per player'], action: 'request-in-app',
              description: 'Just like individual sessions, each player is provided a personalized training program, while the semi-private dynamic fosters a more competitive environment. Players can either request the session with a partner, or we can pair them with one. We typically pair players by their current level and ability, or shared training goals. Semi-private sessions are scheduled by the client.' },
            { id: 'small-group', name: 'Small Group Session', image: '/assets/images/smallGroup.png', price: '$85', meta: ['60 min', '3–4 players'], pricing: ['$85 per player'], action: 'request-in-app',
              description: 'Small groups are still a high-quality training experience, though it is less individualized compared to a fully private session. Sessions provide a competitive environment fostering high-quality training. Just as with Two Person sessions, players can request their partners or we will pair you with a group at a similar caliber. Each session is designed with drills and games that enhance technical ability and simulate in-game scenarios, effectively meeting the needs of each player. Sessions are organized in advance and come at a more accessible price point, allowing athletes to train more frequently.' },
            { id: 'large-group', name: 'Large Group Session', image: '/assets/images/largeGroup.png', price: '$50', meta: ['120 min', '5+ players'], pricing: ['$50 per player'], action: 'calendar',
              description: 'As our most popular service, large group sessions offer quality instruction with high intensity drills and games, but with a more open atmosphere. The one-size-fits-all program allows athletes to focus on personal areas of improvement, while remaining suitable for players of various ages and skill levels. Sessions typically include drills focused on dribbling, receiving and passing, and shooting, followed by small-sided games, and occasionally fitness work. Due to club seasons, it is common for groups to be small, allowing for a more personalized experience. Sessions are held daily, and drop-ins are allowed (for registered players only). The full schedule can be found in the Calendar.' },
            { id: 'goalkeeping', name: 'Goalkeeping', price: 'TBC', meta: ['Coming soon'], pricing: ['Pricing to be confirmed'], action: 'request-in-app', isNew: true, description: COMING_SOON },
        ],
    },
    {
        label: 'Guidance & recruiting',
        services: [
            { id: 'parent-consultation', name: 'Parent Consultation', image: '/assets/images/parentConsultation.png', price: 'From $150', meta: ['60 min', 'In person or phone'], pricing: ['In person — $200', 'By phone — $150'], action: 'request-in-app',
              description: "For parents seeking additional guidance regarding a player's current skill, fitness levels, progress, academy opportunities, college recruitment process, international exposure, or anything soccer-related, a consultation offers a private setting to address all your questions. This one-on-one consultation provides an in-depth analysis of your child's current state, ensuring that all your concerns are thoroughly answered, while also providing recommendations for the next steps in their development." },
            { id: 'game-analysis', name: 'Game Analysis', image: '/assets/images/gameAnalysis.png', price: 'From $150', meta: ['In person, online or video'], pricing: ['In person — $200', 'Online meeting — $150', 'Video recording — $150'], action: 'request-in-app',
              description: "A coach breaks down a player's game — in person, over an online meeting, or as a recorded video review — and walks through what went well, what to work on, and how to carry it into training." },
            { id: 'player-report', name: 'Player Report', image: '/assets/images/playerReport.png', containImage: true, price: '$75', meta: ['After 5+ sessions'], pricing: ['$75 per player'], action: 'request-in-app',
              description: "A comprehensive written report on a player's current progress, skill, fitness, and mental state. This detailed evaluation gives you an understanding of your development, highlighting your personal strengths and areas needing improvement. The report shows both physical and technical ability, but also intangibles such as mental focus and work ethic, allowing for a holistic evaluation and helps inform future training plans." },
            { id: 'college-consulting', name: 'College Consulting', price: 'TBC', meta: ['Coming soon'], pricing: ['Pricing to be confirmed'], action: 'request-in-app', isNew: true, description: COMING_SOON },
        ],
    },
    {
        label: 'Programs & events',
        services: [
            { id: 'camps', name: 'Camps', image: '/assets/images/camps.png', price: 'Varies', meta: ['Throughout the year'], pricing: ['Varies by location and duration'], action: 'camps',
              description: 'Our specialized soccer camps offer intensive training experiences designed to accelerate player development. Led by professional coaches and former players, camps combine technical training, tactical education, and competitive play in a focused environment. Available throughout the year at various locations, our camps cater to different age groups and skill levels.' },
            { id: 'team-training', name: 'Team Training', image: '/assets/images/teamTraining.png', price: 'Custom', meta: ['Full teams', 'All levels'], pricing: ['Custom pricing based on team size'], action: 'request-in-app',
              description: "Our tailored full-team training programs deliver a dynamic and comprehensive approach to enhancing skills, refining tactics, and boosting overall team performance. Designed for teams of all levels, these sessions are fully customized to meet the unique needs of both the collective group and individual players." },
            { id: 'professional-clinics', name: 'Professional Clinics', image: '/assets/images/professionalClinics.png', price: 'Event', meta: ['Led by current and former pros'], pricing: ['Special event pricing'], action: 'request-in-app',
              description: 'Professional clinics feature current and former professional players who share their expertise and experience. These unique opportunities allow players to learn directly from those who have competed at the highest levels. Clinics cover advanced techniques, professional mentality, and insights into what it takes to succeed in professional soccer.' },
            { id: 'showcases', name: 'Showcases', image: '/assets/images/showcases.png', price: 'Event', meta: ['College coaches and scouts'], pricing: ['Event-based pricing'], action: 'request-in-app',
              description: 'Showcases provide players with opportunities to display their talents in front of college coaches, scouts, and recruiters. These events are carefully organized to maximize exposure and create pathways to the next level of competition. We guide players through the showcase process and help them make the most of these important opportunities.' },
        ],
    },
];

const ALL = CATEGORIES.flatMap(c => c.services.map(s => ({ ...s, category: c.label })));

const APP_STORE = 'https://apps.apple.com/us/app/next-star-soccer/id6754170423';
const PLAY_STORE = 'https://play.google.com/store/apps/details?id=com.nextstarsoccer.nextstar&hl=en_US';

/* ─── Shared pieces ─────────────────────────────────────────────────────────── */

const NewBadge = () => (
    <span className="rounded-full bg-white text-black text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1">New</span>
);

// A photo, or for a service that has none yet, a quiet placeholder.
const CardImage = ({ s, className = '', fit = 'cover' }: { s: Service; className?: string; fit?: 'cover' | 'contain' }) =>
    s.image ? (
        <img
            src={s.image}
            alt={s.name}
            className={`${className} ${fit === 'contain' ? 'object-contain bg-neutral-900 p-6' : 'object-cover'}`}
            loading="lazy"
            decoding="async"
        />
    ) : (
        <div className={`${className} bg-neutral-900 flex flex-col items-center justify-center gap-3`}>
            <img src="/assets/images/NextStarBall.png" alt="" className="w-10 h-10 opacity-25" />
            <span className="text-[10px] uppercase tracking-[0.18em] text-white/30">Photo coming soon</span>
        </div>
    );

const StoreBadges = () => (
    <div className="flex items-center gap-3">
        <a href={APP_STORE} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
            <img src="/assets/images/badge-app-store.svg" alt="Download on the App Store" className="h-9 w-auto" />
        </a>
        <a href={PLAY_STORE} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
            <img src="/assets/images/badge-google-play.png" alt="Get it on Google Play" className="h-9 w-auto" />
        </a>
    </div>
);

const ServiceAction = ({ action }: { action: Action }) => {
    if (action === 'calendar') return (
        <Link to="/calendar" onClick={e => e.stopPropagation()} className="inline-flex items-center gap-1.5 bg-white text-black hover:bg-white/85 px-4 py-2 rounded-full text-sm font-semibold">
            See the schedule <span aria-hidden="true">→</span>
        </Link>
    );
    if (action === 'camps') return (
        <Link to="/services/camps" onClick={e => e.stopPropagation()} className="inline-flex items-center gap-1.5 bg-white text-black hover:bg-white/85 px-4 py-2 rounded-full text-sm font-semibold">
            View camps <span aria-hidden="true">→</span>
        </Link>
    );
    return <StoreBadges />;
};

// Full details for a card that only shows a summary.
const ServiceModal = ({ s, onClose }: { s: Service; onClose: () => void }) => (
    <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
        <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-[#0e0e0e] border border-white/10 rounded-2xl" onClick={e => e.stopPropagation()}>
            <div className="relative aspect-[16/9]">
                <CardImage s={s} className="absolute inset-0 w-full h-full" fit={s.containImage ? 'contain' : 'cover'} />
                <button onClick={onClose} aria-label="Close" className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/60 text-white/80 hover:text-white flex items-center justify-center">✕</button>
            </div>
            <div className="p-6 md:p-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h2 className="text-white text-2xl font-medium tracking-[-0.02em]">{s.name}</h2>
                        <p className="mt-1.5 text-[14px] text-white/45">{s.meta.join(' · ')}</p>
                    </div>
                    <div className="text-right">
                        {s.pricing.map(p => <p key={p} className="text-[14px] text-white tabular-nums">{p}</p>)}
                    </div>
                </div>
                <p className="mt-6 text-[15px] leading-relaxed text-white/60">{s.description}</p>
                <div className="mt-8"><ServiceAction action={s.action} /></div>
            </div>
        </div>
    </div>
);

/* ─── Card grid ─────────────────────────────────────────────────────────────── */

// Rows of 2, 3, 1 and 4 cards, every card the same height. Each row lists the
// services it holds by id, so adding a service means adding it to a row, and
// anything not placed is appended in rows of three so a new service can never
// go missing from the page.
const BENTO_ROWS: string[][] = [
    ['individual', 'large-group'],
    ['two-person', 'small-group', 'goalkeeping'],
    ['camps'],
    ['parent-consultation', 'game-analysis', 'player-report', 'college-consulting'],
    ['team-training', 'professional-clinics', 'showcases'],
];

const bentoRows = () => {
    const byId = new Map(ALL.map(s => [s.id, s]));
    const placed = new Set(BENTO_ROWS.flat());
    const rows = BENTO_ROWS.map(ids => ids.map(id => byId.get(id)).filter(Boolean) as typeof ALL);
    const rest = ALL.filter(s => !placed.has(s.id));
    for (let i = 0; i < rest.length; i += 3) rows.push(rest.slice(i, i + 3));
    return rows.filter(r => r.length > 0);
};

// Columns per row size. Phones stack every card at full width — a pair of
// four-up cards is too narrow there for the label and title — and wider
// screens show each row at its full count.
const ROW_COLS: Record<number, string> = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
};
const ROW_TITLE: Record<number, string> = {
    1: 'text-[24px] md:text-[32px]',
    2: 'text-[22px] md:text-[26px]',
    3: 'text-[18px] md:text-[20px]',
    4: 'text-[16px]',
};

const LayoutBento = ({ open }: { open: (s: Service) => void }) => (
    <div className="space-y-3 md:space-y-4">
        {bentoRows().map((row, ri) => (
            <div key={ri} className={`grid gap-3 md:gap-4 ${ROW_COLS[row.length] ?? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-5'}`}>
                {row.map(s => (
                    <button
                        key={s.id}
                        onClick={() => open(s)}
                        className="group relative h-[220px] md:h-[300px] overflow-hidden rounded-2xl text-left"
                    >
                        <CardImage s={s} className="absolute inset-0 w-full h-full transition-transform duration-500 group-hover:scale-[1.03]" />
                        {/* A bright document needs a heavier shade than a photo for the text to read. */}
                        <div className={`absolute inset-0 bg-gradient-to-t ${s.containImage ? 'from-black via-black/75 to-black/30' : 'from-black/85 via-black/10 to-transparent'}`} />
                        <div className="absolute top-4 left-4">
                            {s.isNew ? <NewBadge /> : <span className="rounded-full bg-black/45 backdrop-blur-sm text-white/75 text-[10px] uppercase tracking-wider px-2.5 py-1">{s.category}</span>}
                        </div>
                        {/* On the narrow cards of a four-up row the price gets its own
                            line, so it never squeezes the details beside it. */}
                        <div className={`absolute inset-x-0 bottom-0 p-4 md:p-6 flex gap-x-3 gap-y-1.5 ${
                            row.length >= 4 ? 'flex-col items-start' : 'items-end justify-between'
                        }`}>
                            <div className="min-w-0">
                                <h3 className={`text-white font-medium tracking-[-0.01em] ${ROW_TITLE[row.length] ?? 'text-[16px]'}`}>{s.name}</h3>
                                <p className="text-white/60 text-[12px] md:text-[13px] mt-0.5">{s.meta.join(' · ')}</p>
                            </div>
                            <span className="text-white text-[14px] md:text-[15px] tabular-nums whitespace-nowrap">{s.price}</span>
                        </div>
                    </button>
                ))}
            </div>
        ))}
    </div>
);

const ServicesPage = () => {
    // A link to /services#individual opens that service straight away.
    const [openService, setOpenService] = useState<Service | null>(() => {
        const id = window.location.hash.slice(1);
        return ALL.find(s => s.id === id) ?? null;
    });

    useEffect(() => {
        const url = openService ? `#${openService.id}` : window.location.pathname;
        window.history.replaceState(null, '', url);
    }, [openService]);

    return (
        <div className="min-h-screen bg-black flex flex-col font-lt-wave">
            <Navigation />

            {/* ═══════════════════════ INTRO ═══════════════════════ */}
            <section className="pt-28 md:pt-32 pb-8 md:pb-10">
                <div className="max-w-7xl mx-auto px-6 lg:px-8">
                    <h1 className="text-white font-bold leading-none" style={{ fontSize: '29px' }}>
                        Services
                    </h1>
                </div>
            </section>

            {/* ═══════════════════════ CARDS ═══════════════════════ */}
            <section className="pb-20 md:pb-28 border-b border-white/[0.08]">
                <div className="max-w-7xl mx-auto px-6 lg:px-8">
                    <LayoutBento open={setOpenService} />
                </div>
            </section>

            {/* ═══════════════════════ BOOKING ═══════════════════════ */}
            <section className="border-b border-white/[0.08]">
                <div className="max-w-7xl mx-auto px-6 lg:px-8 py-20 md:py-28 grid md:grid-cols-2 gap-10 items-end">
                    <h2 className="text-white font-medium tracking-[-0.025em] leading-[1.05] text-[clamp(2rem,4vw,3.25rem)]">
                        Book through<br /><span className="text-white/40">the Next Star app</span>
                    </h2>
                    <div className="md:justify-self-end">
                        <p className="text-[15px] text-white/55 leading-relaxed max-w-md mb-6">
                            Create a free account to request sessions, sign up for group training and keep track
                            of a player's progress.
                        </p>
                        <StoreBadges />
                    </div>
                </div>
            </section>

            <Footer />
            {openService && <ServiceModal s={openService} onClose={() => setOpenService(null)} />}
        </div>
    );
};

export default ServicesPage;
