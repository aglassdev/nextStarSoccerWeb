import Navigation from '../components/layout/Navigation';
import Footer from '../components/layout/Footer';

const CampsPage = () => {
    return (
        <div className="min-h-screen bg-black flex flex-col">
            <Navigation />
            <div className="flex-1 flex flex-col items-center justify-start pt-32 px-4">
                <h1 className="text-white text-3xl font-bold">Camps</h1>
            </div>
            <Footer />
        </div>
    );
};

export default CampsPage;
