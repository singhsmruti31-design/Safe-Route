import { useState } from 'react';
import { ShieldCheck, Lock, Trash2, CheckCircle, Database, EyeOff, ServerOff, Smartphone } from 'lucide-react';
import { getReports, getPreferences } from '../utils/storage.js';

export default function Privacy() {
  const [cleared, setCleared] = useState(false);

  const handleClearAllData = () => {
    if (window.confirm('Are you sure you want to delete all saved reports and preferences from this browser?')) {
      localStorage.removeItem('saferoute_reports');
      localStorage.removeItem('saferoute_preferences');
      localStorage.removeItem('saferoute_search_cache');
      localStorage.removeItem('saferoute_place_cache');
      localStorage.removeItem('saferoute_temp_emergency_contacts');
      localStorage.removeItem('saferoute_temp_profile_draft');
      localStorage.removeItem('saferoute_remembered_email');
      setCleared(true);
      setTimeout(() => setCleared(false), 4000);
    }
  };

  return (
    <div className="min-h-screen bg-bg-base py-12 md:py-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-10">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1.5 rounded-full text-xs font-semibold mb-3">
            <ShieldCheck className="w-4 h-4" />
            100% Client-Side Privacy
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-text-dark tracking-tight mb-3">
            Privacy & Data Transparency
          </h1>
          <p className="text-text-muted text-sm md:text-base leading-relaxed">
            Safe Route is built from the ground up as a zero-knowledge, frontend-only application.
            Your physical location and travel intentions belong solely to you.
          </p>
        </div>

        {/* Core Guarantees Grid */}
        <div className="grid sm:grid-cols-2 gap-5">
          <div className="card p-6 bg-white space-y-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-primary">
              <ServerOff className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-text-dark text-base">No Backend or Database</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Safe Route possesses no remote backend servers, no user accounts, no login passwords, and no cloud databases. Everything runs directly in your local browser sandbox.
            </p>
          </div>

          <div className="card p-6 bg-white space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <EyeOff className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-text-dark text-base">Zero Location Tracking</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              When you permit GPS access, the latitude and longitude are used purely in memory to compute routes and query public maps. We never log or transmit your location history.
            </p>
          </div>

          <div className="card p-6 bg-white space-y-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
              <Smartphone className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-text-dark text-base">Local-Only Hazard Reports</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Any unsafe spot reports you submit are written directly to your device's browser <code className="text-primary font-mono bg-blue-50 px-1 rounded">localStorage</code>. They are not uploaded to any central server.
            </p>
          </div>

          <div className="card p-6 bg-white space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-text-dark text-base">External Map Services</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              To render street maps and compute paths, your browser contacts open public endpoints (OpenStreetMap, Overpass API, and OSRM). These are standard anonymous web requests.
            </p>
          </div>
        </div>

        {/* Local Storage Management Card */}
        <div className="card p-6 md:p-8 bg-white border border-border space-y-5">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-xl font-bold text-text-dark flex items-center gap-2">
                <Database className="w-5 h-5 text-primary" />
                Manage Your Local Browser Data
              </h2>
              <p className="text-xs text-text-muted mt-1 max-w-xl leading-relaxed">
                You have full control. You can wipe all local storage data associated with Safe Route (including saved hazard markers, cached searches, and map layer settings) at any time.
              </p>
            </div>
            <button
              onClick={handleClearAllData}
              className="bg-red-50 text-danger border border-red-200 hover:bg-red-100 font-semibold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 transition"
            >
              <Trash2 className="w-4 h-4" />
              Clear Local Storage
            </button>
          </div>

          {cleared && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-2 text-xs text-emerald-800 animate-fade-in">
              <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              All local storage cache, reports, and preferences have been successfully deleted.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
