import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Navigation from '../components/layout/Navigation';
import Footer from '../components/layout/Footer';

type Action = 'request-in-app' | 'calendar' | 'camps';

interface Service {
    id: string;
    name: string;
    image: string;
    // Screenshots and graphics rather than photos — shown whole, not cropped.
    containImage?: boolean;
    price: string;          // short form for the list
    meta: string[];         // duration, group size, format
    pricing: string[];      // every price line, for the detail
    description: string;
    action: Action;
}

interface Category {
    label: string;
    services: Service[];
}

const CATEGORIES: Category[] = [
    {
        label: 'Training',
        services: [
            {
                id: 'individual',
                name: 'Individual Session',
                image: '/assets/images/individual.png',
                price: '$200',
                meta: ['60 minutes', '1 player'],
                pricing: ['$200 per player'],
                description: "Private training offers a bespoke and results-driven approach to achieving your goals. One of our professional coaches will tailor each session to your specific needs, build on your strengths, and improve your weaknesses. Whether your goal is becoming a starter for your club or school, or to reach the collegiate or professional level, our private sessions ensure your development is aligned with the world's best practices and align with your personal objectives. In addition, we provide a comprehensive training plan and regularly evaluate your progress to ensure continuous development.",
                action: 'request-in-app',
            },
            {
                id: 'two-person',
                name: 'Two Person Session',
                image: '/assets/images/twoPerson.png',
                price: '$125',
                meta: ['60 minutes', '2 players'],
                pricing: ['$125 per player'],
                description: 'Just like individual sessions, each player is provided a personalized training program, while the semi-private dynamic fosters a more competitive environment. Players can either request the session with a partner, or we can pair them with one. We typically pair players by their current level and ability, or shared training goals. Semi-private sessions are scheduled by the client.',
                action: 'request-in-app',
            },
            {
                id: 'small-group',
                name: 'Small Group Session',
                image: '/assets/images/smallGroup.png',
                price: '$85',
                meta: ['60 minutes', '3–4 players'],
                pricing: ['$85 per player'],
                description: 'Small groups are still a high-quality training experience, though it is less individualized compared to a fully private session. Sessions provide a competitive environment fostering high-quality training. Just as with Two Person sessions, players can request their partners or we will pair you with a group at a similar caliber. Each session is designed with drills and games that enhance technical ability and simulate in-game scenarios, effectively meeting the needs of each player. Sessions are organized in advance and come at a more accessible price point, allowing athletes to train more frequently.',
                action: 'request-in-app',
            },
            {
                id: 'large-group',
                name: 'Large Group Session',
                image: '/assets/images/largeGroup.png',
                price: '$50',
                meta: ['120 minutes', '5+ players', 'Held daily'],
                pricing: ['$50 per player'],
                description: 'As our most popular service, large group sessions offer quality instruction with high intensity drills and games, but with a more open atmosphere. The one-size-fits-all program allows athletes to focus on personal areas of improvement, while remaining suitable for players of various ages and skill levels. Sessions typically include drills focused on dribbling, receiving and passing, and shooting, followed by small-sided games, and occasionally fitness work. Due to club seasons, it is common for groups to be small, allowing for a more personalized experience. Sessions are held daily, and drop-ins are allowed (for registered players only). The full schedule can be found in the Calendar.',
                action: 'calendar',
            },
        ],
    },
    {
        label: 'Analysis & guidance',
        services: [
            {
                id: 'parent-consultation',
                name: 'Parent Consultation',
                image: '/assets/images/parentConsultation.png',
                containImage: true,
                price: 'From $150',
                meta: ['60 minutes', 'In person or by phone'],
                pricing: ['In person — $200', 'By phone — $150'],
                description: "For parents seeking additional guidance regarding a player's current skill, fitness levels, progress, academy opportunities, college recruitment process, international exposure, or anything soccer-related, a consultation offers a private setting to address all your questions. This one-on-one consultation provides an in-depth analysis of your child's current state, ensuring that all your concerns are thoroughly answered, while also providing recommendations for the next steps in their development.",
                action: 'request-in-app',
            },
            {
                id: 'game-analysis',
                name: 'Game Analysis',
                image: '/assets/images/gameAnalysis.png',
                containImage: true,
                price: 'From $150',
                meta: ['In person, online or video'],
                pricing: ['In person — $200', 'Online meeting — $150', 'Video recording — $150'],
                description: "A coach breaks down a player's game — in person, over an online meeting, or as a recorded video review — and walks through what went well, what to work on, and how to carry it into training.",
                action: 'request-in-app',
            },
            {
                id: 'player-report',
                name: 'Player Report',
                image: '/assets/images/playerReport.png',
                containImage: true,
                price: '$75',
                meta: ['After 5+ training sessions'],
                pricing: ['$75 per player'],
                description: "A comprehensive written report on a player's current progress, skill, fitness, and mental state. This detailed evaluation gives you an understanding of your development, highlighting your personal strengths and areas needing improvement. The report shows both physical and technical ability, but also intangibles such as mental focus and work ethic, allowing for a holistic evaluation and helps inform future training plans.",
                action: 'request-in-app',
            },
        ],
    },
    {
        label: 'Programs & events',
        services: [
            {
                id: 'camps',
                name: 'Camps',
                image: '/assets/images/camps.png',
                price: 'Varies',
                meta: ['Throughout the year', 'Various locations'],
                pricing: ['Varies by location and duration'],
                description: 'Our specialized soccer camps offer intensive training experiences designed to accelerate player development. Led by professional coaches and former players, camps combine technical training, tactical education, and competitive play in a focused environment. Available throughout the year at various locations, our camps cater to different age groups and skill levels.',
                action: 'camps',
            },
            {
                id: 'team-training',
                name: 'Team Training',
                image: '/assets/images/teamTraining.png',
                price: 'Custom',
                meta: ['Full teams', 'All levels'],
                pricing: ['Custom pricing based on team size'],
                description: "Our tailored full-team training programs deliver a dynamic and comprehensive approach to enhancing skills, refining tactics, and boosting overall team performance. Designed for teams of all levels, these sessions are fully customized to meet the unique needs of both the collective group and individual players. Starting with technical drills to hone individual skills, we progress to passing exercises and 1v1 challenges that sharpen key aspects of game play. The program concludes with full-team games that simulate real match conditions, fostering collaboration and team cohesion. Each session is carefully planned in partnership with the team's coach, ensuring alignment with their goals and player development objectives. With a focus on both the individual and the team, our training ensures growth in every aspect of the game, preparing players to perform at their best, both on and off the field.",
                action: 'request-in-app',
            },
            {
                id: 'professional-clinics',
                name: 'Professional Clinics',
                image: '/assets/images/professionalClinics.png',
                price: 'Event',
                meta: ['Led by current and former pros'],
                pricing: ['Special event pricing'],
                description: 'Professional clinics feature current and former professional players who share their expertise and experience. These unique opportunities allow players to learn directly from those who have competed at the highest levels. Clinics cover advanced techniques, professional mentality, and insights into what it takes to succeed in professional soccer.',
                action: 'request-in-app',
            },
            {
                id: 'showcases',
                name: 'Showcases',
                image: '/assets/images/showcases.png',
                price: 'Event',
                meta: ['In front of college coaches and scouts'],
                pricing: ['Event-based pricing'],
                description: 'Showcases provide players with opportunities to display their talents in front of college coaches, scouts, and recruiters. These events are carefully organized to maximize exposure and create pathways to the next level of competition. We guide players through the showcase process and help them make the most of these important opportunities.',
                action: 'request-in-app',
            },
        ],
    },
];

