import { useAuth } from "../context/AuthContext";
import { NotificationBell } from "../components/NotificationBell";

// shafnan start: part2 frontend authenticated layout
/**
 * Shared page layout: sticky top nav with brand, notification bell, and logout.
 * Wrap any authenticated page with this component.
 */
export default function Layout({ children }) {
  const { logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-100">
      {/* -- Top navigation -- */}
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-8">
          {/* Brand */}
          <span className="text-sm font-bold tracking-widest text-[#1a6eb5] uppercase">
            PaperBoat
          </span>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <NotificationBell />

            <button
              type="button"
              onClick={logout}
              className="rounded-lg bg-[#1a6eb5] px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-blue-800"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* -- Page content -- */}
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8">
        {children}
      </main>
    </div>
  );
}
// shafnan end: part2 frontend authenticated layout
