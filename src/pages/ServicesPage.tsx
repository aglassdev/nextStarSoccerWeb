import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navigation from '../components/layout/Navigation';
import Footer from '../components/layout/Footer';

interface Service {
    id: string;
    name: string;
    frontImage: string;
    pricing: string;
    description: string;
    buttonType: 'request-in-app' | 'calendar' | 'camps';
}

const services: Service[] = [
    {
        id: 'individual',
        name: 'Individual Session',
        frontImage: '/assets/images/individual.png',
        pricing: '60 Minutes | $200 Per Player',
        description: 'Private training offers a bespoke and results-driven approach to achieving your goals. One of our professional coaches will tailor each session to your specific needs, build on your strengths, and improve your weaknesses. Whether your goal is becoming a starter for your club or school, or to reach the collegiate or professional level, our private sessions ensure your development is aligned with the world\'s best practices and align with your personal objectives. In addition, we provide a comprehensive training plan and regularly evaluate your progress to ensure continuous development.',
        buttonType: 'request-in-app',
    },
    {
        id: 'two-person',
        name: 'Two Person Session',
        frontImage: '/assets/images/twoPerson.png',
        pricing: '60 Minutes | $125 Per Player',
        description: 'Just like individual sessions, each player is provided a personalized training program, while the semi-private dynamic fosters a more competitive environment. Players can either request the session with a partner, or we can pair them with one. We typically pair players by their current level and ability, or shared training goals. Semi-private sessions are scheduled by the client.',
        buttonType: 'request-in-app',
    },
    {
        id: 'small-group',
        name: 'Small Group Session',
        frontImage: '/assets/images/smallGroup.png',
        pricing: '60 Minutes | $85 Per Player (3–4 Players)',
        description: 'Small groups are still a high-quality training experience, though it is less individualized compared to a fully private session. Sessions provide a competitive environment fostering high-quality training. Just as with Two Person sessions, players can request their partners or we will pair you with a group at a similar caliber. Each session is designed with drills and games that enhance technical ability and simulate in-game scenarios, effectively meeting the needs of each player. Sessions are organized in advance and come at a more accessible price point, allowing athletes to train more frequently.',
        buttonType: 'request-in-app',
    },
    {
        id: 'large-group',
        name: 'Large Group Session',
        frontImage: '/assets/images/largeGroup.png',
        pricing: '120 Minutes | $50 Per Player (5+ Players)',
        description: 'As our most popular service, large group sessions offer quality instruction with high intensity drills and games, but with a more open atmosphere. The one-size-fits-all program allows athletes to focus on personal areas of improvement, while remaining suitable for players of various ages and skill levels. Sessions typically include drills focused on dribbling, receiving and passing, and shooting, followed by small-sided games, and occasionally fitness work. Due to club seasons, it is common for groups to be small, allowing for a more personalized experience. Sessions are held daily, and drop-ins are allowed (for registered players only). The full schedule can be found in the Calendar.',
        buttonType: 'calendar',
    },
    {
        id: 'parent-consultation',
        name: 'Parent Consultation',
        frontImage: '/assets/images/parentConsultation.png',
        pricing: 'In Person: 60 Min | $200\nVia Phone: 60 Min | $150',
        description: 'For parents seeking additional guidance regarding a player\'s current skill, fitness levels, progress, academy opportunities, college recruitment process, international exposure, or anything soccer-related, a consultation offers a private setting to address all your questions. This one-on-one consultation provides an in-depth analysis of your child\'s current state, ensuring that all your concerns are thoroughly answered, while also providing recommendations for the next steps in their development.',
        buttonType: 'request-in-app',
    },
    {
        id: 'game-analysis',
        name: 'Game Analysis',
        frontImage: '/assets/images/gameAnalysis.png',
        pricing: 'In Person: $200 | Online Meeting: $150 | Video Recording: $150',
        description: 'For parents seeking additional guidance regarding a player\'s current skill, fitness levels, progress, academy opportunities, college recruitment process, international exposure, or anything soccer-related, a consultation offers a private setting to address all your questions. This one-on-one consultation provides an in-depth analysis of your child\'s current state, ensuring that all your concerns are thoroughly answered, while also providing recommendations for the next steps in their development.',
        buttonType: 'request-in-app',
    },
    {
        id: 'player-report',
        name: 'Player Report',
        frontImage: '/assets/images/playerReport.png',
        pricing: '$75 Per Player | Available after a minimum of 5 training sessions',
        description: 'A comprehensive written report on a player\'s current progress, skill, fitness, and mental state. This detailed evaluation gives you an understanding of your development, highlighting your personal strengths and areas needing improvement. The report shows both physical and technical ability, but also intangibles such as mental focus and work ethic, allowing for a holistic evaluation and helps inform future training plans.',
        buttonType: 'request-in-app',
    },
    {
        id: 'camps',
        name: 'Camps',
        frontImage: '/assets/images/camps.png',
        pricing: 'Varies by Location and Duration',
        description: 'Our specialized soccer camps offer intensive training experiences designed to accelerate player development. Led by professional coaches and former players, camps combine technical training, tactical education, and competitive play in a focused environment. Available throughout the year at various locations, our camps cater to different age groups and skill levels.',
        buttonType: 'camps',
    },
    {
        id: 'team-training',
        name: 'Team Training',
        frontImage: '/assets/images/teamTraining.png',
        pricing: 'Custom Pricing Based on Team Size',
        description: 'Our tailored full-team training programs deliver a dynamic and comprehensive approach to enhancing skills, refining tactics, and boosting overall team performance. Designed for teams of all levels, these sessions are fully customized to meet the unique needs of both the collective group and individual players. Starting with technical drills to hone individual skills, we progress to passing exercises and 1v1 challenges that sharpen key aspects of game play. The program concludes with full-team games that simulate real match conditions, fostering collaboration and team cohesion. Each session is carefully planned in partnership with the team\'s coach, ensuring alignment with their goals and player development objectives. With a focus on both the individual and the team, our training ensures growth in every aspect of the game, preparing players to perform at their best, both on and off the field.',
        buttonType: 'request-in-app',
    },
    {
        id: 'professional-clinics',
        name: 'Professional Clinics',
        frontImage: '/assets/images/professionalClinics.png',
        pricing: 'Special Event Pricing',
        description: 'Professional clinics feature current and former professional players who share their expertise and experience. These unique opportunities allow players to learn directly from those who have competed at the highest levels. Clinics cover advanced techniques, professional mentality, and insights into what it takes to succeed in professional soccer.',
        buttonType: 'request-in-app',
    },
    {
        id: 'showcases',
        name: 'Showcases',
        frontImage: '/assets/images/showcases.png',
        pricing: 'Event-Based Pricing',
        description: 'Showcases provide players with opportunities to display their talents in front of college coaches, scouts, and recruiters. These events are carefully organized to maximize exposure and create pathways to the next level of competition. We guide players through the showcase process and help them make the most of these important opportunities.',
        buttonType: 'request-in-app',
    },
];

