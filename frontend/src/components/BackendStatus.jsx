/**
 * BackendStatus — compact status indicator for the Safe Route backend.
 *
 * Checks GET /api/health on mount and displays:
 *   🟢 Backend • Mock Data   (backend online, MOCK_MODE=true)
 *   🟢 Backend • Live DB     (backend online, MOCK_MODE=false)
 *   🔴 Backend Offline       (cannot reach backend)
 *   (nothing)                (VITE_API_BASE_URL not configured)
 *
 * Renders as a small, unobtrusive pill — does not block any UI.
 */

import { useEffect, useState } from 'react';
import { isBackendConfigured, checkBackendHealth } from '../services/backendApi.js';

export default function BackendStatus() {
  const [status, setStatus] = useState('checking'); // 'checking' | 'online_mock' | 'online_live' | 'offline'
  const [tooltip, setTooltip] = useState('');

  useEffect(() => {
    if (!isBackendConfigured()) {
      setStatus('unconfigured');
      return;
    }

    let cancelled = false;
    checkBackendHealth()
      .then((health) => {
        if (cancelled) return;
        if (health?.mockMode) {
          setStatus('online_mock');
          setTooltip(`Backend online • Mock data (no live DB) • Uptime ${health.uptimeSeconds}s`);
        } else {
          setStatus('online_live');
          setTooltip(`Backend online • Live database • Uptime ${health.uptimeSeconds}s`);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setStatus('offline');
        setTooltip('Backend server is unreachable. Check that it is running at VITE_API_BASE_URL.');
      });

    return () => { cancelled = true; };
  }, []);

  // Don't render anything if backend isn't configured
  if (status === 'unconfigured' || status === 'checking') return null;

  const CONFIG = {
    online_mock: {
      dot: 'bg-amber-400',
      text: 'text-amber-700',
      bg: 'bg-amber-50 border-amber-200',
      label: 'Backend • Mock Data',
    },
    online_live: {
      dot: 'bg-green-500',
      text: 'text-green-700',
      bg: 'bg-green-50 border-green-200',
      label: 'Backend • Live DB',
    },
    offline: {
      dot: 'bg-red-400',
      text: 'text-red-700',
      bg: 'bg-red-50 border-red-200',
      label: 'Backend Offline',
    },
  };

  const cfg = CONFIG[status];
  if (!cfg) return null;

  return (
    <span
      title={tooltip}
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${cfg.bg} ${cfg.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

