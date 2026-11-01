import { Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import Navbar from './components/Navbar.jsx';
import PrivateRoute from './components/PrivateRoute.jsx';

// Pages
const Home = lazy(() => import('./pages/Home.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const NearbyHelp = lazy(() => import('./pages/NearbyHelp.jsx'));
const ReportIssue = lazy(() => import('./pages/ReportIssue.jsx'));
const About = lazy(() => import('./pages/About.jsx'));
const SOSPage = lazy(() => import('./pages/SOSPage.jsx'));
const Privacy = lazy(() => import('./pages/Privacy.jsx'));
const Login = lazy(() => import('./pages/Login.jsx'));
const Signup = lazy(() => import('./pages/Signup.jsx'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword.jsx'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail.jsx'));
const Profile = lazy(() => import('./pages/Profile.jsx'));
const Settings = lazy(() => import('./pages/Settings.jsx'));
const Helplines = lazy(() => import('./pages/Helplines.jsx'));

function PageLoader() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-text-muted">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
      <span className="text-sm font-medium">Loading Safe Route…</span>
    </div>
  );
}

export default function App() {
  const location = useLocation();
  const isSOSPage = location.pathname === '/sos';

  return (
    <div className="min-h-screen flex flex-col bg-bg-base text-text-dark font-sans selection:bg-blue-100 selection:text-primary">
      {/* Sticky Navbar */}
      <Navbar />

      {/* Main Page Content */}
      <main className="flex-1">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/nearby" element={<NearbyHelp />} />
            <Route path="/report" element={<ReportIssue />} />
            <Route path="/about" element={<About />} />
            <Route path="/sos" element={<SOSPage />} />
            <Route path="/helplines" element={<Helplines />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/profile" element={<PrivateRoute featureName="Your profile"><Profile /></PrivateRoute>} />
            <Route path="/settings" element={<PrivateRoute featureName="Account settings"><Settings /></PrivateRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>

      {/* Floating Global SOS Emergency Shortcut (only hidden on SOS page) */}
      {!isSOSPage && (
        <div className="fixed bottom-6 right-6 z-40">
          <Link
            to="/sos"
            className="flex items-center gap-2 bg-danger text-white font-extrabold px-5 py-3 rounded-full shadow-2xl hover:bg-red-700 transition-all transform hover:scale-105 active:scale-95 sos-pulse"
            aria-label="Instant Emergency SOS"
          >
            <AlertTriangle className="w-5 h-5" />
            <span className="hidden sm:inline text-sm">Emergency SOS</span>
            <span className="sm:hidden text-sm">SOS</span>
          </Link>
        </div>
      )}
    </div>
  );
}
