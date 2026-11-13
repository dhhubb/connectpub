'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, getStoredUser, getToken, storeSession, type SessionUser } from './api';

export type { SessionUser } from './api';

interface SessionValue {
  user: SessionUser | null;
  token: string | null;
  ready: boolean;
  setSession: (token: string | null, user: SessionUser | null) => void;
  refresh: () => Promise<SessionUser | null>;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setUser(getStoredUser());
    setToken(getToken());
    const onSession = () => { setUser(getStoredUser()); setToken(getToken()); };
    window.addEventListener('pc:session', onSession);
    return () => window.removeEventListener('pc:session', onSession);
  }, []);

  const setSession = useCallback((nextToken: string | null, nextUser: SessionUser | null) => {
    storeSession(nextToken, nextUser);
    setToken(nextToken);
    setUser(nextUser);
  }, []);

  const refresh = useCallback(async () => {
    if (!getToken()) { setReady(true); return null; }
    try {
      const { user: fresh } = await api<{ user: SessionUser }>('/auth/me');
      storeSession(getToken(), fresh);
      setUser(fresh);
      return fresh;
    } catch {
      return null;
    } finally {
      setReady(true);
    }
  }, []);

  const logout = useCallback(async () => {
    try { await api('/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
    setSession(null, null);
  }, [setSession]);

  useEffect(() => {
    if (!getToken()) { setReady(true); return; }
    refresh();
  }, [refresh]);

  const value = useMemo<SessionValue>(
    () => ({ user, token, ready, setSession, refresh, logout }),
    [user, token, ready, setSession, refresh, logout],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}
