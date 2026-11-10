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
import CoachApplyPage from './pages/CoachApplyPage';
import CampsPage from './pages/CampsPage';
import CampDetailPage from './pages/CampDetailPage';
import ClinicsPage from './pages/ClinicsPage';
import ClinicDetailPage from './pages/ClinicDetailPage';
import ClinicCheckoutPage from './pages/ClinicCheckoutPage';
import VideoAnalysisPage from './pages/VideoAnalysisPage';
import VideoAnalysisCheckoutPage from './pages/VideoAnalysisCheckoutPage';
import CampCheckoutPage from './pages/CampCheckoutPage';
import Layout from './components/layout/Layout';
import LoadingScreen from './components/common/LoadingScreen';
import AdminLoginPage from './pages/admin/AdminLoginPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import PlayerProfile from './pages/admin/PlayerProfile';
import ParentProfile from './pages/admin/ParentProfile';
import SignInPage from './pages/SignInPage';
import UserLoginPage from './pages/user/UserLoginPage';
import { ACCOUNTS_LIVE, SIGN_IN_PATH } from './constants/features';
import AccountLayout from './pages/account/AccountLayout';
import AccountFamilyPage from './pages/account/AccountFamilyPage';
import AccountSettingsPage from './pages/account/AccountSettingsPage';
import AccountSchedulePage from './pages/account/AccountSchedulePage';
import AccountVideoAnalysisPage from './pages/account/AccountVideoAnalysisPage';
import AccountVideoAnalysisDetailPage from './pages/account/AccountVideoAnalysisDetailPage';
import AccountInboxPage from './pages/account/AccountInboxPage';
import AccountProfilePage from './pages/account/AccountProfilePage';
import AccountHomeTrainingPage from './pages/account/AccountHomeTrainingPage';
import AccountPlayerCenterPage from './pages/account/playerCenter/AccountPlayerCenterPage';
import AccountTrainingProgramPage from './pages/account/playerCenter/AccountTrainingProgramPage';
import AccountJournalPage from './pages/account/playerCenter/AccountJournalPage';
import CoachLayout from './pages/coach/CoachLayout';
import CoachDashboardPage from './pages/coach/CoachDashboardPage';
import CoachSessionPage from './pages/coach/CoachSessionPage';
import CoachCalendarPage from './pages/coach/CoachCalendarPage';
import CoachInboxPage from './pages/coach/CoachInboxPage';
import CoachVideoAnalysisPage from './pages/coach/CoachVideoAnalysisPage';
import CoachAnalysisWorkspacePage from './pages/coach/CoachAnalysisWorkspacePage';
import PaymentPortalPage from './pages/user/PaymentPortalPage';
import CheckoutPage from './pages/user/CheckoutPage';
import StatusPage from './pages/StatusPage';
import AppDownloadPopup from './components/common/AppDownloadPopup';
import { useApplyAdminTheme } from './hooks/useAdminTheme';

// Scroll to top on every route change
const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
};

// Light, dark or system appearance on the admin pages only.
const AdminThemeRoot = () => {
  const { pathname } = useLocation();
  useApplyAdminTheme(pathname.startsWith('/admin'));
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
}

// Signed-in pages (Account Center, bill checkout) — anyone else goes to
// /signin and comes back here afterwards.
const UserProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, initialized } = useAuth();
  const { pathname } = useLocation();

  if (!initialized) {
    return <LoadingScreen message="Loading..." />;
  }

  if (!user) {
    return <Navigate to={SIGN_IN_PATH} replace state={{ from: pathname }} />;
  }

  return <>{children}</>;
};;

