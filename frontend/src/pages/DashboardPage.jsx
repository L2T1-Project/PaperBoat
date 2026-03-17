import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";

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

          setDisplayName(
            displayNameRes.data?.data?.full_name || displayNameRes.data?.data?.username || "User",
          );
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

          setDisplayName(
            displayNameRes.data?.data?.full_name || displayNameRes.data?.data?.username || "User",
          );
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

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Workspace</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">Welcome back, {firstName}</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Use the Papers tab to browse publications, inspect citation trails, and engage in review discussions.
          </p>
        </section>

        {error ? (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</section>
        ) : null}

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
            <p className="mt-2 text-sm font-medium text-slate-800">Review a paper in your domain</p>
          </article>
        </section>

        {role === "researcher" ? (
          <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Your Recent Papers</h2>
            {isLoading ? <p className="text-sm text-slate-500">Loading researcher papers...</p> : null}
            {!isLoading && !researcherRecentPapers.length ? (
              <p className="text-sm text-slate-500">No papers linked yet.</p>
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
              <p className="mb-2 text-sm font-medium text-slate-700">All papers (horizontal scroll)</p>
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
            </div>
          </section>
        ) : null}

        {role === "venue_user" ? (
          <section className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Top 10 Most Cited Papers</h2>
              {isLoading ? <p className="mt-1 text-sm text-slate-500">Loading venue insights...</p> : null}
              {!isLoading && !venueTopCitedPapers.length ? (
                <p className="mt-1 text-sm text-slate-500">No published papers found for this venue.</p>
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
              ) : null}
            </div>

            <div>
              <h3 className="text-base font-semibold text-slate-900">Prominent Authors in This Venue</h3>
              {!venueProminentAuthors.length ? (
                <p className="mt-1 text-sm text-slate-500">No author data available yet.</p>
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
      </div>
    </main>
  );
}
