import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axios";
import NotificationBell from './NotificationBell';

function NavLink({ to, label, active }) {
  return (
    <Link
      to={to}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
      }`}
    >
      {label}
    </Link>
  );
}

export default function AppHeader() {
  const location = useLocation();
  const { isAuthenticated, logout, user } = useAuth();
  const [researcherAuthorId, setResearcherAuthorId] = useState(null);

  useEffect(() => {
    const fetchResearcherProfile = async () => {
      if (!isAuthenticated || user?.role !== "researcher" || !user?.userId) {
        setResearcherAuthorId(null);
        return;
      }

      try {
        const response = await api.get(`/researchers/${user.userId}`);
        setResearcherAuthorId(response.data?.data?.author_id || null);
      } catch {
        setResearcherAuthorId(null);
      }
    };

    fetchResearcherProfile();
  }, [isAuthenticated, user?.role, user?.userId]);

  const isAuthPage =
    location.pathname === "/login" || location.pathname === "/signup";

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/90 bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link
          to="/papers"
          className="text-base font-semibold tracking-tight text-slate-900"
        >
          PaperBoat
        </Link>

        <div className="flex items-center gap-2">
          {!isAuthPage && (
            <>
              <NavLink
                to="/papers"
                label="Papers"
                active={location.pathname.startsWith("/papers")}
              />
              <NavLink
                to="/authors"
                label="Authors"
                active={location.pathname.startsWith("/authors")}
              />
              <NavLink
                to="/venues"
                label="Venues"
                active={location.pathname.startsWith("/venues")}
              />
              {isAuthenticated ? (
                <NavLink
                  to="/dashboard"
                  label="Dashboard"
                  active={location.pathname === "/dashboard"}
                />
              ) : null}
              {isAuthenticated ? (
                <NavLink
                  to="/library"
                  label="My Library"
                  active={location.pathname === "/library"}
                />
              ) : null}
              {isAuthenticated ? (
                <NavLink
                  to="/feedback"
                  label="Feedback"
                  active={location.pathname.startsWith("/feedback")}
                />
              ) : null}
              {isAuthenticated && user?.role === "researcher" ? (
                <NavLink
                  to={`/researchers/${user.userId}/claims`}
                  label="My Claims"
                  active={location.pathname === `/researchers/${user.userId}/claims`}
                />
              ) : null}
              {isAuthenticated && user?.role === "admin" ? (
                <NavLink
                  to="/admin/claims"
                  label="Claim Queue"
                  active={location.pathname === "/admin/claims"}
                />
              ) : null}
              {isAuthenticated && user?.role === "admin" ? (
                <NavLink
                  to="/admin/feedback"
                  label="Feedback Inbox"
                  active={location.pathname === "/admin/feedback"}
                />
              ) : null}
            </>
          )}

          {isAuthenticated ? (
            <div className="ml-2 flex items-center gap-2">
              {user?.role === "researcher" ? (
                <Link
                  to={researcherAuthorId ? `/authors/${researcherAuthorId}` : "/authors"}
                  className="hidden rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 sm:inline"
                >
                  Your Profile
                </Link>
              ) : (
                <span className="hidden rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600 sm:inline">
                  {user?.role || "user"}
                </span>
              )}
              <NotificationBell />
              <button
                type="button"
                onClick={logout}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-100"
              >
                Logout
              </button>
            </div>
          ) : (
            <div className="ml-2 flex items-center gap-2">
              <NavLink
                to="/login"
                label="Login"
                active={location.pathname === "/login"}
              />
              <NavLink
                to="/signup"
                label="Signup"
                active={location.pathname === "/signup"}
              />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
