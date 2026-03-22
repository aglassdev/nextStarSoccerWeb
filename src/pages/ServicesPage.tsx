import React, { useState } from 'react';
import Navigation from '../components/layout/Navigation';

interface Service {
    id: string;
    name: string;
    frontImage: string;
    pricing: string;
    description: string;
}

const services: Service[] = [
    {
        id: 'individual',
        name: 'Individual Session',
        frontImage: '/assets/images/individual.png',
        pricing: '60 Minutes | $200 Per Player',
        description: 'Private training offers a bespoke and results-driven approach to achieving your goals. One of our professional coaches will tailor each session to your specific needs, build on your strengths, and improve your weaknesses. Whether your goal is becoming a starter for your club or school, or to reach the collegiate or professional level, our private sessions ensure your development is aligned with the world\'s best practices and align with your personal objectives. In addition, we provide a comprehensive training plan and regularly evaluate your progress to ensure continuous development.',
    },
    {
        id: 'two-person',
        name: 'Two Person Session',
        frontImage: '/assets/images/twoPerson.png',
        pricing: '60 Minutes | $150 Per Player',
        description: 'Two-person training sessions offer personalized coaching while providing a training partner to compete with and learn from. This format combines individual attention with the benefits of partner training, creating a dynamic environment that pushes both players to excel. Each session is tailored to address both players\' needs while fostering healthy competition and teamwork.',
    },
    {
        id: 'small-group',
        name: 'Small Group Session',
        frontImage: '/assets/images/smallGroup.png',
        pricing: '60 Minutes | $100 Per Player',
        description: 'Small group training sessions (3-6 players) provide a balance between personalized attention and team dynamics. These sessions focus on developing individual skills while incorporating game-like situations and team play. Players benefit from working with peers of similar skill levels while receiving professional coaching guidance throughout the session.',
    },
    {
        id: 'large-group',
        name: 'Large Group Session',
        frontImage: '/assets/images/largeGroup.png',
        pricing: '60 Minutes | $75 Per Player',
        description: 'Large group training sessions (7+ players) create an engaging team environment that simulates real game scenarios. These sessions emphasize tactical understanding, teamwork, and position-specific training while maintaining a high level of individual development. Perfect for teams or groups looking to improve together under professional guidance.',
    },
    {
        id: 'parent-consultation',
        name: 'Parent Consultation',
        frontImage: '/assets/images/parentConsultation.png',
        pricing: 'In Person: 30 Min | $200\nVia Phone: 30 Min | $150',
        description: 'For parents seeking additional guidance regarding a player\'s current skill, fitness levels, progress, academy opportunities, college recruitment process, international exposure, or anything soccer-related, a consultation offers a private setting to address all your questions. This one-on-one consultation provides an in-depth analysis of your child\'s current state, ensuring that all your concerns are thoroughly answered, while also providing recommendations for the next steps in their development.',
    },
    {
        id: 'game-analysis',
        name: 'Game Analysis',
        frontImage: '/assets/images/gameAnalysis.png',
        pricing: 'Full Match: $300 | Half Match: $200',
        description: 'Professional game analysis provides detailed insights into player performance during actual match situations. Our coaches review game footage to identify strengths, areas for improvement, tactical understanding, and decision-making patterns. You\'ll receive a comprehensive report with actionable feedback and recommendations to elevate your game to the next level.',
    },
    {
        id: 'player-report',
        name: 'Player Report',
        frontImage: '/assets/images/playerReport.png',
        pricing: 'Comprehensive Analysis | $250',
        description: 'A detailed player report provides an objective assessment of a player\'s abilities, potential, and development needs. Our professional coaches evaluate technical skills, tactical awareness, physical attributes, and mental qualities to create a comprehensive profile. This report is valuable for recruitment purposes, development planning, and setting clear goals for improvement.',
    },
    {
        id: 'camps',
        name: 'Camps',
        frontImage: '/assets/images/camps.png',
        pricing: 'Varies by Location and Duration',
        description: 'Our specialized soccer camps offer intensive training experiences designed to accelerate player development. Led by professional coaches and former players, camps combine technical training, tactical education, and competitive play in a focused environment. Available throughout the year at various locations, our camps cater to different age groups and skill levels.',
    },
    {
        id: 'team-training',
        name: 'Team Training',
        frontImage: '/assets/images/teamTraining.png',
        pricing: 'Custom Pricing Based on Team Size',
        description: 'Team training sessions provide professional coaching for entire teams looking to improve cohesion, tactics, and overall performance. Our coaches work with your team to develop game plans, improve coordination, and enhance individual skills within a team context. Sessions can be customized to focus on specific areas such as attacking, defending, or set pieces.',
    },
    {
        id: 'professional-clinics',
        name: 'Professional Clinics',
        frontImage: '/assets/images/professionalClinics.png',
        pricing: 'Special Event Pricing',
        description: 'Professional clinics feature current and former professional players who share their expertise and experience. These unique opportunities allow players to learn directly from those who have competed at the highest levels. Clinics cover advanced techniques, professional mentality, and insights into what it takes to succeed in professional soccer.',
    },
    {
        id: 'showcases',
        name: 'Showcases',
        frontImage: '/assets/images/showcases.png',
        pricing: 'Event-Based Pricing',
        description: 'Showcases provide players with opportunities to display their talents in front of college coaches, scouts, and recruiters. These events are carefully organized to maximize exposure and create pathways to the next level of competition. We guide players through the showcase process and help them make the most of these important opportunities.',
    },
];

