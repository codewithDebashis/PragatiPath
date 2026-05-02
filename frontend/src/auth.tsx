import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, formatApiError } from './api';

export type User = {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  child_name?: string;
  child_age?: number;
  child_class?: string;
  user_id_code?: string;
  role: 'parent' | 'admin';
  enrollment_status?: string;
  created_at?: string;
};

type AuthCtx = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (data: any) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await AsyncStorage.getItem('pp_token');
      if (token) {
        try {
          const r = await api.get('/auth/me');
          setUser(r.data);
        } catch {
          await AsyncStorage.removeItem('pp_token');
        }
      }
      setLoading(false);
    })();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const r = await api.post('/auth/login', { email, password });
      await AsyncStorage.setItem('pp_token', r.data.token);
      setUser(r.data.user);
      return r.data.user as User;
    } catch (e: any) {
      throw new Error(formatApiError(e?.response?.data?.detail) || e.message);
    }
  };

  const register = async (data: any) => {
    try {
      const r = await api.post('/auth/register', data);
      await AsyncStorage.setItem('pp_token', r.data.token);
      setUser(r.data.user);
      return r.data.user as User;
    } catch (e: any) {
      throw new Error(formatApiError(e?.response?.data?.detail) || e.message);
    }
  };

  const logout = async () => {
    await AsyncStorage.removeItem('pp_token');
    setUser(null);
  };

  const refresh = async () => {
    try {
      const r = await api.get('/auth/me');
      setUser(r.data);
    } catch {}
  };

  return <Ctx.Provider value={{ user, loading, login, register, logout, refresh }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth outside provider');
  return c;
}
