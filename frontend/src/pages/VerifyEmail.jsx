import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Loader2, Mail } from 'lucide-react';
import BackendNotice from '../components/BackendNotice.jsx';
import { authCapabilities, verifyEmailRequest } from '../services/auth.js';
import { ApiNotConfiguredError } from '../services/api.js';

export default function VerifyEmail() {
  const caps = authCapabilities();
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleVerify = async () => {
    setError('');
    setSuccess('');
    if (!token) {
      setError('This page needs a verification token from your email link.');
      return;
    }
    setLoading(true);
    try {
      const data = await verifyEmailRequest({ token });
      setSuccess(data?.message || 'The backend accepted the verification request.');
    } catch (err) {
      setError(err instanceof ApiNotConfiguredError ? err.message : err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-bg-base flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md space-y-4 text-center">
        <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mx-auto">
          <Mail className="w-6 h-6 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-text-dark">Verify your email</h1>
        <p className="text-sm text-text-muted">
          Open the link from your confirmation email, then confirm below. Safe Route will not mark an address as verified without the backend.
        </p>
        {!caps.verifyEmail && (
          <BackendNotice>
            Email verification waits for VITE_AUTH_VERIFY_EMAIL_PATH. No local shortcut is applied.
          </BackendNotice>
        )}
        <div className="card p-6 space-y-3">
          {token ? (
            <p className="text-xs text-text-muted break-all">Token present from the verification link.</p>
          ) : (
            <p className="text-sm text-text-muted">No token in this URL yet.</p>
          )}
          {error && <p className="text-sm text-danger">{error}</p>}
          {success && <p className="text-sm text-success">{success}</p>}
          <button type="button" onClick={handleVerify} disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Verify email
          </button>
        </div>
        <Link to="/login" className="text-sm text-primary font-medium hover:underline">Back to login</Link>
      </div>
    </div>
  );
}
