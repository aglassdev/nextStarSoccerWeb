import Navigation from '../components/layout/Navigation';
import Footer from '../components/layout/Footer';
import { images } from '../constants/images';

const ScholarshipPage = () => {
  return (
    <div className="min-h-screen bg-black flex flex-col font-lt-wave">
      <Navigation />

      <div className="pt-24 pb-16 px-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-10">Scholarships</h1>

          <div className="flex flex-col lg:flex-row gap-12 lg:gap-16">
            {/* Left column — story + images */}
            <div className="lg:w-3/5 space-y-8 text-gray-300">
              <p className="text-lg leading-relaxed">
                At Next Star Soccer, we believe that world-class training should be accessible to
                everyone. Every young athlete deserves the chance to develop their skills, chase
                their dreams, and reach the highest level — regardless of their financial
                situation. Talent doesn't discriminate, and neither should opportunity.
              </p>

              <p className="text-lg leading-relaxed">
                We feel blessed to be rooted in this community and surrounded by so many dedicated
                families and passionate young players. That's exactly why we're committed to
                giving back. Our scholarship program exists to ensure that no player is turned
                away simply because of cost. If you have the drive and the passion, we want you
                on the field with us.
              </p>

              {/* charity1 — full-width break between paragraphs */}
              <div className="rounded-xl overflow-hidden">
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

              {/* charity2 — wrapped / floated within text */}
              <div className="text-lg leading-relaxed">
                <img
                  src={images.charity2}
                  alt="Next Star Soccer scholarship program"
                  className="float-right ml-5 mb-4 w-1/2 rounded-xl object-cover"
                />
                <p>
                  Our goal is simple: to be fair, to be open, and to make sure that everyone has
                  a chance. We want to level the playing field so that the next generation of
                  talent can emerge from every background and every neighborhood. The next star
                  could be anyone — and we want to make sure they get their shot.
                </p>
              </div>
            </div>

            {/* Right column — application steps + apply button */}
            <div className="lg:w-2/5">
              <div className="sticky top-28 rounded-2xl border border-gray-750 bg-gradient-to-b from-gray-900/80 to-black p-8">
                <h2 className="text-2xl font-bold text-white mb-6">How to Apply</h2>

                <ol className="space-y-6">
                  {/* Step 1 */}
                  <li className="flex gap-4">
                    <span className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-blue-800 text-white text-sm font-bold">
                      1
                    </span>
                    <div>
                      <h3 className="text-white font-semibold mb-1">Create an Account</h3>
                      <p className="text-gray-400 text-sm leading-relaxed">
                        Sign up for a Next Star Soccer account if you haven't already. This gives
                        you access to the scholarship application and your family dashboard.
                      </p>
                    </div>
                  </li>

                  {/* Step 2 */}
                  <li className="flex gap-4">
                    <span className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-blue-800 text-white text-sm font-bold">
                      2
                    </span>
                    <div>
                      <h3 className="text-white font-semibold mb-1">Complete the Application</h3>
                      <p className="text-gray-400 text-sm leading-relaxed">
                        Fill out the online scholarship application in full. Be sure to include
                        your player's details, training history, and a brief statement about why
                        you're applying.
                      </p>
                    </div>
                  </li>

                  {/* Step 3 */}
                  <li className="flex gap-4">
                    <span className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-blue-800 text-white text-sm font-bold">
                      3
                    </span>
                    <div>
                      <h3 className="text-white font-semibold mb-1">Upload Financial Documents</h3>
                      <p className="text-gray-400 text-sm leading-relaxed">
                        We require financial information from both parents where appropriate and
                        applicable. All supporting documents can be uploaded directly through the
                        application.
                      </p>
                    </div>
                  </li>

                  {/* Step 4 */}
                  <li className="flex gap-4">
                    <span className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-blue-800 text-white text-sm font-bold">
                      4
                    </span>
                    <div>
                      <h3 className="text-white font-semibold mb-1">Committee Review</h3>
                      <p className="text-gray-400 text-sm leading-relaxed">
                        The scholarship committee will review every application. All information is
                        kept strictly confidential. Scholarships are awarded based on demonstrated
                        financial need — that is the only determinant.
                      </p>
                    </div>
                  </li>

                  {/* Step 5 */}
                  <li className="flex gap-4">
                    <span className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-blue-800 text-white text-sm font-bold">
                      5
                    </span>
                    <div>
                      <h3 className="text-white font-semibold mb-1">Award & Next Steps</h3>
                      <p className="text-gray-400 text-sm leading-relaxed">
                        If awarded, families are responsible for any uniform, club, coaching, or
                        team expenses not covered by the scholarship. Recipients are strongly
                        encouraged to volunteer their time back to the club at team or club events.
                      </p>
                    </div>
                  </li>
                </ol>

                <button className="mt-8 w-full py-3.5 rounded-xl bg-blue-800 hover:bg-blue-700 transition-colors text-white font-semibold text-lg tracking-wide">
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default ScholarshipPage;
