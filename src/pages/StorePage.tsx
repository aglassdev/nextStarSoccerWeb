import Navigation from '../components/layout/Navigation';
import Footer from '../components/layout/Footer';

const StorePage = () => {
  return (
    <div className="min-h-screen bg-black flex flex-col">
      <Navigation />
      <div className="pt-24 px-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-4xl font-bold text-white text-center mb-8 font-lt-wave">
            Store
          </h1>
          <p className="text-lg text-gray-400 text-center font-lt-wave">
            Coming soon.
          </p>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default StorePage;
