import { useEffect, useRef, useState } from 'react';
import Navigation from '../components/layout/Navigation';
import Footer from '../components/layout/Footer';
import AnimatedCycleText from '../components/common/AnimatedCycleText';
import AnimatedCounter from '../components/common/AnimatedCounter';
import { images } from '../constants/images';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const HomePageNew = () => {
    const [visibleCounters, setVisibleCounters] = useState({ row1: false, row2: false });
    const [paragraphsVisible, setParagraphsVisible] = useState([false, false, false, false]);
    const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

    const statsRef = useRef<HTMLDivElement>(null);
    const aboutRef = useRef<HTMLDivElement>(null);
    const collageSectionRef = useRef<HTMLDivElement>(null);
    const collageTrackRef = useRef<HTMLDivElement>(null);
    const heroRef = useRef<HTMLDivElement>(null);
    const heroImageRef = useRef<HTMLImageElement>(null);
    const backgroundRef = useRef<HTMLDivElement>(null);
    const socialSectionRef = useRef<HTMLDivElement>(null);

    const collageImages = [
        { src: images.collage1,  caption: 'Private Training' },
        { src: images.collage2,  caption: 'Game Day' },
        { src: images.collage3,  caption: 'Academy Clinic' },
        { src: images.collage4,  caption: 'Player Development' },
        { src: images.collage5,  caption: 'Speed & Agility' },
        { src: images.collage6,  caption: 'Technical Work' },
        { src: images.collage7,  caption: 'Small Group' },
        { src: images.collage8,  caption: 'College Prep' },
        { src: images.collage9,  caption: 'Team Training' },
        { src: images.collage10, caption: 'Next Star Showcase' },
    ];

    const instagramImages = [
        images.instagram1,
        images.instagram2,
        images.instagram3,
        images.instagram4,
        images.instagram5,
    ];

    const instagramPosts = [
        'https://www.instagram.com/p/C9N0qy5PKh0/?img_index=1',
        'https://www.instagram.com/p/DAtr1Y2PaBx/?img_index=1',
        'https://www.instagram.com/p/DRf1fmdjthJ/?img_index=1',
        'https://www.instagram.com/p/DMnvmAbxq0Q/?img_index=1',
        'https://www.instagram.com/p/C_Q_ZEwvaEn/?img_index=1',
    ];

    /* ---------------- RESPONSIVE LISTENER ---------------- */
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    /* ---------------- HERO IMAGE OPACITY + BACKGROUND COLOR (MOBILE) ---------------- */
    useEffect(() => {
        if (!isMobile) return;

        const heroImg = heroImageRef.current;
        const bg = backgroundRef.current;
        if (!heroImg || !bg) return;

        const handleScroll = () => {
            const opacity = Math.max(0, 1 - (window.scrollY / (window.innerHeight * 1.5)));
            heroImg.style.opacity = String(opacity);

            const collageEl = collageSectionRef.current;
            if (collageEl) {
                const collageTop = collageEl.getBoundingClientRect().top;
                if (collageTop < window.innerHeight * 0.9) {
                    bg.style.backgroundColor = 'rgb(240,234,214)';
                } else {
                    bg.style.backgroundColor = 'black';
                }
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll();
        return () => window.removeEventListener('scroll', handleScroll);
    }, [isMobile]);

    /* ---------------- DESKTOP: COLLAGE HORIZONTAL SCROLL WITH GSAP ---------------- */
    useEffect(() => {
        if (isMobile) return;
        if (!collageSectionRef.current || !collageTrackRef.current) return;

        const track = collageTrackRef.current;
        const imgs = gsap.utils.toArray<HTMLElement>('.collage-img');
        const scrollDistance = track.scrollWidth - window.innerWidth;

        gsap.to(track, {
            x: -scrollDistance,
            ease: 'none',
            scrollTrigger: {
                trigger: collageSectionRef.current,
                start: 'top top',
                end: () => `+=${scrollDistance * 2}`,
                scrub: 1.3,
                pin: true,
                anticipatePin: 1,
                snap: {
                    snapTo: 1 / (imgs.length - 1),
                    duration: 0.6,
                    ease: 'expo.out',
                },
            },
        });

        // Background color switch via GSAP
        ScrollTrigger.create({
            trigger: collageSectionRef.current,
            start: 'top top',
            end: '+=1',
            onEnter: () =>
                gsap.to(backgroundRef.current, {
                    backgroundColor: 'rgb(240,234,214)',
                    duration: 0.25,
                    ease: 'power1.out',
                }),
            onLeaveBack: () =>
                gsap.to(backgroundRef.current, {
                    backgroundColor: 'black',
                    duration: 0.25,
                    ease: 'power1.out',
                }),
        });

        // Parallax on each image
        imgs.forEach((img, i) => {
            const depth = i % 3 === 0 ? 1 : i % 3 === 1 ? 0.7 : 0.45;
            const yOffset = (i % 2 === 0 ? -1 : 1) * (50 + i * 6);

            gsap.fromTo(
                img,
                { y: yOffset },
                {
                    y: -yOffset,
                    ease: 'none',
                    scrollTrigger: {
                        trigger: collageSectionRef.current,
                        start: 'top bottom',
                        end: 'bottom top',
                        scrub: depth,
                    },
                }
            );
        });

        // Desktop hero image opacity via GSAP-controlled scroll
        const heroImg = heroImageRef.current;
        if (heroImg) {
            const handleScroll = () => {
                const opacity = Math.max(0, 1 - (window.scrollY / (window.innerHeight * 1.5)));
                heroImg.style.opacity = String(opacity);
            };
            window.addEventListener('scroll', handleScroll, { passive: true });
            handleScroll();
            // Store cleanup ref
            (collageSectionRef.current as any)._desktopScrollCleanup = () =>
                window.removeEventListener('scroll', handleScroll);
        }

        return () => {
            const cleanup = (collageSectionRef.current as any)?._desktopScrollCleanup;
            if (cleanup) cleanup();
            ScrollTrigger.killAll();
        };
    }, [isMobile]);

    /* ---------------- SOCIAL CARD FAN-OUT WITH GSAP ---------------- */
    useEffect(() => {
        if (!socialSectionRef.current) return;

        const cards = gsap.utils.toArray<HTMLElement>('.social-card');
        if (cards.length === 0) return;

        // Desktop: wider spread; Mobile: compact spread
        const fanData = isMobile
            ? [
                { x: -220, rotation: -24, z: 1 },
                { x: -110, rotation: -12, z: 2 },
                { x:    0, rotation:   0, z: 5 },
                { x:  110, rotation:  12, z: 2 },
                { x:  208, rotation:  22, z: 1 },
              ]
            : [
                { x: -330, rotation: -24, z: 1 },
                { x: -162, rotation: -12, z: 2 },
                { x:    0, rotation:   0, z: 5 },
                { x:  162, rotation:  12, z: 2 },
                { x:  312, rotation:  22, z: 1 },
              ];

        gsap.set(cards, { x: 0, rotation: 0, transformOrigin: 'center 85%' });

        ScrollTrigger.create({
            trigger: socialSectionRef.current,
            start: 'top 65%',
            once: true,
            onEnter: () => {
                cards.forEach((card, i) => {
                    gsap.to(card, { x: fanData[i].x, rotation: fanData[i].rotation, duration: 0.9, ease: 'power3.out', delay: i * 0.04 });
                });
            },
        });

        const NUDGE = isMobile ? 28 : 38;
        cards.forEach((card, i) => {
            card.addEventListener('mouseenter', () => {
                gsap.to(card, { y: -22, scale: 1.05, zIndex: 20, duration: 0.28, ease: 'power2.out' });
                cards.forEach((other, j) => {
                    if (j === i) return;
                    const shift = j < i ? -NUDGE : NUDGE;
                    gsap.to(other, { x: fanData[j].x + shift, duration: 0.28, ease: 'power2.out' });
                });
            });
            card.addEventListener('mouseleave', () => {
                gsap.to(card, { y: 0, scale: 1, zIndex: fanData[i].z, duration: 0.35, ease: 'power2.out' });
                cards.forEach((other, j) => {
                    if (j === i) return;
                    gsap.to(other, { x: fanData[j].x, duration: 0.35, ease: 'power2.out' });
                });
            });
        });

        return () => ScrollTrigger.killAll();
    }, [isMobile]);

    /* ---------------- PARAGRAPH SLIDE IN ---------------- */
    useEffect(() => {
        const handleScroll = () => {
            if (aboutRef.current) {
                const aboutTop = aboutRef.current.getBoundingClientRect().top;
                const windowHeight = window.innerHeight;
                setParagraphsVisible([
                    aboutTop < windowHeight * 0.7,
                    aboutTop < windowHeight * 0.5,
                    aboutTop < windowHeight * 0.3,
                    aboutTop < windowHeight * 0.1,
                ]);
            }
        };
        window.addEventListener('scroll', handleScroll);
        handleScroll();
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    /* ---------------- SECTION FADE IN ---------------- */
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) entry.target.classList.add('in-view');
                });
            },
            { threshold: 0.2, rootMargin: '-100px' }
        );
        document.querySelectorAll('.section-container').forEach((s) => observer.observe(s));
        return () => observer.disconnect();
    }, []);

    /* ---------------- COUNTERS ---------------- */
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const row = (entry.target as HTMLElement).dataset.row;
                        if (row) setVisibleCounters((prev) => ({ ...prev, [row]: true }));
                    }
                });
            },
            { threshold: 0.3, rootMargin: '0px 0px -10% 0px' }
        );
        document.querySelectorAll('[data-row]').forEach((r) => observer.observe(r));
        return () => observer.disconnect();
    }, []);

    return (
        <div className="min-h-screen relative font-lt-wave overflow-x-hidden">
            {/* GLOBAL BACKGROUND */}
            <div
                ref={backgroundRef}
                className="fixed inset-0 z-0"
                style={{ backgroundColor: 'black', transition: 'background-color 0.4s ease' }}
            />

            {/* HERO IMAGE — opacity updated live via scroll listener */}
            <div className="fixed inset-0 z-0">
                <img
                    ref={heroImageRef}
                    src={images.homeHero}
                    alt="Next Star Soccer Background"
                    className="w-full h-full object-cover"
                    fetchPriority="high"
                    decoding="async"
                    style={{ opacity: 1 }}
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
            </div>

            <div className="relative z-50">
                <Navigation />
            </div>

            {/* ── HERO ── */}
            <section
                ref={heroRef}
                className="relative z-10 h-screen w-full flex items-center justify-center section-container in-view"
                data-section="hero"
            >
                <div className="hero-content px-4">
                    <AnimatedCycleText />
                </div>
            </section>

            {/* ── STATS ── */}
            <section
                ref={statsRef}
                className="relative z-10 min-h-screen py-16 md:py-20 px-4 flex items-center section-container"
                data-section="stats"
            >
                <div className="max-w-6xl mx-auto w-full section-content">
                    <h2 className="text-3xl md:text-4xl font-bold text-center mb-10 md:mb-16 section-title text-white">
                        Next Star In Numbers
                    </h2>
                    <div className="space-y-10 md:space-y-16">
                        <div data-row="row1" className="grid grid-cols-3 gap-3 md:gap-8">
                            <AnimatedCounter isVisible={visibleCounters.row1} endValue={2500} label="Youth Players" suffix="+" />
                            <AnimatedCounter isVisible={visibleCounters.row1} endValue={100} label="Professional Players" suffix="+" />
                            <AnimatedCounter isVisible={visibleCounters.row1} endValue={50} label={'National &\nYouth National\nTeam Players'} suffix="+" />
                        </div>
                        <div data-row="row2" className="grid grid-cols-3 gap-3 md:gap-8">
                            <AnimatedCounter isVisible={visibleCounters.row2} endValue={200} label={'NCAA\nDivision I'} suffix="+" />
                            <AnimatedCounter isVisible={visibleCounters.row2} endValue={50} label={'NCAA\nDivision II'} suffix="+" />
                            <AnimatedCounter isVisible={visibleCounters.row2} endValue={100} label={'NCAA\nDivision III'} suffix="+" />
                        </div>
                    </div>
                </div>
            </section>

            {/* ── ABOUT ── */}
            <section
                ref={aboutRef}
                className="relative z-10 min-h-screen py-16 md:py-20 px-6 flex items-center section-container"
                data-section="about"
            >
                <div className="max-w-4xl mx-auto section-content">
                    <h2 className="text-3xl md:text-4xl font-bold text-center mb-8 section-title text-white">
                        About Next Star
                    </h2>
                    <div className="text-base md:text-lg text-center leading-relaxed space-y-6 text-white">
                        {[
                            'At Next Star, we believe that passion and diligence are the driving forces behind success. Led by a team of experienced coaches and ex-pros, our mission is to nurture these qualities in every player while providing a profound understanding of the game.',
                            'Our approach extends beyond mere technical and physical development; we offer invaluable insights into the intricate dynamics of youth leagues, MLS academy programs, college recruitment, and professional pathways.',
                            "Additionally, we guide sports psychology, nutrition, and discipline, recognizing that holistic development is key to achieving excellence. We understand parents' vital role in a player's journey, and we prioritize their involvement and support.",
                            'Specializing in comprehensive soccer training, Next Star also delivers tailored programs designed to enhance technical skills and physical prowess for individuals and groups alike. Our services encompass mentorship, counseling, and consulting for academies, colleges, and aspiring professionals.',
                        ].map((text, i) => (
                            <p
                                key={i}
                                className="paragraph-slide"
                                style={{
                                    opacity: paragraphsVisible[i] ? 1 : 0,
                                    transform: paragraphsVisible[i] ? 'translateX(0)' : 'translateX(-50px)',
                                    transition: `opacity 0.6s ease ${i * 0.2}s, transform 0.6s ease ${i * 0.2}s`,
                                }}
                            >
                                {text}
                            </p>
                        ))}
                    </div>
                </div>
            </section>

            {/* COLLAGE -- Desktop: GSAP horizontal scroll | Mobile: staggered grid */}
            {isMobile ? (
                <section ref={collageSectionRef} className="relative z-10 py-16 px-4 md:px-16">
                    <div className="max-w-5xl mx-auto">
                        <div className="grid grid-cols-2 gap-3 md:gap-6">
                            {collageImages.map((item, i) => (
                                <div
                                    key={i}
                                    className="flex flex-col gap-2"
                                    style={{ marginTop: i % 2 !== 0 ? '48px' : '0' }}
                                >
                                    <img
                                        src={item.src}
                                        alt={item.caption}
                                        className="w-full h-[160px] sm:h-[240px] object-cover rounded-xl shadow-2xl"
                                        loading="lazy"
                                        decoding="async"
                                    />
                                    <p className="text-[9px] sm:text-[11px] uppercase tracking-[0.18em] text-gray-600 font-medium pl-1">
                                        {item.caption}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            ) : (
                <section ref={collageSectionRef} className="relative h-screen z-10">
                    <div className="sticky top-0 h-screen overflow-hidden">
                        <div ref={collageTrackRef} className="flex items-center h-full gap-24 px-[15vw]">
                            {collageImages.map((item, i) => (
                                <div
                                    key={i}
                                    className="collage-img flex-shrink-0 flex flex-col gap-3"
                                    style={{ marginTop: i % 2 === 0 ? '6vh' : '-4vh' }}
                                >
                                    <img
                                        src={item.src}
                                        alt={item.caption}
                                        className="w-[320px] h-[48vh] object-cover rounded-xl shadow-2xl"
                                    />
                                    <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500 font-medium pl-1">
                                        {item.caption}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* SOCIALS -- GSAP fan-out card deck */}
            <section
                ref={socialSectionRef}
                className={`relative z-10 flex flex-col justify-center overflow-hidden ${isMobile ? 'py-16' : 'h-screen'}`}
                data-section="instagram"
            >
                {/* Centered heading */}
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
                    {instagramPosts.map((postUrl, i) => (
                        <a
                            key={i}
                            href={postUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`social-card absolute rounded-3xl overflow-hidden shadow-2xl cursor-pointer ${
                                isMobile
                                    ? 'w-[150px] h-[250px]'
                                    : 'w-[240px] h-[400px] md:w-[270px] md:h-[440px]'
                            }`}
                            style={{ zIndex: i === 2 ? 10 : 5 - Math.abs(i - 2) }}
                        >
                            <img
                                src={instagramImages[i]}
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
                    <a
                        href="https://www.instagram.com/nextstarsoccer/"
                        target="_blank" rel="noopener noreferrer"
                        className="text-black text-base md:text-lg font-light lowercase tracking-wide hover:opacity-40 transition-opacity duration-300"
                    >
                        instagram
                    </a>
                    <a
                        href="https://www.facebook.com/nextstarsoccer/"
                        target="_blank" rel="noopener noreferrer"
                        className="text-black text-base md:text-lg font-light lowercase tracking-wide hover:opacity-40 transition-opacity duration-300"
                    >
                        facebook
                    </a>
                </div>
            </section>

            <div className="relative z-10">
                <Footer />
            </div>

            <style>{`
        .section-container {
          opacity: 0;
          transform: translateY(100px);
          transition: opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1),
                      transform 0.8s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .section-container.in-view {
          opacity: 1;
          transform: translateY(0);
        }
        .section-content {
          transform: scale(0.95);
          transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.2s;
        }
        .section-container.in-view .section-content {
          transform: scale(1);
        }
        .hero-content {
          animation: fadeInUp 1.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(40px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .section-title {
          opacity: 0;
          transform: translateY(20px);
          transition: opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.3s,
                      transform 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.3s;
        }
        .section-container.in-view .section-title {
          opacity: 1;
          transform: translateY(0);
        }
        html { scroll-behavior: smooth; }
      `}</style>
        </div>
    );
};

export default HomePageNew;
