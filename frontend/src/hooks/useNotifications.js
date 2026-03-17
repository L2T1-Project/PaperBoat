import { useCallback, useEffect, useRef, useState } from "react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";

const POLL_INTERVAL_MS = 5000;

export function useNotifications() {
  const { isAuthenticated, user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const intervalRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated || !user?.userId) return;
    try {
      const res = await api.get(`/notifications/user/${user.userId}`);
      setNotifications(res.data?.data ?? []);
    } catch {
      // Silently swallow polling errors — no toast spam
    }
  }, [isAuthenticated, user?.userId]);

  // Start / stop the poll based on auth state
  useEffect(() => {
    if (!isAuthenticated) {
      setNotifications([]);
      return;
    }

    fetchNotifications();
    intervalRef.current = setInterval(fetchNotifications, POLL_INTERVAL_MS);

    return () => clearInterval(intervalRef.current);
  }, [isAuthenticated, fetchNotifications]);

  const markAsRead = useCallback(async (notificationId) => {
    // Optimistic UI update
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n)),
    );
    try {
      await api.patch(`/notifications/${notificationId}/read`);
    } catch {
      // Roll back optimistic update on failure
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, is_read: false } : n,
        ),
      );
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    try {
      await api.patch("/notifications/read-all");
    } catch {
      // Re-fetch to get accurate state on failure
      fetchNotifications();
    }
  }, [fetchNotifications]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // Build a navigation path from the enriched link fields returned by the API
  const getNotificationPath = (n) => {
    if (n.link_type === "review" && n.link_paper_id) {
      return `/papers/${n.link_paper_id}/reviews`;
    }
    if (n.link_type === "paper" && n.link_paper_id) {
      return `/papers/${n.link_paper_id}`;
    }
    if (n.link_type === "user" && n.link_author_id) {
      return `/authors/${n.link_author_id}`;
    }
    return null;
  };

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    getNotificationPath,
  };
}
