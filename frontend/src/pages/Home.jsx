import { Link } from 'react-router-dom';
import { Shield, Navigation, MapPin, AlertTriangle, Users, Clock, ChevronRight, Star, Eye } from 'lucide-react';
import { useState, Suspense, lazy } from 'react';

// Lazy-load map so the landing page renders fast
const MapView = lazy(() => import('../components/MapView.jsx'));

const FEATURES = [
  {
    icon: Navigation,
    color: '#2563EB',
    bg: '#EFF6FF',
    title: 'Real Walking Routes',
    desc: 'Actual walking routes powered by OpenStreetMap and OSRM routing — not static maps.',
  },
  {
    icon: Shield,
    color: '#16A34A',
    bg: '#F0FDF4',
    title: 'Safety Scoring',
    desc: 'Every route is scored using nearby police stations, hospitals, open shops and local conditions.',
  },
  {
    icon: Clock,
    color: '#EAB308',
    bg: '#FEFCE8',
    title: 'Time-Aware',
    desc: 'Safety estimates adjust for departure time — shops open at 2pm may be closed at 2am.',
  },
  {
    icon: MapPin,
    color: '#7C3AED',
    bg: '#F5F3FF',
    title: 'Nearby Help',
    desc: 'Find the nearest police stations, hospitals, pharmacies and petrol pumps from real OSM data.',
  },
  {
    icon: AlertTriangle,
    color: '#DC2626',
    bg: '#FEF2F2',
    title: 'SOS Emergency',
    desc: 'One-tap location sharing via WhatsApp and SMS. Your location, instantly shareable.',
  },
  {
    icon: Users,
    color: '#0891B2',
    bg: '#F0F9FF',
    title: 'Community Reports',
    desc: 'Report unsafe spots. Reports are stored on your device and help personalise your scores.',
  },
];

const STEPS = [
  { num: '01', title: 'Share your destination', desc: 'Type where you want to go. Or pick it on the map.' },
  { num: '02', title: 'Compare routes', desc: 'View alternative walking routes with safety scores, distances and estimated times.' },
  { num: '03', title: 'Walk safer', desc: 'Follow the route that works best for you, with nearby help visible on the map.' },
];

export default function Home() {
  const [mapLoaded, setMapLoaded] = useState(false);

  return (
    <div className="min-h-screen bg-bg-base">
      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-12 pb-8 md:pt-20">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          {/* Left: Copy */}
          <div className="animate-slide-up">
            <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-full text-xs text-primary font-semibold mb-4">
              <Star className="w-3.5 h-3.5" />
              Safety-first navigation
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-text-dark leading-tight mb-4">
              Your Journey.<br />
              <span className="text-primary">Your Safety.</span>
            </h1>
            <p className="text-text-muted text-lg leading-relaxed mb-6 max-w-md">
              Safe Route helps you find walking paths based on real geographical safety data —
              police stations, hospitals, open shops and local conditions.
            </p>
            <p className="text-xs text-text-muted bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-2.5 mb-6 max-w-md leading-relaxed">
              ⚠️ Safe Route provides estimated safety information based on available geographical data.
              It <strong>cannot guarantee personal safety</strong>. Always remain aware of your surroundings.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/dashboard"
                className="btn-primary inline-flex items-center gap-2 text-base px-6 py-3"
                id="hero-start-btn"
              >
                Start Exploring
                <ChevronRight className="w-5 h-5" />
              </Link>
              <Link
                to="/about"
                className="btn-secondary inline-flex items-center gap-2 text-base px-6 py-3"
              >
                <Eye className="w-5 h-5" />
                How it works
              </Link>
            </div>
          </div>

          {/* Right: Map preview */}
          <div className="rounded-2xl overflow-hidden shadow-xl border border-border h-80 md:h-96 animate-fade-in">
            <Suspense fallback={
              <div className="w-full h-full bg-gray-100 flex items-center justify-center text-text-muted text-sm">
                Loading map…
              </div>
            }>
              <MapView
                center={[12.9716, 77.5946]} // Bengaluru
                zoom={13}
              />
            </Suspense>
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16" id="features">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold text-text-dark mb-3">
            Built for safer journeys
          </h2>
          <p className="text-text-muted max-w-xl mx-auto">
            Every feature is designed to help you make informed decisions about your walking route.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f) => (
            <div key={f.title} className="card p-5 hover:shadow-md transition-shadow group">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"
                style={{ background: f.bg }}
              >
                <f.icon className="w-5 h-5" style={{ color: f.color }} />
              </div>
              <h3 className="font-semibold text-text-dark mb-1.5">{f.title}</h3>
              <p className="text-text-muted text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────── */}
      <section className="bg-white border-y border-border py-16" id="how-it-works">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-text-dark mb-3">How Safe Route works</h2>
            <p className="text-text-muted">Three simple steps to a safer walk.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {STEPS.map((s, i) => (
              <div key={s.num} className="flex flex-col items-center text-center p-6">
                <div className="w-14 h-14 rounded-2xl bg-primary text-white text-xl font-bold flex items-center justify-center mb-4 shadow-md">
                  {s.num}
                </div>
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute translate-x-32 -translate-y-24">
                    <ChevronRight className="w-6 h-6 text-border" />
                  </div>
                )}
                <h3 className="font-semibold text-text-dark mb-2">{s.title}</h3>
                <p className="text-text-muted text-sm">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Target users ───────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
        <div className="card p-8 md:p-10 flex flex-col md:flex-row items-center gap-8">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-text-dark mb-3">Designed for everyone who walks alone</h2>
            <ul className="space-y-2 text-text-muted text-sm">
              {['College students navigating at night', 'Working women commuting late', 'People unfamiliar with a city', 'Anyone who wants to compare route safety'].map(u => (
                <li key={u} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                  {u}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex-shrink-0">
            <Link to="/dashboard" className="btn-primary text-base px-8 py-4 inline-flex items-center gap-2" id="cta-start-btn">
              Get Started <ChevronRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="border-t border-border bg-white py-8 mt-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-text-muted">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <span className="font-semibold text-text-dark">Safe<span className="text-primary">Route</span></span>
            <span>· Frontend-only · No data collected</span>
          </div>
          <div className="flex gap-4">
            <Link to="/about" className="hover:text-primary transition-colors">About</Link>
            <Link to="/privacy" className="hover:text-primary transition-colors">Privacy</Link>
            <Link to="/report" className="hover:text-primary transition-colors">Report Issue</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
