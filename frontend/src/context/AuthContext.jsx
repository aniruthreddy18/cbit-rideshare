import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi, tokenStore } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(() => Boolean(tokenStore.get()));
  const [sessionMessage, setSessionMessage] = useState('');

  // Restore the session on page load.
  useEffect(() => {
    if (!tokenStore.get()) return;
    let active = true;
    authApi
      .me()
      .then((data) => active && setUser(data.user))
      .catch(() => {
        tokenStore.clear();
        if (active) setUser(null);
      })
      .finally(() => active && setInitializing(false));
    return () => {
      active = false;
    };
  }, []);

  // Any 401 from the API logs the user out with an explanation.
  useEffect(() => {
    const onExpired = (event) => {
      setUser(null);
      setSessionMessage(event.detail || 'Your session has expired. Please log in again.');
    };
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, []);

  const login = useCallback(async (credentials) => {
    const data = await authApi.login(credentials);
    tokenStore.set(data.token);
    setUser(data.user);
    setSessionMessage('');
    return data.user;
  }, []);

  const register = useCallback(async (payload) => {
    const data = await authApi.register(payload);
    tokenStore.set(data.token);
    setUser(data.user);
    setSessionMessage('');
    return data.user;
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, initializing, login, register, logout, sessionMessage, clearSessionMessage: () => setSessionMessage('') }),
    [user, initializing, login, register, logout, sessionMessage]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>.');
  return context;
}
