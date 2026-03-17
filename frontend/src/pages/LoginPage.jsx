import { LoginForm } from "../components/auth/LoginForm";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-700">
      <section className="mx-auto grid min-h-[calc(100vh-64px)] w-full max-w-7xl grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-2 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-slate-300 bg-slate-900 p-8 text-white sm:p-12">
          <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_1px_1px,_#ffffff_1px,_transparent_0)] [background-size:18px_18px]" />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-300">Research Identity Network</p>
            <h1 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl">Welcome back to PaperBoat</h1>
            <p className="mt-4 max-w-md text-sm text-slate-200 sm:text-base">
              Discover papers, connect with reviewers, and follow the citation flow of ideas that matter.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-3 text-xs text-slate-300 sm:text-sm">
              <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-3">Domain-first discovery</div>
              <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-3">Threaded peer reviews</div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
          <div className="w-full max-w-md">
            <h2 className="text-2xl font-semibold text-slate-900">Sign in</h2>
            <p className="mt-1 text-sm text-slate-600">Access your PaperBoat account</p>
            <div className="mt-6">
              <LoginForm />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
