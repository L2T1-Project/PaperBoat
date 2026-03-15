import { useAuth } from "../context/AuthContext";

export default function DashboardPage() {
  const { user, logout } = useAuth();

  return (
    <main className="min-h-screen bg-gray-100 px-4 py-6 sm:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <header className="mb-10 flex items-center justify-end">
          <button
            type="button"
            onClick={logout}
            className="rounded-lg bg-[#1a6eb5] px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-blue-800"
          >
            Logout
          </button>
        </header>

        <section className="rounded-2xl bg-white p-8 shadow-md">
          <h1 className="text-2xl font-semibold text-gray-800 sm:text-3xl">
            Welcome back, {user?.role ?? "user"}
          </h1>
        </section>
      </div>
    </main>
  );
}
