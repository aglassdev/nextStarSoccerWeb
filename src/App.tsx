import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import HomePage from './pages/HomePageNew';
import AboutPage from './pages/AboutPage';
import CoachesPage from './pages/CoachesPage';
import CoachDetailPage from './pages/CoachDetailPage';
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
import TermsPage from './pages/TermsPage';
import PrivacyPage from './pages/PrivacyPage';
import ScholarshipPage from './pages/ScholarshipPage';
import ScholarshipApplicationPage from './pages/ScholarshipApplicationPage';
import CampsPage from './pages/CampsPage';
import CampDetailPage from './pages/CampDetailPage';
import Layout from './components/layout/Layout';
import LoadingScreen from './components/common/LoadingScreen';
import AdminLoginPage from './pages/admin/AdminLoginPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import PlayerProfile from './pages/admin/PlayerProfile';
import ParentProfile from './pages/admin/ParentProfile';
import AppDownloadPopup from './components/common/AppDownloadPopup';

// Scroll to top on every route change
const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
};

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
      <Route path="/coaches/:slug" element={<CoachDetailPage />} />
      <Route path="/services" element={<ServicesPage />} />
      <Route path="/services/camps" element={<CampsPage />} />
      <Route path="/services/camps/:slug" element={<CampDetailPage />} />
      <Route path="/alumni" element={<AlumniPage />} />
      <Route path="/calendar" element={<CalendarPage />} />
      <Route path="/calendar-embed" element={<CalendarEmbed />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/faq" element={<FAQPage />} />
      <Route path="/store" element={<StorePage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/scholarships" element={<ScholarshipPage />} />
      <Route path="/scholarships/apply" element={<ScholarshipApplicationPage />} />

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

      {/* Admin routes */}
      <Route path="/admin" element={<AdminLoginPage />} />
      <Route path="/admin/dashboard" element={<AdminDashboard />} />
      <Route path="/admin/players" element={<AdminDashboard />} />
      <Route path="/admin/players/:type/:id" element={<PlayerProfile />} />
      <Route path="/admin/coaches" element={<AdminDashboard />} />
      <Route path="/admin/coach-management" element={<AdminDashboard />} />
      <Route path="/admin/parents" element={<AdminDashboard />} />
      <Route path="/admin/parents/:id" element={<ParentProfile />} />
      <Route path="/admin/messages" element={<AdminDashboard />} />
      <Route path="/admin/payments" element={<AdminDashboard />} />
      <Route path="/admin/bills" element={<AdminDashboard />} />
      <Route path="/admin/inquiries" element={<AdminDashboard />} />
      <Route path="/admin/calendar" element={<AdminDashboard />} />
      <Route path="/admin/event-assistant" element={<AdminDashboard />} />
      <Route path="/admin/dev" element={<AdminDashboard />} />
      <Route path="/admin/dev/feedback" element={<AdminDashboard />} />
      <Route path="/admin/session-reviews" element={<AdminDashboard />} />

      {/* Catch all - redirect to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ScrollToTop />
        <AppRoutes />
        <AppDownloadPopup />
        <Analytics />
        <SpeedInsights />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
