import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "../../hooks/useNotifications";

function BellIcon({ hasUnread }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      {hasUnread && (
        <circle
          cx="18"
          cy="5"
          r="4"
          fill="#ef4444"
          stroke="white"
          strokeWidth="1.5"
        />
      )}
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="flex-shrink-0 text-slate-400"
    >
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationBox() {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    getNotificationPath,
  } = useNotifications();
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);
  const buttonRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleClickOutside(e) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleNotificationClick = (n) => {
    if (!n.is_read) markAsRead(n.id);
    const path = getNotificationPath(n);
    if (path) {
      setOpen(false);
      navigate(path);
    }
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
      >
        <BellIcon hasUnread={unreadCount > 0} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold leading-none text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border border-slate-200 bg-white shadow-lg"
          role="dialog"
          aria-label="Notifications panel"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="text-sm font-semibold text-slate-800">
              Notifications
              {unreadCount > 0 && (
                <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600">
                  {unreadCount} new
                </span>
              )}
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="text-xs text-slate-500 hover:text-slate-800 hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <ul className="max-h-80 overflow-y-auto" role="list">
            {notifications.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-slate-400">
                No notifications yet
              </li>
            ) : (
              notifications.map((n) => {
                const path = getNotificationPath(n);
                const isClickable = Boolean(path);
                return (
                  <li key={n.id} role="listitem">
                    <button
                      type="button"
                      onClick={() => handleNotificationClick(n)}
                      className={`w-full px-4 py-3 text-left transition-colors focus:outline-none focus-visible:bg-slate-50 ${
                        n.is_read
                          ? "bg-white hover:bg-slate-50"
                          : "bg-blue-50/60 hover:bg-blue-50"
                      } ${isClickable ? "cursor-pointer" : "cursor-default"}`}
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${
                            n.is_read ? "bg-transparent" : "bg-blue-500"
                          }`}
                          aria-hidden="true"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-sm leading-snug text-slate-700">
                            {n.message}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-400">
                            {timeAgo(n.created_at)}
                          </p>
                        </div>
                        {isClickable && <ArrowIcon />}
                      </div>
                    </button>
                    <div className="mx-4 border-t border-slate-100" />
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
