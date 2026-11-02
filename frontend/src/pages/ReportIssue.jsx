import { useState, useEffect, useCallback } from 'react';
import { MapPin, AlertTriangle, Send, CheckCircle, Info, Trash2, Loader2 } from 'lucide-react';
import { Suspense, lazy } from 'react';
import { useGeolocation } from '../hooks/useGeolocation.js';
import { useAuth } from '../context/AuthContext.jsx';
import {
  reportsRequireBackend,
  submitReport,
  listAccountReports,
  deleteAccountReport
} from '../services/reports.js';
import { getReports, deleteReport } from '../utils/storage.js';

const MapView = lazy(() => import('../components/MapView.jsx'));

const CATEGORIES = [
  { value: 'no_lighting',    label: 'No Street Lighting',  icon: '🔦' },
  { value: 'isolated',       label: 'Isolated Area',        icon: '🏚️' },
  { value: 'felt_unsafe',    label: 'Felt Unsafe',          icon: '😰' },
  { value: 'poor_road',      label: 'Poor Road Condition',  icon: '🚧' },
  { value: 'other',          label: 'Other',                icon: '📝' },
];

const CATEGORY_MAP = {
  dark: { label: 'No Street Lighting', icon: '🔦' },
  no_lighting: { label: 'No Street Lighting', icon: '🔦' },
  isolated: { label: 'Isolated Area', icon: '🏚️' },
  isolated_area: { label: 'Isolated Area', icon: '🏚️' },
  felt_unsafe: { label: 'Felt Unsafe', icon: '😰' },
  suspicious_activity: { label: 'Felt Unsafe', icon: '😰' },
  harassment: { label: 'Harassment', icon: '⚠️' },
  safe_spot: { label: 'Safe Spot', icon: '✅' },
  poor_road: { label: 'Poor Road Condition', icon: '🚧' },
  other: { label: 'Other', icon: '📝' },
};

