import { useState, useCallback } from 'react';
import { getCurrentLocation } from '../services/geolocation.js';

/**
 * Hook to get and manage the user's geolocation.
 *
 * Returns:
 *   location: { lat, lon, accuracy } | null
 *   loading: boolean
 *   error: string | null
 *   getLocation: () => Promise<void>
 */
export function useGeolocation() {
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const getLocation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const loc = await getCurrentLocation();
      setLocation(loc);
      return loc;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { location, loading, error, getLocation, setLocation };
}
