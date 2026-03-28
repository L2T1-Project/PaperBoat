import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import SaveButton from '../components/SaveButton';

function PaperDetailsPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const currentUserId = user?.userId;
  const currentRole = user?.role;
  const [paper, setPaper] = useState(null);
  const [topics, setTopics] = useState([]);
  const [citedByPapers, setCitedByPapers] = useState([]);
  const [researcherAuthorId, setResearcherAuthorId] = useState(null);
  const [existingClaim, setExistingClaim] = useState(null);
  const [authorPosition, setAuthorPosition] = useState("");
  const [showClaimForm, setShowClaimForm] = useState(false);
  const [isSubmittingClaim, setIsSubmittingClaim] = useState(false);
  const [claimMessage, setClaimMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setIsLoading(true);
        setError("");

        const requests = [
          api.get(`/papers/${id}`),
          api.get(`/papers/${id}/topics`),
          api.get(`/papers/${id}/cited-by`),
        ];

        if (currentRole === "researcher" && currentUserId) {
          requests.push(api.get(`/researchers/${currentUserId}`));
          requests.push(api.get(`/researchers/${currentUserId}/claims`));
        }

        const [paperRes, topicsRes, citedByRes, researcherRes, claimsRes] = await Promise.all(requests);

        setPaper(paperRes.data?.data || null);
        setTopics(topicsRes.data?.data || []);
        setCitedByPapers(citedByRes.data?.data || []);

        if (researcherRes?.data?.data?.author_id) {
          setResearcherAuthorId(Number(researcherRes.data.data.author_id));
        } else {
          setResearcherAuthorId(null);
        }

        if (claimsRes?.data?.data) {
          const claim = claimsRes.data.data.find((item) => Number(item.paper_id) === Number(id)) || null;
          setExistingClaim(claim);
        } else {
          setExistingClaim(null);
        }
      } catch (err) {
        console.error("Failed loading paper details:", err);
        setError("Could not load paper details.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchAll();
  }, [id, currentRole, currentUserId]);

  const isResearchersPaper = useMemo(() => {
    if (currentRole !== "researcher" || !researcherAuthorId || !Array.isArray(paper?.authors)) {
      return false;
    }

    return paper.authors.some((author) => Number(author.id) === Number(researcherAuthorId));
  }, [currentRole, researcherAuthorId, paper]);

  const submitClaim = async (event) => {
    event.preventDefault();
    setClaimMessage("");

    const parsedPosition = Number(authorPosition);
    if (!Number.isInteger(parsedPosition) || parsedPosition < 1) {
      setClaimMessage("Author position must be a positive integer.");
      return;
    }

    if (!currentUserId || currentRole !== "researcher") {
      setClaimMessage("Only researchers can create paper claims.");
      return;
    }

    try {
      setIsSubmittingClaim(true);
      await api.post(`/researchers/${currentUserId}/claims`, {
        paper_id: Number(id),
        position: parsedPosition,
      });

      setExistingClaim({
        paper_id: Number(id),
        position: parsedPosition,
        claim_status: "Pending",
      });
      setShowClaimForm(false);
      setClaimMessage("Claim submitted successfully. Admins have been notified.");
    } catch (err) {
      setClaimMessage(err?.response?.data?.message || "Could not submit claim.");
    } finally {
      setIsSubmittingClaim(false);
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-slate-50 py-10">
        <div className="mx-auto max-w-5xl px-4 text-sm text-slate-600">Loading paper details...</div>
      </main>
    );
  }

  if (!paper) {
    return (
      <main className="min-h-screen bg-slate-50 py-10">
        <div className="mx-auto max-w-5xl px-4 text-sm text-red-600">Paper not found.</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 py-10">
      <div className="mx-auto w-full max-w-5xl space-y-5 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <Link to="/papers" className="text-sm font-medium text-slate-700 hover:underline">
            Back to papers
          </Link>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">{paper.title}</h1>
              <SaveButton paperId={paper.id} />
            </div>

            {currentRole === "researcher" ? (
              <div className="flex items-center gap-2">
                {isResearchersPaper ? (
                  <span className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    Your paper
                  </span>
                ) : existingClaim ? (
                  <span className="rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    Claim status: {existingClaim.claim_status}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowClaimForm((prev) => !prev)}
                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    {showClaimForm ? "Cancel" : "Claim Paper"}
                  </button>
                )}
              </div>
            ) : null}
          </div>

          {currentRole === "researcher" && !isResearchersPaper && !existingClaim && showClaimForm ? (
            <form onSubmit={submitClaim} className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Author Position</label>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  min="1"
                  value={authorPosition}
                  onChange={(event) => setAuthorPosition(event.target.value)}
                  placeholder="Enter your author position"
                  className="w-52 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-700"
                />
                <button
                  type="submit"
                  disabled={isSubmittingClaim}
                  className="rounded-md bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-900 disabled:opacity-50"
                >
                  {isSubmittingClaim ? "Submitting..." : "Submit Claim"}
                </button>
              </div>
              {claimMessage ? <p className="mt-2 text-xs text-slate-600">{claimMessage}</p> : null}
            </form>
          ) : null}

          {claimMessage && (!showClaimForm || existingClaim) ? (
            <p className="mt-3 text-xs text-slate-600">{claimMessage}</p>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            {paper.doi ? (
              <a
                href={`https://doi.org/${paper.doi}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-slate-800"
              >
                DOI: {paper.doi}
              </a>
            ) : null}
            {paper.pdf_url ? (
              <a
                href={paper.pdf_url}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-slate-300 bg-white px-3 py-1 text-slate-700"
              >
                Open PDF
              </a>
            ) : null}
            {paper.github_repo ? (
              <a
                href={paper.github_repo}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-slate-300 bg-white px-3 py-1 text-slate-700"
              >
                GitHub Repo
              </a>
            ) : null}
            {paper.is_retracted ? (
              <span className="rounded-full border border-red-300 bg-red-50 px-3 py-1 text-red-700">Retracted</span>
            ) : null}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Venue</h2>
            {paper.venue_id ? (
              <Link
                to={`/venues/${paper.venue_id}`}
                className="mt-2 inline-block text-lg font-semibold text-slate-900 hover:underline"
              >
                {paper.venue_name || "N/A"}
              </Link>
            ) : (
              <p className="mt-2 text-lg font-semibold text-slate-900">{paper.venue_name || "N/A"}</p>
            )}
            <p className="mt-1 text-sm text-slate-600">Type: {paper.venue_type || "N/A"}</p>
            <p className="mt-1 text-sm text-slate-600">ISSN: {paper.issn || "N/A"}</p>
            <p className="mt-1 text-sm text-slate-600">
              Published: {paper.publication_date ? String(paper.publication_date).slice(0, 10) : "N/A"}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Publisher</h2>
            <p className="mt-2 text-lg font-semibold text-slate-900">{paper.publisher_name || "N/A"}</p>
            <p className="mt-1 text-sm text-slate-600">Country: {paper.publisher_country || "N/A"}</p>
            {paper.publisher_website ? (
              <a
                href={paper.publisher_website}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-sm font-medium text-slate-700 hover:underline"
              >
                Visit publisher website
              </a>
            ) : null}
          </article>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Authors</h2>
          {Array.isArray(paper.authors) && paper.authors.length ? (
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              {paper.authors.map((author) => (
                <li key={author.id}>
                  #{author.position || "-"} {author.name}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate-500">No author data available.</p>
          )}

          <h3 className="mt-5 text-sm font-semibold uppercase tracking-wide text-slate-500">Topics</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {topics.length ? (
              topics.map((topic) => (
                <span
                  key={topic.id}
                  className="rounded-full border border-slate-300 bg-slate-100 px-3 py-1 text-xs text-slate-700"
                >
                  {topic.domain_name} / {topic.field_name} / {topic.topic_name}
                </span>
              ))
            ) : (
              <p className="text-sm text-slate-500">No topic tags linked.</p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Citation Snapshot</h2>
          <p className="mt-2 text-lg font-semibold text-slate-900">Cited by {citedByPapers.length} paper(s)</p>
          <p className="mt-3 text-sm font-medium text-slate-700">Top citing papers</p>
          {citedByPapers.length ? (
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              {citedByPapers.slice(0, 3).map((citingPaper) => (
                <li key={citingPaper.id}>- {citingPaper.title}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate-500">No citations found yet.</p>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Reviews</h2>
            <Link
              to={`/papers/${paper.id}/reviews`}
              className="text-sm font-medium text-slate-700 hover:underline"
            >
              View all reviews →
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

export default PaperDetailsPage;
