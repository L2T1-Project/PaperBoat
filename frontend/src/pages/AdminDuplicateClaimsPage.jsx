import { useEffect, useState } from "react";
import api from "../api/axios";
import EmptyState from "../components/common/EmptyState";

function linkify(text) {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) =>
    urlRegex.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noreferrer"
        className="break-all text-blue-600 underline hover:text-blue-800"
      >
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export default function AdminDuplicateClaimsPage() {
  const [claims, setClaims] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isProcessing, setIsProcessing] = useState({});

  const fetchClaims = async () => {
    try {
      setIsLoading(true);
      setError("");
      const response = await api.get("/claims/admin");
      setClaims(response.data?.data || []);
    } catch (err) {
      console.error("Failed to load duplicate claims:", err);
      setError(err?.response?.data?.error || "Could not load duplicate author claims.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClaims();
  }, []);

  const processClaim = async (claimId, action) => {
    const key = `${claimId}-${action}`;
    try {
      setIsProcessing((prev) => ({ ...prev, [key]: true }));
      await api.post(`/claims/admin/${claimId}/${action}`);
      await fetchClaims();
    } catch (err) {
      setError(err?.response?.data?.error || `Failed to ${action} claim.`);
    } finally {
      setIsProcessing((prev) => ({ ...prev, [key]: false }));
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 py-10">
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 sm:px-6 lg:px-8">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Admin Console
          </p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            Duplicate Author Claims
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Review author ownership disputes submitted during signup.
            Approve to transfer the researcher link to the claimant, or reject to keep the current owner.
          </p>
        </section>

        {error ? (
          <section className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </section>
        ) : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {isLoading ? (
            <p className="text-sm text-slate-600">Loading pending claims...</p>
          ) : claims.length === 0 ? (
            <EmptyState
              icon="📭"
              title="No pending duplicate claims"
              body="No ownership disputes are waiting for review. New submissions will appear here automatically."
              className="py-8"
            />
          ) : (
            <div className="space-y-4">
              {claims.map((claim) => {
                const swapKey = `${claim.id}-approve`;
                const keepKey = `${claim.id}-reject`;

                return (
                  <article
                    key={claim.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-4"
                  >
                    {/* Header row */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-slate-500">
                        Claim #{claim.id} &middot;{" "}
                        {new Date(claim.created_at).toLocaleString()}
                      </span>
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                        Pending
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      {/* Claimant */}
                      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                          Claimant (new user)
                        </p>
                        <p className="font-semibold text-slate-900">
                          {claim.claimant_name}
                        </p>
                        <p className="text-slate-600">{claim.claimant_email}</p>
                        <p className="text-slate-500 text-xs">
                          User ID: {claim.claimant_user_id}
                        </p>
                      </div>

                      {/* Author profile */}
                      <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Claimed Author Profile
                        </p>
                        <p className="font-semibold text-slate-900">
                          {claim.author_name}
                        </p>
                        {claim.author_orc_id ? (
                          <p className="text-slate-500 text-xs">
                            ORCID: {claim.author_orc_id}
                          </p>
                        ) : null}
                        <p className="text-slate-500 text-xs">
                          Author ID: {claim.claimed_author_id}
                        </p>
                      </div>

                      {/* Current researcher */}
                      <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-rose-600">
                          Current Researcher
                        </p>
                        {claim.current_researcher_name ? (
                          <>
                            <p className="font-semibold text-slate-900">
                              {claim.current_researcher_name}
                            </p>
                            <p className="text-slate-600">
                              {claim.current_researcher_email}
                            </p>
                            <p className="text-slate-500 text-xs">
                              User ID: {claim.current_researcher_user_id}
                            </p>
                          </>
                        ) : (
                          <p className="text-slate-500 italic">
                            No current researcher linked
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Claim text */}
                    <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                        Claim Message
                      </p>
                      <p className="whitespace-pre-wrap text-slate-800 leading-relaxed">
                        {linkify(claim.claim_text)}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      <button
                        type="button"
                        disabled={!!isProcessing[swapKey] || !!isProcessing[keepKey]}
                        onClick={() => processClaim(claim.id, "approve")}
                        className="rounded-md border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isProcessing[swapKey] ? "Processing..." : "Approve and Transfer"}
                      </button>
                      <button
                        type="button"
                        disabled={!!isProcessing[swapKey] || !!isProcessing[keepKey]}
                        onClick={() => processClaim(claim.id, "reject")}
                        className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isProcessing[keepKey] ? "Processing..." : "Reject and Keep Current Owner"}
                      </button>
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
