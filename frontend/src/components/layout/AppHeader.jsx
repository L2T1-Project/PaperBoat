import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import NotificationBox from "../notifications/NotificationBox";

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
              {isAuthenticated ? (
                <NavLink
                  to="/dashboard"
                  label="Dashboard"
                  active={location.pathname === "/dashboard"}
                />
              ) : null}
            </>
          )}

          {isAuthenticated ? (
            <div className="ml-2 flex items-center gap-2">
              <span className="hidden rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600 sm:inline">
                {user?.role || "user"}
              </span>
              <NotificationBox />
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
