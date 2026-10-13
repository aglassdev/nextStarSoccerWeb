import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Navigation from '../components/layout/Navigation';
import Footer from '../components/layout/Footer';
import AnimatedCycleText from '../components/common/AnimatedCycleText';
import AnimatedCounter from '../components/common/AnimatedCounter';
import { images } from '../constants/images';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/* ─── Data ─────────────────────────────────────────────────────────────────── */

const STATS: { end: number; suffix: string; label: string; detail: string }[] = [
    { end: 2500, suffix: '+', label: 'Youth Players',         detail: 'Trained across all age groups since founding.' },
    { end: 100,  suffix: '+', label: 'Professional Players',  detail: 'Alumni competing at the highest levels worldwide.' },
    { end: 50,   suffix: '+', label: 'National Team Players', detail: 'At youth and senior national team level.' },
    { end: 200,  suffix: '+', label: 'NCAA Division I',       detail: 'Alumni playing at the collegiate Division I level.' },
    { end: 50,   suffix: '+', label: 'NCAA Division II',      detail: 'Alumni playing at the collegiate Division II level.' },
    { end: 100,  suffix: '+', label: 'NCAA Division III',     detail: 'Alumni playing at the collegiate Division III level.' },
];

// Filler media for the three split sections below, until the real photos and
// video are uploaded. Swap these values to replace them.
const ABOUT_IMAGE = '/assets/images/collage1.png';
const TEAM_IMAGE = '/assets/images/collage2.png';
const FUNDAMENTALS_VIDEO =
    'https://nyc.cloud.appwrite.io/v1/storage/buckets/6a1fa457000995c2a83f/files/6a1fa81c001bd64cf360/view?project=68577380002195dec512';

const STORY: {
    label: string; title: [string, string?]; body: string; cta: string; to: string;
    image?: string; video?: string; alt?: string;
}[] = [
    {
        label: 'About us',
        title: ['Founded in 2018,', 'built in the DC area'],
        body: 'Founded in 2018, Next Star started with a simple goal: give young players the coaching, guidance and opportunities to reach their potential. Today it trains players of every age across the DC area, with alumni competing in college and professional soccer around the world.',
        cta: 'See where our alumni play', to: '/alumni',
        image: ABOUT_IMAGE, alt: 'Next Star players training',
    },
    {
        label: 'Our approach',
        title: ['The Fundamentals'],
        body: 'Every session comes back to the basics that decide games: first touch, passing, movement and decision-making under pressure. Mastered early and repeated often, they are what every level after them is built on.',
        cta: 'Explore services', to: '/services',
        video: FUNDAMENTALS_VIDEO,
    },
    {
        label: 'Our team',
        title: ['Built by players,', 'for players'],
        body: 'Next Star is led by experienced coaches and former professionals who have walked the path our players are on. We train the technical and physical side of the game, and guide families through youth leagues, academies, college recruitment and the professional game.',
        cta: 'Meet the coaches', to: '/coaches',
        image: TEAM_IMAGE, alt: 'Next Star coaches',
    },
];

