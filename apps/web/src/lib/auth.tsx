'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  apiFetch,
  clearAuth,
  loadAuth,
  saveAuth,
  type StoredAuth,
} from '@/lib/api';

type AuthContextValue = {
  auth: StoredAuth | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: {
    email: string;
    password: string;
    name: string;
    tenantName: string;
  }) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<StoredAuth | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setAuth(loadAuth());
    setReady(true);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiFetch<StoredAuth>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    saveAuth(data);
    setAuth(data);
  }, []);

  const register = useCallback(
    async (input: {
      email: string;
      password: string;
      name: string;
      tenantName: string;
    }) => {
      const data = await apiFetch<StoredAuth>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      saveAuth(data);
      setAuth(data);
    },
    [],
  );

  const logout = useCallback(() => {
    clearAuth();
    setAuth(null);
  }, []);

  const value = useMemo(
    () => ({ auth, ready, login, register, logout }),
    [auth, ready, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
