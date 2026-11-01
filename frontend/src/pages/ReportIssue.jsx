import { useState } from 'react';
import { MapPin, AlertTriangle, Send, CheckCircle, Info, Trash2 } from 'lucide-react';
import { Suspense, lazy } from 'react';
import { useGeolocation } from '../hooks/useGeolocation.js';
import { saveReport, getReports, deleteReport } from '../utils/storage.js';

const MapView = lazy(() => import('../components/MapView.jsx'));

const CATEGORIES = [
  { value: 'no_lighting',    label: 'No Street Lighting',  icon: '🔦' },
  { value: 'isolated',       label: 'Isolated Area',        icon: '🏚️' },
  { value: 'felt_unsafe',    label: 'Felt Unsafe',          icon: '😰' },
  { value: 'poor_road',      label: 'Poor Road Condition',  icon: '🚧' },
  { value: 'other',          label: 'Other',                icon: '📝' },
];

export default function ReportIssue() {
  const { location, getLocation, loading: gpsLoading } = useGeolocation();
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [reports, setReports] = useState(() => getReports());
  const [mapCenter, setMapCenter] = useState([20.5937, 78.9629]);

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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!category) { alert('Please select a category.'); return; }
    if (!selectedLocation) { alert('Please select a location on the map or detect your GPS location.'); return; }

    const report = saveReport({
      lat: selectedLocation.lat,
      lon: selectedLocation.lon,
      category,
      description: description.trim(),
    });

    setSubmitted(true);
    setReports(getReports());
    setCategory('');
    setDescription('');

    setTimeout(() => setSubmitted(false), 4000);
  };

  const handleDelete = (id) => {
    deleteReport(id);
    setReports(getReports());
  };

  return (
    <div className="min-h-screen bg-bg-base">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-text-dark mb-1">Report an Unsafe Location</h1>
          <p className="text-text-muted text-sm">
            Help others by marking places that felt unsafe. Reports are stored only on your device.
          </p>
        </div>

        {/* Privacy notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-primary mb-1">Device-only storage</p>
            <p className="text-xs text-blue-700">
              Reports are saved in your browser's local storage only. They are <strong>not shared</strong> with other users, not sent to any server, and cannot be verified. Do not use these reports as authoritative safety information.
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
                  disabled={gpsLoading}
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
                placeholder="Add any details that might help others understand the concern…"
                rows={3}
                maxLength={500}
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm text-text-dark outline-none focus:border-primary focus:ring-2 focus:ring-blue-100 resize-none"
              />
              <p className="text-xs text-text-muted mt-1">{description.length}/500 characters</p>
            </div>

            {submitted && (
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-success text-sm font-semibold animate-fade-in">
                <CheckCircle className="w-5 h-5" /> Report saved to your device.
              </div>
            )}

            <button
              type="submit"
              className="btn-primary w-full flex items-center justify-center gap-2"
              id="report-submit-btn"
            >
              <Send className="w-4 h-4" /> Submit Report
            </button>
          </form>

          {/* Reports list */}
          <div>
            <h2 className="text-base font-semibold text-text-dark mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" />
              Your Reports ({reports.length})
            </h2>
            {reports.length === 0 ? (
              <div className="card p-8 text-center text-text-muted text-sm">
                No reports yet. Submit your first report above.
              </div>
            ) : (
              <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                {reports.map(r => {
                  const cat = CATEGORIES.find(c => c.value === r.category);
                  return (
                    <div key={r.id} className="card p-3 flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-yellow-50 flex items-center justify-center flex-shrink-0 text-base">
                        {cat?.icon || '📝'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-text-dark">{cat?.label || r.category}</p>
                        {r.description && <p className="text-xs text-text-muted mt-0.5 truncate">{r.description}</p>}
                        <p className="text-xs text-text-muted mt-1 font-mono">{r.lat?.toFixed(4)}, {r.lon?.toFixed(4)}</p>
                        <p className="text-xs text-text-muted">{new Date(r.createdAt).toLocaleString()}</p>
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