const ServiceCard: React.FC<{ service: Service }> = ({ service }) => {
    const [isFlipped, setIsFlipped] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div
            className={`relative w-full h-96 cursor-pointer transition-transform duration-300 ${
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
                        onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const parent = e.currentTarget.parentElement;
                            if (parent) {
                                parent.style.background = 'linear-gradient(135deg, #1e40af 0%, #10b981 100%)';
                            }
                        }}
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent p-6">
                        <h3 className="text-white text-2xl font-bold">{service.name}</h3>
                    </div>
                </div>

                {/* Back of card */}
                <div
                    className="absolute inset-0 rounded-2xl overflow-hidden shadow-2xl bg-gradient-to-br from-gray-900 to-black p-8"
                    style={{
                        backfaceVisibility: 'hidden',
                        transform: 'rotateY(180deg)',
                    }}
                >
                    <div className="h-full flex flex-col justify-between">
                        <div>
                            <h3 className="text-white text-2xl font-bold mb-4">{service.name}</h3>
                            <p className="text-green-400 text-sm font-semibold mb-4 whitespace-pre-line">
                                {service.pricing}
                            </p>
                            <div className="overflow-y-auto max-h-56 pr-2 custom-scrollbar">
                                <p className="text-gray-300 text-sm leading-relaxed">
                                    {service.description}
                                </p>
                            </div>
                        </div>
                        <button
                            className="mt-4 w-full bg-white text-black py-3 rounded-lg font-bold hover:bg-gray-200 transition-colors"
                            onClick={(e) => {
                                e.stopPropagation();
                                // Handle request service action
                                console.log('Request service:', service.name);
                            }}
                        >
                            Request Service
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ServicesPage = () => {
    return (
        <div className="min-h-screen bg-black">
            <Navigation />

            <div className="pt-20 pb-16 px-4">
                <div className="max-w-7xl mx-auto">
                    {/* Header */}
                    <div className="text-center mb-12 mt-8">
                        <h1 className="text-white text-3xl font-bold">Our Services</h1>
                    </div>

                    {/* Services Grid with Custom Layout */}
                    <div className="space-y-8">
                        {/* Row 1: 2 cards - Individual & Two Person */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <ServiceCard service={services[0]} />
                            <ServiceCard service={services[1]} />
                        </div>

                        {/* Row 2: 2 cards - Small Group & Large Group */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <ServiceCard service={services[2]} />
                            <ServiceCard service={services[3]} />
                        </div>

                        {/* Row 3: 3 cards - Parent Consultation, Game Analysis & Player Report */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            <ServiceCard service={services[4]} />
                            <ServiceCard service={services[5]} />
                            <ServiceCard service={services[6]} />
                        </div>

                        {/* Row 4: 2 cards - Camps & Team Training */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <ServiceCard service={services[7]} />
                            <ServiceCard service={services[8]} />
                        </div>

                        {/* Row 5: 2 cards - Professional Clinics & Showcases */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <ServiceCard service={services[9]} />
                            <ServiceCard service={services[10]} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <footer className="bg-black py-8 px-4 border-t border-gray-800">
                <div className="max-w-6xl mx-auto text-center">
                    <p className="text-gray-400 text-sm">
                        © {new Date().getFullYear()} Next Star Soccer. All rights reserved.
                    </p>
                </div>
            </footer>

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