const ALL_SERVICES = CATEGORIES.flatMap(c => c.services);

const APP_STORE = 'https://apps.apple.com/us/app/next-star-soccer/id6754170423';
const PLAY_STORE = 'https://play.google.com/store/apps/details?id=com.nextstarsoccer.nextstar&hl=en_US';

const Label = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <p className={`text-[11px] uppercase tracking-[0.18em] text-white/40 ${className}`}>{children}</p>
);

const StoreBadges = () => (
    <div className="flex items-center gap-3">
        <a href={APP_STORE} target="_blank" rel="noopener noreferrer">
            <img src="/assets/images/badge-app-store.svg" alt="Download on the App Store" className="h-10 w-auto" />
        </a>
        <a href={PLAY_STORE} target="_blank" rel="noopener noreferrer">
            <img src="/assets/images/badge-google-play.png" alt="Get it on Google Play" className="h-10 w-auto" />
        </a>
    </div>
);

// What a visitor does next depends on the service: most are booked in the app,
// group sessions are picked off the calendar, and camps have their own pages.
const ServiceAction = ({ action }: { action: Action }) => {
    if (action === 'calendar') {
        return (
            <Link to="/calendar" className="inline-flex items-center gap-1.5 bg-white text-black hover:bg-white/85 px-5 py-2.5 rounded-full text-sm font-semibold transition-colors">
                See the schedule <span aria-hidden="true">→</span>
            </Link>
        );
    }
    if (action === 'camps') {
        return (
            <Link to="/services/camps" className="inline-flex items-center gap-1.5 bg-white text-black hover:bg-white/85 px-5 py-2.5 rounded-full text-sm font-semibold transition-colors">
                View camps <span aria-hidden="true">→</span>
            </Link>
        );
    }
    return (
        <div>
            <p className="text-[13px] text-white/50 mb-3">Request this session in the Next Star app.</p>
            <StoreBadges />
        </div>
    );
};

