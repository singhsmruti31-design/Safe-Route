import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  loginRequest,
  logoutRequest,
  signupRequest,
  fetchCurrentUser,
} from '../services/auth.js';
import { ApiNotConfiguredError } from '../services/api.js';

const AuthContext = createContext(null);
const AUTH_TOKEN_KEY = 'saferoute_auth_token';

function parseAuthResponse(data) {
  if (!data || typeof data !== 'object') return null;
  const user = data.user || data.account || data;
  const token = data.token || data.accessToken || data.access_token || null;
  if (!user || (!user.email && !user.id && !user.fullName)) return null;
  return {
    token,
    user: {
      id: user.id || user._id || user.email,
      fullName: user.fullName || user.name || '',
      email: user.email || '',
      mobile: user.mobile || user.phone || '',
      photoUrl: user.photoUrl || user.avatarUrl || '',
      emailVerified: Boolean(user.emailVerified || user.verified),
    },
  };
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [busy, setBusy] = useState(false);

  // Restore authenticated session from backend on page reload
  useEffect(() => {
    let token = null;
    try {
      token = localStorage.getItem(AUTH_TOKEN_KEY);
    } catch {
      // localStorage may be disabled or restricted
    }
    if (!token) return;

    let cancelled = false;
    fetchCurrentUser(token)
      .then((data) => {
        if (cancelled) return;
        const parsed = parseAuthResponse({ ...data, token });
        if (parsed) {
          setSession(parsed);
        } else {
          try { localStorage.removeItem(AUTH_TOKEN_KEY); } catch {}
        }
      })
      .catch((err) => {
        if (cancelled) return;
        // Invalid or expired token: clear persisted token
        if (!(err instanceof ApiNotConfiguredError)) {
          try { localStorage.removeItem(AUTH_TOKEN_KEY); } catch {}
        }
        setSession(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async ({ email, password }) => {
    setBusy(true);
    try {
      const data = await loginRequest({ email, password });
      const parsed = parseAuthResponse(data);
      if (!parsed) {
        throw new Error('The backend did not return a verified user session.');
      }
      if (parsed.token) {
        try { localStorage.setItem(AUTH_TOKEN_KEY, parsed.token); } catch {}
      }
      setSession(parsed);
      return parsed.user;
    } finally {
      setBusy(false);
    }
  }, []);

  const signup = useCallback(async (payload) => {
    setBusy(true);
    try {
      const data = await signupRequest(payload);
      const parsed = parseAuthResponse(data);
      if (parsed) {
        if (parsed.token) {
          try { localStorage.setItem(AUTH_TOKEN_KEY, parsed.token); } catch {}
        }
        setSession(parsed);
      }
      return data;
    } finally {
      setBusy(false);
    }
  }, []);

  const logout = useCallback(async () => {
    const token = session?.token;
    try { localStorage.removeItem(AUTH_TOKEN_KEY); } catch {}
    setSession(null);
    if (token) {
      try {
        await logoutRequest(token);
      } catch (err) {
        if (!(err instanceof ApiNotConfiguredError)) {
          console.warn('Logout request failed:', err.message);
        }
      }
    }
  }, [session]);

  const updateUser = useCallback((updatedUser) => {
    if (!updatedUser) return;
    setSession((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        user: {
          ...prev.user,
          ...updatedUser,
        },
      };
    });
  }, []);

  const value = useMemo(
    () => ({
      user: session?.user || null,
      token: session?.token || null,
      isAuthenticated: Boolean(session?.user),
      busy,
      login,
      signup,
      logout,
      updateUser,
    }),
    [session, busy, login, signup, logout, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
