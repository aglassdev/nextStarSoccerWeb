import { useNavigate } from 'react-router-dom';
import Navigation from '../components/layout/Navigation';
import Footer from '../components/layout/Footer';
import ProfileCard from '../components/ProfileCard';
import { coaches } from '../constants/coachesData';

const CoachesPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <Navigation />
      <div className="pt-24 px-4 pb-16">
        <div className="max-w-[1600px] mx-auto">
          <h1 className="text-4xl font-bold text-white text-center mb-4 font-lt-wave">
            Our Coaches
          </h1>
          <p className="text-lg text-gray-400 text-center mb-16 font-lt-wave">
          </p>

          {/* Profile Cards Grid - 2 rows of 5 on desktop, 5 rows of 2 on mobile */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-6 lg:gap-8">
            {coaches.map((coach) => (
              <div
                key={coach.id}
                className="flex justify-center cursor-pointer"
                onClick={() => navigate(`/coaches/${coach.slug}`)}
              >
                <ProfileCard
                  name={coach.name}
                  title={coach.title}
                  handle={coach.handle}
                  status={coach.status}
                  contactText="Contact"
                  avatarUrl={coach.avatarUrl}
                  showUserInfo={false}
                  enableTilt={true}
                  enableMobileTilt={false}
                  behindGlowEnabled={true}
                  behindGlowColor="hsla(223, 100%, 70%, 0.6)"
                  innerGradient="linear-gradient(145deg,hsla(223, 40%, 45%, 0.55) 0%,hsla(76, 60%, 70%, 0.27) 100%)"
                  onContactClick={() => navigate(`/coaches/${coach.slug}`)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default CoachesPage;
