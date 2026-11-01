/**
 * Opening-hours utilities.
 * Determines whether a place is likely open at a given time.
 * Only uses OSM-style opening_hours strings where available.
 */

/**
 * Simple OSM opening_hours parser.
 * Handles common patterns like "Mo-Fr 09:00-18:00", "24/7", "Mo-Su 08:00-22:00".
 * Returns:
 *   'open'    — place is open at the given time
 *   'closed'  — place is closed at the given time
 *   'unknown' — cannot determine (complex rule or no data)
 */
export function isOpenAt(openingHoursStr, date = new Date()) {
  if (!openingHoursStr) return 'unknown';

  const s = openingHoursStr.trim().toLowerCase();

  // 24/7
  if (s === '24/7' || s === 'open 24/7' || s === 'always open') return 'open';

  // Mo-Su HH:MM-HH:MM style (most common Indian OSM entries)
  const simpleRule = /^(?:mo|tu|we|th|fr|sa|su)(?:-(?:mo|tu|we|th|fr|sa|su))?\s+(\d{2}):(\d{2})-(\d{2}):(\d{2})$/;

  // Try splitting by semicolon (multiple rules)
  const rules = s.split(';').map((r) => r.trim());

  for (const rule of rules) {
    const m = rule.match(simpleRule);
    if (m) {
      const [, sh, sm, eh, em] = m.map(Number);
      const currentMinutes = date.getHours() * 60 + date.getMinutes();
      const startMinutes = sh * 60 + sm;
      const endMinutes = eh * 60 + em;

      // Check day of week (simplified: assumes rule applies to today)
      const dayNames = ['su', 'mo', 'tu', 'we', 'th', 'fr', 'sa'];
      const todayStr = dayNames[date.getDay()];
      const dayPart = rule.split(' ')[0];

      if (!dayMatchesToday(dayPart, todayStr)) continue;

      if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
        return 'open';
      } else {
        return 'closed';
      }
    }
  }

  return 'unknown';
}

function dayMatchesToday(dayPart, today) {
  const dayOrder = ['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su'];
  if (dayPart.includes('-')) {
    const [start, end] = dayPart.split('-');
    const si = dayOrder.indexOf(start);
    const ei = dayOrder.indexOf(end);
    const ti = dayOrder.indexOf(today);
    if (si === -1 || ei === -1 || ti === -1) return true; // assume applies
    if (si <= ei) return ti >= si && ti <= ei;
    // wraps around (e.g. Sa-Mo)
    return ti >= si || ti <= ei;
  }
  if (dayPart === today) return true;
  // If we can't parse, assume it applies
  return true;
}

/**
 * Returns a human-readable status label.
 */
export function openStatusLabel(status) {
  if (status === 'open') return 'Open Now';
  if (status === 'closed') return 'Closed';
  return 'Hours Unknown';
}

/**
 * Returns Tailwind colour class for the open status.
 */
export function openStatusColor(status) {
  if (status === 'open') return 'text-success';
  if (status === 'closed') return 'text-danger';
  return 'text-text-muted';
}
