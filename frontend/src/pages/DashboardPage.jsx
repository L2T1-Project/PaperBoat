import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import EmptyState from "../components/common/EmptyState";

export default function DashboardPage() {
  const { user } = useAuth();
  const userId = user?.userId;
  const role = user?.role;

  const [displayName, setDisplayName] = useState("User");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [researcherRecentPapers, setResearcherRecentPapers] = useState([]);
  const [researcherAllPapers, setResearcherAllPapers] = useState([]);

  const [venueTopCitedPapers, setVenueTopCitedPapers] = useState([]);
  const [venuePublishedPapers, setVenuePublishedPapers] = useState([]);
  const [venueProminentAuthors, setVenueProminentAuthors] = useState([]);
  const [showAllVenuePapers, setShowAllVenuePapers] = useState(false);

  const researcherScrollRef = useRef(null);

  useEffect(() => {
    const fetchDashboard = async () => {
      if (!userId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError("");

        const displayNamePromise = api.get(`/users/${userId}/display-name`);

        if (role === "researcher") {
          const [displayNameRes, recentRes, allRes] = await Promise.all([
            displayNamePromise,
            api.get(`/researchers/${userId}/dashboard/papers`, { params: { limit: 5, offset: 0 } }),
            api.get(`/researchers/${userId}/dashboard/papers`, { params: { limit: 50, offset: 0 } }),
          ]);

          setDisplayName(displayNameRes.data?.data?.full_name || displayNameRes.data?.data?.username || "User");
          setResearcherRecentPapers(recentRes.data?.data || []);
          setResearcherAllPapers(allRes.data?.data || []);
          return;
        }

        if (role === "venue_user") {
          const [displayNameRes, topCitedRes, publishedRes, authorsRes] = await Promise.all([
            displayNamePromise,
            api.get(`/venue-users/${userId}/dashboard/top-cited-papers`, { params: { limit: 10, offset: 0 } }),
            api.get(`/venue-users/${userId}/dashboard/published-papers`, { params: { limit: 100, offset: 0 } }),
            api.get(`/venue-users/${userId}/dashboard/prominent-authors`, { params: { limit: 8 } }),
          ]);

          setDisplayName(displayNameRes.data?.data?.full_name || displayNameRes.data?.data?.username || "User");
          setVenueTopCitedPapers(topCitedRes.data?.data || []);
          setVenuePublishedPapers(publishedRes.data?.data || []);
          setVenueProminentAuthors(authorsRes.data?.data || []);
          return;
        }

        const displayNameRes = await displayNamePromise;
        setDisplayName(displayNameRes.data?.data?.full_name || displayNameRes.data?.data?.username || "User");
      } catch (err) {
        console.error("Dashboard load error:", err);
        setError("Failed to load dashboard data.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboard();
  }, [userId, role]);

  const firstName = useMemo(() => {
    const source = (displayName || "User").trim();
    return source.split(" ")[0] || "User";
  }, [displayName]);

  const scrollResearcherRow = (direction) => {
    if (!researcherScrollRef.current) return;
    researcherScrollRef.current.scrollBy({
      left: direction === "left" ? -420 : 420,
      behavior: "smooth",
    });
  };

  const heroTone = role === "admin"
    ? "from-rose-100 via-white to-amber-100"
    : role === "researcher"
      ? "from-emerald-100 via-white to-cyan-100"
      : role === "venue_user"
        ? "from-blue-100 via-white to-teal-100"
        : "from-amber-100 via-white to-lime-100";

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <section className={`rounded-3xl border border-slate-200 bg-gradient-to-r ${heroTone} p-8 shadow-sm`}>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">Workspace</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900">Welcome back, {firstName}</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-700">
            {role === "researcher" && "Your researcher workspace is tuned for claims, profile momentum, and publication visibility."}
            {role === "venue_user" && "Track your venue's publication performance and author impact from one place."}
            {role === "admin" && "Keep moderation quality high with quick access to queue and feedback operations."}
            {!role || role === "user" ? "Save important papers, explore authors, and build your personal reading trail." : null}
          </p>
        </section>

        {error ? <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</section> : null}

        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Signed In As</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">{displayName}</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Profile Role</p>
            <p className="mt-2 text-xl font-semibold text-slate-900 capitalize">{role || "User"}</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-slate-500">Suggested Action</p>
            {role === "researcher" ? (
              <div className="mt-2 space-y-2">
                <p className="text-sm font-medium text-slate-800">Submit and track paper claims</p>
                <Link
                  to={`/researchers/${userId}/claims`}
                  className="inline-block rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  See My Claims
                </Link>
              </div>
            ) : null}
            {role === "admin" ? (
              <div className="mt-2 space-y-2">
                <p className="text-sm font-medium text-slate-800">Review moderation queue</p>
                <Link
                  to="/admin/claims"
                  className="inline-block rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Open Claim Queue
                </Link>
              </div>
            ) : null}
            {role === "venue_user" ? (
              <p className="mt-2 text-sm font-medium text-slate-800">Inspect top-cited papers and venue-author trends</p>
            ) : null}
            {(!role || role === "user") ? (
              <p className="mt-2 text-sm font-medium text-slate-800">Save relevant papers and follow researchers you trust</p>
            ) : null}
          </article>
        </section>

        {role === "admin" ? (
          <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <article className="rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-rose-600">Queue</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">Pending Claims</p>
              <p className="mt-1 text-xs text-slate-600">Prioritize unresolved authorship claims.</p>
            </article>
            <article className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-amber-700">Inbox</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">Feedback Responses</p>
              <p className="mt-1 text-xs text-slate-600">Keep user communication timely and clear.</p>
            </article>
            <article className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-cyan-700">Signal</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">Notification Health</p>
              <p className="mt-1 text-xs text-slate-600">Watch moderation and response delivery behavior.</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Action</p>
              <div className="mt-2 flex flex-col gap-2">
                <Link to="/admin/claims" className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">Go to Claims</Link>
                <Link to="/admin/feedback" className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">Go to Feedback</Link>
              </div>
            </article>
          </section>
        ) : null}

        {role === "researcher" ? (
          <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Your Recent Papers</h2>
            {isLoading ? <p className="text-sm text-slate-500">Loading researcher papers...</p> : null}
            {!isLoading && !researcherRecentPapers.length ? (
              <EmptyState
                icon="🧪"
                title="No linked papers yet"
                body="Start with your claims page to connect your profile to existing papers in the catalog."
                ctaLabel="Open My Claims"
                ctaTo={`/researchers/${userId}/claims`}
                className="py-8"
              />
            ) : null}
            {!!researcherRecentPapers.length ? (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {researcherRecentPapers.map((paper) => (
                  <article key={paper.paper_id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <Link
                      to={`/papers/${paper.paper_id}`}
                      className="text-sm font-semibold text-slate-900 line-clamp-2 hover:text-slate-700 hover:underline"
                    >
                      {paper.title}
                    </Link>
                    <p className="mt-1 text-xs text-slate-600">{paper.venue_name || "N/A"}</p>
                    <p className="mt-1 text-xs text-slate-500">Citations: {paper.citation_count || 0}</p>
                  </article>
                ))}
              </div>
            ) : null}

            <div className="pt-2">
              <p className="mb-2 text-sm font-medium text-slate-700">All papers</p>
              {!researcherAllPapers.length ? (
                <p className="text-sm text-slate-500">No additional papers yet.</p>
              ) : (
                <>
                  <div ref={researcherScrollRef} className="flex gap-3 overflow-x-auto pb-2">
                    {researcherAllPapers.map((paper) => (
                      <article key={paper.paper_id} className="min-w-[280px] rounded-xl border border-slate-200 bg-white p-4">
                        <Link
                          to={`/papers/${paper.paper_id}`}
                          className="text-sm font-semibold text-slate-900 line-clamp-2 hover:text-slate-700 hover:underline"
                        >
                          {paper.title}
                        </Link>
                        <p className="mt-1 text-xs text-slate-600">{paper.venue_name || "N/A"}</p>
                        <p className="mt-1 text-xs text-slate-500">Citations: {paper.citation_count || 0}</p>
                      </article>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => scrollResearcherRow("left")}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollResearcherRow("right")}
                      className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
                    >
                      →
                    </button>
                  </div>
                </>
              )}
            </div>
          </section>
        ) : null}

        {role === "venue_user" ? (
          <section className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Top 10 Most Cited Papers</h2>
              {isLoading ? <p className="mt-1 text-sm text-slate-500">Loading venue insights...</p> : null}
              {!isLoading && !venueTopCitedPapers.length ? (
                <EmptyState
                  icon="📉"
                  title="No citation data yet"
                  body="Published papers for this venue will appear here once indexed."
                  className="mt-3 py-7"
                />
              ) : null}
              {!!venueTopCitedPapers.length ? (
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {venueTopCitedPapers.map((paper) => (
                    <article key={paper.paper_id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <Link
                        to={`/papers/${paper.paper_id}`}
                        className="text-sm font-semibold text-slate-900 line-clamp-2 hover:text-slate-700 hover:underline"
                      >
                        {paper.title}
                      </Link>
                      <p className="mt-1 text-xs text-slate-500">Citations: {paper.citation_count || 0}</p>
                    </article>
                  ))}
                </div>
              ) : null}
            </div>

            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-900">All Published Papers</h3>
                <button
                  type="button"
                  onClick={() => setShowAllVenuePapers((prev) => !prev)}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
                >
                  {showAllVenuePapers ? "Hide" : "Show all"}
                </button>
              </div>
              {showAllVenuePapers ? (
                venuePublishedPapers.length ? (
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {venuePublishedPapers.map((paper) => (
                      <article key={paper.paper_id} className="rounded-xl border border-slate-200 bg-white p-4">
                        <Link
                          to={`/papers/${paper.paper_id}`}
                          className="text-sm font-semibold text-slate-900 line-clamp-2 hover:text-slate-700 hover:underline"
                        >
                          {paper.title}
                        </Link>
                        <p className="mt-1 text-xs text-slate-500">Citations: {paper.citation_count || 0}</p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon="📚"
                    title="No published papers"
                    body="This venue does not have indexed papers yet."
                    className="mt-3 py-7"
                  />
                )
              ) : null}
            </div>

            <div>
              <h3 className="text-base font-semibold text-slate-900">Prominent Authors in This Venue</h3>
              {!venueProminentAuthors.length ? (
                <EmptyState
                  icon="👤"
                  title="No author data available"
                  body="Author activity will show here when publication links are available."
                  className="mt-3 py-7"
                />
              ) : (
                <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {venueProminentAuthors.map((author) => (
                    <article key={author.author_id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-semibold text-slate-900">{author.author_name}</p>
                      <p className="mt-1 text-xs text-slate-600">Papers: {author.paper_count}</p>
                      <p className="mt-1 text-xs text-slate-500">Citations: {author.total_citations}</p>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>
        ) : null}

        {(!role || role === "user") ? (
          <section className="grid gap-4 md:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Discovery</p>
              <h2 className="mt-2 text-lg font-semibold text-slate-900">Find your next paper</h2>
              <p className="mt-2 text-sm text-slate-600">Use domains and topic filters to quickly narrow down what matters.</p>
              <Link to="/papers" className="mt-3 inline-block rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800">Explore Papers</Link>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">Community</p>
              <h2 className="mt-2 text-lg font-semibold text-slate-900">Follow active researchers</h2>
              <p className="mt-2 text-sm text-slate-600">Visit author profiles, inspect records, and follow claimed researcher accounts.</p>
              <Link to="/authors" className="mt-3 inline-block rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800">Browse Authors</Link>
            </article>
          </section>
        ) : null}
      </div>
    </main>
  );
}