const CLUB_ICONS = [
  '568289-removebg-preview.png','Annapolis_Blues_FC_Logo.png','Chattanooga_FC_logo.svg.png',
  'Club_Deportivo_Águila_logo.svg.png','Dukla_bb.png','H4.png','New_York_Red_Bulls_logo.svg.png',
  'Northern_Virginia_FC_logo.png','OH_LEUVEN.png','Orlando_Pride_logo.svg.png',
  'Portland_Hearts_of_Pine_Logo.png','Portland_Thorns_logo.svg.png','San_Diego_FC_logo.svg.png',
  'Sarasota_Paradise_Logo.png','St._Louis_City_SC_logo.svg.png','The_Town_FC_logo.svg.png',
  '_.png','__.png','___.png','____.png','______.png',
  'ajax.png','albaceteBalompié.png','amiens.png','annapolisBlues.png','arlington.png',
  'arsenal.png','assyriskaff.png','avalta.png','benfica.png','bethesda.png','bogotafc.png',
  'bournemouth.png','carolinacore.png','cdAméricadeCali.png','cdCacahuatique.png',
  'cdsColo-Colo.png','charlotteindependance.png','chicagoFire.png','cincinnati2.png',
  'clubDestroyers.png','columbusCrew.png','csEmelec.png','dcUnited.png','dothanunited.png',
  'dynamo.png','elfsborg.png','elpasolocomotive.png','fccincinnati.png','frankfurt.png',
  'grazerAK.png','hoffenheim.png','huntsvillecity.png','ikSirius.png',
  'images-removebg-preview.png','khfccinlogo_copy__2_.png','krcgenk.png','lafc.png',
  'lagalaxy.png','landskronaBolS.png','leverkusen.png','lexington.png',
  'littleRockRangers.png','logo_Alexandria-SA.png','loudoun.png','louisianaKrewe.png',
  'louisianafirejuniors.png','maimifc.png','manurewa.png','marylandBobcats.png',
  'minnesota2.png','montreal.png','nashville.png','newEnglandRevolution.png',
  'northCarolinafc.png','nycfcii.png','olyonnes.png','pateadores.png','pateadoressc.png',
  'philadelphiaunion.png','rapids.png','rapids2.png','realmonarchs.png','redlandsfc.png',
  'roughriders.png','sandnesUlf.png','santabarbarasc.png','santosLaguna.png','seacoast.png',
  'sjquakes.png','sportingkansas2.png','switchbacks.png','syrianskafc.png','texomafc.png',
  'torontofc.png','tulsa.png','vancouverWhitecaps.png','vda.png','vermontGreen.png',
  'wake.png','westerlo.png','wolfsburg.png',
];

const COLLEGE_ICONS = [
  'Akron_Zips_logo_2022.svg.png','Group.png','Lynchburg_Hornets_logo.svg.png',
  'Manhattan_Jaspers_logo.svg.png','North_Carolina_Tar_Heels_logo.svg.png',
  'Ohio_State_Buckeyes_logo.svg.png','Providence_Friars_logo.svg.png',
  'Stanford_Cardinal_logo.svg.png','UMass_Amherst_athletics_logo.svg.png',
  'William_&_Mary_Athletics_logo.svg.png','Wisconsin_Badgers_logo.svg.png',
  '_.png','au.png','binghamton.png','bu.png','bucknell.png','colgate.png','columbia.png',
  'convert (9).png','cornell.png','creighton.png','csdu.png','duke.png','elon.png',
  'emory.png','georgemason.png','georgetown.png','harvard.png','haverford.png',
  'high-point.png','howard.png','jmu.png','longwood.png','maryland.png','mississippi.png',
  'ncstate.png','ncwu.png','odu.png','penn.png','princeton.png','radford.png','sanDiego.png',
  'uca.png','ucberkeley.png','ucla.png','ucsb.png','uic.png','uk.png','umich.png',
  'uncg.png','uncw.png','vcu.png','virginia.png','wakeForest.png','washu.png','yale.png',
];

/* ── Logo Carousel ──────────────────────────────────────────────────────────── */
function LogoCarousel({ icons, folder, direction, duration = '60s' }: {
  icons: string[];
  folder: 'clubs' | 'colleges';
  direction: 'left' | 'right';
  duration?: string;
}) {
  const doubled = [...icons, ...icons];
  // Soft edges so logos dissolve into the page rather than hitting a hard cut.
  const maskStyle = 'linear-gradient(to right, transparent, black 12%, black 88%, transparent)';

  return (
    <div
      className="overflow-hidden w-full"
      style={{ maskImage: maskStyle, WebkitMaskImage: maskStyle }}
    >
      <div
        className={`flex items-center gap-12 w-max ${direction === 'left' ? 'carousel-left' : 'carousel-right'}`}
        style={{
          animationDuration: duration,
          // Force a GPU compositor layer so iOS Safari never pauses this
          // animation when the element is temporarily off-screen.
          transform: 'translateZ(0)',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden' as any,
          willChange: 'transform',
        }}
      >
        {doubled.map((file, i) => (
          <img
            key={i}
            src={`/assets/icons/${folder}/${encodeURIComponent(file)}`}
            alt=""
            aria-hidden="true"
            className="h-10 w-auto object-contain flex-shrink-0"
            loading="eager"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ))}
      </div>
    </div>
  );
}

