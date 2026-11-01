import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Loader2, Shield } from 'lucide-react';
import FormField from '../components/FormField.jsx';
import PasswordField from '../components/PasswordField.jsx';
import BackendNotice from '../components/BackendNotice.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { authCapabilities, getRememberedEmail, setRememberedEmail } from '../services/auth.js';
import { isValidEmail } from '../utils/validation.js';
import { ApiNotConfiguredError } from '../services/api.js';

export default function Login() {
  const { login, busy } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const caps = authCapabilities();
  const [email, setEmail] = useState(() => getRememberedEmail());
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(() => Boolean(getRememberedEmail()));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');

  const from = location.state?.from || '/profile';

  const validate = () => {
    const next = {};
    if (!isValidEmail(email)) next.email = 'Enter a valid email address.';
    if (!password) next.password = 'Enter your password.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!validate()) return;
    if (remember) setRememberedEmail(email.trim());
    else setRememberedEmail('');

    try {
      await login({ email: email.trim(), password });
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof ApiNotConfiguredError) {
        setFormError(err.message);
      } else {
        setFormError(err.message || 'Sign in failed. The account was not verified by a backend.');
      }
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-bg-base flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mx-auto mb-3">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-text-dark">Sign in</h1>
          <p className="text-sm text-text-muted mt-1">Use your Safe Route account. Route search stays available without signing in.</p>
        </div>

        {!caps.login && (
          <div className="mb-4">
            <BackendNotice title="Account sign-in is not connected yet">
              Login will work after your teammate provides the auth API. This form validates input and will not create a fake session.
            </BackendNotice>
          </div>
        )}

        <form onSubmit={handleSubmit} className="card p-6 space-y-4" noValidate>
          <FormField
            id="login-email"
            label="Email address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
            autoComplete="email"
            required
          />
          <PasswordField
            id="login-password"
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            autoComplete="current-password"
          />
          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 text-text-muted">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              Remember email
            </label>
            <Link to="/forgot-password" className="text-primary font-medium hover:underline">
              Forgot password
            </Link>
          </div>
          <p className="text-xs text-text-muted">
            Remember Me stores only your email on this device. Sessions are created only after backend verification.
          </p>
          {formError && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm text-danger">{formError}</div>
          )}
          <button type="submit" disabled={busy} className="btn-primary w-full flex items-center justify-center gap-2 py-3">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {busy ? 'Signing in…' : 'Login'}
          </button>
        </form>

        <p className="text-sm text-center text-text-muted mt-4">
          No account yet?{' '}
          <Link to="/signup" className="text-primary font-semibold hover:underline">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
