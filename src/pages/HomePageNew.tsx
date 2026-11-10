import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Navigation from '../components/layout/Navigation';
import Footer from '../components/layout/Footer';
import AnimatedCycleText from '../components/common/AnimatedCycleText';
import AnimatedCounter from '../components/common/AnimatedCounter';
import { images, homeImages } from '../constants/images';
import { withPageImages } from '../hooks/usePageImages';

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

// ?v= changes whenever the hero is replaced, so browsers drop the old copy.
const HERO_VERSION = '1015hq';
const HERO_VIDEO = `/assets/hero-1080.mp4?v=${HERO_VERSION}`;
const HERO_VIDEO_MOBILE = `/assets/hero-720.mp4?v=${HERO_VERSION}`;
const HERO_POSTER = `/assets/hero-poster.jpg?v=${HERO_VERSION}`;

// Filler media for the three split sections below, until the real photos and
// video are uploaded. Swap these values to replace them.
const ABOUT_IMAGE = homeImages.about;
const TEAM_IMAGE = homeImages.team;
const FUNDAMENTALS_VIDEO = '/assets/fundamentals.mp4?v=15hq';
const FUNDAMENTALS_POSTER = homeImages.fundamentalsPoster;

const STORY: {
    label: string; title: [string, string?]; body: string; cta?: string; to?: string;
    image?: string; video?: string; poster?: string; alt?: string;
}[] = [
    {
        label: 'About us',
        title: ['Founded in 2016,', 'built in the DC area'],
        body: 'Founded in 2016, Next Star started with a simple goal: give young players the coaching, guidance and opportunities to reach their potential. Today it trains players of every age across the DC area, with alumni competing in college and professional soccer around the world.',
        image: ABOUT_IMAGE, alt: 'Next Star players training',
    },
    {
        label: 'Our approach',
        title: ['The Fundamentals'],
        body: 'Every session comes back to the basics that decide games: first touch, passing, movement and decision-making under pressure. Mastered early and repeated often, they are what every level after them is built on.',
        cta: 'Explore services', to: '/services',
        video: FUNDAMENTALS_VIDEO, poster: FUNDAMENTALS_POSTER,
    },
    {
        label: 'Our team',
        title: ['Built by players,', 'for players'],
        body: 'Next Star is led by experienced coaches and former professionals who have walked the path our players are on. We train the technical and physical side of the game, and guide families through youth leagues, academies, college recruitment and the professional game.',
        cta: 'Meet the coaches', to: '/coaches',
        image: TEAM_IMAGE, alt: 'Next Star coaches',
    },
];

