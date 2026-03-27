import Navigation from '../components/layout/Navigation';
import Footer from '../components/layout/Footer';

const AboutPage = () => {
  return (
    <div className="min-h-screen bg-black flex flex-col font-lt-wave">
      <Navigation />
      
      <div className="pt-24 pb-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-8">About Next Star Soccer</h1>
          
          <div className="space-y-6 text-gray-300">
            <p className="text-lg leading-relaxed">
              At Next Star, we believe that passion and diligence are the driving forces behind success. 
              Led by a team of experienced coaches and ex-pros, our mission is to nurture these qualities 
              in every player while providing a profound understanding of the game.
            </p>
            
            <p className="text-lg leading-relaxed">
              Our approach extends beyond mere technical and physical development; we offer invaluable 
              insights into the intricate dynamics of youth leagues, MLS academy programs, college 
              recruitment, and professional pathways.
            </p>
            
            <p className="text-lg leading-relaxed">
              Additionally, we guide sports psychology, nutrition, and discipline, recognizing that 
              holistic development is key to achieving excellence. We understand parents' vital role in 
              a player's journey, and we prioritize their involvement and support.
            </p>
            
            <p className="text-lg leading-relaxed">
              Specializing in comprehensive soccer training, Next Star also delivers tailored programs 
              designed to enhance technical skills and physical prowess for individuals and groups alike. 
              Our services encompass mentorship, counseling, and consulting for academies, colleges, and 
              aspiring professionals.
            </p>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default AboutPage;
