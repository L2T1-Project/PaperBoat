import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import api from "../api/axios";
import { useAuth } from "./AuthContext";

// shafnan start: part2 frontend notification polling
const POLL_INTERVAL_MS = 15_000;
const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { isAuthenticated, user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const intervalRef = useRef(null);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const fetchNotifications = useCallback(async () => {
    if (!user?.userId) return;
    try {
      const res = await api.get(`/notifications/user/${user.userId}`);
      setNotifications(res.data.data ?? []);
    } catch (err) {
      console.error("[NotificationContext] fetch error:", err);
    }
  }, [user?.userId]);

  useEffect(() => {
    if (!isAuthenticated || !user?.userId) {
      setNotifications([]);
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      return;
    }

    fetchNotifications();
    intervalRef.current = setInterval(fetchNotifications, POLL_INTERVAL_MS);

    return () => {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [isAuthenticated, user?.userId, fetchNotifications]);

  const markAsRead = useCallback(
    async (notificationId) => {
      if (!user?.userId) return;
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, is_read: true } : n,
        ),
      );
      try {
        await api.patch(`/notifications/${notificationId}/receivers/read`, {
          user_id: user.userId,
        });
      } catch (err) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId ? { ...n, is_read: false } : n,
          ),
        );
        console.error("[markAsRead] error:", err);
      }
    },
    [user?.userId],
  );

  const markAllAsRead = useCallback(async () => {
    if (!user?.userId) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    try {
      await api.patch(`/notifications/user/${user.userId}/read-all`);
    } catch (err) {
      console.error("[markAllAsRead] error:", err);
    }
  }, [user?.userId]);

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, markAsRead, markAllAsRead }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error(
      "useNotifications must be used within a NotificationProvider",
    );
  }
  return ctx;
}
// shafnan end: part2 frontend notification polling
