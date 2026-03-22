import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import HomePage from './pages/HomePageNew';
import AboutPage from './pages/AboutPage';
import CoachesPage from './pages/CoachesPage';
import ServicesPage from './pages/ServicesPage';
import AlumniPage from './pages/AlumniPage';
import ContactPage from './pages/ContactPage';
import FAQPage from './pages/FAQPage';
import StorePage from './pages/StorePage';
import LoginPage from './pages/auth/LoginPage';
import SignupPage from './pages/auth/SignupPage';
import DashboardPage from './pages/DashboardPage';
import EventsPage from './pages/EventsPage';
import CalendarPage from './pages/CalendarPage';
import CalendarEmbed from './pages/CalendarEmbed';
import BillingPage from './pages/BillingPage';
import ProfilePage from './pages/ProfilePage';
import Layout from './components/layout/Layout';
import LoadingScreen from './components/common/LoadingScreen';

// Protected route wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, initialized } = useAuth();

  if (!initialized) {
    return <LoadingScreen message="Initializing..." />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

function AppRoutes() {
  return (
    <Routes>
      {/* Public landing pages */}
      <Route path="/" element={<HomePage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/coaches" element={<CoachesPage />} />
      <Route path="/services" element={<ServicesPage />} />
      <Route path="/alumni" element={<AlumniPage />} />
      <Route path="/calendar" element={<CalendarPage />} />
      <Route path="/calendar-embed" element={<CalendarEmbed />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/faq" element={<FAQPage />} />
      <Route path="/store" element={<StorePage />} />
      
      {/* Auth routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

      {/* Protected dashboard routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="events" element={<EventsPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="billing" element={<BillingPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>

      {/* Catch all - redirect to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
