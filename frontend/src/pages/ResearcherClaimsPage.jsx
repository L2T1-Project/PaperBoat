import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api/axios";
import EmptyState from "../components/common/EmptyState";

const STATUS_CLASSES = {
  Pending: "border-amber-200 bg-amber-50 text-amber-700",
  Approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Declined: "border-rose-200 bg-rose-50 text-rose-700",
};

export default function ResearcherClaimsPage() {
  const { id } = useParams();
  const [claims, setClaims] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchClaims = async () => {
    try {
      setIsLoading(true);
      setError("");

      const response = await api.get(`/researchers/${id}/claims`);
      setClaims(response.data?.data || []);
    } catch (err) {
      console.error("Failed to load claims:", err);
      setError(err?.response?.data?.message || "Could not load your claims.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClaims();
  }, [id]);

  const grouped = useMemo(() => {
    const initial = { Pending: [], Approved: [], Declined: [] };
    claims.forEach((claim) => {
      const key = claim.claim_status;
      if (initial[key]) {
        initial[key].push(claim);
      }
    });
    return initial;
  }, [claims]);

  const retractClaim = async (paperId) => {
    try {
      await api.delete(`/researchers/${id}/claims/${paperId}`);
      fetchClaims();
    } catch (err) {
      setError(err?.response?.data?.message || "Could not retract this claim.");
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 py-10">
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 sm:px-6 lg:px-8">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Researcher Workspace</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">My Paper Claims</h1>
          <p className="mt-2 text-sm text-slate-600">Track pending moderation decisions and outcomes for your submitted claims.</p>
        </section>

        {error ? (
          <section className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </section>
        ) : null}

        {isLoading ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
            Loading claims...
          </section>
        ) : (
          <div className="space-y-5">
            {["Pending", "Approved", "Declined"].map((status) => (
              <section key={status} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-base font-semibold text-slate-900">
                  {status} <span className="text-sm font-normal text-slate-500">({grouped[status].length})</span>
                </h2>

                {!grouped[status].length ? (
                  <EmptyState
                    icon={status === "Pending" ? "⏳" : status === "Approved" ? "✅" : "🧾"}
                    title={`No ${status.toLowerCase()} claims`}
                    body={status === "Pending"
                      ? "Submit or refresh claims from paper pages to see live moderation status here."
                      : "This section will populate automatically when claim decisions are made."}
                    ctaLabel="Browse papers"
                    ctaTo="/papers"
                    className="mt-3 py-7"
                  />
                ) : (
                  <div className="mt-3 space-y-3">
                    {grouped[status].map((claim) => (
                      <article key={`${claim.paper_id}-${claim.claimed_at}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <Link to={`/papers/${claim.paper_id}`} className="text-sm font-semibold text-slate-900 hover:underline">
                              {claim.title}
                            </Link>
                            <p className="mt-1 text-xs text-slate-500">
                              Position: #{claim.position} • Claimed on {new Date(claim.claimed_at).toLocaleDateString()}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_CLASSES[claim.claim_status] || "border-slate-200 bg-slate-100 text-slate-700"}`}>
                              {claim.claim_status}
                            </span>
                            {claim.claim_status === "Pending" ? (
                              <button
                                type="button"
                                onClick={() => retractClaim(claim.paper_id)}
                                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                              >
                                Retract
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
