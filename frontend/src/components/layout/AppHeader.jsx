import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axios";
import NotificationBell from './NotificationBell';

const ROLE_NAV = {
  guest: [
    { to: "/papers", label: "Papers", match: (path) => path.startsWith("/papers") },
    { to: "/authors", label: "Authors", match: (path) => path.startsWith("/authors") },
    { to: "/venues", label: "Venues", match: (path) => path.startsWith("/venues") },
  ],
  user: [
    { to: "/papers", label: "Papers", match: (path) => path.startsWith("/papers") },
    { to: "/authors", label: "Authors", match: (path) => path.startsWith("/authors") },
    { to: "/venues", label: "Venues", match: (path) => path.startsWith("/venues") },
    { to: "/dashboard", label: "Dashboard", match: (path) => path === "/dashboard" },
    { to: "/library", label: "My Library", match: (path) => path === "/library" },
    { to: "/feedback", label: "Feedback", match: (path) => path.startsWith("/feedback") },
  ],
  researcher: [
    { to: "/papers", label: "Papers", match: (path) => path.startsWith("/papers") },
    { to: "/authors", label: "Authors", match: (path) => path.startsWith("/authors") },
    { to: "/venues", label: "Venues", match: (path) => path.startsWith("/venues") },
    { to: "/dashboard", label: "Dashboard", match: (path) => path === "/dashboard" },
    { to: "/library", label: "My Library", match: (path) => path === "/library" },
    { to: "/feedback", label: "Feedback", match: (path) => path.startsWith("/feedback") },
  ],
  venue_user: [
    { to: "/papers", label: "Papers", match: (path) => path.startsWith("/papers") },
    { to: "/authors", label: "Authors", match: (path) => path.startsWith("/authors") },
    { to: "/venues", label: "Venues", match: (path) => path.startsWith("/venues") },
    { to: "/dashboard", label: "Dashboard", match: (path) => path === "/dashboard" },
    { to: "/library", label: "My Library", match: (path) => path === "/library" },
    { to: "/feedback", label: "Feedback", match: (path) => path.startsWith("/feedback") },
  ],
  admin: [
    { to: "/papers", label: "Papers", match: (path) => path.startsWith("/papers") },
    { to: "/authors", label: "Authors", match: (path) => path.startsWith("/authors") },
    { to: "/venues", label: "Venues", match: (path) => path.startsWith("/venues") },
    { to: "/dashboard", label: "Dashboard", match: (path) => path === "/dashboard" },
    { to: "/admin/claims", label: "Claim Queue", match: (path) => path === "/admin/claims" },
    { to: "/admin/feedback", label: "Feedback Inbox", match: (path) => path === "/admin/feedback" },
  ],
};

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
  const [venueProfilePath, setVenueProfilePath] = useState("/venues");

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

  useEffect(() => {
    const fetchVenueProfile = async () => {
      if (!isAuthenticated || user?.role !== "venue_user" || !user?.userId) {
        setVenueProfilePath("/venues");
        return;
      }

      try {
        const response = await api.get(`/venue-users/${user.userId}`);
        const payload = response.data?.data ?? response.data;
        const venueId = Number(payload?.venue_id);
        setVenueProfilePath(Number.isInteger(venueId) && venueId > 0 ? `/venues/${venueId}` : "/venues");
      } catch {
        setVenueProfilePath("/venues");
      }
    };

    fetchVenueProfile();
  }, [isAuthenticated, user?.role, user?.userId]);

  const isAuthPage =
    location.pathname === "/login" || location.pathname === "/signup";
  const roleKey = isAuthenticated ? user?.role || "user" : "guest";
  const navItems = ROLE_NAV[roleKey] || ROLE_NAV.user;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/90 bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="text-base font-semibold tracking-tight text-slate-900"
        >
          PaperBoat
        </Link>

        <div className="flex items-center gap-2">
          {!isAuthPage && (
            <>
              {navItems.map((item) => (
                <NavLink
                  key={`${item.to}-${item.label}`}
                  to={item.to}
                  label={item.label}
                  active={item.match(location.pathname)}
                />
              ))}
              {isAuthenticated && user?.role === "researcher" ? (
                <NavLink
                  to={`/researchers/${user.userId}/claims`}
                  label="My Claims"
                  active={location.pathname === `/researchers/${user.userId}/claims`}
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
              ) : user?.role === "venue_user" ? (
                <Link
                  to={venueProfilePath}
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
              <Link
                to="/profile/edit"
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Edit Profile
              </Link>
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
