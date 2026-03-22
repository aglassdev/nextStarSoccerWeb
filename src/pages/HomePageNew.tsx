import { useEffect, useRef, useState } from 'react';
import Navigation from '../components/layout/Navigation';
import AnimatedCycleText from '../components/common/AnimatedCycleText';
import AnimatedCounter from '../components/common/AnimatedCounter';
import { images } from '../constants/images';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const HomePageNew = () => {
    const [visibleCounters, setVisibleCounters] = useState({
        row1: false,
        row2: false,
    });
    const [showInstagramModal, setShowInstagramModal] = useState(false);
    const [paragraphsVisible, setParagraphsVisible] = useState([false, false, false, false]);

    const statsRef = useRef<HTMLDivElement>(null);
    const aboutRef = useRef<HTMLDivElement>(null);
    const collageSectionRef = useRef<HTMLDivElement>(null);
    const collageTrackRef = useRef<HTMLDivElement>(null);
    const heroRef = useRef<HTMLDivElement>(null);
    const backgroundRef = useRef<HTMLDivElement>(null);
    const instagramDeckRef = useRef<HTMLDivElement>(null);

    const collageImages = [
        images.collage1,
        images.collage2,
        images.collage3,
        images.collage4,
        images.collage5,
        images.collage6,
        images.collage7,
        images.collage8,
        images.collage9,
        images.collage10,
    ];

    const instagramImages = [
        images.instagram1,
        images.instagram2,
        images.instagram3,
        images.instagram4,
        images.instagram5,
    ]

    const instagramPosts = [
        'https://www.instagram.com/p/C9N0qy5PKh0/?img_index=1',
        'https://www.instagram.com/p/DAtr1Y2PaBx/?img_index=1',
        'https://www.instagram.com/p/DRf1fmdjthJ/?img_index=1',
        'https://www.instagram.com/p/DMnvmAbxq0Q/?img_index=1',
        'https://www.instagram.com/p/C_Q_ZEwvaEn/?img_index=1',
    ];

    /* ---------------- COLLAGE HORIZONTAL SCROLL WITH GSAP ---------------- */
    useEffect(() => {
        if (!collageSectionRef.current || !collageTrackRef.current) return;

        const track = collageTrackRef.current;
        const imgs = gsap.utils.toArray<HTMLElement>('.collage-img');
        const scrollDistance = track.scrollWidth - window.innerWidth;

        // Horizontal scroll + snap to each image
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

        // Immediate black → eggshell background switch when entering collage
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

        // Parallax effect on images
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

        return () => ScrollTrigger.killAll();
    }, []);

    /* ---------------- INSTAGRAM DECK WITH GSAP ---------------- */
    useEffect(() => {
        if (!instagramDeckRef.current) return;

        const cards = gsap.utils.toArray<HTMLElement>('.instagram-card');

        cards.forEach((card, i) => {
            const offset = i - 2; // Center card is at index 2

            gsap.set(card, {
                x: offset * 200,
                rotation: offset * 6,
                scale: 1,
                zIndex: 10 - Math.abs(offset),
            });

            card.addEventListener('mouseenter', () => {
                gsap.to(card, {
                    scale: 1.1,
                    rotation: 0,
                    zIndex: 50,
                    duration: 0.35,
                    ease: 'power3.out',
                });
            });

            card.addEventListener('mouseleave', () => {
                gsap.to(card, {
                    scale: 1,
                    rotation: offset * 6,
                    zIndex: 10 - Math.abs(offset),
                    duration: 0.4,
                    ease: 'power3.out',
                });
            });
        });
    }, []);

    /* ---------------- PARAGRAPH SLIDE IN ---------------- */
    useEffect(() => {
        const handleScroll = () => {
            if (aboutRef.current) {
                const aboutRect = aboutRef.current.getBoundingClientRect();
                const aboutTop = aboutRect.top;
                const windowHeight = window.innerHeight;

                const paragraphTriggers = [
                    aboutTop < windowHeight * 0.7,
                    aboutTop < windowHeight * 0.5,
                    aboutTop < windowHeight * 0.3,
                    aboutTop < windowHeight * 0.1,
                ];

                setParagraphsVisible(paragraphTriggers);
            }
        };

        window.addEventListener('scroll', handleScroll);
        handleScroll();

        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    /* ---------------- SECTION FADE IN ---------------- */
    useEffect(() => {
        const observerOptions = {
            threshold: 0.2,
            rootMargin: '-100px',
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('in-view');
                }
            });
        }, observerOptions);

        const sections = document.querySelectorAll('.section-container');
        sections.forEach((section) => observer.observe(section));

        return () => observer.disconnect();
    }, []);

    /* ---------------- COUNTERS ---------------- */
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const target = entry.target as HTMLElement;
                        const row = target.dataset.row;
                        if (row) {
                            setVisibleCounters((prev) => ({ ...prev, [row]: true }));
                        }
                    }
                });
            },
            {
                threshold: 0.3,
                rootMargin: '0px 0px -10% 0px',
            }
        );

        const rows = document.querySelectorAll('[data-row]');
        rows.forEach((row) => observer.observe(row));

        return () => observer.disconnect();
    }, []);

    return (
        <div className="min-h-screen relative font-lt-wave overflow-x-hidden">
            {/* GLOBAL BACKGROUND */}
            <div
                ref={backgroundRef}
                className="fixed inset-0 z-0 transition-colors duration-500"
                style={{ backgroundColor: 'black' }}
            />

            <div className="fixed inset-0 z-0">
                <img
                    src={images.homeHero}
                    alt="Next Star Soccer Background"
                    className="w-full h-full object-cover"
                    style={{
                        opacity: Math.max(0, 1 - (window.scrollY / (window.innerHeight * 1.5))),
                        transition: 'opacity 0.3s ease-out'
                    }}
                    onError={(e) => {
                        e.currentTarget.style.display = 'none';
                    }}
                />
            </div>

            <div className="relative z-50">
                <Navigation />
            </div>

            <section
                ref={heroRef}
                className="relative z-10 h-screen w-full flex items-center justify-center section-container in-view"
                data-section="hero"
            >
                <div className="hero-content">
                    <AnimatedCycleText />
                </div>
            </section>

            <section
                ref={statsRef}
                className="relative z-10 min-h-screen py-20 px-4 flex items-center section-container"
                data-section="stats"
            >
                <div className="max-w-6xl mx-auto w-full section-content">
                    <h2 className="text-4xl font-bold text-center mb-16 section-title text-white">
                        Next Star In Numbers
                    </h2>
                    <div className="space-y-16">
                        <div data-row="row1" className="grid grid-cols-3 gap-8">
                            <AnimatedCounter
                                isVisible={visibleCounters.row1}
                                endValue={1000}
                                label="Youth Players"
                                suffix="+"
                            />
                            <AnimatedCounter
                                isVisible={visibleCounters.row1}
                                endValue={100}
                                label="Professional Players"
                                suffix="+"
                            />
                            <AnimatedCounter
                                isVisible={visibleCounters.row1}
                                endValue={50}
                                label={'National & Youth\nNational Team Players'}
                                suffix="+"
                            />
                        </div>

                        <div data-row="row2" className="grid grid-cols-3 gap-8">
                            <AnimatedCounter
                                isVisible={visibleCounters.row2}
                                endValue={200}
                                label={'Collegiate NCAA\nDivision I Players'}
                                suffix="+"
                            />
                            <AnimatedCounter
                                isVisible={visibleCounters.row2}
                                endValue={50}
                                label={'Collegiate NCAA\nDivision II Players'}
                                suffix="+"
                            />
                            <AnimatedCounter
                                isVisible={visibleCounters.row2}
                                endValue={100}
                                label={'Collegiate NCAA\nDivision III Players'}
                                suffix="+"
                            />
                        </div>
                    </div>
                </div>
            </section>

            <section
                ref={aboutRef}
                className="relative z-10 min-h-screen py-20 px-4 flex items-center section-container"
                data-section="about"
            >
                <div className="max-w-4xl mx-auto section-content">
                    <h2 className="text-4xl font-bold text-center mb-8 section-title text-white">
                        About Next Star
                    </h2>
                    <div className="text-lg text-center leading-relaxed space-y-6 text-white">
                        <p
                            className="paragraph-slide"
                            style={{
                                opacity: paragraphsVisible[0] ? 1 : 0,
                                transform: paragraphsVisible[0] ? 'translateX(0)' : 'translateX(-50px)',
                                transition: 'opacity 0.6s ease, transform 0.6s ease'
                            }}
                        >
                            At Next Star, we believe that passion and diligence are the driving
                            forces behind success. Led by a team of experienced coaches and
                            ex-pros, our mission is to nurture these qualities in every player
                            while providing a profound understanding of the game.
                        </p>
                        <p
                            className="paragraph-slide"
                            style={{
                                opacity: paragraphsVisible[1] ? 1 : 0,
                                transform: paragraphsVisible[1] ? 'translateX(0)' : 'translateX(-50px)',
                                transition: 'opacity 0.6s ease 0.2s, transform 0.6s ease 0.2s'
                            }}
                        >
                            Our approach extends beyond mere technical and physical development;
                            we offer invaluable insights into the intricate dynamics of youth
                            leagues, MLS academy programs, college recruitment, and professional
                            pathways.
                        </p>
                        <p
                            className="paragraph-slide"
                            style={{
                                opacity: paragraphsVisible[2] ? 1 : 0,
                                transform: paragraphsVisible[2] ? 'translateX(0)' : 'translateX(-50px)',
                                transition: 'opacity 0.6s ease 0.4s, transform 0.6s ease 0.4s'
                            }}
                        >
                            Additionally, we guide sports psychology, nutrition, and discipline,
                            recognizing that holistic development is key to achieving
                            excellence. We understand parents' vital role in a player's journey,
                            and we prioritize their involvement and support.
                        </p>
                        <p
                            className="paragraph-slide"
                            style={{
                                opacity: paragraphsVisible[3] ? 1 : 0,
                                transform: paragraphsVisible[3] ? 'translateX(0)' : 'translateX(-50px)',
                                transition: 'opacity 0.6s ease 0.6s, transform 0.6s ease 0.6s'
                            }}
                        >
                            Specializing in comprehensive soccer training, Next Star also
                            delivers tailored programs designed to enhance technical skills and
                            physical prowess for individuals and groups alike. Our services
                            encompass mentorship, counseling, and consulting for academies,
                            colleges, and aspiring professionals.
                        </p>
                    </div>
                </div>
            </section>

            {/* COLLAGE - GSAP Horizontal Scroll */}
            <section ref={collageSectionRef} className="relative h-screen z-10">
                <div className="sticky top-0 h-screen overflow-hidden">
                    <div ref={collageTrackRef} className="flex items-center h-full gap-32 px-[15vw]">
                        {collageImages.map((img, i) => (
                            <img
                                key={i}
                                src={img}
                                alt={`Collage ${i + 1}`}
                                className="collage-img w-[360px] h-[52vh] object-cover rounded-2xl shadow-2xl flex-shrink-0"
                                style={{ marginTop: i % 2 === 0 ? '6vh' : '-4vh' }}
                            />
                        ))}
                    </div>
                </div>
            </section>

            {/* INSTAGRAM - GSAP Deck */}
            <section className="relative z-10 py-32 px-4 section-container" data-section="instagram">
                <div className="max-w-6xl mx-auto section-content">
                    <div className="text-center mb-16">
                        <h2 className="text-5xl font-bold mb-2 text-black">
                            WHAT'S UP
                        </h2>
                        <h3 className="text-3xl text-black" style={{ fontFamily: 'serif' }}>
                            ON SOCIALS
                        </h3>
                    </div>

                    <div ref={instagramDeckRef} className="relative flex justify-center items-center h-[420px] mb-12">
                        {instagramPosts.map((postUrl, i) => (
                            <a
                                key={i}
                                href={postUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="instagram-card absolute w-[280px] h-[380px] rounded-2xl bg-gray-900 shadow-2xl cursor-pointer overflow-hidden"
                            >
                                <img
                                    src={instagramImages[i]}
                                    alt={`Instagram post ${i + 1}`}
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 opacity-0 hover:opacity-20 transition-opacity duration-300" />
                            </a>
                        ))}
                    </div>

                    <div className="text-center mt-20">
                        <button
                            onClick={() => setShowInstagramModal(true)}
                            className="inline-block"
                        >
                            <div className="instagram-gradient-border p-[2px] rounded-xl hover:scale-105 transition-transform duration-300">
                                <div className="bg-black px-10 py-5 rounded-xl hover:bg-gray-900 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <svg
                                            className="w-10 h-10 instagram-gradient-text"
                                            fill="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                                        </svg>
                                        <div className="text-left">
                                            <div className="instagram-gradient-text text-xl font-bold">@nextstarsoccer</div>
                                            <div className="text-gray-400 text-sm">Follow on Instagram</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </button>
                    </div>
                </div>
            </section>

            <footer className="relative z-10 py-8 px-4 bg-black">
                <div className="max-w-6xl mx-auto text-center">
                    <p className="text-sm text-gray-400">
                        © {new Date().getFullYear()} Next Star Soccer. All rights reserved.
                    </p>
                </div>
            </footer>

            {showInstagramModal && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-90 p-4"
                    onClick={() => setShowInstagramModal(false)}
                >
                    <div
                        className="relative bg-white rounded-lg w-full max-w-md h-[680px] overflow-hidden shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setShowInstagramModal(false)}
                            className="absolute top-4 right-4 z-10 bg-black bg-opacity-70 hover:bg-opacity-90 text-white rounded-full p-2 transition-colors"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        <iframe
                            src="https://www.instagram.com/nextstarsoccer/"
                            className="w-full h-full border-0 rounded-lg"
                            title="Instagram Profile"
                            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                        />
                    </div>
                </div>
            )}

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
          from {
            opacity: 0;
            transform: translateY(40px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
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

        .instagram-gradient-border {
          background: linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%);
        }

        .instagram-gradient-text {
          background: linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        html {
          scroll-behavior: smooth;
        }
      `}</style>
        </div>
    );
};

export default HomePageNew;