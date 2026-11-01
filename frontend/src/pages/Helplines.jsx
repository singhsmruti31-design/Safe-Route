import { Link } from 'react-router-dom';
import { Car, Flame, Globe, Heart, Phone, Shield, Siren, Users } from 'lucide-react';
import { INDIA_HELPLINES } from '../data/helplines.js';

const ICONS = {
  shield: Shield,
  ambulance: Siren,
  flame: Flame,
  heart: Heart,
  users: Users,
  globe: Globe,
  car: Car,
};

export default function Helplines() {
  return (
    <div className="min-h-screen bg-bg-base py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-danger mb-1">India</p>
          <h1 className="text-2xl font-bold text-text-dark">Emergency Helplines</h1>
          <p className="text-sm text-text-muted mt-1">
            <strong>112</strong> is India’s unified emergency number. Tapping Call opens your phone dialer. Safe Route does not place the call for you.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {INDIA_HELPLINES.map((item) => {
            const Icon = ICONS[item.icon] || Phone;
            return (
              <div
                key={item.id}
                className={`card p-5 flex flex-col gap-3 ${item.unified ? 'border-red-200 bg-red-50/40' : ''}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.unified ? 'bg-red-100 text-danger' : 'bg-blue-50 text-primary'}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-semibold text-text-dark">{item.service}</h2>
                    <p className="text-lg font-extrabold text-text-dark">{item.number}</p>
                    {item.unified && (
                      <span className="text-[10px] uppercase font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Unified emergency number</span>
                    )}
                  </div>
                </div>
                <p className="text-sm text-text-muted leading-relaxed">{item.description}</p>
                <a
                  href={`tel:${item.number}`}
                  className={`${item.unified ? 'btn-danger' : 'btn-primary'} inline-flex items-center justify-center gap-2 min-h-[44px]`}
                >
                  <Phone className="w-4 h-4" />
                  Call {item.number} now
                </a>
              </div>
            );
          })}
        </div>

        <Link to="/sos" className="text-sm text-primary font-medium hover:underline">Back to SOS</Link>
      </div>
    </div>
  );
}