const ServiceDetail = ({ service }: { service: Service }) => (
    <div>
        <div className={`aspect-[16/10] overflow-hidden border border-white/[0.08] ${service.containImage ? 'bg-white/[0.03] p-6' : 'bg-black'}`}>
            <img
                src={service.image}
                alt={service.name}
                className={`w-full h-full ${service.containImage ? 'object-contain' : 'object-cover'}`}
                decoding="async"
            />
        </div>
        <div className="mt-8 flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
            <div>
                <h2 className="text-white font-medium tracking-[-0.02em] text-[clamp(1.6rem,2.4vw,2.1rem)] leading-tight">
                    {service.name}
                </h2>
                <p className="mt-2 text-[14px] text-white/45">{service.meta.join(' · ')}</p>
            </div>
            <div className="text-right">
                {service.pricing.map(line => (
                    <p key={line} className="text-[14px] text-white tabular-nums leading-relaxed">{line}</p>
                ))}
            </div>
        </div>
        <p className="mt-6 text-[15px] leading-relaxed text-white/60 max-w-2xl">{service.description}</p>
        <div className="mt-8">
            <ServiceAction action={service.action} />
        </div>
    </div>
);

const ServicesPage = () => {
    // A link can land on one service directly, e.g. /services#camps.
    const initial = () => {
        const id = typeof window !== 'undefined' ? window.location.hash.slice(1) : '';
        return ALL_SERVICES.some(s => s.id === id) ? id : ALL_SERVICES[0].id;
    };
    const [selectedId, setSelectedId] = useState<string>(initial);
    const selected = useMemo(() => ALL_SERVICES.find(s => s.id === selectedId) ?? ALL_SERVICES[0], [selectedId]);

    useEffect(() => {
        window.history.replaceState(null, '', `#${selectedId}`);
    }, [selectedId]);

    return (
        <div className="min-h-screen bg-black flex flex-col font-lt-wave">
            <Navigation />

            {/* ═══════════════════════ INTRO ═══════════════════════ */}
            <section className="pt-40 md:pt-48 pb-16 md:pb-24 border-b border-white/[0.08]">
                <div className="max-w-7xl mx-auto px-6 lg:px-8">
                    <Label>Services</Label>
                    <h1 className="mt-6 text-white font-medium tracking-[-0.03em] leading-[1.02] text-[clamp(2.6rem,6vw,5rem)]">
                        Training for<br />every stage
                    </h1>
                    <p className="mt-8 max-w-3xl text-[clamp(1.1rem,1.6vw,1.4rem)] leading-relaxed tracking-[-0.01em]">
                        <span className="text-white">One-on-one sessions to camps and showcases.</span>{' '}
                        <span className="text-white/45">
                            Everything is coached by the same staff of professionals and former players,
                            and priced per player.
                        </span>
                    </p>
                </div>
            </section>

            {/* ═══════════════════════ INDEX + DETAIL ═══════════════════════ */}
            <section className="border-b border-white/[0.08]">
                <div className="max-w-7xl mx-auto px-6 lg:px-8 md:grid md:grid-cols-12">

                    {/* The index: every service and its price, grouped. */}
                    <nav className="md:col-span-5 md:border-r border-white/[0.08] md:pr-10 pb-16" aria-label="Services">
                        {CATEGORIES.map((cat, ci) => (
                            <div key={cat.label} className={ci === 0 ? 'pt-10' : 'pt-14'}>
                                <Label className="mb-4">
                                    <span className="tabular-nums">0{ci + 1}</span>
                                    <span className="mx-2 text-white/20">/</span>
                                    {cat.label}
                                </Label>
                                <ul className="border-t border-white/[0.08]">
                                    {cat.services.map(s => {
                                        const active = s.id === selectedId;
                                        return (
                                            <li key={s.id} className="border-b border-white/[0.08]">
                                                <button
                                                    onClick={() => setSelectedId(s.id)}
                                                    aria-current={active ? 'true' : undefined}
                                                    className="group w-full flex items-baseline justify-between gap-4 py-4 text-left"
                                                >
                                                    <span className={`flex items-center gap-3 text-[16px] transition-colors ${active ? 'text-white' : 'text-white/55 group-hover:text-white'}`}>
                                                        <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${active ? 'bg-white' : 'bg-transparent'}`} />
                                                        {s.name}
                                                    </span>
                                                    <span className={`text-[14px] tabular-nums transition-colors ${active ? 'text-white' : 'text-white/35 group-hover:text-white/60'}`}>
                                                        {s.price}
                                                    </span>
                                                </button>

                                                {/* On phones the detail opens under its own row. */}
                                                {active && (
                                                    <div className="md:hidden pb-10 pt-2">
                                                        <ServiceDetail service={s} />
                                                    </div>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        ))}
                    </nav>

                    {/* The detail, held in view while the index scrolls past it. */}
                    <article className="hidden md:block md:col-span-7 md:pl-12 py-10">
                        <div className="sticky top-24">
                            <ServiceDetail service={selected} />
                        </div>
                    </article>
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
        </div>
    );
};

export default ServicesPage;