// Each photo with its real shape, so it can be shown whole — every one is a
// tall portrait bar the last two.
const COLLAGE_IMAGES = [
    { src: images.collage1,  alt: 'Private training',   aspect: 1575 / 2000 },
    { src: images.collage2,  alt: 'Game day',           aspect: 1370 / 2000 },
    { src: images.collage3,  alt: 'Academy clinic',     aspect: 1431 / 2000 },
    { src: images.collage4,  alt: 'Player development', aspect: 1333 / 2000 },
    { src: images.collage5,  alt: 'Speed and agility',  aspect: 1333 / 2000 },
    { src: images.collage6,  alt: 'Technical work',     aspect: 1333 / 2000 },
    { src: images.collage7,  alt: 'Small group',        aspect: 1400 / 2000 },
    { src: images.collage8,  alt: 'College prep',       aspect: 1551 / 2000 },
    { src: images.collage9,  alt: 'Team training',      aspect: 2000 / 1594 },
    { src: images.collage10, alt: 'Next Star showcase', aspect: 2881 / 2000 },
];

// Where each photo sits, as [left, top, width] in a field 100 units wide. The
// height of each follows from its shape, so the layout can be scattered by
// hand without cropping anything; every pair is at least 5 units apart and no
// two share a top edge, so it never settles into rows. Phones get a denser
// arrangement of their own, since the desktop one would shrink to thumbnails.
type Spot = [left: number, top: number, width: number];
const SCATTER_DESKTOP: Spot[] = [
    [6, 31, 21], [41, 8, 18], [58, 69, 19], [88, 46, 12], [66, 2, 15],
    [34, 42, 16], [14, 72, 17], [86, 14, 14], [55, 40, 27], [0, 0, 34],
];
const SCATTER_MOBILE: Spot[] = [
    [8, 52, 40], [70, 16, 30], [46, 242, 38], [12, 161, 32], [56, 68, 34],
    [60, 127, 30], [0, 218, 36], [54, 181, 40], [0, 112, 50], [0, 0, 64],
];

function Scatter({ spots, className = '' }: { spots: Spot[]; className?: string }) {
    const height = Math.max(...spots.map(([, top, width], i) => top + width / COLLAGE_IMAGES[i].aspect));
    return (
        <div className={`relative w-full ${className}`} style={{ aspectRatio: `100 / ${height}` }}>
            {COLLAGE_IMAGES.map((photo, i) => {
                const [left, top, width] = spots[i];
                return (
                    <img
                        key={photo.src}
                        src={photo.src}
                        alt={photo.alt}
                        className="absolute block object-contain"
                        style={{ left: `${left}%`, top: `${(top / height) * 100}%`, width: `${width}%`, aspectRatio: `${photo.aspect}` }}
                        loading="lazy"
                        decoding="async"
                    />
                );
            })}
        </div>
    );
}

const INSTAGRAM_IMAGES = [images.instagram1, images.instagram2, images.instagram3, images.instagram4, images.instagram5];
const INSTAGRAM_POSTS  = [
    'https://www.instagram.com/p/C9N0qy5PKh0/?img_index=1',
    'https://www.instagram.com/p/DAtr1Y2PaBx/?img_index=1',
    'https://www.instagram.com/p/DRf1fmdjthJ/?img_index=1',
    'https://www.instagram.com/p/DMnvmAbxq0Q/?img_index=1',
    'https://www.instagram.com/p/C_Q_ZEwvaEn/?img_index=1',
];

/* ─── Layout pieces ────────────────────────────────────────────────────────── */

const Container = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <div className={`max-w-7xl mx-auto px-6 lg:px-8 ${className}`}>{children}</div>
);

const Label = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <p className={`text-[11px] uppercase tracking-[0.18em] text-white/40 ${className}`}>{children}</p>
);

const HEADING = 'text-white font-medium tracking-[-0.025em] leading-[1.05] text-[clamp(2.25rem,4.4vw,3.6rem)]';

type Chapter = (typeof STORY)[number];

