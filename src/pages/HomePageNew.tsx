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
    { end: 2500, suffix: '+', label: 'Youth Players',                      detail: 'Trained across all age groups since founding.' },
    { end: 100,  suffix: '+', label: 'Professional Players',               detail: 'Alumni competing at the highest levels worldwide.' },
    { end: 50,   suffix: '+', label: 'National Team Players',              detail: 'Representing the U.S. at youth & senior level.' },
    { end: 200,  suffix: '+', label: 'NCAA Division I',                    detail: 'Alumni earning Division I scholarships.' },
    { end: 50,   suffix: '+', label: 'NCAA Division II',                   detail: 'Alumni competing at the Division II level.' },
    { end: 100,  suffix: '+', label: 'NCAA Division III',                  detail: 'Alumni playing at the collegiate Division III level.' },
];

const ABOUT_PARAGRAPHS = [
    'At Next Star, we believe that passion and diligence are the driving forces behind success. Led by a team of experienced coaches and ex-pros, our mission is to nurture these qualities in every player while providing a profound understanding of the game.',
    'Our approach extends beyond mere technical and physical development; we offer invaluable insights into the intricate dynamics of youth leagues, MLS academy programs, college recruitment, and professional pathways.',
    "Additionally, we guide sports psychology, nutrition, and discipline, recognizing that holistic development is key to achieving excellence. We understand parents' vital role in a player's journey, and we prioritize their involvement and support.",
    'Specializing in comprehensive soccer training, Next Star also delivers tailored programs designed to enhance technical skills and physical prowess for individuals and groups alike. Our services encompass mentorship, counseling, and consulting for academies, colleges, and aspiring professionals.',
];

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

const INSTAGRAM_IMAGES = [
    images.instagram1,
    images.instagram2,
    images.instagram3,
    images.instagram4,
    images.instagram5,
];

