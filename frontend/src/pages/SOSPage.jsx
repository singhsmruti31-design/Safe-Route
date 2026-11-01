import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, Phone, MessageSquare, MapPin, Copy, Check,
  Shield, Loader2, ExternalLink, HeartHandshake, Siren, Flame, Heart
} from 'lucide-react';
import { captureShareLocation, smsLinkForNumber, whatsappLinkForNumber } from '../services/emergencyShare.js';
import { getPrimaryContact, listContacts } from '../services/emergencyContacts.js';
import { useAuth } from '../context/AuthContext.jsx';
import { telHref } from '../utils/validation.js';

export default function SOSPage() {
  const { token } = useAuth();
  const [share, setShare] = useState(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [contact, setContact] = useState(() => getPrimaryContact());
  const [contactError, setContactError] = useState('');

  const handleShareLocation = async () => {
    setShareLoading(true);
    setShareError(null);
    try {
      const data = await captureShareLocation();
      setShare(data);
      const listed = await listContacts(token);
      const contacts = listed.contacts || [];
      setContact(contacts.find((c) => c.isPrimary) || contacts[0] || null);
    } catch (err) {
      setShareError(err.message || 'Unable to access GPS. Calling options stay available.');
    } finally {
      setShareLoading(false);
    }
  };

  const handleCopy = () => {
    if (!share?.message) return;
    navigator.clipboard.writeText(share.message).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const loadContact = async () => {
    setContactError('');
    const listed = await listContacts(token);
    const contacts = listed.contacts || [];
    const primary = contacts.find((c) => c.isPrimary) || contacts[0] || null;
    setContact(primary);
    if (!primary) setContactError('No emergency contact saved yet. Add one from Profile.');
  };

  useEffect(() => {
    loadContact();
  }, [token]);

  const contactTel = contact ? telHref(contact.phone) : null;

  return (
    <div className="min-h-screen bg-bg-base py-8 md:py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-8">
        <div className="bg-red-600 text-white rounded-2xl p-6 md:p-8 shadow-xl">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Emergency SOS</h1>
              <p className="text-red-100 text-sm mt-1">
                112 is India’s unified emergency number. Safe Route does not place calls or send messages for you.
              </p>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <a
              href="tel:112"
              className="min-h-[52px] bg-white text-red-600 font-extrabold px-4 py-3 rounded-xl hover:bg-red-50 flex items-center justify-center gap-2"
              id="call-112-btn"
            >
              <Phone className="w-5 h-5" />
              Call 112
            </a>
            <a
              href={contactTel || '/profile#contacts'}
              onClick={(e) => {
                if (!contactTel) {
                  loadContact();
                }
              }}
              className="min-h-[52px] bg-red-800 text-white font-extrabold px-4 py-3 rounded-xl hover:bg-red-900 flex items-center justify-center gap-2"
              id="call-emergency-contact-btn"
            >
              <Phone className="w-5 h-5" />
              Call emergency contact
            </a>
            <button
              type="button"
              onClick={handleShareLocation}
              className="min-h-[52px] bg-white/15 border border-white/40 text-white font-extrabold px-4 py-3 rounded-xl hover:bg-white/25 flex items-center justify-center gap-2"
              id="share-location-btn"
            >
              {shareLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <MapPin className="w-5 h-5" />}
              Share my location
            </button>
          </div>
          {contactError && <p className="text-sm text-red-100 mt-3">{contactError} <Link to="/profile#contacts" className="underline font-semibold">Manage contacts</Link></p>}
          {contact && contactTel && (
            <p className="text-xs text-red-100 mt-3">Primary contact: {contact.name} · {contact.phone}</p>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <a href="tel:100" className="card p-4 flex items-center gap-3 hover:border-primary min-h-[56px]">
            <Shield className="w-5 h-5 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-text-dark">Call Police</p>
              <p className="text-xs text-text-muted">100</p>
            </div>
            <Phone className="w-4 h-4 text-danger" />
          </a>
          <a href="tel:108" className="card p-4 flex items-center gap-3 hover:border-primary min-h-[56px]">
            <Siren className="w-5 h-5 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-text-dark">Call Ambulance</p>
              <p className="text-xs text-text-muted">108</p>
            </div>
            <Phone className="w-4 h-4 text-danger" />
          </a>
          <a href="tel:101" className="card p-4 flex items-center gap-3 hover:border-primary min-h-[56px]">
            <Flame className="w-5 h-5 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-text-dark">Call Fire Brigade</p>
              <p className="text-xs text-text-muted">101</p>
            </div>
            <Phone className="w-4 h-4 text-danger" />
          </a>
          <a href="tel:181" className="card p-4 flex items-center gap-3 hover:border-primary min-h-[56px]">
            <Heart className="w-5 h-5 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-text-dark">Call Women Helpline</p>
              <p className="text-xs text-text-muted">181</p>
            </div>
            <Phone className="w-4 h-4 text-danger" />
          </a>
        </div>

        <Link to="/helplines" className="btn-secondary w-full inline-flex items-center justify-center min-h-[44px] font-semibold">
          View all Emergency Helplines
        </Link>

        <div className="card p-6 md:p-8 space-y-5 bg-white">
          <div>
            <h2 className="text-xl font-bold text-text-dark flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              Location sharing
            </h2>
            <p className="text-xs text-text-muted mt-1">
              GPS is requested only when you choose Share my location. WhatsApp and SMS open a draft — you must press Send.
            </p>
          </div>

          {shareLoading && (
            <div className="flex items-center justify-center py-6 text-text-muted gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="text-sm">Requesting GPS permission…</span>
            </div>
          )}

          {shareError && !shareLoading && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
              <p className="font-semibold mb-1">Location unavailable</p>
              <p className="text-xs">{shareError}</p>
              <p className="text-xs mt-2 text-text-muted">You can still call 112, police, ambulance or your emergency contact.</p>
              <button type="button" onClick={handleShareLocation} className="mt-3 btn-secondary text-xs">Try GPS again</button>
            </div>
          )}

          {share && !shareLoading && (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-3 gap-3 bg-blue-50/60 border border-blue-100 rounded-xl p-4 text-xs">
                <div>
                  <span className="text-text-muted block font-medium">Latitude</span>
                  <span className="font-mono font-bold text-text-dark text-sm">{share.lat.toFixed(5)}</span>
                </div>
                <div>
                  <span className="text-text-muted block font-medium">Longitude</span>
                  <span className="font-mono font-bold text-text-dark text-sm">{share.lon.toFixed(5)}</span>
                </div>
                <div>
                  <span className="text-text-muted block font-medium">Accuracy</span>
                  <span className="font-mono font-bold text-text-dark text-sm">±{Math.round(share.accuracy || 0)} m</span>
                </div>
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <a
                  href={contact ? whatsappLinkForNumber(contact.phone, share.lat, share.lon) : share.whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 bg-[#25D366] text-white font-bold py-3.5 px-4 rounded-xl text-sm min-h-[44px]"
                  id="page-sos-whatsapp"
                >
                  <MessageSquare className="w-4 h-4" />
                  WhatsApp location
                </a>
                <a
                  href={contact ? smsLinkForNumber(contact.phone, share.lat, share.lon) : share.smsLink}
                  className="flex items-center justify-center gap-2 bg-blue-600 text-white font-bold py-3.5 px-4 rounded-xl text-sm min-h-[44px]"
                  id="page-sos-sms"
                >
                  <Phone className="w-4 h-4" />
                  SMS location
                </a>
                <button type="button" onClick={handleCopy} className="flex items-center justify-center gap-2 bg-gray-100 text-text-dark font-bold py-3.5 px-4 rounded-xl text-sm border border-border min-h-[44px]">
                  {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied' : 'Copy message'}
                </button>
              </div>
              <a href={share.mapsLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-semibold">
                <ExternalLink className="w-3.5 h-3.5" /> Open Google Maps pin
              </a>
            </div>
          )}
        </div>

        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 flex-shrink-0">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-emerald-950 text-base">Nearby police stations and hospitals</h3>
              <p className="text-xs text-emerald-800 mt-0.5">Uses live OpenStreetMap data. Phone buttons appear only when OSM lists a number.</p>
            </div>
          </div>
          <Link to="/nearby" className="flex-shrink-0 bg-emerald-600 text-white font-bold px-5 py-2.5 rounded-xl text-sm hover:bg-emerald-700 min-h-[44px] inline-flex items-center">
            Find Nearby Help
          </Link>
        </div>

        <div className="card p-6 bg-white space-y-4">
          <h2 className="font-bold text-text-dark text-lg flex items-center gap-2">
            <HeartHandshake className="w-5 h-5 text-primary" />
            Quick personal safety notes
          </h2>
          <div className="grid sm:grid-cols-2 gap-4 text-xs text-text-muted leading-relaxed">
            <div className="border border-border rounded-xl p-3 bg-gray-50/50">
              <strong className="text-text-dark block mb-1">Stay in public, lit areas</strong>
              Move toward open shops, pharmacies or transit hubs if it is safe to do so.
            </div>
            <div className="border border-border rounded-xl p-3 bg-gray-50/50">
              <strong className="text-text-dark block mb-1">Keep someone on the line</strong>
              Call a trusted contact and describe where you are. You must place that call yourself.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