const StoryText = ({ chapter: ch }: { chapter: Chapter }) => (
    <>
        <Label>{ch.label}</Label>
        <h2 className={`mt-6 ${HEADING}`}>
            {ch.title[0]}{ch.title[1] && <><br /><span className="text-white/40">{ch.title[1]}</span></>}
        </h2>
        <p className="mt-6 text-[clamp(1.05rem,1.45vw,1.25rem)] leading-relaxed text-white/60">{ch.body}</p>
        <Link to={ch.to} className="mt-8 inline-flex items-center gap-1.5 text-[14px] text-white/50 hover:text-white transition-colors">
            {ch.cta} <span aria-hidden="true">→</span>
        </Link>
    </>
);

// About Us plays out over a pinned screen while the page scrolls past it:
//   1. the black card starts growing out of the middle once the photo is
//      about half on screen, its text already in place and revealed as the
//      card opens around it;
//   2. it reaches 3/4 of the frame, overshooting a touch and settling back;
//   3. it holds there for a stretch of scroll, so reading feels like a pause;
//   4. then it keeps growing until the black has taken over the whole frame.
// The card is a full-size black layer cut down with clip-path, so growing it
// never re-lays-out the text, and its size eases toward the scroll position
// every frame rather than jumping with each scroll event.
const REVEAL_HEIGHT = 300; // vh of scroll the pinned part spans
const GROW_END = 0.36, HOLD_END = 0.64;
const REST = 0.75; // the card's size, as a share of the frame, while it holds
const FOLLOW = 0.12; // share of the remaining distance covered each frame

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
// Ease-out with a small overshoot past 1 that settles back.
const easeOutBack = (t: number) => { const c = 1.4; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; };
const easeInOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

const AboutReveal = ({ chapter }: { chapter: Chapter }) => {
    const wrapRef = useRef<HTMLDivElement>(null);
    const cardRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const wrap = wrapRef.current, card = cardRef.current;
        if (!wrap || !card) return;
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        // 0 when the photo's top is halfway up the screen, 1 when the pinned
        // stretch ends, so the card is already growing as the photo arrives.
        const progress = () => {
            const r = wrap.getBoundingClientRect();
            const lead = window.innerHeight * 0.5;
            const span = r.height - window.innerHeight + lead;
            return clamp01((lead - r.top) / span);
        };
        const sizeAt = (p: number) => {
            if (p < GROW_END) return REST * easeOutBack(p / GROW_END);
            if (p < HOLD_END) return REST;
            return REST + (1 - REST) * easeInOut((p - HOLD_END) / (1 - HOLD_END));
        };
        const draw = (size: number) => {
            const inset = `${((1 - Math.max(0, size)) / 2) * 100}%`;
            card.style.clipPath = `inset(${inset} ${inset} ${inset} ${inset})`;
        };

        if (reduced) { draw(REST); return; }

        let current = sizeAt(progress());
        let raf = 0;
        const tick = () => {
            const target = sizeAt(progress());
            current += (target - current) * FOLLOW;
            if (Math.abs(target - current) < 0.0004) current = target;
            draw(current);
            raf = current === target ? 0 : requestAnimationFrame(tick);
        };
        const wake = () => { if (!raf) raf = requestAnimationFrame(tick); };

        // The pause: if scrolling comes to rest just short of the hold, ease
        // the page onto it. Never mid-scroll, so it never fights the reader.
        let idle: ReturnType<typeof setTimeout> | undefined;
        const settle = () => {
            clearTimeout(idle);
            idle = setTimeout(() => {
                const r = wrap.getBoundingClientRect();
                const lead = window.innerHeight * 0.5;
                const span = r.height - window.innerHeight + lead;
                const p = (lead - r.top) / span;
                const target = GROW_END + 0.03;
                if (p > GROW_END - 0.1 && p < GROW_END) {
                    window.scrollTo({ top: window.scrollY + (target - p) * span, behavior: 'smooth' });
                }
            }, 160);
        };

        draw(current);
        window.addEventListener('scroll', wake, { passive: true });
        window.addEventListener('resize', wake);
        window.addEventListener('scroll', settle, { passive: true });
        return () => {
            cancelAnimationFrame(raf); clearTimeout(idle);
            window.removeEventListener('scroll', wake);
            window.removeEventListener('resize', wake);
            window.removeEventListener('scroll', settle);
        };
    }, []);

    return (
        <section ref={wrapRef} className="relative border-b border-white/[0.08]" style={{ height: `${REVEAL_HEIGHT}vh` }}>
            <div className="sticky top-0 h-screen overflow-hidden">
                <img src={chapter.image} alt={chapter.alt} className="absolute inset-0 w-full h-full object-cover" />
                <div
                    ref={cardRef}
                    className="absolute inset-0 bg-black flex items-center justify-center will-change-[clip-path]"
                    style={{ clipPath: 'inset(50% 50% 50% 50%)' }}
                >
                    <div className="w-[min(36rem,calc(100vw-3rem))] px-6 text-center [&_a]:justify-center">
                        <StoryText chapter={chapter} />
                    </div>
                </div>
            </div>
        </section>
    );
};