const INSTAGRAM_POSTS = [
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

    /* ── Shared stat-number style ── */
    const numStyle = {
        fontFamily: "'Fraunces', 'LT Wave', serif",
        fontSize: 'clamp(2.8rem, 7vw, 5.5rem)',
        lineHeight: 1,
    } as const;

    /* ─── JSX ─── */
    return (
        <div className="min-h-screen font-lt-wave overflow-x-hidden">

            {/* ═══════════════════════ HERO ═══════════════════════ */}
            <section className="relative h-screen overflow-hidden bg-black">
                <img
                    src={images.homeHero}
                    alt="Next Star Soccer"
                    className="absolute inset-0 w-full h-full object-cover"
                    fetchPriority="high"
                    decoding="async"
                />
                {/* Subtle dark overlay so nav + text read clearly */}
                <div className="absolute inset-0 bg-black/25" />

                <div className="relative z-50">
                    <Navigation />
                </div>

                {/* Centered headline */}
                <div className="absolute inset-0 flex items-center justify-center z-10">
                    <div className="hero-entrance">
                        <AnimatedCycleText />
                    </div>
                </div>
            </section>

            {/* ═══════════════════════ STATS ═══════════════════════ */}
            <section className="bg-[#f0ead6] py-20 md:py-28 px-6 md:px-12 lg:px-20 fade-section">
                <div className="max-w-6xl mx-auto">

                    {/* Section label */}
                    <div className="mb-8 md:mb-12">
                        <span className="mono-label text-stone-500">01 · By The Numbers</span>
                    </div>

                    {/* Heading */}
                    <div className="mb-12 md:mb-16 max-w-xl">
                        <h2 className="display-heading text-stone-900 text-[clamp(2.2rem,5.5vw,4rem)]">
                            Next Star
                            <br />
                            <em className="font-light text-stone-600 not-italic" style={{ fontStyle: 'italic' }}>
                                in numbers.
                            </em>
                        </h2>
                    </div>

                    {/* Row 1 */}
                    <div data-row="row1" className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                        {STATS.slice(0, 3).map((stat, i) => (
                            <article
                                key={i}
                                className="stat-card rounded-2xl bg-white border border-stone-200 p-6 md:p-8"
                                style={{ animationDelay: `${i * 80}ms` }}
                            >
                                <div className="text-stone-900" style={numStyle}>
                                    <AnimatedCounter
                                        isVisible={visibleCounters.row1}
                                        endValue={stat.end}
                                        label=""
                                        suffix={stat.suffix}
                                        containerClassName=""
                                        numberClassName="leading-none text-stone-900"
                                        numberStyle={numStyle}
                                    />
                                </div>
                                <div className="h-px bg-stone-200 my-4" />
                                <p className="mono-label text-stone-500 mb-1">{stat.label}</p>
                                <p className="text-[13px] text-stone-500 leading-relaxed">{stat.detail}</p>
                            </article>
                        ))}
                    </div>

                    {/* Row 2 */}
                    <div data-row="row2" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {STATS.slice(3).map((stat, i) => (
                            <article
                                key={i}
                                className="stat-card rounded-2xl bg-white border border-stone-200 p-6 md:p-8"
                                style={{ animationDelay: `${(i + 3) * 80}ms` }}
                            >
                                <div style={numStyle}>
                                    <AnimatedCounter
                                        isVisible={visibleCounters.row2}
                                        endValue={stat.end}
                                        label=""
                                        suffix={stat.suffix}
                                        containerClassName=""
                                        numberClassName="leading-none text-stone-900"
                                        numberStyle={numStyle}
                                    />
                                </div>
                                <div className="h-px bg-stone-200 my-4" />
                                <p className="mono-label text-stone-500 mb-1">{stat.label}</p>
                                <p className="text-[13px] text-stone-500 leading-relaxed">{stat.detail}</p>
                            </article>
                        ))}
                    </div>

                </div>
            </section>

            {/* ═══════════════════════ WHO WE ARE ═══════════════════════ */}
            <section
                ref={aboutRef}
                className="bg-black py-20 md:py-28 px-6 md:px-12 lg:px-20 fade-section"
            >
                <div className="max-w-6xl mx-auto">
                    <div className="grid md:grid-cols-12 gap-10 md:gap-16 items-start">

                        {/* Left: heading */}
                        <div className="md:col-span-4 lg:col-span-4 md:sticky md:top-24">
                            <span className="mono-label text-white/35">02 · About</span>
                            <h2 className="display-heading text-white mt-4 text-[clamp(2.2rem,5.5vw,4rem)]">
                                Who We Are
                            </h2>
                            <p className="mt-5 text-[14px] text-white/45 leading-relaxed max-w-[26ch]">
                                A team of coaches, ex-pros, and mentors built around one goal: developing complete players.
                            </p>
                        </div>

                        {/* Right: paragraphs */}
                        <div className="md:col-span-8 lg:col-span-8 space-y-5">
                            {ABOUT_PARAGRAPHS.map((text, i) => (
                                <div
                                    key={i}
                                    className="rounded-2xl border border-white/8 bg-white/[0.04] p-6 md:p-7"
                                    style={{
                                        opacity:    paragraphsVisible[i] ? 1 : 0,
                                        transform:  paragraphsVisible[i] ? 'none' : 'translateY(18px)',
                                        transition: `opacity 0.65s ease ${i * 0.12}s, transform 0.65s ease ${i * 0.12}s`,
                                    }}
                                >
                                    <p className="text-[14px] md:text-[15px] text-white/70 leading-relaxed md:leading-loose">
                                        {text}
                                    </p>
                                </div>
                            ))}
                        </div>

                    </div>
                </div>
            </section>

            {/* ═══════════════════════ IMAGES ═══════════════════════ */}
            <section className="bg-[#f0ead6] py-20 md:py-28 px-6 md:px-12 lg:px-20 fade-section">
                <div className="max-w-6xl mx-auto">

                    <div className="mb-8 md:mb-12">
                        <span className="mono-label text-stone-500">03 · On The Pitch</span>
                    </div>

                    <h2 className="display-heading text-stone-900 text-[clamp(2.2rem,5.5vw,4rem)] mb-10 md:mb-14 max-w-xl">
                        Training, clinics
                        <br />
                        <em className="font-light text-stone-600" style={{ fontStyle: 'italic' }}>
                            & development.
                        </em>
                    </h2>

                    {/* Masonry grid via CSS columns */}
                    <div className="columns-2 md:columns-3 lg:columns-4 gap-3">
                        {COLLAGE_IMAGES.map((item, i) => (
                            <div
                                key={i}
                                className="break-inside-avoid mb-3"
                                style={{ animationDelay: `${i * 40}ms` }}
                            >
                                <div className="overflow-hidden rounded-xl">
                                    <img
                                        src={item.src}
                                        alt={item.caption}
                                        className="w-full object-cover hover:scale-105 transition-transform duration-500"
                                        loading="lazy"
                                        decoding="async"
                                    />
                                </div>
                                <p className="mono-label text-stone-500 mt-2 pl-1">{item.caption}</p>
                            </div>
                        ))}
                    </div>

                </div>
            </section>

            {/* ═══════════════════════ SOCIAL (unchanged) ═══════════════════════ */}
            <section
                ref={socialSectionRef}
                className={`bg-[#f0ead6] flex flex-col justify-center overflow-hidden ${isMobile ? 'py-16' : 'py-24 md:py-32'}`}
                data-section="instagram"
            >
                {/* Heading */}
                <div className="text-center mb-10 md:mb-12 relative z-10 pointer-events-none select-none">
                    <h2 className={`font-black leading-none text-black uppercase ${isMobile ? 'text-[clamp(36px,5.5vw,88px)]' : 'text-[clamp(44px,6.5vw,88px)]'}`}>
                        WHAT'S UP
                    </h2>
                    <p className={`font-black text-black uppercase leading-tight ${isMobile ? 'text-[clamp(28px,4.5vw,72px)]' : 'text-[clamp(36px,5.5vw,72px)]'}`}>
                        ON SOCIALS
                    </p>
                </div>

                {/* Card deck */}
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

                {/* Platform links */}
                <div className={`flex justify-center items-center gap-10 relative z-10 ${isMobile ? 'mt-8' : 'mt-10'}`}>
                    <span className="text-black/30 text-[10px] uppercase tracking-[0.25em]">Follow</span>
                    <a href="https://www.instagram.com/nextstarsoccer/" target="_blank" rel="noopener noreferrer"
                        className="text-black text-base md:text-lg font-light lowercase tracking-wide hover:opacity-40 transition-opacity duration-300">
                        instagram
                    </a>
                    <a href="https://www.facebook.com/nextstarsoccer/" target="_blank" rel="noopener noreferrer"
                        className="text-black text-base md:text-lg font-light lowercase tracking-wide hover:opacity-40 transition-opacity duration-300">
                        facebook
                    </a>
                </div>
            </section>

            {/* ═══════════════════════ FOOTER ═══════════════════════ */}
            <Footer />

            {/* ─── Global styles ─── */}
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..700;1,9..144,300..700&family=Geist+Mono:wght@300..500&display=swap');

                .display-heading {
                    font-family: 'Fraunces', 'LT Wave', serif;
                    font-optical-sizing: auto;
                    line-height: 1.05;
                    letter-spacing: -0.03em;
                }

                .mono-label {
                    font-family: 'Geist Mono', 'SFMono-Regular', monospace;
                    font-size: 10px;
                    letter-spacing: 0.22em;
                    text-transform: uppercase;
                    display: block;
                }

                /* Stat card entrance */
                .stat-card {
                    animation: fadeUp 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
                }
                @keyframes fadeUp {
                    from { opacity: 0; transform: translateY(14px); }
                    to   { opacity: 1; transform: translateY(0); }
                }

                /* Section fade-in */
                .fade-section {
                    opacity: 0;
                    transform: translateY(32px);
                    transition: opacity 0.8s cubic-bezier(0.22, 1, 0.36, 1),
                                transform 0.8s cubic-bezier(0.22, 1, 0.36, 1);
                }
                .fade-section.in-view {
                    opacity: 1;
                    transform: none;
                }

                /* Hero headline entrance */
                .hero-entrance {
                    animation: heroIn 1.2s cubic-bezier(0.22, 1, 0.36, 1) both;
                }
                @keyframes heroIn {
                    from { opacity: 0; transform: translateY(28px); }
                    to   { opacity: 1; transform: translateY(0); }
                }

                html { scroll-behavior: smooth; }
            `}</style>
        </div>
    );
};

export default HomePageNew;