// Partners, in the white bar under About us. Each logo has its own height so
// they read as the same size: the wide Dunkin' wordmark and the heavy Uber
// letters sit a little lower than the swoosh.
// w/h are the files' pixel sizes, so each logo's space is held before it loads.
const PARTNERS: { name: string; href: string; logo: string; w: number; h: number; height: string }[] = [
    { name: 'Nike',    href: 'https://www.nike.com/',          logo: '/assets/partners/nike.webp',  w: 720, h: 257, height: 'clamp(20px, 3.4vw, 46px)' },
    { name: 'Uber',    href: 'https://www.uber.com/',          logo: '/assets/partners/uber.webp',  w: 720, h: 250, height: 'clamp(16px, 2.6vw, 34px)' },
    { name: "Dunkin'", href: 'https://www.dunkindonuts.com/', logo: '/assets/partners/dunkin.png', w: 969, h: 188, height: 'clamp(14px, 2.3vw, 30px)' },
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
// The logos scroll as short pieces of LOGOS_PER_PIECE fixed-width slots that
// all run the same animation, so the strip moves as one. A single strip of
// every logo (17,000 px wide for the clubs) is too big a moving layer for
// iPhone Safari, which then doesn't draw it at all. Every piece is the same
// width, so shifting each by (pieces × 100%) of itself moves the whole strip
// by exactly one copy of the list, and the second copy takes its place.
const LOGOS_PER_PIECE = 8;

function LogoCarousel({ icons, folder, direction, duration = '60s' }: {
  icons: string[];
  folder: 'clubs' | 'colleges';
  direction: 'left' | 'right';
  duration?: string;
}) {
  // Fill the last piece (with the first few logos again) so all pieces match.
  const short = icons.length % LOGOS_PER_PIECE;
  const filled = short ? [...icons, ...icons.slice(0, LOGOS_PER_PIECE - short)] : icons;
  const pieces: string[][] = [];
  for (let i = 0; i < filled.length; i += LOGOS_PER_PIECE) pieces.push(filled.slice(i, i + LOGOS_PER_PIECE));

  const name = `logos-${folder}-${direction}`;
  const shift = `-${pieces.length * 100}%`;
  const [from, to] = direction === 'left' ? ['0%', shift] : [shift, '0%'];
  // Soft edges so logos dissolve into the page rather than hitting a hard cut.
  const maskStyle = 'linear-gradient(to right, transparent, black 12%, black 88%, transparent)';

  return (
    <div className="overflow-hidden w-full" style={{ maskImage: maskStyle, WebkitMaskImage: maskStyle }}>
      <style>{`@keyframes ${name} { from { transform: translateX(${from}); } to { transform: translateX(${to}); } }`}</style>
      <div className="flex w-max">
        {[0, 1].flatMap((copy) => pieces.map((piece, k) => (
          <div
            key={`${copy}-${k}`}
            className="flex flex-shrink-0 items-center"
            style={{
              animation: `${name} ${duration} linear infinite`,
              willChange: 'transform',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden' as any,
            }}
          >
            {piece.map((file, j) => (
              <span key={j} className="flex items-center justify-center flex-shrink-0 w-14 md:w-[72px] h-9 md:h-10 mr-7 md:mr-12">
                <img
                  src={`/assets/icons/${folder}/${encodeURIComponent(file)}`}
                  alt=""
                  aria-hidden="true"
                  className="max-h-full max-w-full object-contain"
                  loading="eager"
                  decoding="async"
                  onError={e => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }}
                />
              </span>
            ))}
          </div>
        )))}
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
// The "On the pitch" photo gallery is switched off for now, so the page ends
// at the social cards.
const SHOW_GALLERY = false;

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
        {ch.cta && ch.to && (
            <Link to={ch.to} className="mt-8 inline-flex items-center gap-1.5 text-[14px] text-white/50 hover:text-white transition-colors">
                {ch.cta} <span aria-hidden="true">→</span>
            </Link>
        )}
    </>
);

// About Us grows in as the photo scrolls up:
//   1. the black card starts growing out of the middle once the photo is
//      a little under half on screen, its text already in place and
//      revealed as the card opens around it;
//   2. it grows at one steady rate to 3/4 of the frame, the text growing
//      with it, and arrives just before the photo fills the screen, so it
//      is already full size (and centred) by the time the photo's top meets
//      the menu bar, even allowing for the card trailing a fast scroll.
//      There is no pinned stretch, so it never keeps growing under the
//      reader's scroll once the photo is in full view.
// REVEAL_HEIGHT above 100 would pin the screen for the extra and spread the
// growth over it too.
// The card is a full-size black layer cut down with clip-path, so growing it
// never re-lays-out the text, and its size eases toward the scroll position
// every frame rather than jumping with each scroll event.
const REVEAL_HEIGHT = 100; // vh the section spans; 100 = no pinned stretch
const GROW_FROM = 0.62; // the photo's top, as a share of the screen height down from the top, when growing starts
const GROW_TO = 0.12;   // ...and when the card reaches full size
const REST = 0.75; // the card's final size, as a share of the frame
const FOLLOW = 0.3; // share of the remaining distance covered each frame

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

const AboutReveal = ({ chapter }: { chapter: Chapter }) => {
    const wrapRef = useRef<HTMLDivElement>(null);
    const cardRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const wrap = wrapRef.current, card = cardRef.current, text = textRef.current;
        if (!wrap || !card || !text) return;
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        // 0 when the photo's top is GROW_FROM of the way down the screen, 1
        // when it is GROW_TO down (plus any pinned stretch).
        const progress = () => {
            const r = wrap.getBoundingClientRect();
            const h = window.innerHeight;
            const span = (GROW_FROM - GROW_TO) * h + (r.height - h);
            return clamp01((GROW_FROM * h - r.top) / span);
        };
        const sizeAt = (p: number) => {
            // One steady rate from start to 3/4: no easing, no held stretch.
            return REST * p;
        };
        const draw = (size: number) => {
            const inset = `${((1 - Math.max(0, size)) / 2) * 100}%`;
            card.style.clipPath = `inset(${inset} ${inset} ${inset} ${inset})`;
            // The text scales with the card: full size at the 3/4 rest.
            text.style.transform = `scale(${Math.max(0.05, size / REST)})`;
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


        draw(current);
        window.addEventListener('scroll', wake, { passive: true });
        window.addEventListener('resize', wake);
        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener('scroll', wake);
            window.removeEventListener('resize', wake);
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
                    <div ref={textRef} className="w-[min(36rem,calc(100vw-3rem))] px-6 text-center [&_a]:justify-center will-change-transform" style={{ transform: 'scale(0.05)' }}>
                        <StoryText chapter={chapter} />
                    </div>
                </div>
            </div>
        </section>
    );
};

// Photo or video beside the text (stacked on phones: text, then the media at
// its own shape so nothing is cropped; `mediaFirst` puts the media on top).
// On phones About uses this too, photo first, in place of the pinned reveal,
// which would squeeze its wide photo into a tall frame and its card into a strip.
const StorySplit = ({ chapter: ch, mediaLeft, mediaFirst = false }: { chapter: Chapter; mediaLeft: boolean; mediaFirst?: boolean }) => (
    <section className="border-b border-white/[0.08] grid md:grid-cols-2">
        <div className={`relative ${ch.video ? 'aspect-video' : 'aspect-[4/3]'} md:aspect-auto md:min-h-[600px] bg-neutral-900 ${mediaFirst ? 'order-1' : 'order-2'} ${mediaLeft ? 'md:order-1' : 'md:order-2'}`}>
            {ch.video ? (
                <video src={ch.video} poster={ch.poster} autoPlay loop muted playsInline preload="metadata" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
                <img src={ch.image} alt={ch.alt} className="absolute inset-0 w-full h-full object-cover" loading="lazy" decoding="async" />
            )}
        </div>
        <div className={`flex items-center px-6 lg:px-8 py-14 md:py-24 ${mediaFirst ? 'order-2' : 'order-1'} ${mediaLeft ? 'md:order-2' : 'md:order-1'}`}>
            <div className={`max-w-xl ${mediaLeft ? 'md:mr-auto md:ml-12 lg:ml-16' : 'md:ml-auto md:mr-12 lg:mr-16'}`}>
                <StoryText chapter={ch} />
            </div>
        </div>
    </section>
);

// The social cards fan out from the middle. On phones the spread is worked
// out from the screen width so the outer cards (rotation included) stay on
// screen with a margin.
const MOBILE_CARD = { w: 132, h: 220 };
const fanFor = (mobile: boolean) => {
    if (!mobile) {
        return [{ x: -330, rotation: -24, z: 1 }, { x: -162, rotation: -12, z: 2 }, { x: 0, rotation: 0, z: 5 }, { x: 162, rotation: 12, z: 2 }, { x: 312, rotation: 22, z: 1 }];
    }
    const rotations = [-10, -5, 0, 5, 10];
    const r = (10 * Math.PI) / 180;
    // How far the outer card reaches past its centre: rotated about a point
    // 85% down, its top corner swings out the most.
    const reach = (MOBILE_CARD.w / 2) * Math.cos(r) + MOBILE_CARD.h * 0.85 * Math.sin(r);
    const step = Math.max(26, Math.min(80, (window.innerWidth / 2 - 16 - reach) / 2));
    return rotations.map((rotation, i) => ({ x: Math.round((i - 2) * step), rotation, z: [1, 2, 5, 2, 1][i] }));
};

/* ─── Component ─────────────────────────────────────────────────────────────── */

const HomePageNew = () => {
    const [countersVisible, setCountersVisible] = useState(false);
    const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

    const statsRef         = useRef<HTMLDivElement>(null);
    const socialSectionRef = useRef<HTMLDivElement>(null);
    const videoRef         = useRef<HTMLVideoElement>(null);

    /* ── Responsive ── */
    useEffect(() => {
        const fn = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', fn);
        return () => window.removeEventListener('resize', fn);
    }, []);

    /* ── Autoplay nudge: some mobile browsers hold back autoplay until asked. ── */
    useEffect(() => {
        videoRef.current?.play().catch(() => { /* the poster stays up */ });
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

        const fanData = fanFor(isMobile);

        gsap.set(cards, { x: 0, rotation: 0, transformOrigin: 'center 85%' });

        ScrollTrigger.create({
            trigger: socialSectionRef.current,
            start: 'top 65%',
            once: true,
            onEnter: () => cards.forEach((card, i) =>
                gsap.to(card, { x: fanData[i].x, rotation: fanData[i].rotation, duration: 0.9, ease: 'power3.out', delay: i * 0.04 })
            ),
        });

        const NUDGE = isMobile ? 16 : 38;
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

            {/* ═══════════════════════ HERO ═══════════════════════ */}
            <section className="relative h-screen overflow-hidden bg-black" style={{ height: '100svh' }}>
                {/* Served from the site itself rather than Appwrite storage, which
                    sent the 107 MB original slowly and kept dropping the line.
                    Phones get a lighter 720p cut. The poster is the first frame,
                    so the hero is never black while the video starts. */}
                <video
                    ref={videoRef}
                    autoPlay
                    loop
                    muted
                    playsInline
                    preload="auto"
                    poster={HERO_POSTER}
                    className="absolute inset-0 w-full h-full object-cover"
                >
                    <source src={HERO_VIDEO_MOBILE} type="video/mp4" media="(max-width: 767px)" />
                    <source src={HERO_VIDEO} type="video/mp4" />
                </video>
                <div className="absolute inset-0 bg-black/20" />

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
                    {/* Larger than the other headings, centred on the grid's height and
                        flush right so it sits against the figures beside it. */}
                    <div className="md:col-span-4 flex md:items-center md:justify-end">
                        <div className="md:text-right">
                            <h2 className="text-white font-medium tracking-[-0.03em] leading-[1.02] text-[clamp(2.75rem,5.6vw,4.75rem)]">
                                Next Star<br />
                                <span className="text-white/40">in numbers</span>
                            </h2>
                            <Link to="/alumni" className="mt-6 inline-flex items-center gap-1.5 text-[14px] text-white/50 hover:text-white transition-colors">
                                See where our alumni play <span aria-hidden="true">→</span>
                            </Link>
                        </div>
                    </div>
                    <div ref={statsRef} className="md:col-span-8 grid grid-cols-2 sm:grid-cols-3 border-t border-l border-white/[0.08]">
                        {STATS.map((stat) => (
                            <div key={stat.label} className="border-r border-b border-white/[0.08] p-5 md:p-8">
                                <AnimatedCounter
                                    isVisible={countersVisible}
                                    endValue={stat.end}
                                    label=""
                                    suffix={stat.suffix}
                                    containerClassName=""
                                    numberClassName="text-white font-medium tracking-[-0.03em] tabular-nums"
                                    numberStyle={{ fontSize: 'clamp(2.1rem, 4.2vw, 3.4rem)', lineHeight: 1, fontFamily: "'LT Wave', sans-serif" }}
                                />
                                <p className="mt-4 md:mt-5 text-[13px] text-white">{stat.label}</p>
                                <p className="mt-1 text-[13px] text-white/40 leading-relaxed">{stat.detail}</p>
                            </div>
                        ))}
                    </div>
                </Container>
            </section>

            <section className="border-b border-white/[0.08] pb-12 md:pb-16">
                <LogoCarousel icons={COLLEGE_ICONS} folder="colleges" direction="left" duration="60s" />
            </section>

            {/* ═══════════════════════ ABOUT US — scroll reveal (phones: photo and text) ═══════════════════════ */}
            {isMobile ? <StorySplit chapter={STORY[0]} mediaLeft={false} mediaFirst /> : <AboutReveal chapter={STORY[0]} />}

            {/* ═══════════════════════ PARTNERS — short white bar ═══════════════════════ */}
            <section aria-labelledby="partners-heading" className="bg-white h-[20vh] min-h-[120px]">
                <Container className="h-full flex items-center gap-4 md:gap-12">
                    <h2 id="partners-heading" className="shrink-0 text-black font-medium tracking-[-0.025em] leading-[1.05] text-[clamp(1.15rem,2.4vw,2rem)]">
                        Our<br className="md:hidden" /> <span className="text-black/40">partners</span>
                    </h2>
                    <div className="shrink-0 w-px self-stretch my-[5vh] bg-black/10" aria-hidden="true" />
                    {/* On the narrowest phones the logos shrink to fit rather than spill off the edge. */}
                    <ul className="flex-1 min-w-0 flex items-center justify-evenly gap-3 md:gap-4">
                        {PARTNERS.map(p => (
                            <li key={p.name} className="min-w-0">
                                <a
                                    href={p.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label={p.name}
                                    className="block max-w-full transition-transform duration-300 ease-out hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black rounded"
                                >
                                    <img
                                        src={p.logo} alt={p.name} width={p.w} height={p.h}
                                        style={{ height: p.height }}
                                        className="block w-auto max-w-full object-contain"
                                        loading="lazy" decoding="async"
                                    />
                                </a>
                            </li>
                        ))}
                    </ul>
                </Container>
            </section>

            {/* ═══════════════════════ FUNDAMENTALS + TEAM — half and half ═══════════════════════ */}
            {STORY.slice(1).map(ch => <StorySplit key={ch.label} chapter={ch} mediaLeft={!!ch.video} />)}

            {/* ═══════════════════════ SOCIAL — white, black text ═══════════════════════ */}
            <section
                ref={socialSectionRef}
                className={`bg-white flex flex-col justify-center overflow-hidden ${isMobile ? 'py-16' : 'py-24 md:py-32'}`}
                data-section="instagram"
            >
                <div className="text-center mb-10 md:mb-12 relative z-10 pointer-events-none select-none">
                    <h2 className={`font-black leading-none text-black uppercase font-lt-wave ${isMobile ? 'text-[clamp(36px,5.5vw,88px)]' : 'text-[clamp(44px,6.5vw,88px)]'}`}>
                        WHAT'S UP
                    </h2>
                    <p className={`font-black text-black uppercase leading-tight font-lt-wave ${isMobile ? 'text-[clamp(28px,4.5vw,72px)]' : 'text-[clamp(36px,5.5vw,72px)]'}`}>
                        ON SOCIALS
                    </p>
                </div>

                <div
                    className="relative flex items-center justify-center"
                    style={{ height: isMobile ? '280px' : '480px' }}
                >
                    {INSTAGRAM_POSTS.map((postUrl, i) => (
                        <a
                            key={i}
                            href={postUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`social-card absolute overflow-hidden shadow-2xl cursor-pointer ${
                                isMobile ? 'w-[132px] h-[220px] rounded-2xl' : 'w-[240px] h-[400px] md:w-[270px] md:h-[440px] rounded-3xl'
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
                    <span className="text-black/40 text-[10px] uppercase tracking-[0.25em] font-lt-wave">Follow</span>
                    <a href="https://www.instagram.com/nextstarsoccer/" target="_blank" rel="noopener noreferrer"
                        className="text-black text-base md:text-lg font-light lowercase tracking-wide hover:opacity-40 transition-opacity duration-300 font-lt-wave">
                        instagram
                    </a>
                    <a href="https://www.facebook.com/nextstarsoccer/" target="_blank" rel="noopener noreferrer"
                        className="text-black text-base md:text-lg font-light lowercase tracking-wide hover:opacity-40 transition-opacity duration-300 font-lt-wave">
                        facebook
                    </a>
                </div>
            </section>

            {/* ═══════════════════════ GALLERY — hidden for now; set SHOW_GALLERY to bring it back ═══════════════════════ */}
            {SHOW_GALLERY && (
            <section>
                <Container className="py-24 md:py-32">
                    <h2 className={`${HEADING} mb-16 md:mb-20`}>On the pitch</h2>
                    <Scatter spots={SCATTER_MOBILE} className="md:hidden" />
                    <Scatter spots={SCATTER_DESKTOP} className="hidden md:block" />
                </Container>
            </section>
            )}

            {/* ═══════════════════════ FOOTER ═══════════════════════ */}
            <Footer />

            <style>{`html { scroll-behavior: smooth; }`}</style>
        </div>
    );
};

// Loading screen until the hero's poster is in; the photos further down follow.
export default withPageImages(HomePageNew, () => ({
    first: [HERO_POSTER],
    more: [ABOUT_IMAGE, TEAM_IMAGE, FUNDAMENTALS_POSTER, ...INSTAGRAM_IMAGES],
}));