/* ─── Component ─────────────────────────────────────────────────────────────── */

const HomePageNew = () => {
    const [countersVisible, setCountersVisible] = useState(false);
    const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
    const [videoReady, setVideoReady] = useState(false);

    const statsRef         = useRef<HTMLDivElement>(null);
    const socialSectionRef = useRef<HTMLDivElement>(null);
    const videoRef         = useRef<HTMLVideoElement>(null);

    /* ── Responsive ── */
    useEffect(() => {
        const fn = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', fn);
        return () => window.removeEventListener('resize', fn);
    }, []);

    /* ── Video autoplay + loading-screen fallback ──
         On iOS/mobile autoplay may be blocked and canplay may never fire before
         the user sees the page.  We dismiss the overlay on whichever event
         arrives first: playing (video is rendering frames), loadeddata (first
         frame decoded), canplay, or an error.  Hard timeout is 3 s.           */
    useEffect(() => {
        const vid = videoRef.current;
        if (!vid) return;
        const done = () => setVideoReady(true);
        vid.addEventListener('playing',    done, { once: true });
        vid.addEventListener('loadeddata', done, { once: true });
        vid.addEventListener('canplay',    done, { once: true });
        vid.play().catch(done);
        const timer = setTimeout(done, 3000);
        return () => {
            vid.removeEventListener('playing',    done);
            vid.removeEventListener('loadeddata', done);
            vid.removeEventListener('canplay',    done);
            clearTimeout(timer);
        };
    }, []);

    /* ── Counters start counting once the grid is on screen. Nothing fades in:
         the figures are always there, they just run up to their totals. ── */
    useEffect(() => {
        const el = statsRef.current;
        if (!el) return;
        const obs = new IntersectionObserver(
            (entries) => { if (entries.some(e => e.isIntersecting)) { setCountersVisible(true); obs.disconnect(); } },
            { threshold: 0.2 }
        );
        obs.observe(el);
        return () => obs.disconnect();
    }, []);

    /* ── Social fan-out (GSAP) — unchanged ── */
    useEffect(() => {
        if (!socialSectionRef.current) return;
        const cards = gsap.utils.toArray<HTMLElement>('.social-card');
        if (!cards.length) return;

        const fanData = isMobile
            ? [{ x: -220, rotation: -24, z: 1 }, { x: -110, rotation: -12, z: 2 }, { x: 0, rotation: 0, z: 5 }, { x: 110, rotation: 12, z: 2 }, { x: 208, rotation: 22, z: 1 }]
            : [{ x: -330, rotation: -24, z: 1 }, { x: -162, rotation: -12, z: 2 }, { x: 0, rotation: 0, z: 5 }, { x: 162, rotation: 12, z: 2 }, { x: 312, rotation: 22, z: 1 }];

        gsap.set(cards, { x: 0, rotation: 0, transformOrigin: 'center 85%' });

        ScrollTrigger.create({
            trigger: socialSectionRef.current,
            start: 'top 65%',
            once: true,
            onEnter: () => cards.forEach((card, i) =>
                gsap.to(card, { x: fanData[i].x, rotation: fanData[i].rotation, duration: 0.9, ease: 'power3.out', delay: i * 0.04 })
            ),
        });

        const NUDGE = isMobile ? 28 : 38;
        cards.forEach((card, i) => {
            card.addEventListener('mouseenter', () => {
                gsap.to(card, { y: -22, scale: 1.05, zIndex: 20, duration: 0.28, ease: 'power2.out' });
                cards.forEach((other, j) => {
                    if (j !== i) gsap.to(other, { x: fanData[j].x + (j < i ? -NUDGE : NUDGE), duration: 0.28, ease: 'power2.out' });
                });
            });
            card.addEventListener('mouseleave', () => {
                gsap.to(card, { y: 0, scale: 1, zIndex: fanData[i].z, duration: 0.35, ease: 'power2.out' });
                cards.forEach((other, j) => {
                    if (j !== i) gsap.to(other, { x: fanData[j].x, duration: 0.35, ease: 'power2.out' });
                });
            });
        });

        return () => ScrollTrigger.killAll();
    }, [isMobile]);

    /* ─── JSX ─── */
    return (
        <div className="min-h-screen bg-black font-lt-wave overflow-x-clip">

            {/* ═══════════════════════ VIDEO LOADING OVERLAY ═══════════════════════ */}
            <div
                className="fixed inset-0 z-[9999] bg-black flex items-center justify-center transition-opacity duration-700 pointer-events-none"
                style={{ opacity: videoReady ? 0 : 1 }}
            >
                <img
                    src="/assets/images/NextStarBall.png"
                    alt=""
                    className="w-20 h-20 object-contain animate-scale-pulse"
                />
            </div>

            {/* ═══════════════════════ HERO ═══════════════════════ */}
            <section className="relative h-screen overflow-hidden bg-black">
                <video
                    ref={videoRef}
                    src="https://nyc.cloud.appwrite.io/v1/storage/buckets/6a1fa457000995c2a83f/files/6a1fa81c001bd64cf360/view?project=68577380002195dec512"
                    autoPlay
                    loop
                    muted
                    playsInline
                    onError={() => setVideoReady(true)}
                    className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/20" />
                {/* Melts the bottom of the video into the black page below. */}
                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-black" />

                {/* Navigation sits in normal flow but is fixed — placement here keeps z-order clean */}
                <Navigation />

                <div className="absolute inset-0 flex items-center justify-center z-10">
                    <AnimatedCycleText />
                </div>
            </section>

            {/* ═══════════════════════ WHERE ALUMNI PLAY ═══════════════════════ */}
            {/* Clubs above the numbers, colleges below them, all one band. */}
            <section className="pt-12 md:pt-16">
                <LogoCarousel icons={CLUB_ICONS} folder="clubs" direction="right" duration="110s" />
            </section>

            {/* ═══════════════════════ NUMBERS ═══════════════════════ */}
            <section>
                <Container className="py-14 md:py-16 grid md:grid-cols-12 gap-12">
                    <div className="md:col-span-4">
                        <h2 className={HEADING}>
                            Next Star<br />
                            <span className="text-white/40">in numbers</span>
                        </h2>
                    </div>
                    <div ref={statsRef} className="md:col-span-8 grid grid-cols-2 sm:grid-cols-3 border-t border-l border-white/[0.08]">
                        {STATS.map((stat) => (
                            <div key={stat.label} className="border-r border-b border-white/[0.08] p-6 md:p-8">
                                <AnimatedCounter
                                    isVisible={countersVisible}
                                    endValue={stat.end}
                                    label=""
                                    suffix={stat.suffix}
                                    containerClassName=""
                                    numberClassName="text-white font-medium tracking-[-0.03em] tabular-nums"
                                    numberStyle={{ fontSize: 'clamp(2.1rem, 4.2vw, 3.4rem)', lineHeight: 1, fontFamily: "'LT Wave', sans-serif" }}
                                />
                                <p className="mt-5 text-[13px] text-white">{stat.label}</p>
                                <p className="mt-1 text-[13px] text-white/40 leading-relaxed">{stat.detail}</p>
                            </div>
                        ))}
                    </div>
                </Container>
            </section>

            <section className="border-b border-white/[0.08] pb-12 md:pb-16">
                <LogoCarousel icons={COLLEGE_ICONS} folder="colleges" direction="left" duration="60s" />
            </section>

            {/* ═══════════════════════ ABOUT US — scroll reveal ═══════════════════════ */}
            <AboutReveal chapter={STORY[0]} />

            {/* ═══════════════════════ FUNDAMENTALS + TEAM — half and half ═══════════════════════ */}
            {STORY.slice(1).map(ch => {
                const mediaLeft = !!ch.video;
                return (
                    <section key={ch.label} className="border-b border-white/[0.08] grid md:grid-cols-2">
                        <div className={`relative min-h-[360px] md:min-h-[600px] bg-neutral-900 order-2 ${mediaLeft ? 'md:order-1' : 'md:order-2'}`}>
                            {ch.video ? (
                                <video src={ch.video} autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover" />
                            ) : (
                                <img src={ch.image} alt={ch.alt} className="absolute inset-0 w-full h-full object-cover" />
                            )}
                        </div>
                        <div className={`flex items-center px-4 sm:px-6 lg:px-8 py-16 md:py-24 order-1 ${mediaLeft ? 'md:order-2' : 'md:order-1'}`}>
                            <div className={`max-w-xl ${mediaLeft ? 'md:mr-auto md:ml-12 lg:ml-16' : 'md:ml-auto md:mr-12 lg:mr-16'}`}>
                                <StoryText chapter={ch} />
                            </div>
                        </div>
                    </section>
                );
            })}

            {/* ═══════════════════════ SOCIAL (unchanged) ═══════════════════════ */}
            <section
                ref={socialSectionRef}
                className={`bg-black border-b border-white/[0.08] flex flex-col justify-center overflow-hidden ${isMobile ? 'py-16' : 'py-24 md:py-32'}`}
                data-section="instagram"
            >
                <div className="text-center mb-10 md:mb-12 relative z-10 pointer-events-none select-none">
                    <h2 className={`font-black leading-none text-white uppercase font-lt-wave ${isMobile ? 'text-[clamp(36px,5.5vw,88px)]' : 'text-[clamp(44px,6.5vw,88px)]'}`}>
                        WHAT'S UP
                    </h2>
                    <p className={`font-black text-white uppercase leading-tight font-lt-wave ${isMobile ? 'text-[clamp(28px,4.5vw,72px)]' : 'text-[clamp(36px,5.5vw,72px)]'}`}>
                        ON SOCIALS
                    </p>
                </div>

                <div
                    className="relative flex items-center justify-center"
                    style={{ height: isMobile ? '320px' : '480px' }}
                >
                    {INSTAGRAM_POSTS.map((postUrl, i) => (
                        <a
                            key={i}
                            href={postUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`social-card absolute rounded-3xl overflow-hidden shadow-2xl cursor-pointer ${
                                isMobile ? 'w-[150px] h-[250px]' : 'w-[240px] h-[400px] md:w-[270px] md:h-[440px]'
                            }`}
                            style={{ zIndex: i === 2 ? 10 : 5 - Math.abs(i - 2) }}
                        >
                            <img
                                src={INSTAGRAM_IMAGES[i]}
                                alt={`Instagram post ${i + 1}`}
                                className="w-full h-full object-cover"
                                loading="lazy"
                                decoding="async"
                            />
                        </a>
                    ))}
                </div>

                <div className={`flex justify-center items-center gap-10 relative z-10 ${isMobile ? 'mt-8' : 'mt-10'}`}>
                    <span className="text-white/30 text-[10px] uppercase tracking-[0.25em] font-lt-wave">Follow</span>
                    <a href="https://www.instagram.com/nextstarsoccer/" target="_blank" rel="noopener noreferrer"
                        className="text-white text-base md:text-lg font-light lowercase tracking-wide hover:opacity-40 transition-opacity duration-300 font-lt-wave">
                        instagram
                    </a>
                    <a href="https://www.facebook.com/nextstarsoccer/" target="_blank" rel="noopener noreferrer"
                        className="text-white text-base md:text-lg font-light lowercase tracking-wide hover:opacity-40 transition-opacity duration-300 font-lt-wave">
                        facebook
                    </a>
                </div>
            </section>

            {/* ═══════════════════════ GALLERY ═══════════════════════ */}
            <section>
                <Container className="py-24 md:py-32">
                    <h2 className={`${HEADING} mb-16 md:mb-20`}>On the pitch</h2>
                    <Scatter spots={SCATTER_MOBILE} className="md:hidden" />
                    <Scatter spots={SCATTER_DESKTOP} className="hidden md:block" />
                </Container>
            </section>

            {/* ═══════════════════════ FOOTER ═══════════════════════ */}
            <Footer />

            <style>{`html { scroll-behavior: smooth; }`}</style>
        </div>
    );
};

export default HomePageNew;
