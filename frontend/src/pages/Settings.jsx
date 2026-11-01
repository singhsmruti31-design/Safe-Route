import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Settings as SettingsIcon } from 'lucide-react';
import PasswordField from '../components/PasswordField.jsx';
import BackendNotice from '../components/BackendNotice.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { authCapabilities, changePasswordRequest } from '../services/auth.js';
import { passwordIssues } from '../utils/validation.js';
import { ApiNotConfiguredError } from '../services/api.js';

export default function Settings() {
  const { token, isAuthenticated, logout } = useAuth();
  const caps = authCapabilities();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!isAuthenticated) {
      setError('Sign in with a verified backend session before changing an account password.');
      return;
    }
    const issues = passwordIssues(newPassword);
    if (issues.length) {
      setError(issues.join(' '));
      return;
    }
    if (newPassword !== confirm) {
      setError('New passwords do not match.');
      return;
    }
    if (!currentPassword) {
      setError('Enter your current password.');
      return;
    }
    setLoading(true);
    try {
      const data = await changePasswordRequest({ token, currentPassword, newPassword });
      setSuccess(data?.message || 'Password change submitted to the backend.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirm('');
    } catch (err) {
      setError(err instanceof ApiNotConfiguredError ? err.message : err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-base py-8">
      <div className="max-w-xl mx-auto px-4 sm:px-6 space-y-6">
        <h1 className="text-2xl font-bold text-text-dark flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-primary" /> Settings
        </h1>
        {!caps.changePassword && (
          <BackendNotice>
            Changing an account password requires VITE_AUTH_CHANGE_PASSWORD_PATH. This form will not store a new password in the browser.
          </BackendNotice>
        )}
        <form onSubmit={handleChangePassword} className="card p-6 space-y-4" noValidate>
          <h2 className="font-semibold text-text-dark">Change password</h2>
          <PasswordField id="current-password" label="Current password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          <PasswordField id="new-password" label="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
          <PasswordField id="confirm-password" label="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          {error && <p className="text-sm text-danger">{error}</p>}
          {success && <p className="text-sm text-success">{success}</p>}
          <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Update password
          </button>
        </form>
        <div className="card p-6 flex flex-wrap gap-3">
          <Link to="/profile" className="btn-secondary">Back to profile</Link>
          {isAuthenticated && (
            <button type="button" className="btn-secondary text-danger" onClick={logout}>Logout</button>
          )}
        </div>
      </div>
    </div>
  );
}
