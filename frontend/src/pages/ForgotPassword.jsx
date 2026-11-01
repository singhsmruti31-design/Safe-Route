import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import FormField from '../components/FormField.jsx';
import PasswordField from '../components/PasswordField.jsx';
import BackendNotice from '../components/BackendNotice.jsx';
import { authCapabilities, forgotPasswordRequest, resetPasswordRequest } from '../services/auth.js';
import { isValidEmail, passwordIssues } from '../utils/validation.js';
import { ApiNotConfiguredError } from '../services/api.js';

export default function ForgotPassword() {
  const caps = authCapabilities();
  const [params] = useSearchParams();
  const resetToken = params.get('token') || '';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRequest = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!isValidEmail(email)) {
      setError('Enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      const data = await forgotPasswordRequest({ email: email.trim() });
      setSuccess(data?.message || 'If the backend accepts this request, follow the email it sends. No password was changed on this device.');
    } catch (err) {
      setError(err instanceof ApiNotConfiguredError ? err.message : err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const issues = passwordIssues(password);
    if (issues.length) {
      setError(issues.join(' '));
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const data = await resetPasswordRequest({ token: resetToken, password });
      setSuccess(data?.message || 'Password reset submitted to the backend.');
    } catch (err) {
      setError(err instanceof ApiNotConfiguredError ? err.message : err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-bg-base flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-4">
        <h1 className="text-2xl font-bold text-text-dark text-center">
          {resetToken ? 'Choose a new password' : 'Reset password'}
        </h1>
        {!(resetToken ? caps.resetPassword : caps.forgotPassword) && (
          <BackendNotice>
            Password reset is sent to the backend only after the reset API path is configured. This screen will not change any password locally.
          </BackendNotice>
        )}
        <form onSubmit={resetToken ? handleReset : handleRequest} className="card p-6 space-y-4" noValidate>
          {resetToken ? (
            <>
              <PasswordField id="reset-password" label="New password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
              <PasswordField id="reset-confirm" label="Confirm password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
            </>
          ) : (
            <FormField id="reset-email" label="Email address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          )}
          {error && <p className="text-sm text-danger">{error}</p>}
          {success && <p className="text-sm text-success">{success}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {resetToken ? 'Update password' : 'Send reset instructions'}
          </button>
        </form>
        <p className="text-sm text-center">
          <Link to="/login" className="text-primary font-medium hover:underline">Back to login</Link>
        </p>
      </div>
    </div>
  );
}
