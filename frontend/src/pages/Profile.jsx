import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, MapPinned, Trash2, User } from 'lucide-react';
import FormField from '../components/FormField.jsx';
import EmergencyContactsPanel from '../components/EmergencyContactsPanel.jsx';
import BackendNotice from '../components/BackendNotice.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import {
  getTemporaryProfileDraft,
  profileRequiresBackend,
  saveTemporaryProfileDraft,
  updateProfileRequest,
} from '../services/profile.js';
import { listSavedRoutes, deleteSavedRoute, savedRoutesRequireBackend } from '../services/savedRoutes.js';
import { listAccountReports, reportsRequireBackend } from '../services/reports.js';
import { isValidEmail, isValidMobile, isValidName, normalizePhone } from '../utils/validation.js';

export default function Profile() {
  const { user, token, isAuthenticated, logout, updateUser } = useAuth();
  const navigate = useNavigate();
  const draft = getTemporaryProfileDraft();
  const [form, setForm] = useState({
    fullName: user?.fullName || draft?.fullName || '',
    email: user?.email || draft?.email || '',
    mobile: user?.mobile || draft?.mobile || '',
    photoDataUrl: user?.photoUrl || draft?.photoDataUrl || '',
  });
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [routes, setRoutes] = useState([]);
  const [reports, setReports] = useState([]);

  useEffect(() => {
    if (user) {
      setForm((prev) => ({
        ...prev,
        fullName: user.fullName || prev.fullName,
        email: user.email || prev.email,
        mobile: user.mobile || prev.mobile,
        photoDataUrl: user.photoUrl || prev.photoDataUrl,
      }));
    }
  }, [user]);

  useEffect(() => {
    listSavedRoutes(token).then((data) => setRoutes(data.routes || [])).catch(() => setRoutes([]));
    listAccountReports(token).then((data) => setReports(data.reports || [])).catch(() => setReports([]));
  }, [token]);

  const setField = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handlePhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 400 * 1024) {
      setError('Please choose an image under 400 KB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setForm((prev) => ({ ...prev, photoDataUrl: reader.result }));
    reader.readAsDataURL(file);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setStatus('');
    setError('');
    const next = {};
    if (!isValidName(form.fullName)) next.fullName = 'Enter your full name.';
    if (!isValidEmail(form.email)) next.email = 'Enter a valid email address.';
    if (form.mobile && !isValidMobile(form.mobile)) next.mobile = 'Enter a valid mobile number.';
    setErrors(next);
    if (Object.keys(next).length) return;

    const payload = {
      fullName: form.fullName.trim(),
      email: form.email.trim(),
      mobile: form.mobile ? normalizePhone(form.mobile) : '',
      photoDataUrl: form.photoDataUrl,
    };

    if (isAuthenticated && !profileRequiresBackend()) {
      try {
        const res = await updateProfileRequest(token, payload);
        if (updateUser && res?.user) {
          updateUser(res.user);
        }
        setStatus('Profile updated on the server.');
        return;
      } catch (err) {
        setError(err.message);
        return;
      }
    }

    saveTemporaryProfileDraft(payload);
    setStatus('Saved as a temporary device draft. This is not a signed-in account profile.');
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleDeleteRoute = async (id) => {
    try {
      await deleteSavedRoute(token, id);
      setRoutes((prev) => prev.filter((r) => r.id !== id));
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-screen bg-bg-base py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-text-dark flex items-center gap-2">
              <User className="w-6 h-6 text-primary" /> Profile
            </h1>
            <p className="text-sm text-text-muted mt-1">
              {isAuthenticated ? `Signed in as ${user.email}` : 'Not signed in. Account sync needs the backend.'}
            </p>
          </div>
          {isAuthenticated && (
            <button type="button" onClick={handleLogout} className="btn-secondary text-sm inline-flex items-center gap-2">
              <LogOut className="w-4 h-4" /> Logout
            </button>
          )}
        </div>

        {!isAuthenticated && (
          <BackendNotice title="No verified session">
            Login and Sign up are ready, but this app will not pretend you are logged in. You can still edit a temporary device draft and emergency contacts for testing.
            {' '}<Link to="/login" className="font-semibold underline">Sign in</Link>
          </BackendNotice>
        )}

        <form onSubmit={handleSave} className="card p-6 space-y-4" noValidate>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-blue-50 overflow-hidden flex items-center justify-center text-primary font-bold">
              {form.photoDataUrl ? (
                <img src={form.photoDataUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                (form.fullName || 'U').charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <label className="btn-secondary text-xs inline-block cursor-pointer">
                Upload photo
                <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
              </label>
              <p className="text-xs text-text-muted mt-1">Optional. Stored only in this browser draft until an upload API exists.</p>
            </div>
          </div>
          <FormField id="profile-name" label="Full name" value={form.fullName} onChange={setField('fullName')} error={errors.fullName} />
          <FormField id="profile-email" label="Email address" type="email" value={form.email} onChange={setField('email')} error={errors.email} />
          <FormField id="profile-mobile" label="Mobile number" type="tel" value={form.mobile} onChange={setField('mobile')} error={errors.mobile} />
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn-primary">Save profile</button>
            <Link to="/settings" className="btn-secondary">Change password</Link>
          </div>
          {status && <p className="text-sm text-success">{status}</p>}
          {error && <p className="text-sm text-danger">{error}</p>}
        </form>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-text-dark">Emergency contacts</h2>
          <EmergencyContactsPanel />
        </section>

        <section className="card p-6 space-y-3">
          <h2 className="text-lg font-bold text-text-dark flex items-center gap-2">
            <MapPinned className="w-5 h-5 text-primary" /> Saved routes
          </h2>
          {savedRoutesRequireBackend() && (
            <BackendNotice title="Temporary device storage">
              Saved routes stay on this browser only. Account-wide syncing requires the backend route-history API.
            </BackendNotice>
          )}
          {routes.length === 0 && <p className="text-sm text-text-muted">No saved routes yet.</p>}
          {routes.map((r) => (
            <div key={r.id || r.name} className="border border-border rounded-xl p-3 text-sm flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-text-dark truncate">{r.name || 'Saved route'}</p>
                {r.summary && <p className="text-xs text-text-muted mt-0.5">{r.summary}</p>}
                {r.savedAt && <p className="text-xs text-text-muted mt-0.5">{new Date(r.savedAt).toLocaleDateString()}</p>}
                {r.temporary && <span className="text-[10px] uppercase font-bold bg-amber-50 text-amber-800 px-2 py-0.5 rounded-full">Device only</span>}
              </div>
              <button
                type="button"
                onClick={() => handleDeleteRoute(r.id)}
                className="text-danger hover:bg-red-50 p-1.5 rounded-lg flex-shrink-0"
                aria-label="Remove saved route"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </section>

        <section className="card p-6 space-y-3">
          <h2 className="text-lg font-bold text-text-dark">Submitted reports</h2>
          <p className="text-xs text-text-muted">
            {reportsRequireBackend()
              ? 'Device-only reports from this browser. They are not shared with other users.'
              : 'Community reports submitted from your account.'}
          </p>
          {reports.length === 0 && (
            <p className="text-sm text-text-muted">
              {reportsRequireBackend() ? 'No reports on this device.' : 'No submitted reports found.'}
            </p>
          )}
          {reports.slice(0, 10).map((r) => (
            <div key={r.id} className="border border-border rounded-xl p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-text-dark">{r.category || r.type}</p>
                {r.status && (
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded capitalize ${
                    r.status === 'approved' ? 'bg-green-100 text-green-800' :
                    r.status === 'rejected' ? 'bg-red-100 text-red-800' :
                    'bg-amber-100 text-amber-800'
                  }`}>
                    {r.status}
                  </span>
                )}
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                {(r.description || r.note || 'No description')} · {(r.createdAt || r.created_at ? new Date(r.createdAt || r.created_at).toLocaleString() : '')}
              </p>
            </div>
          ))}
          <Link to="/report" className="text-sm text-primary font-medium hover:underline">Open report page</Link>
        </section>
      </div>
    </div>
  );
}