export default function ReportIssue() {
  const { token, isAuthenticated } = useAuth();
  const { location, getLocation, loading: gpsLoading } = useGeolocation();
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [reports, setReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [mapCenter, setMapCenter] = useState([20.5937, 78.9629]);

  const loadReports = useCallback(async () => {
    if (reportsRequireBackend()) {
      setReports(getReports());
      return;
    }

    if (isAuthenticated && token) {
      setLoadingReports(true);
      try {
        const res = await listAccountReports(token);
        setReports(res.reports || []);
      } catch {
        setReports(getReports());
      } finally {
        setLoadingReports(false);
      }
    } else {
      setReports(getReports());
    }
  }, [isAuthenticated, token]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const handleDetect = async () => {
    const loc = await getLocation();
    if (loc) {
      setSelectedLocation({ lat: loc.lat, lon: loc.lon });
      setMapCenter([loc.lat, loc.lon]);
    }
  };

  const handleMapClick = (latlng) => {
    setSelectedLocation({ lat: latlng.lat, lon: latlng.lng });
    setMapCenter([latlng.lat, latlng.lng]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);

    if (!category) {
      setSubmitError('Please select a category.');
      return;
    }
    if (!selectedLocation) {
      setSubmitError('Please select a location on the map or detect your GPS location.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await submitReport(
        {
          lat: selectedLocation.lat,
          lon: selectedLocation.lon,
          category,
          description: description.trim(),
        },
        token
      );

      setSubmitSuccess(res.message || 'Report submitted successfully.');
      setCategory('');
      setDescription('');
      await loadReports();

      setTimeout(() => setSubmitSuccess(null), 5000);
    } catch (err) {
      setSubmitError(err.message || 'Failed to submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      if (isAuthenticated && !reportsRequireBackend() && token) {
        await deleteAccountReport(token, id);
        await loadReports();
      } else {
        deleteReport(id);
        setReports(getReports());
      }
    } catch (err) {
      console.warn('Failed to delete report:', err.message);
      deleteReport(id);
      setReports(getReports());
    }
  };

  const isBackendActive = !reportsRequireBackend();

  return (
    <div className="min-h-screen bg-bg-base">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text-dark mb-1">Report an Unsafe Location</h1>
          <p className="text-text-muted text-sm">
            {isBackendActive
              ? 'Help others by marking places that felt unsafe. Verified reports help everyone travel safer.'
              : 'Help others by marking places that felt unsafe. Reports are stored only on your device.'}
          </p>
        </div>

        {/* Privacy / Backend notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-primary mb-1">
              {isBackendActive ? 'Community Safety Reports' : 'Device-only storage'}
            </p>
            <p className="text-xs text-blue-700">
              {isBackendActive ? (
                <>
                  Reports are submitted to the Safe Route server for community verification and moderation.
                  {isAuthenticated ? ' Reports are associated with your account.' : ' Submitted anonymously.'}
                  {' '}In mock mode, data is kept in backend memory and will reset when the server restarts.
                </>
              ) : (
                <>
                  Reports are saved in your browser's local storage only. They are <strong>not shared</strong> with other users, not sent to any server, and cannot be verified. Do not use these reports as authoritative safety information.
                </>
              )}
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Location selection */}
            <div className="card p-4">
              <p className="text-sm font-semibold text-text-dark mb-3">📍 Location</p>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleDetect}
                  disabled={gpsLoading || submitting}
                  className="btn-secondary w-full text-sm py-2.5 flex items-center justify-center gap-2"
                  id="report-detect-btn"
                >
                  <MapPin className="w-4 h-4" />
                  {gpsLoading ? 'Detecting…' : 'Use My Current Location'}
                </button>
                <p className="text-xs text-text-muted text-center">or click on the map below to select a location</p>
              </div>
              {selectedLocation && (
                <div className="mt-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  <p className="text-xs text-success font-semibold">✓ Location selected</p>
                  <p className="text-xs text-text-muted font-mono">{selectedLocation.lat.toFixed(5)}, {selectedLocation.lon.toFixed(5)}</p>
                </div>
              )}
            </div>

            {/* Map for picking location */}
            <div className="card overflow-hidden" style={{ height: '240px' }}>
              <Suspense fallback={<div className="w-full h-full flex items-center justify-center text-text-muted text-sm">Loading map…</div>}>
                <MapView
                  center={mapCenter}
                  zoom={mapCenter[0] === 20.5937 ? 5 : 15}
                  currentLocation={location}
                  onMapClick={handleMapClick}
                  nearbyPlaces={[]}
                  visibleLayers={new Set()}
                />
              </Suspense>
            </div>
            <p className="text-xs text-text-muted text-center -mt-2">Click on the map to pin the unsafe location</p>

            {/* Category */}
            <div>
              <p className="text-sm font-semibold text-text-dark mb-2">Category *</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {CATEGORIES.map(({ value, label, icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setCategory(value)}
                    disabled={submitting}
                    className={`flex items-center gap-2 p-3 rounded-xl border text-left text-sm transition-all ${
                      category === value
                        ? 'border-primary bg-blue-50 text-primary'
                        : 'border-border text-text-muted hover:border-primary'
                    }`}
                  >
                    <span>{icon}</span>
                    <span className="text-xs font-medium">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="report-desc" className="block text-sm font-semibold text-text-dark mb-2">
                Description (optional)
              </label>
              <textarea
                id="report-desc"
                value={description}
                onChange={e => setDescription(e.target.value)}
                disabled={submitting}
                placeholder="Add any details that might help others understand the concern…"
                rows={3}
                maxLength={500}
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm text-text-dark outline-none focus:border-primary focus:ring-2 focus:ring-blue-100 resize-none"
              />
              <p className="text-xs text-text-muted mt-1">{description.length}/500 characters</p>
            </div>

            {submitSuccess && (
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-success text-sm font-semibold animate-fade-in">
                <CheckCircle className="w-5 h-5 flex-shrink-0" />
                <span>{submitSuccess}</span>
              </div>
            )}

            {submitError && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-danger text-sm font-semibold animate-fade-in">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full flex items-center justify-center gap-2"
              id="report-submit-btn"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Submitting…
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" /> Submit Report
                </>
              )}
            </button>
          </form>

          {/* Reports list */}
          <div>
            <h2 className="text-base font-semibold text-text-dark mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" />
              Your Reports ({reports.length})
              {loadingReports && <Loader2 className="w-3.5 h-3.5 animate-spin text-text-muted" />}
            </h2>
            {reports.length === 0 ? (
              <div className="card p-8 text-center text-text-muted text-sm">
                No reports yet. Submit your first report above.
              </div>
            ) : (
              <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                {reports.map(r => {
                  const catKey = r.category || r.type;
                  const cat = CATEGORY_MAP[catKey] || CATEGORIES.find(c => c.value === catKey);
                  const latVal = typeof r.lat === 'number' ? r.lat.toFixed(4) : (r.coordinates?.lat ? Number(r.coordinates.lat).toFixed(4) : 'N/A');
                  const lonVal = typeof r.lon === 'number' ? r.lon.toFixed(4) : (typeof r.lng === 'number' ? r.lng.toFixed(4) : (r.coordinates?.lng ? Number(r.coordinates.lng).toFixed(4) : 'N/A'));
                  const dateStr = r.createdAt || r.created_at ? new Date(r.createdAt || r.created_at).toLocaleString() : '';

                  return (
                    <div key={r.id} className="card p-3 flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-yellow-50 flex items-center justify-center flex-shrink-0 text-base">
                        {cat?.icon || '📝'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-text-dark">{cat?.label || catKey}</p>
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
                        {(r.description || r.note) && (
                          <p className="text-xs text-text-muted mt-0.5 truncate">{r.description || r.note}</p>
                        )}
                        <p className="text-xs text-text-muted mt-1 font-mono">{latVal}, {lonVal}</p>
                        {dateStr && <p className="text-xs text-text-muted">{dateStr}</p>}
                      </div>
                      <button
                        onClick={() => handleDelete(r.id)}
                        className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-red-50 flex-shrink-0"
                        aria-label="Delete report"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
