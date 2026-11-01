import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, Shield } from 'lucide-react';
import FormField from '../components/FormField.jsx';
import PasswordField from '../components/PasswordField.jsx';
import BackendNotice from '../components/BackendNotice.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { authCapabilities } from '../services/auth.js';
import { isValidEmail, isValidMobile, isValidName, normalizePhone, passwordIssues } from '../utils/validation.js';
import { ApiNotConfiguredError } from '../services/api.js';

export default function Signup() {
  const { signup, busy } = useAuth();
  const navigate = useNavigate();
  const caps = authCapabilities();
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    mobile: '',
    password: '',
    confirmPassword: '',
    terms: false,
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');

  const setField = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const validate = () => {
    const next = {};
    if (!isValidName(form.fullName)) next.fullName = 'Enter your full name.';
    if (!isValidEmail(form.email)) next.email = 'Enter a valid email address.';
    if (!isValidMobile(form.mobile)) next.mobile = 'Enter a valid mobile number.';
    const pw = passwordIssues(form.password);
    if (pw.length) next.password = pw.join(' ');
    if (form.password !== form.confirmPassword) next.confirmPassword = 'Passwords do not match.';
    if (!form.terms) next.terms = 'Accept the terms to continue.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSuccess('');
    if (!validate()) return;

    try {
      const result = await signup({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        mobile: normalizePhone(form.mobile),
        password: form.password,
      });
      if (result?.user || result?.token || result?.accessToken) {
        navigate('/profile');
        return;
      }
      setSuccess(
        result?.message ||
        'If the backend accepts this registration, check your email for a verification step. You are not signed in until the server confirms the account.'
      );
    } catch (err) {
      if (err instanceof ApiNotConfiguredError) {
        setFormError(err.message);
      } else {
        setFormError(err.message || 'Registration failed.');
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
          <h1 className="text-2xl font-bold text-text-dark">Create an account</h1>
          <p className="text-sm text-text-muted mt-1">For profiles, synced contacts and saved routes. Walking search stays public.</p>
        </div>

        {!caps.signup && (
          <div className="mb-4">
            <BackendNotice title="Registration is not connected yet">
              This page checks your details locally. An account is created only when the signup API is configured and accepts the request.
            </BackendNotice>
          </div>
        )}

        <form onSubmit={handleSubmit} className="card p-6 space-y-4" noValidate>
          <FormField id="signup-name" label="Full name" value={form.fullName} onChange={setField('fullName')} error={errors.fullName} autoComplete="name" required />
          <FormField id="signup-email" label="Email address" type="email" value={form.email} onChange={setField('email')} error={errors.email} autoComplete="email" required />
          <FormField id="signup-mobile" label="Mobile number" type="tel" placeholder="+91 98765 43210" value={form.mobile} onChange={setField('mobile')} error={errors.mobile} autoComplete="tel" required />
          <PasswordField id="signup-password" label="Password" value={form.password} onChange={setField('password')} error={errors.password} autoComplete="new-password" />
          <PasswordField id="signup-confirm" label="Confirm password" value={form.confirmPassword} onChange={setField('confirmPassword')} error={errors.confirmPassword} autoComplete="new-password" />

          <label className="flex items-start gap-2 text-sm text-text-dark">
            <input type="checkbox" checked={form.terms} onChange={setField('terms')} className="mt-1" />
            <span>
              I accept the{' '}
              <Link to="/privacy" className="text-primary font-medium hover:underline">privacy policy</Link>
              {' '}and understand that Safe Route cannot guarantee personal safety.
            </span>
          </label>
          {errors.terms && <p className="text-xs text-danger">{errors.terms}</p>}

          {formError && <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm text-danger">{formError}</div>}
          {success && <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2 text-sm text-success">{success}</div>}

          <button type="submit" disabled={busy} className="btn-primary w-full flex items-center justify-center gap-2 py-3">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {busy ? 'Submitting…' : 'Sign up'}
          </button>
        </form>

        <p className="text-sm text-center text-text-muted mt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-primary font-semibold hover:underline">Login</Link>
        </p>
      </div>
    </div>
  );
}