const ServiceCard: React.FC<{ service: Service }> = ({ service }) => {
    const [isFlipped, setIsFlipped] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const navigate = useNavigate();

    const renderButton = () => {
        if (service.buttonType === 'request-in-app') {
            return (
                <button
                    className="mt-2 md:mt-4 w-full bg-gray-600 text-gray-400 py-1.5 md:py-3 rounded-lg text-[10px] md:text-sm font-bold cursor-not-allowed"
                    disabled
                    onClick={(e) => e.stopPropagation()}
                >
                    Request In App
                </button>
            );
        }

        if (service.buttonType === 'calendar') {
            return (
                <button
                    className="mt-2 md:mt-4 w-full bg-white text-black py-1.5 md:py-3 rounded-lg text-[10px] md:text-sm font-bold hover:bg-gray-200 transition-colors"
                    onClick={(e) => {
                        e.stopPropagation();
                        navigate('/calendar');
                    }}
                >
                    Calendar
                </button>
            );
        }

        if (service.buttonType === 'camps') {
            return (
                <button
                    className="mt-2 md:mt-4 w-full bg-white text-black py-1.5 md:py-3 rounded-lg text-[10px] md:text-sm font-bold hover:bg-gray-200 transition-colors"
                    onClick={(e) => {
                        e.stopPropagation();
                        navigate('/services/camps');
                    }}
                >
                    View Camps
                </button>
            );
        }
    };

    return (
        <div
            className={`relative w-full h-52 sm:h-72 md:h-96 cursor-pointer transition-transform duration-300 ${
                isHovered && !isFlipped ? 'scale-105' : 'scale-100'
            }`}
            style={{ perspective: '1000px' }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={() => setIsFlipped(!isFlipped)}
        >
            <div
                className="relative w-full h-full"
                style={{
                    transformStyle: 'preserve-3d',
                    transition: 'transform 0.7s cubic-bezier(0.4, 0.0, 0.2, 1)',
                    transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0)',
                }}
            >
                {/* Front of card */}
                <div
                    className="absolute inset-0 rounded-2xl overflow-hidden shadow-2xl"
                    style={{ backfaceVisibility: 'hidden' }}
                >
                    <img
                        src={service.frontImage}
                        alt={service.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        decoding="async"
                        onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const parent = e.currentTarget.parentElement;
                            if (parent) {
                                parent.style.background = 'linear-gradient(135deg, #1e40af 0%, #10b981 100%)';
                            }
                        }}
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent p-3 md:p-6">
                        <h3 className="text-white text-sm md:text-2xl font-bold leading-snug">{service.name}</h3>
                    </div>
                </div>

                {/* Back of card */}
                <div
                    className="absolute inset-0 rounded-2xl overflow-hidden shadow-2xl bg-gradient-to-br from-gray-900 to-black p-4 md:p-8"
                    style={{
                        backfaceVisibility: 'hidden',
                        transform: 'rotateY(180deg)',
                    }}
                >
                    <div className="h-full flex flex-col justify-between">
                        <div>
                            <h3 className="text-white text-sm md:text-2xl font-bold mb-2 md:mb-4 leading-snug">{service.name}</h3>
                            <p className="text-green-400 text-[10px] md:text-sm font-semibold mb-2 md:mb-4 whitespace-pre-line">
                                {service.pricing}
                            </p>
                            <div className="overflow-y-auto max-h-20 md:max-h-56 pr-1 md:pr-2 custom-scrollbar">
                                <p className="text-gray-300 text-[10px] md:text-sm leading-relaxed">
                                    {service.description}
                                </p>
                            </div>
                        </div>
                        {renderButton()}
                    </div>
                </div>
            </div>
        </div>
    );
};

