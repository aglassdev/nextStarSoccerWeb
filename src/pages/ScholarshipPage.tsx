import Navigation from '../components/layout/Navigation';
import Footer from '../components/layout/Footer';
import { images } from '../constants/images';

const ScholarshipPage = () => {
  return (
    <div className="min-h-screen bg-black flex flex-col font-lt-wave">
      <Navigation />

      <div className="pt-24 pb-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-8">Scholarships</h1>

          <div className="space-y-8 text-gray-300">
            <p className="text-lg leading-relaxed">
              At Next Star Soccer, we believe that world-class training should be accessible to
              everyone. Every young athlete deserves the chance to develop their skills, chase their
              dreams, and reach the highest level — regardless of their financial situation. Talent
              doesn't discriminate, and neither should opportunity.
            </p>

            <p className="text-lg leading-relaxed">
              We feel blessed to be rooted in this community and surrounded by so many dedicated
              families and passionate young players. That's exactly why we're committed to giving
              back. Our scholarship program exists to ensure that no player is turned away simply
              because of cost. If you have the drive and the passion, we want you on the field with
              us.
            </p>

            <div className="rounded-xl overflow-hidden my-8">
              <img
                src={images.charity1}
                alt="Next Star Soccer community outreach"
                className="w-full h-auto object-cover"
              />
            </div>

            <p className="text-lg leading-relaxed">
              We've seen firsthand how access to quality coaching can transform a player's
              trajectory — not just on the pitch, but in life. The discipline, confidence, and
              teamwork that come from high-level training carry over into the classroom, the
              community, and beyond. Every player who walks through our doors becomes part of
              something bigger.
            </p>

            <p className="text-lg leading-relaxed">
              Our goal is simple: to be fair, to be open, and to make sure that everyone has a
              chance. We want to level the playing field so that the next generation of talent can
              emerge from every background and every neighborhood. The next star could be anyone —
              and we want to make sure they get their shot.
            </p>

            <div className="rounded-xl overflow-hidden my-8">
              <img
                src={images.charity2}
                alt="Next Star Soccer scholarship program"
                className="w-full h-auto object-cover"
              />
            </div>

            <p className="text-lg leading-relaxed">
              If you or someone you know could benefit from our scholarship program, don't hesitate
              to reach out. We review every application with care and are always looking for ways
              to expand our support. Together, we can make sure that passion and hard work are the
              only requirements for greatness.
            </p>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default ScholarshipPage;
