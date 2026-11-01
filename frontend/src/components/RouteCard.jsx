import { formatDistance, formatDuration } from '../utils/distance.js';
import { safetyCategoryColor, safetyCategoryBg, safetyCategoryLabel, safetyCategory } from '../utils/safetyScoring.js';
import { Clock, MapPin, Navigation, Shield, Zap, ChevronRight, Loader2 } from 'lucide-react';
import SafetyScore from './SafetyScore.jsx';

/**
 * RouteCard — displays a single genuine pedestrian walking route with progressive safety score loading.
 *
 * Props:
 *   route       Route object (with distance in metres and duration in pedestrian seconds)
 *   score       scoreRoute result (or null during background calculation)
 *   selected    boolean
 *   onSelect    () => void
 *   badge       string (e.g. 'Safest', 'Fastest')
 *   badgeColor  string
 */
export default function RouteCard({ route, score, selected, onSelect, badge, badgeColor = '#2563EB' }) {
  if (!route) return null;

  const safetyScore = score?.overall?.score;
  const confidence = score?.overall?.confidence;
  const insufficient = score?.insufficient;

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left rounded-xl border transition-all duration-200 p-4 group ${
        selected
          ? 'border-primary bg-blue-50 shadow-md ring-2 ring-blue-100'
          : 'border-border bg-white hover:border-primary hover:shadow-sm'
      }`}
      aria-pressed={selected}
      aria-label={`Route option${badge ? `: ${badge}` : ''}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          {badge && (
            <span
              className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
              style={{ background: badgeColor }}
            >
              {badge}
            </span>
          )}
          {selected && (
            <span className="text-xs font-semibold text-primary bg-blue-100 px-2 py-0.5 rounded-full">
              Selected
            </span>
          )}
          <span className="text-[11px] font-medium text-text-muted bg-gray-100 px-2 py-0.5 rounded-full">
            🚶 Walking
          </span>
        </div>
        <ChevronRight className={`w-4 h-4 flex-shrink-0 transition-transform ${selected ? 'text-primary rotate-90' : 'text-text-muted group-hover:translate-x-0.5'}`} />
      </div>

      {/* Stats row: Real pedestrian distance & walking duration */}
      <div className="flex items-center gap-4 mb-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-text-dark">
          <MapPin className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">{formatDistance(route.distance)}</span>
        </div>
        <div className="flex items-center gap-1.5 text-text-dark">
          <Clock className="w-4 h-4 text-text-muted" />
          <span className="text-sm text-text-dark font-medium">{formatDuration(route.duration)}</span>
        </div>
      </div>

      {/* Progressive Safety Score State */}
      {score ? (
        <SafetyScore
          score={safetyScore}
          confidence={confidence}
          insufficient={insufficient}
          compact
        />
      ) : (
        <div className="rounded-xl bg-blue-50/60 border border-blue-100 px-3 py-2 text-xs text-primary flex items-center justify-center gap-2 animate-pulse">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
          <span className="font-medium">Calculating safety score…</span>
        </div>
      )}
    </button>
  );
}
