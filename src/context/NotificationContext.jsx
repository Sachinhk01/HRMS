import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { getUnreadCount } from '../services/notificationService';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    try {
      const count = await getUnreadCount();
      setUnreadCount(count || 0);
    } catch {
      // Leave the last known count rather than flashing the dot to 0 on a
      // transient network error.
    }
  }, [user]);

  // Refetch whenever the logged-in user changes (login/logout).
  useEffect(() => {
    refreshUnreadCount();
  }, [refreshUnreadCount]);

  // Optimistic local update for instant UI feedback — call this right when
  // a notification is marked read, then let refreshUnreadCount() reconcile
  // with the server in the background.
  const decrementUnreadCount = useCallback((by = 1) => {
    setUnreadCount((current) => Math.max(0, current - by));
  }, []);

  const value = { unreadCount, refreshUnreadCount, decrementUnreadCount, setUnreadCount };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export const useNotifications = () => useContext(NotificationContext);