function AppRoutes() {
  // The status page lives at status.nextstarsoccer.com — when served from that
  // subdomain, render it for any path. It's also reachable at /status.
  const isStatusSubdomain =
    typeof window !== 'undefined' && window.location.hostname.split('.')[0] === 'status';
  if (isStatusSubdomain) {
    return (
      <Routes>
        <Route path="*" element={<StatusPage />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/status" element={<StatusPage />} />
      {/* Public landing pages */}
      <Route path="/" element={<HomePage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/coaches" element={<CoachesPage />} />
      <Route path="/coaches/:slug" element={<CoachDetailPage />} />
      <Route path="/services" element={<ServicesPage />} />
      <Route path="/services/camps" element={<CampsPage />} />
      <Route path="/services/camps/:slug" element={<CampDetailPage />} />
      <Route path="/services/clinics" element={<ClinicsPage />} />
      <Route path="/services/clinics/:slug" element={<ClinicDetailPage />} />
      {/* Buying video analysis needs website accounts (film is uploaded from the Account Center) */}
      <Route path="/services/video-analysis" element={ACCOUNTS_LIVE ? <VideoAnalysisPage /> : <Navigate to="/services" replace />} />
      {/* An account is required to buy (no guest checkout): signed-out buyers go to sign in first. */}
      <Route
        path="/checkout/video-analysis"
        element={
          ACCOUNTS_LIVE ? (
            <UserProtectedRoute>
              <VideoAnalysisCheckoutPage />
            </UserProtectedRoute>
          ) : (
            <Navigate to="/services" replace />
          )
        }
      />
      {/* Camps sold on the website: an account is required too (no guest checkout). */}
      <Route
        path="/checkout/camp/:campId"
        element={
          ACCOUNTS_LIVE ? (
            <UserProtectedRoute>
              <CampCheckoutPage />
            </UserProtectedRoute>
          ) : (
            <Navigate to="/services/camps" replace />
          )
        }
      />
      <Route path="/checkout/:slug" element={<ClinicCheckoutPage />} />
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
      <Route path="/coachapply" element={<CoachApplyPage />} />

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

      {/* Sign in + Account Center (the /user portal lives in it). Local only for
          now (constants/features.ts): the live site keeps the /user portal. */}
      <Route path="/signin" element={ACCOUNTS_LIVE ? <SignInPage /> : <Navigate to="/user" replace />} />
      <Route path="/user" element={ACCOUNTS_LIVE ? <Navigate to="/signin" replace /> : <UserLoginPage />} />
      <Route
        path="/user/payments"
        element={
          ACCOUNTS_LIVE ? (
            <Navigate to="/account/payments" replace />
          ) : (
            <UserProtectedRoute>
              <PaymentPortalPage standalone />
            </UserProtectedRoute>
          )
        }
      />
      <Route
        path="/account"
        element={
          ACCOUNTS_LIVE ? (
            <UserProtectedRoute>
              <AccountLayout />
            </UserProtectedRoute>
          ) : (
            <Navigate to="/user/payments" replace />
          )
        }
      >
        {/* No hub page: the account pages open from the person icon in the navigation. */}
        <Route index element={<Navigate to="schedule" replace />} />
        <Route path="payments" element={<PaymentPortalPage />} />
        <Route path="family" element={<AccountFamilyPage />} />
        <Route path="settings" element={<AccountSettingsPage />} />
        <Route path="schedule" element={<AccountSchedulePage />} />
        <Route path="video-analysis" element={<AccountVideoAnalysisPage />} />
        <Route path="video-analysis/:id" element={<AccountVideoAnalysisDetailPage />} />
        <Route path="profile" element={<AccountProfilePage />} />
        <Route path="home-training" element={<AccountHomeTrainingPage />} />
        {/* Player Center: each part locked until an admin unlocks it for the account */}
        <Route path="player-center" element={<AccountPlayerCenterPage />} />
        <Route path="player-center/training-program" element={<AccountTrainingProgramPage />} />
        <Route path="player-center/journal" element={<AccountJournalPage />} />
        <Route path="inbox" element={<AccountInboxPage />} />
        <Route path="inbox/:conversationId" element={<AccountInboxPage />} />
      </Route>
      {/* Coach dashboard (coaches and admins) */}
      <Route
        path="/coach"
        element={
          <UserProtectedRoute>
            <CoachLayout />
          </UserProtectedRoute>
        }
      >
        {/* Dashboard (sessions, calendar, stats), Calendar, Inbox and Video Analysis, in the right-side menu */}
        <Route index element={<CoachDashboardPage />} />
        <Route path="session/:eventId" element={<CoachSessionPage />} />
        <Route path="calendar" element={<CoachCalendarPage />} />
        <Route path="inbox" element={<CoachInboxPage />} />
        <Route path="video-analysis" element={<CoachVideoAnalysisPage />} />
        <Route path="analysis/:id" element={<CoachAnalysisWorkspacePage />} />
        {/* Old addresses */}
        <Route path="sessions" element={<Navigate to="/coach" replace />} />
        <Route path="requests" element={<Navigate to="/coach/inbox" replace />} />
      </Route>
      {/* Bill checkout keeps its own full-page layout */}
      {['/account/payments/checkout', '/user/payments/checkout'].map((path) => (
        <Route
          key={path}
          path={path}
          element={
            <UserProtectedRoute>
              <CheckoutPage />
            </UserProtectedRoute>
          }
        />
      ))}

      {/* Admin routes */}
      <Route path="/admin" element={<AdminLoginPage />} />
      <Route path="/admin/dashboard" element={<AdminDashboard />} />
      <Route path="/admin/players" element={<AdminDashboard />} />
      <Route path="/admin/players/:type/:id" element={<PlayerProfile />} />
      <Route path="/admin/coaches" element={<AdminDashboard />} />
      <Route path="/admin/coach-management" element={<AdminDashboard />} />
      <Route path="/admin/coach-payments" element={<AdminDashboard />} />
      <Route path="/admin/parents" element={<AdminDashboard />} />
      <Route path="/admin/parents/:id" element={<ParentProfile />} />
      <Route path="/admin/messages" element={<AdminDashboard />} />
      {/* <Route path="/admin/payments" element={<AdminDashboard />} /> */}
      <Route path="/admin/bills" element={<AdminDashboard />} />
      <Route path="/admin/inquiries" element={<AdminDashboard />} />
      <Route path="/admin/calendar" element={<AdminDashboard />} />
      <Route path="/admin/event-assistant" element={<AdminDashboard />} />
      <Route path="/admin/attendance" element={<AdminDashboard />} />
      <Route path="/admin/attendance/:calType/:eventId" element={<AdminDashboard />} />
      <Route path="/admin/dev" element={<AdminDashboard />} />
      <Route path="/admin/dev/feedback" element={<AdminDashboard />} />
      <Route path="/admin/dev/status" element={<AdminDashboard />} />
      <Route path="/admin/session-reviews" element={<AdminDashboard />} />
      <Route path="/admin/scholarships" element={<AdminDashboard />} />
      <Route path="/admin/video-analysis" element={<AdminDashboard />} />

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
        <AdminThemeRoot />
        <AppRoutes />
        <AppDownloadPopup />
        <Analytics />
        <SpeedInsights />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
