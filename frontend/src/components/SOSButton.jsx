import { AlertTriangle, Phone, MessageSquare, MapPin, X, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { getCurrentLocation, generateGoogleMapsLink, generateWhatsAppLink, generateSMSLink } from '../services/geolocation.js';

/**
 * SOSButton — highly visible emergency button.
 *
 * When clicked:
 * 1. Gets current GPS location.
 * 2. Generates a Google Maps link.
 * 3. Opens WhatsApp / SMS share options.
 *
 * IMPORTANT: This only shares a location snapshot. It does NOT provide live tracking.
 * The user must press Send in WhatsApp or their messaging app.
 */
export default function SOSButton({ className = '' }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);

  const handleSOS = async () => {
    setOpen(true);
    setLoading(true);
    setError(null);
    setLocation(null);
    try {
      const loc = await getCurrentLocation();
      setLocation(loc);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const mapsLink = location ? generateGoogleMapsLink(location.lat, location.lon) : null;
  const waLink = location ? generateWhatsAppLink(location.lat, location.lon) : null;
  const smsLink = location ? generateSMSLink(location.lat, location.lon) : null;

  return (
    <>
      {/* SOS Trigger Button */}
      <button
        onClick={handleSOS}
        className={`flex items-center gap-2 bg-danger text-white font-bold rounded-xl px-5 py-3 text-base hover:bg-red-700 transition-colors sos-pulse shadow-lg ${className}`}
        aria-label="Emergency SOS — share my location"
        id="sos-button"
      >
        <AlertTriangle className="w-5 h-5" />
        SOS Emergency
      </button>

      {/* Modal overlay */}
      {open && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 animate-fade-in" role="dialog" aria-modal="true" aria-label="Emergency SOS">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 relative animate-slide-up">
            {/* Close */}
            <button
              onClick={() => setOpen(false)}
              className="absolute top-4 right-4 text-text-muted hover:text-text-dark p-1 rounded-lg hover:bg-gray-100"
              aria-label="Close SOS dialog"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-7 h-7 text-danger" />
              </div>
              <div>
                <h2 className="font-bold text-text-dark text-lg leading-tight">Emergency SOS</h2>
                <p className="text-xs text-text-muted">Share your current location</p>
              </div>
            </div>

            {/* Loading state */}
            {loading && (
              <div className="flex items-center gap-2 py-4 justify-center text-text-muted">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span className="text-sm">Getting your location…</span>
              </div>
            )}

            <a
              href="tel:112"
              className="flex items-center justify-center gap-2 w-full bg-danger text-white font-bold px-4 py-3 rounded-xl mb-3 min-h-[44px]"
            >
              <Phone className="w-5 h-5" />
              Call 112
            </a>

            {/* Error state */}
            {!loading && error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-danger flex-shrink-0" />
                  <p className="text-sm text-danger font-medium">Location unavailable</p>
                </div>
                <p className="text-xs text-red-600 mt-1">{error}</p>
                <p className="text-xs text-text-muted mt-2">
                  Calling options stay available. WhatsApp and SMS sharing need GPS.
                </p>
              </div>
            )}

            {/* Success state */}
            {!loading && location && (
              <>
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="w-4 h-4 text-success flex-shrink-0" />
                    <p className="text-sm text-success font-semibold">Location captured</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 text-text-muted mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-text-muted font-mono break-all">
                      {location.lat.toFixed(5)}, {location.lon.toFixed(5)}
                    </p>
                  </div>
                  {location.accuracy && (
                    <p className="text-xs text-text-muted mt-1">
                      Accuracy: ±{Math.round(location.accuracy)} m
                    </p>
                  )}
                </div>

                {/* Share buttons */}
                <div className="space-y-2 mb-4">
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 w-full bg-green-500 text-white font-semibold px-4 py-3 rounded-xl hover:bg-green-600 transition-colors text-sm"
                    id="sos-whatsapp-btn"
                  >
                    <MessageSquare className="w-5 h-5" />
                    Share via WhatsApp
                  </a>
                  <a
                    href={smsLink}
                    className="flex items-center gap-3 w-full bg-blue-500 text-white font-semibold px-4 py-3 rounded-xl hover:bg-blue-600 transition-colors text-sm"
                    id="sos-sms-btn"
                  >
                    <Phone className="w-5 h-5" />
                    Share via SMS
                  </a>
                  <a
                    href={mapsLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 w-full bg-gray-100 text-text-dark font-semibold px-4 py-3 rounded-xl hover:bg-gray-200 transition-colors text-sm"
                    id="sos-maps-btn"
                  >
                    <MapPin className="w-5 h-5" />
                    Open in Google Maps
                  </a>
                </div>
              </>
            )}

            {/* Disclaimer */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-2">
              <p className="text-xs text-yellow-800">
                ⚠️ This shares a <strong>location snapshot</strong>, not live tracking. You must press Send in WhatsApp or your messaging app. Always call emergency services (112) if in immediate danger.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
