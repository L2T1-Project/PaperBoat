import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import EmptyState from "../components/common/EmptyState";

const TAB_STATUS = [
  { key: "Pending", statusId: 5 },
  { key: "Approved", statusId: 3 },
  { key: "Declined", statusId: 4 },
];

const BADGE_CLASSES = {
  Pending: "border-amber-200 bg-amber-50 text-amber-700",
  Approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Declined: "border-rose-200 bg-rose-50 text-rose-700",
};

export default function AdminClaimsPage() {
  const [activeTab, setActiveTab] = useState("Pending");
  const [claims, setClaims] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isUpdating, setIsUpdating] = useState({});

  const fetchClaims = async (status) => {
    try {
      setIsLoading(true);
      setError("");

      const response = await api.get(`/admin/claims/${status}`);
      setClaims(response.data?.data || []);
    } catch (err) {
      console.error("Failed to load admin claims:", err);
      setError(err?.response?.data?.error || "Could not load claims moderation queue.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClaims(activeTab);
  }, [activeTab]);

  const processClaim = async (claim, nextStatusId) => {
    const key = `${claim.researcher_id}-${claim.paper_id}-${nextStatusId}`;
    try {
      setIsUpdating((prev) => ({ ...prev, [key]: true }));
      await api.patch(`/admin/claims/${claim.researcher_id}/${claim.paper_id}`, {
        status_id: nextStatusId,
      });
      fetchClaims(activeTab);
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to process claim.");
    } finally {
      setIsUpdating((prev) => ({ ...prev, [key]: false }));
    }
  };

  const counts = useMemo(() => {
    const map = { Pending: 0, Approved: 0, Declined: 0 };
    claims.forEach((claim) => {
      if (map[claim.claim_status] !== undefined) {
        map[claim.claim_status] += 1;
      }
    });
    return map;
  }, [claims]);

  return (
    <main className="min-h-screen bg-slate-50 py-10">
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 sm:px-6 lg:px-8">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Admin Console</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Paper Claim Moderation</h1>
          <p className="mt-2 text-sm text-slate-600">Review incoming claims and decide whether they should be approved or declined.</p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            {TAB_STATUS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                  activeTab === tab.key
                    ? "bg-slate-900 text-white"
                    : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                }`}
              >
                {tab.key}
                {activeTab === tab.key && counts[tab.key] ? ` (${counts[tab.key]})` : ""}
              </button>
            ))}
          </div>
        </section>

        {error ? (
          <section className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </section>
        ) : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {isLoading ? (
            <p className="text-sm text-slate-600">Loading {activeTab.toLowerCase()} claims...</p>
          ) : !claims.length ? (
            <EmptyState
              icon={activeTab === "Pending" ? "📭" : activeTab === "Approved" ? "✅" : "🗂️"}
              title={`No ${activeTab.toLowerCase()} claims right now`}
              body={activeTab === "Pending"
                ? "The queue is currently clear. New submissions will appear here."
                : "Use the Pending tab to process new moderation actions."}
              ctaLabel="Open pending queue"
              ctaAction={() => setActiveTab("Pending")}
              className="py-8"
            />
          ) : (
            <div className="space-y-3">
              {claims.map((claim) => {
                const approveKey = `${claim.researcher_id}-${claim.paper_id}-3`;
                const declineKey = `${claim.researcher_id}-${claim.paper_id}-4`;

                return (
                  <article key={`${claim.researcher_id}-${claim.paper_id}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <Link to={`/papers/${claim.paper_id}`} className="text-sm font-semibold text-slate-900 hover:underline">
                          {claim.paper_title}
                        </Link>
                        <p className="mt-1 text-xs text-slate-600">
                          Claimed by {claim.full_name || claim.username} • position #{claim.position}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Submitted on {new Date(claim.claimed_at).toLocaleString()}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${BADGE_CLASSES[claim.claim_status] || "border-slate-200 bg-slate-100 text-slate-700"}`}>
                          {claim.claim_status}
                        </span>

                        {activeTab === "Pending" ? (
                          <>
                            <button
                              type="button"
                              disabled={!!isUpdating[approveKey]}
                              onClick={() => processClaim(claim, 3)}
                              className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled={!!isUpdating[declineKey]}
                              onClick={() => processClaim(claim, 4)}
                              className="rounded-md border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                            >
                              Decline
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
