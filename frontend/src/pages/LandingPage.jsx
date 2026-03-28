import { Navigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const FEATURES = [
	{
		title: "Discover the right papers",
		text: "Browse by domain, field, and topic with transparent metadata and clean filtering.",
	},
	{
		title: "Follow researchers",
		text: "Keep up with claimed researcher profiles and get notified when new work appears.",
	},
	{
		title: "Role-aware workspaces",
		text: "Researcher claims, venue insights, and admin moderation each get focused dashboards.",
	},
];

export default function LandingPage() {
	const { isAuthenticated } = useAuth();

	if (isAuthenticated) {
		return <Navigate to="/dashboard" replace />;
	}

	return (
		<main className="relative min-h-screen overflow-hidden bg-[#f6f2e8] text-slate-900">
			<div className="pointer-events-none absolute -left-24 top-20 h-72 w-72 rounded-full bg-emerald-200/50 blur-3xl" />
			<div className="pointer-events-none absolute -right-28 top-12 h-80 w-80 rounded-full bg-amber-300/40 blur-3xl" />
			<div className="pointer-events-none absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-cyan-200/40 blur-3xl" />

			<section className="mx-auto grid w-full max-w-6xl gap-8 px-4 pb-14 pt-12 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:pt-16">
				<div>
					<p className="inline-block rounded-full border border-slate-300/80 bg-white/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
						PaperBoat
					</p>
					<h1 className="mt-4 text-4xl font-black leading-tight sm:text-5xl">
						Find the right research,
						<span className="block text-emerald-700">without the noise.</span>
					</h1>
					<p className="mt-4 max-w-xl text-base text-slate-700 sm:text-lg">
						Discover credible papers, verify researcher profiles, and track meaningful academic activity in one clear workspace.
					</p>

					<div className="mt-7 flex flex-wrap gap-3">
						<Link
							to="/signup"
							className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-slate-400/30 transition hover:-translate-y-0.5 hover:bg-slate-800"
						>
							Create account
						</Link>
						<Link
							to="/papers"
							className="rounded-xl border border-slate-300 bg-white/80 px-5 py-3 text-sm font-semibold text-slate-800 transition hover:-translate-y-0.5 hover:bg-white"
						>
							Explore papers
						</Link>
					</div>

					<div className="mt-10 grid gap-3 sm:grid-cols-3">
						{FEATURES.map((feature) => (
							<article key={feature.title} className="rounded-2xl border border-slate-300/70 bg-white/70 p-4 backdrop-blur-sm">
								<h2 className="text-sm font-bold text-slate-900">{feature.title}</h2>
								<p className="mt-2 text-xs leading-relaxed text-slate-600">{feature.text}</p>
							</article>
						))}
					</div>
				</div>

				<aside className="rounded-3xl border border-slate-300/80 bg-white/80 p-6 shadow-xl shadow-slate-400/20 backdrop-blur-sm sm:p-7">
					<p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Workspace Preview</p>
					<div className="mt-4 space-y-3">
						<div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
							<p className="text-xs text-slate-500">Researcher</p>
							<p className="mt-1 text-sm font-semibold text-slate-900">Track claims and recent papers</p>
						</div>
						<div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
							<p className="text-xs text-slate-500">Venue User</p>
							<p className="mt-1 text-sm font-semibold text-slate-900">See citation and author insights</p>
						</div>
						<div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
							<p className="text-xs text-slate-500">Admin</p>
							<p className="mt-1 text-sm font-semibold text-slate-900">Moderate claims and feedback inbox</p>
						</div>
					</div>

					<div className="mt-6 rounded-2xl bg-slate-900 p-4 text-slate-100">
						<p className="text-xs uppercase tracking-[0.14em] text-slate-300">Returning user?</p>
						<Link
							to="/login"
							className="mt-2 inline-block rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 hover:bg-slate-100"
						>
							Login
						</Link>
					</div>
				</aside>
			</section>
		</main>
	);
}
