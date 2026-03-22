import Navigation from '../components/layout/Navigation';
import ProfileCard from '../components/ProfileCard';

const CoachesPage = () => {
  const coaches = [
    {
      id: 1,
      name: "Paul Torres",
      title: "Director & Head Coach",
      handle: "coach1",
      status: "Available",
      avatarUrl: "", // Add image URL here
    },
    {
      id: 2,
      name: "Phillip Gyau",
      title: "Head Coach",
      handle: "coach2",
      status: "Available",
      avatarUrl: "", // Add image URL here
    },
    {
      id: 3,
      name: "Ryan Machado",
      title: "Pro Coach",
      handle: "coach3",
      status: "Available",
      avatarUrl: "", // Add image URL here
    },
    {
      id: 4,
      name: "Gonzalo Carrasco",
      title: "Pro Coach",
      handle: "coach4",
      status: "Available",
      avatarUrl: "", // Add image URL here
    },
    {
      id: 5,
      name: "Steve Birnbaum",
      title: "Pro Coach",
      handle: "coach5",
      status: "Available",
      avatarUrl: "", // Add image URL here
    },
    {
      id: 6,
      name: "Marco Etcheverry",
      title: "Pro Coach",
      handle: "coach6",
      status: "Available",
      avatarUrl: "", // Add image URL here
    },
    {
      id: 7,
      name: "Patrick Mullins",
      title: "Pro Coach",
      handle: "coach7",
      status: "Available",
      avatarUrl: "", // Add image URL here
    },
    {
      id: 8,
      name: "Chris Pontius",
      title: "Pro Coach",
      handle: "coach8",
      status: "Available",
      avatarUrl: "", // Add image URL here
    }
  ];

  return (
    <div className="min-h-screen bg-black">
      <Navigation />
      <div className="pt-24 px-4 pb-16">
        <div className="max-w-[1600px] mx-auto">
          <h1 className="text-4xl font-bold text-white text-center mb-4 font-lt-wave">
            Our Coaches
          </h1>
          <p className="text-lg text-gray-400 text-center mb-16 font-lt-wave">
          </p>

          {/* Profile Cards Grid - 2 rows of 4 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            {coaches.map((coach) => (
              <div key={coach.id} className="flex justify-center">
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
                  onContactClick={() => console.log(`Contact ${coach.name}`)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoachesPage;
