import { useEffect, useRef, useState } from 'react';
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
    { end: 2500, suffix: '+', label: 'Youth Players',        detail: 'Trained across all age groups since founding.' },
    { end: 100,  suffix: '+', label: 'Professional Players', detail: 'Alumni competing at the highest levels worldwide.' },
    { end: 50,   suffix: '+', label: 'National Team Players',detail: 'Representing countries around the world at youth & senior national team level.' },
    { end: 200,  suffix: '+', label: 'NCAA Division I',      detail: 'Alumni playing at the collegiate Division I level.' },
    { end: 50,   suffix: '+', label: 'NCAA Division II',     detail: 'Alumni playing at the collegiate Division II level.' },
    { end: 100,  suffix: '+', label: 'NCAA Division III',    detail: 'Alumni playing at the collegiate Division III level.' },
];

const ABOUT_PARAGRAPHS = [
    'At Next Star, we believe that passion and diligence are the driving forces behind success. Led by a team of experienced coaches and ex-pros, our mission is to nurture these qualities in every player while providing a profound understanding of the game.',
    'Our approach extends beyond mere technical and physical development; we offer invaluable insights into the intricate dynamics of youth leagues, MLS academy programs, college recruitment, and professional pathways.',
    "Additionally, we guide sports psychology, nutrition, and discipline, recognizing that holistic development is key to achieving excellence. We understand parents' vital role in a player's journey, and we prioritize their involvement and support.",
    'Specializing in comprehensive soccer training, Next Star also delivers tailored programs designed to enhance technical skills and physical prowess for individuals and groups alike. Our services encompass mentorship, counseling, and consulting for academies, colleges, and aspiring professionals.',
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
  return (
    <div className="overflow-hidden w-full" style={{ maskImage: 'linear-gradient(to right, transparent, black 8%, black 92%, transparent)' }}>
      <div
        className={`flex items-center gap-8 w-max ${direction === 'left' ? 'carousel-left' : 'carousel-right'}`}
        style={{ animationDuration: duration }}
      >
        {doubled.map((file, i) => (
          <img
            key={i}
            src={`/assets/icons/${folder}/${encodeURIComponent(file)}`}
            alt=""
            aria-hidden="true"
            className="h-12 w-auto object-contain flex-shrink-0"
            loading="lazy"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ))}
      </div>
    </div>
  );
}

const COLLAGE_IMAGES = [
    { src: images.collage1,  caption: 'Private Training'   },
    { src: images.collage2,  caption: 'Game Day'           },
    { src: images.collage3,  caption: 'Academy Clinic'     },
    { src: images.collage4,  caption: 'Player Development' },
    { src: images.collage5,  caption: 'Speed & Agility'    },
    { src: images.collage6,  caption: 'Technical Work'     },
    { src: images.collage7,  caption: 'Small Group'        },
    { src: images.collage8,  caption: 'College Prep'       },
    { src: images.collage9,  caption: 'Team Training'      },
    { src: images.collage10, caption: 'Next Star Showcase' },
];

const INSTAGRAM_IMAGES = [images.instagram1, images.instagram2, images.instagram3, images.instagram4, images.instagram5];
const INSTAGRAM_POSTS  = [
    'https://www.instagram.com/p/C9N0qy5PKh0/?img_index=1',
    'https://www.instagram.com/p/DAtr1Y2PaBx/?img_index=1',
    'https://www.instagram.com/p/DRf1fmdjthJ/?img_index=1',
    'https://www.instagram.com/p/DMnvmAbxq0Q/?img_index=1',
    'https://www.instagram.com/p/C_Q_ZEwvaEn/?img_index=1',
];

/* ─── Component ─────────────────────────────────────────────────────────────── */

