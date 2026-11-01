import { Link } from 'react-router-dom';
import {
  Shield, MapPin, Clock, AlertTriangle, Eye, Compass, HeartPulse,
  Activity, CheckCircle2, HelpCircle, ExternalLink, ArrowRight, Lock
} from 'lucide-react';

export default function About() {
  const factors = [
    {
      title: 'Emergency Services Proximity',
      weight: '35%',
      badge: 'Critical Factor',
      badgeColor: 'bg-blue-100 text-blue-700',
      description: 'Calculates the distance from every segment of your walking route to registered Police Stations and 24/7 Hospitals from OpenStreetMap data.',
      icon: Shield,
    },
    {
      title: 'Active Commercial Presence & Footfall',
      weight: '25%',
      badge: 'Time Dependent',
      badgeColor: 'bg-emerald-100 text-emerald-700',
      description: 'Shops, 24/7 pharmacies, cafes, and open businesses provide natural human surveillance and immediate assistance options.',
      icon: HeartPulse,
    },
    {
      title: 'Time of Travel Adjustment',
      weight: '20%',
      badge: 'Dynamic',
      badgeColor: 'bg-amber-100 text-amber-700',
      description: 'Safety calculations shift dynamically based on whether you depart at 2:00 PM or 2:00 AM, factoring in business opening hours.',
      icon: Clock,
    },
    {
      title: 'Road Hierarchy & Infrastructure',
      weight: '15%',
      badge: 'Structural',
      badgeColor: 'bg-purple-100 text-purple-700',
      description: 'Main pedestrian roads, lit avenues, and well-trafficked thoroughfares receive positive preference over unlit or isolated back-alleys.',
      icon: Compass,
    },
    {
      title: 'Local User-Reported Conditions',
      weight: '5%',
      badge: 'Local Device',
      badgeColor: 'bg-rose-100 text-rose-700',
      description: 'Hazard reports (poor lighting, isolated spots) logged on your device personalize and recalibrate route estimates.',
      icon: AlertTriangle,
    },
  ];

  const faqs = [
    {
      q: 'Does Safe Route guarantee my personal safety?',
      a: 'No algorithm or service can guarantee personal safety. Safe Route provides proximity-based estimates derived from open geographical data (police stations, hospitals, open stores). Always remain vigilant, stay in lit areas, and contact local authorities (112) in an emergency.',
    },
    {
      q: 'Where does the map and routing data come from?',
      a: 'Safe Route uses 100% free, open-source services: OpenStreetMap for cartographic tiles, the Overpass API for real-time amenity discovery, Nominatim for search geocoding, and OSRM (Open Source Routing Machine) for walking paths.',
    },
    {
      q: 'Is my live GPS location tracked or stored on any server?',
      a: 'Never. Safe Route operates strictly as a frontend-only application with zero backend databases. Your GPS coordinates remain exclusively within your browser session and are never transmitted to any third-party tracking server.',
    },
    {
      q: 'How does the Emergency SOS feature work?',
      a: 'When triggered, it captures your immediate GPS coordinates, generates a Google Maps pin link, and formats an urgent SOS message ready to dispatch via WhatsApp or SMS. You retain final control before pressing send in your messaging application.',
    },
  ];

  return (
    <div className="min-h-screen bg-bg-base">
      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="bg-white border-b border-border py-14 md:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 text-primary px-3.5 py-1.5 rounded-full text-xs font-semibold mb-4">
            <Shield className="w-4 h-4" />
            Transparent Safety Methodology
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold text-text-dark tracking-tight mb-4">
            About Safe Route
          </h1>
          <p className="text-text-muted text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
            Safe Route is an open, privacy-first pedestrian navigation companion.
            We empower solo walkers, students, and commuters to make informed choices
            with real geographical data.
          </p>
        </div>
      </section>

      {/* ── Main content ────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 space-y-16">
        {/* Important Disclaimer Notice */}
        <section className="bg-amber-50 border border-amber-200 rounded-2xl p-6 md:p-8 flex items-start gap-4 shadow-sm">
          <AlertTriangle className="w-8 h-8 text-amber-600 flex-shrink-0 mt-1" />
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-amber-900">
              Important Safety Notice & Disclaimer
            </h2>
            <p className="text-sm text-amber-800 leading-relaxed">
              Safe Route computes relative safety metrics using geographical proximity to emergency infrastructure,
              illuminated roads, and open businesses. <strong>It cannot predict crime, monitor real-time security events,
              or guarantee safety.</strong> If you find yourself in danger or distress, immediately contact emergency
              services: in India, dial <strong className="underline">112</strong> or your local emergency hotline.
            </p>
          </div>
        </section>

        {/* How Scoring Works */}
        <section>
          <div className="text-center max-w-xl mx-auto mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-text-dark mb-2">
              How Route Safety is Calculated
            </h2>
            <p className="text-sm text-text-muted">
              We break candidate walking routes into 100-meter segments and assess environmental safety factors.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {factors.map((f) => (
              <div key={f.title} className="card p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-primary">
                    <f.icon className="w-5 h-5" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${f.badgeColor}`}>
                      {f.badge}
                    </span>
                    <span className="text-xs font-bold text-primary bg-blue-50 px-2 py-1 rounded-md">
                      {f.weight}
                    </span>
                  </div>
                </div>
                <h3 className="font-semibold text-text-dark text-base mb-1.5">{f.title}</h3>
                <p className="text-xs text-text-muted leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Data Sources and Technology */}
        <section className="card p-8 bg-white">
          <h2 className="text-xl md:text-2xl font-bold text-text-dark mb-6">
            Open Data & Architecture
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 text-sm">
            <div className="border border-border rounded-xl p-4 bg-gray-50/50">
              <p className="font-semibold text-text-dark mb-1">OpenStreetMap</p>
              <p className="text-xs text-text-muted leading-relaxed">
                Global community-driven map database providing street networks, walkways, and lighting tags.
              </p>
            </div>
            <div className="border border-border rounded-xl p-4 bg-gray-50/50">
              <p className="font-semibold text-text-dark mb-1">Overpass API</p>
              <p className="text-xs text-text-muted leading-relaxed">
                Live spatial query engine fetching police stations, pharmacies, and open emergency services within 1km.
              </p>
            </div>
            <div className="border border-border rounded-xl p-4 bg-gray-50/50">
              <p className="font-semibold text-text-dark mb-1">OSRM Routing</p>
              <p className="text-xs text-text-muted leading-relaxed">
                High-performance pedestrian routing engine generating turn-by-turn walking trajectories.
              </p>
            </div>
            <div className="border border-border rounded-xl p-4 bg-gray-50/50">
              <p className="font-semibold text-text-dark mb-1">Local Storage</p>
              <p className="text-xs text-text-muted leading-relaxed">
                Client-side privacy sandbox where user reports and preferences remain securely on your device.
              </p>
            </div>
          </div>
        </section>

        {/* Frequently Asked Questions */}
        <section>
          <div className="text-center max-w-xl mx-auto mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-text-dark mb-2">
              Frequently Asked Questions
            </h2>
            <p className="text-sm text-text-muted">
              Everything you need to know about Safe Route's functionality and privacy.
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq) => (
              <div key={faq.q} className="card p-5">
                <h3 className="font-semibold text-text-dark text-base mb-2 flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-primary flex-shrink-0" />
                  {faq.q}
                </h3>
                <p className="text-sm text-text-muted leading-relaxed pl-6">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA Banner */}
        <section className="bg-primary text-white rounded-2xl p-8 md:p-10 text-center shadow-lg">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">
            Ready to explore safer walking routes?
          </h2>
          <p className="text-blue-100 max-w-lg mx-auto text-sm md:text-base mb-6">
            Search any starting point and destination in India to instantly compare routes by safety.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              to="/dashboard"
              className="bg-white text-primary font-bold px-6 py-3 rounded-xl hover:bg-blue-50 transition-colors inline-flex items-center gap-2"
            >
              Open Safe Route Dashboard
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/sos"
              className="bg-red-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-red-700 transition-colors inline-flex items-center gap-2"
            >
              Emergency SOS Hub
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
