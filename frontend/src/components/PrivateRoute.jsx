import { useAuth } from '../context/AuthContext.jsx';
import BackendNotice from './BackendNotice.jsx';
import { Link } from 'react-router-dom';

/**
 * PrivateRoute — wraps account-only pages.
 *
 * Behaviour without backend:
 * - Does NOT redirect or block access (the backend is not yet connected).
 * - Shows a BackendNotice banner at the top of the page so users know login is needed.
 * - All core app features (routing, nearby help, SOS) remain fully public.
 *
 * When the backend is connected and isAuthenticated becomes true, the notice disappears.
 */
export default function PrivateRoute({ children, featureName = 'This feature' }) {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return children;

  return (
    <>
      <div className="max-w-4xl mx-auto px-4 pt-4">
        <BackendNotice title="Sign in required">
          {featureName} is linked to your account.{' '}
          <Link to="/login" className="font-semibold underline">Sign in</Link> or{' '}
          <Link to="/signup" className="font-semibold underline">create an account</Link> to access this.
          Route search, Nearby Help, and SOS are always available without signing in.
        </BackendNotice>
      </div>
      {children}
    </>
  );
}