const HomePageNew = () => {
    const [visibleCounters, setVisibleCounters] = useState({ row1: false, row2: false });
    const [paragraphsVisible, setParagraphsVisible] = useState([false, false, false, false]);
    const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
    const [videoReady, setVideoReady] = useState(false);

    const aboutRef         = useRef<HTMLDivElement>(null);
    const socialSectionRef = useRef<HTMLDivElement>(null);

    /* ── Responsive ── */
    useEffect(() => {
        const fn = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', fn);
        return () => window.removeEventListener('resize', fn);
    }, []);

    /* ── Paragraph reveal ── */
    useEffect(() => {
        const fn = () => {
            if (!aboutRef.current) return;
            const top = aboutRef.current.getBoundingClientRect().top;
            const h   = window.innerHeight;
            setParagraphsVisible([top < h * 0.78, top < h * 0.6, top < h * 0.42, top < h * 0.24]);
        };
        window.addEventListener('scroll', fn);
        fn();
        return () => window.removeEventListener('scroll', fn);
    }, []);

    /* ── Section fade-in ── */
    useEffect(() => {
        const obs = new IntersectionObserver(
            (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('in-view'); }),
            { threshold: 0.08, rootMargin: '-40px' }
        );
        document.querySelectorAll('.fade-section').forEach((s) => obs.observe(s));
        return () => obs.disconnect();
    }, []);

    /* ── Counter reveal ── */
    useEffect(() => {
        const obs = new IntersectionObserver(
            (entries) => entries.forEach((e) => {
                if (e.isIntersecting) {
                    const row = (e.target as HTMLElement).dataset.row;
                    if (row) setVisibleCounters((p) => ({ ...p, [row]: true }));
                }
            }),
            { threshold: 0.2 }
        );
        document.querySelectorAll('[data-row]').forEach((r) => obs.observe(r));
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
        <div className="min-h-screen font-lt-wave overflow-x-hidden">

            {/* ═══════════════════════ VIDEO LOADING OVERLAY ═══════════════════════ */}
            <div
                className="fixed inset-0 z-[9999] bg-black flex items-center justify-center transition-opacity duration-700 pointer-events-none"
                style={{ opacity: videoReady ? 0 : 1 }}
            >
                <img
                    src="/assets/images/NextStarBall.png"
                    alt=""
                    className="w-20 h-20 object-contain animate-pulse"
                />
            </div>

            {/* ═══════════════════════ HERO ═══════════════════════ */}
            <section className="relative h-screen overflow-hidden bg-black">
                <video
                    src="https://nyc.cloud.appwrite.io/v1/storage/buckets/6a1fa457000995c2a83f/files/6a1fa81c001bd64cf360/view?project=68577380002195dec512"
                    autoPlay
                    loop
                    muted
                    playsInline
                    onCanPlay={() => setVideoReady(true)}
                    className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/20" />

                {/* Navigation sits in normal flow but is fixed — placement here keeps z-order clean */}
                <Navigation />

                {/* Centered headline */}
                <div className="absolute inset-0 flex items-center justify-center z-10">
                    <div className="hero-entrance">
                        <AnimatedCycleText />
                    </div>
                </div>
            </section>

            {/* ═══════════════ STATS + CAROUSELS (one unified section) ══════════════ */}
            <div className="bg-[#f0ead6] fade-section">

            {/* Clubs carousel */}
            <div className="pt-16 pb-3">
              <LogoCarousel icons={CLUB_ICONS} folder="clubs" direction="right" duration="110s" />
            </div>

            {/* Stats content */}
            <section className="py-10 md:py-14 px-6 md:px-12 lg:px-20">
                <div className="max-w-6xl mx-auto">

                    {/* Section label */}
                    <div className="mb-8 md:mb-12">
                        <span className="section-label text-stone-500">01 · By The Numbers</span>
                    </div>

                    {/* Heading */}
                    <div className="mb-12 md:mb-16">
                        <h2 className="text-stone-900 font-bold text-[clamp(2rem,5vw,3.5rem)] leading-tight">
                            Next Star
                        </h2>
                        <h2 className="text-stone-400 font-light text-[clamp(2rem,5vw,3.5rem)] leading-tight">
                            in numbers.
                        </h2>
                    </div>

                    {/* Row 1 */}
                    <div data-row="row1" className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                        {STATS.slice(0, 3).map((stat, i) => (
                            <article key={i} className="stat-card rounded-2xl bg-white border border-stone-200/80 p-6 md:p-8">
                                <AnimatedCounter
                                    isVisible={visibleCounters.row1}
                                    endValue={stat.end}
                                    label=""
                                    suffix={stat.suffix}
                                    containerClassName=""
                                    numberClassName="leading-none text-stone-900 font-bold"
                                    numberStyle={{ fontSize: 'clamp(2.8rem, 6.5vw, 5rem)', lineHeight: 1, fontFamily: "'LT Wave', sans-serif" }}
                                />
                                <div className="h-px bg-stone-200 my-4" />
                                <p className="section-label text-stone-500 mb-1.5">{stat.label}</p>
                                <p className="text-[13px] text-stone-400 leading-relaxed">{stat.detail}</p>
                            </article>
                        ))}
                    </div>

                    {/* Row 2 */}
                    <div data-row="row2" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {STATS.slice(3).map((stat, i) => (
                            <article key={i} className="stat-card rounded-2xl bg-white border border-stone-200/80 p-6 md:p-8">
                                <AnimatedCounter
                                    isVisible={visibleCounters.row2}
                                    endValue={stat.end}
                                    label=""
                                    suffix={stat.suffix}
                                    containerClassName=""
                                    numberClassName="leading-none text-stone-900 font-bold"
                                    numberStyle={{ fontSize: 'clamp(2.8rem, 6.5vw, 5rem)', lineHeight: 1, fontFamily: "'LT Wave', sans-serif" }}
                                />
                                <div className="h-px bg-stone-200 my-4" />
                                <p className="section-label text-stone-500 mb-1.5">{stat.label}</p>
                                <p className="text-[13px] text-stone-400 leading-relaxed">{stat.detail}</p>
                            </article>
                        ))}
                    </div>

                </div>
            </section>

            {/* Colleges carousel */}
            <div className="pt-3 pb-16">
              <LogoCarousel icons={COLLEGE_ICONS} folder="colleges" direction="left" duration="60s" />
            </div>

            </div>{/* end unified stats section */}

            {/* ═══════════════════════ WHO WE ARE ═══════════════════════ */}
            <section
                ref={aboutRef}
                className="bg-black py-20 md:py-28 px-6 md:px-12 lg:px-20 fade-section"
            >
                <div className="max-w-6xl mx-auto">
                    <div className="grid md:grid-cols-12 gap-10 md:gap-16 items-start">

                        {/* Left: sticky heading */}
                        <div className="md:col-span-4 md:sticky md:top-28">
                            <span className="section-label text-white/30">02 · About</span>
                            <h2 className="text-white font-bold text-[clamp(2rem,5vw,3.5rem)] leading-tight mt-4">
                                Who We Are
                            </h2>
                            <p className="mt-4 text-[14px] text-white/40 leading-relaxed max-w-[28ch]">
                                A team of coaches, ex-pros, and mentors built around one goal: developing complete players.
                            </p>
                        </div>

                        {/* Right: numbered paragraphs, no borders */}
                        <div className="md:col-span-8 space-y-10 md:space-y-12">
                            {ABOUT_PARAGRAPHS.map((text, i) => (
                                <div
                                    key={i}
                                    style={{
                                        opacity:    paragraphsVisible[i] ? 1 : 0,
                                        transform:  paragraphsVisible[i] ? 'none' : 'translateY(16px)',
                                        transition: `opacity 0.65s ease ${i * 0.12}s, transform 0.65s ease ${i * 0.12}s`,
                                    }}
                                >
                                    {/* Number + rule */}
                                    <div className="flex items-center gap-3 mb-4">
                                        <span className="section-label text-white/20">0{i + 1}</span>
                                        <div className="h-px flex-1 bg-white/10" />
                                    </div>
                                    {/* Text */}
                                    <p className="text-[14px] md:text-[15px] text-white/65 leading-relaxed md:leading-loose">
                                        {text}
                                    </p>
                                </div>
                            ))}
                        </div>

                    </div>
                </div>
            </section>

            {/* ═══════════════════════ SOCIAL (unchanged) ═══════════════════════ */}
            <section
                ref={socialSectionRef}
                className={`bg-[#f0ead6] flex flex-col justify-center overflow-hidden ${isMobile ? 'py-16' : 'py-24 md:py-32'}`}
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
                    <span className="text-black/30 text-[10px] uppercase tracking-[0.25em] font-lt-wave">Follow</span>
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

            {/* ═══════════════════════ PHOTO COLLAGE (after socials) ═══════════════════════ */}
            <section className="bg-[#f0ead6] py-12 md:py-16 px-6 md:px-12 lg:px-20 fade-section">
                <div className="max-w-6xl mx-auto">
                    <div className="columns-2 md:columns-3 lg:columns-4 gap-3">
                        {COLLAGE_IMAGES.map((item, i) => (
                            <div key={i} className="break-inside-avoid mb-3">
                                <div className="overflow-hidden rounded-xl">
                                    <img
                                        src={item.src}
                                        alt={item.caption}
                                        className="w-full object-cover hover:scale-105 transition-transform duration-500"
                                        loading="lazy"
                                        decoding="async"
                                    />
                                </div>
                                <p className="section-label text-stone-400 mt-2 pl-1">{item.caption}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══════════════════════ FOOTER ═══════════════════════ */}
            <Footer />

            {/* ─── Global styles ─── */}
            <style>{`
                /* Section labels — LT Wave small uppercase */
                .section-label {
                    font-family: 'LT Wave', sans-serif;
                    font-size: 10px;
                    letter-spacing: 0.22em;
                    text-transform: uppercase;
                    display: block;
                }

                /* Stat card entrance */
                .stat-card {
                    animation: fadeUp 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
                }

                /* Section fade-in */
                .fade-section {
                    opacity: 0;
                    transform: translateY(28px);
                    transition: opacity 0.85s cubic-bezier(0.22, 1, 0.36, 1),
                                transform 0.85s cubic-bezier(0.22, 1, 0.36, 1);
                }
                .fade-section.in-view {
                    opacity: 1;
                    transform: none;
                }

                /* Hero headline entrance */
                .hero-entrance {
                    animation: heroIn 1.2s cubic-bezier(0.22, 1, 0.36, 1) both;
                }

                @keyframes fadeUp {
                    from { opacity: 0; transform: translateY(14px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes heroIn {
                    from { opacity: 0; transform: translateY(24px); }
                    to   { opacity: 1; transform: translateY(0); }
                }

                html { scroll-behavior: smooth; }
            `}</style>
        </div>
    );
};

export default HomePageNew;
