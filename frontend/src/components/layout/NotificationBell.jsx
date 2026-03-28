import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';

const TYPE_ICON = {
  follow:   '👤',
  paper:    '📄',
  feedback: '💬',
  review:   '💬',
  generic:  '🔔',
};

function timeAgo(dateStr) {
  if (!dateStr) return "just now";

  // Some backend timestamps arrive without timezone suffix. Treat those as UTC
  // to avoid local-time parsing offsets that can show incorrect hour differences.
  const raw = String(dateStr).trim();
  const withT = raw.includes("T") ? raw : raw.replace(" ", "T");
  const hasZone = /(?:z|[+-]\d{2}(?::?\d{2})?)$/i.test(withT);
  const normalized = hasZone ? withT : `${withT}Z`;

  const createdMs = new Date(normalized).getTime();
  if (Number.isNaN(createdMs)) return "just now";

  const diff = Math.max(0, Date.now() - createdMs);
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (days >= 1) return `${days}d ago`;
  if (hours >= 1) return `${hours}h ago`;
  if (mins >= 1) return `${mins}m ago`;
  return "just now";
}

export default function NotificationBell() {
  const [open, setOpen]            = useState(false);
  const [notifications, setNotifs] = useState([]);
  const [unreadCount, setUnread]   = useState(0);
  const [loading, setLoading]      = useState(false);
  const dropdownRef                = useRef(null);
  const navigate                   = useNavigate();

  const fetchNotifs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/notifications?limit=20');
      setNotifs(res.data.data.notifications);
      setUnread(res.data.data.unreadCount);
    } catch { /* silent — user may not be authed */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 30000); // poll every 30s
    return () => clearInterval(interval);
  }, [fetchNotifs]);

  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function handleOpen() {
    setOpen(prev => !prev);
    if (!open) await fetchNotifs();
  }

  async function handleMarkRead(notifId, e) {
    e.stopPropagation();
    try {
      await api.patch(`/notifications/${notifId}/read`);
      setNotifs(prev => prev.map(n => n.id === notifId ? { ...n, is_read: true } : n));
      setUnread(prev => Math.max(0, prev - 1));
    } catch { /* silent */ }
  }

  async function handleMarkAllRead() {
    try {
      await api.patch('/notifications/read-all');
      setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnread(0);
    } catch { /* silent */ }
  }

  function handleNotifClick(notif) {
    if (!notif.is_read) {
      api.patch(`/notifications/${notif.id}/read`).catch(() => {});
      setNotifs(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
      setUnread(prev => Math.max(0, prev - 1));
    }
    if (notif.type === 'paper' && notif.paper_id)           navigate(`/papers/${notif.paper_id}`);
    else if (notif.type === 'feedback')                     navigate('/feedback/my');
    else if (notif.type === 'follow' && notif.triggered_user_id) navigate(`/authors/${notif.triggered_user_id}`);
    setOpen(false);
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-full text-gray-600 hover:text-blue-600 hover:bg-blue-50 transition-colors"
        aria-label="Notifications"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
            <span className="font-semibold text-gray-800 text-sm">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
            {loading && notifications.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-400">Loading…</div>
            ) : notifications.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-400">
                <div className="text-3xl mb-2">🔔</div>No notifications yet
              </div>
            ) : notifications.map(notif => (
              <div
                key={notif.id}
                onClick={() => handleNotifClick(notif)}
                className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-blue-50 ${!notif.is_read ? 'bg-blue-50/40' : 'bg-white'}`}
              >
                <span className="text-xl mt-0.5 flex-shrink-0">{TYPE_ICON[notif.type] ?? '🔔'}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm leading-snug ${!notif.is_read ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                    {notif.message}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{timeAgo(notif.created_at)}</p>
                </div>
                {!notif.is_read && (
                  <button
                    onClick={(e) => handleMarkRead(notif.id, e)}
                    className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-blue-500 hover:bg-blue-700 transition-colors"
                    title="Mark as read"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
