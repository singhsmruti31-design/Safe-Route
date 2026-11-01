import { safetyCategory, safetyCategoryColor, safetyCategoryBg, safetyCategoryLabel } from '../utils/safetyScoring.js';

/**
 * SafetyScore component — displays a route's safety score visually.
 *
 * Props:
 *   score       number  0-100
 *   confidence  number  0-100 (percentage)
 *   insufficient boolean
 *   compact     boolean  — smaller version for cards
 */
export default function SafetyScore({ score, confidence = 0, insufficient = false, compact = false }) {
  if (insufficient) {
    return (
      <div className={`rounded-xl border border-border p-3 bg-gray-50 ${compact ? '' : ''}`}>
        <p className="text-xs text-text-muted font-medium text-center">Insufficient safety data</p>
        <p className="text-xs text-text-muted text-center mt-0.5">Not enough local data to estimate a reliable score.</p>
      </div>
    );
  }

  const cat = safetyCategory(score);
  const color = safetyCategoryColor(cat);
  const bg = safetyCategoryBg(cat);
  const label = safetyCategoryLabel(cat);

  const radius = compact ? 28 : 40;
  const stroke = compact ? 5 : 7;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const viewSize = (radius + stroke + 2) * 2;

  return (
    <div className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${compact ? '' : 'p-4'}`}
         style={{ background: bg, borderColor: color + '40' }}>
      {/* Circular progress */}
      <div className="flex-shrink-0">
        <svg width={viewSize} height={viewSize} viewBox={`0 0 ${viewSize} ${viewSize}`} role="img" aria-label={`Safety score ${score}`}>
          <circle
            cx={viewSize / 2}
            cy={viewSize / 2}
            r={radius}
            fill="none"
            stroke={color + '30'}
            strokeWidth={stroke}
          />
          <circle
            cx={viewSize / 2}
            cy={viewSize / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${viewSize / 2} ${viewSize / 2})`}
          />
          <text
            x="50%"
            y="50%"
            dominantBaseline="middle"
            textAnchor="middle"
            fill={color}
            fontSize={compact ? '13' : '16'}
            fontWeight="700"
            fontFamily="Inter, sans-serif"
          >
            {score}
          </text>
        </svg>
      </div>

      {/* Text info */}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm" style={{ color }}>{label}</p>
        <p className="text-xs text-text-muted mt-0.5">
          Safety score: <strong>{score}/100</strong>
        </p>
        <div className="flex items-center gap-1.5 mt-1">
          <div className="flex-1 h-1.5 bg-white rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${confidence}%`, background: color }}
            />
          </div>
          <span className="text-xs text-text-muted whitespace-nowrap">{confidence}% data</span>
        </div>
      </div>
    </div>
  );
}
