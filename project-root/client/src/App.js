import React, { lazy, Suspense, useEffect, useState } from 'react';
import { MotionConfig } from 'framer-motion';
import BootScreen from './components/BootScreen';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './layout/ProtectedRoute';
import Layout from './layout/Layout';
import ScrollToTop from './layout/ScrollToTop';
import PageTitle from './layout/PageTitle';
import { ToastProvider } from './layout/ToastProvider';

// Public Auth pages
import Login from './pages/Login';
import Signup from './pages/Signup';
import VerifyOtp from './pages/VerifyOtp';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import OAuthCallback from './pages/OAuthCallback';
import PublicShare from './pages/PublicShare';

// Protected pages
import Dashboard from './pages/Dashboard';
import Files from './pages/Files';
import MyFiles from './pages/MyFiles';
import Sharing from './pages/Sharing';
import SharedWithMe from './pages/SharedWithMe';
import Activity from './features/activity/ActivityPage';
import Analytics from './pages/Analytics';
import Notifications from './pages/Notifications';
import Admin from './pages/Admin';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';
import Assistant from './pages/Assistant';

import { notificationsAPI } from './utils/api';
import { events, EVENTS } from './utils/events';
import './assets/global.css';
import './styles/experience.css';
const Landing = lazy(() => import('./features/landing/Landing'));

function AppShell() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    let isMounted = true;

    const load = () => {
      notificationsAPI
        .list()
        .then((r) => {
          if (!isMounted) return;
          setUnreadCount(r.data.filter((n) => !n.is_read).length);
        })
        .catch(() => {});
    };

    load();
    const unsubscribe = events.on(EVENTS.NOTIFICATIONS_CHANGED, load);
    const iv = setInterval(load, 3000);

    return () => {
      isMounted = false;
      unsubscribe();
      clearInterval(iv);
    };
  }, [user]);

  return (
    <Layout unreadCount={unreadCount}>
      <Routes>
        <Route path="/"               element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard"      element={<Dashboard />} />
        <Route path="/files"          element={<Files />} />
        <Route path="/my-files"       element={<MyFiles />} />
        <Route path="/sharing"        element={<Sharing />} />
        <Route path="/shared-with-me" element={<SharedWithMe />} />
        <Route path="/activity"       element={<Activity />} />
        <Route path="/analytics"      element={<Analytics />} />
        <Route path="/notifications"  element={<Notifications />} />
        <Route path="/settings"       element={<Settings />} />
        <Route path="/assistant"      element={<Assistant />} />
        <Route path="/assistant/configuration" element={<Assistant />} />

        <Route
          path="/admin"
          element={
            <ProtectedRoute adminOnly={true}>
              <Admin />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user"><ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <Router>
            <ScrollToTop />
            <PageTitle />
            <Routes>
              <Route path="/" element={<Suspense fallback={<BootScreen message="Opening the archive"/>}><Landing /></Suspense>} />
              {/* Public auth routes */}
              <Route path="/login"           element={<Login />} />
              <Route path="/signup"          element={<Signup />} />
              <Route path="/verify-otp"      element={<VerifyOtp />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password"  element={<ResetPassword />} />
              <Route path="/oauth-callback"  element={<OAuthCallback />} />
              <Route path="/s/:token"        element={<PublicShare />} />

              {/* Existing application pages remain behind the authentication boundary. */}
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <AppShell />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </Router>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider></MotionConfig>
  );
}
