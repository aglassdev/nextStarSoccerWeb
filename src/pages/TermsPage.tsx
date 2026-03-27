import Navigation from '../components/layout/Navigation';
import Footer from '../components/layout/Footer';

const TermsPage = () => {
  return (
    <div className="min-h-screen bg-black flex flex-col">
      <Navigation />
      <main className="flex-1 pt-28 pb-16 px-6 max-w-4xl mx-auto w-full">
        <h1 className="text-white text-4xl font-bold font-lt-wave mb-3">Terms of Service</h1>
        <p className="text-gray-500 text-sm uppercase tracking-widest mb-12">Last updated: March 2026</p>
        <div className="text-gray-400 text-sm leading-relaxed space-y-6">
          <p>Content coming soon.</p>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default TermsPage;