const ServicesPage = () => {
    return (
        <div className="min-h-screen bg-black flex flex-col">
            <Navigation />

            <div className="pt-20 pb-16 px-4">
                <div className="max-w-7xl mx-auto">
                    {/* Header */}
                    <div className="text-center mb-12 mt-8">
                        <h1 className="text-white text-3xl font-bold">Our Services</h1>
                    </div>

                    {/* MOBILE LAYOUT (< md) */}
                    <div className="md:hidden space-y-3">
                        {/* Row 1: Individual — full width */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2"><ServiceCard service={services[0]} /></div>
                        </div>
                        {/* Row 2: Two Person + Small Group */}
                        <div className="grid grid-cols-2 gap-3">
                            <ServiceCard service={services[1]} />
                            <ServiceCard service={services[2]} />
                        </div>
                        {/* Row 3: Large Group — full width */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2"><ServiceCard service={services[3]} /></div>
                        </div>
                        {/* Row 4: Parent Consultation + Player Report */}
                        <div className="grid grid-cols-2 gap-3">
                            <ServiceCard service={services[4]} />
                            <ServiceCard service={services[6]} />
                        </div>
                        {/* Row 5: Game Analysis — full width */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2"><ServiceCard service={services[5]} /></div>
                        </div>
                        {/* Row 6: Camps + Team Training */}
                        <div className="grid grid-cols-2 gap-3">
                            <ServiceCard service={services[7]} />
                            <ServiceCard service={services[8]} />
                        </div>
                        {/* Row 7: Pro Clinics + Showcases */}
                        <div className="grid grid-cols-2 gap-3">
                            <ServiceCard service={services[9]} />
                            <ServiceCard service={services[10]} />
                        </div>
                    </div>

                    {/* DESKTOP LAYOUT (>= md) */}
                    <div className="hidden md:block space-y-8">
                        {/* Row 1: Individual & Two Person */}
                        <div className="grid grid-cols-2 gap-8">
                            <ServiceCard service={services[0]} />
                            <ServiceCard service={services[1]} />
                        </div>
                        {/* Row 2: Small Group & Large Group */}
                        <div className="grid grid-cols-2 gap-8">
                            <ServiceCard service={services[2]} />
                            <ServiceCard service={services[3]} />
                        </div>
                        {/* Row 3: Parent Consultation, Game Analysis & Player Report */}
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-8">
                            <ServiceCard service={services[4]} />
                            <ServiceCard service={services[5]} />
                            <ServiceCard service={services[6]} />
                        </div>
                        {/* Row 4: Camps & Team Training */}
                        <div className="grid grid-cols-2 gap-8">
                            <ServiceCard service={services[7]} />
                            <ServiceCard service={services[8]} />
                        </div>
                        {/* Row 5: Professional Clinics & Showcases */}
                        <div className="grid grid-cols-2 gap-8">
                            <ServiceCard service={services[9]} />
                            <ServiceCard service={services[10]} />
                        </div>
                    </div>
                </div>
            </div>

            <Footer />

            {/* Custom scrollbar styles */}
            <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.3);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.5);
        }
      `}</style>
        </div>
    );
};

export default ServicesPage;
