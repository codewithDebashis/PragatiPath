import { useEffect, useState, useCallback } from 'react';
import { AppState } from 'react-native';
import { api } from './api';
import { useAuth } from './auth';

export function useUnreadCount() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!user) { setCount(0); return; }
    try {
      const r = await api.get('/notifications/me');
      setCount((r.data as any[]).filter((n) => !n.read).length);
    } catch {}
  }, [user]);

  useEffect(() => {
    if (!user) return;
    refresh();
    const id = setInterval(refresh, 15000);
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') refresh(); });
    return () => { clearInterval(id); sub.remove(); };
  }, [user, refresh]);

  return { count, refresh };
}
