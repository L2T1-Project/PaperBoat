import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import EmptyState from "../components/common/EmptyState";
import AuthorEntriesEditor from "../components/papers/AuthorEntriesEditor";

const MANUAL_INITIAL = {
  title: "",
  publication_date: "",
  pdf_url: "",
  doi: "",
  github_repo: "",
  venue_id: "",
  topic_id: "",
};

const INITIAL_AUTHORS = [{ name: "", position: 1, author_id: null, orc_id: "" }];

function normalizeOrcId(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  return raw.replace(/^https?:\/\/orcid\.org\//i, "").toUpperCase();
}

function SuggestionItem({ suggestion, onReview, reviewing, venueName }) {
  const [note, setNote] = useState("");
  const paper = suggestion.suggested_paper || {};

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-slate-900">{paper.title || "Untitled suggestion"}</p>
          <p className="text-xs text-slate-500">
            from {suggestion.sender_name} ({suggestion.sender_email})
          </p>
        </div>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
          {suggestion.suggestion_status}
        </span>
      </div>

      <div className="mt-3 grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
        <p>Venue: {venueName || `ID ${paper.venue_id || "N/A"}`}</p>
        <p>Date: {paper.publication_date || "N/A"}</p>
        <p>DOI: {paper.doi || "N/A"}</p>
        <p>PDF: {paper.pdf_url || "N/A"}</p>
      </div>

      {Array.isArray(paper.authors) && paper.authors.length ? (
        <div className="mt-2 text-xs text-slate-700">
          <p className="font-semibold">Authors</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {paper.authors.map((author, index) => (
              <li key={`${author.author_id || author.name}-${index}`}>
                #{author.position}: {author.name}
                {author.author_id ? ` (ID ${author.author_id})` : " (new)"}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {paper.notes ? (
        <p className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">Researcher note: {paper.notes}</p>
      ) : null}

      <label className="mt-3 block text-xs font-medium text-slate-700">
        Admin note
        <textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5"
          placeholder="Optional moderation note"
        />
      </label>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => onReview(suggestion.id, "approve", note)}
          disabled={reviewing}
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          Approve + Add Paper
        </button>
        <button
          type="button"
          onClick={() => onReview(suggestion.id, "reject", note)}
          disabled={reviewing}
          className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
        >
          Reject
        </button>
      </div>
    </article>
  );
}

export default function AdminAddPaperPage() {
  const [tab, setTab] = useState("manual");

  const [manualForm, setManualForm] = useState(MANUAL_INITIAL);
  const [manualSaving, setManualSaving] = useState(false);
  const [manualMessage, setManualMessage] = useState("");
  const [manualError, setManualError] = useState("");
  const [manualAuthors, setManualAuthors] = useState(INITIAL_AUTHORS);

  const [queueFilter, setQueueFilter] = useState("pending");
  const [queue, setQueue] = useState([]);
  const [queueLoading, setQueueLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState(null);
  const [venues, setVenues] = useState([]);
  const [venuesLoading, setVenuesLoading] = useState(true);
  const [venueQuery, setVenueQuery] = useState("");
  const [topics, setTopics] = useState([]);
  const [topicsLoading, setTopicsLoading] = useState(true);
  const [topicQuery, setTopicQuery] = useState("");

  const canSaveManual = useMemo(() => {
    const hasRequiredPaperFields = !!manualForm.title.trim() && !!manualForm.publication_date && !!manualForm.venue_id && !!manualForm.topic_id;
    if (!hasRequiredPaperFields || manualAuthors.length === 0) return false;

    const positions = new Set();
    for (const author of manualAuthors) {
      const name = author.name?.trim();
      const position = Number(author.position);
      if (!name || !Number.isInteger(position) || position < 1 || positions.has(position)) {
        return false;
      }
      positions.add(position);
    }

    return true;
  }, [manualForm, manualAuthors]);

  const updateManual = (key, value) => {
    setManualForm((prev) => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    const loadVenues = async () => {
      setVenuesLoading(true);
      try {
        const response = await api.get("/venues");
        setVenues(response.data?.data || []);
      } catch (error) {
        console.error("Failed to load venues for admin add paper:", error);
        setVenues([]);
      } finally {
        setVenuesLoading(false);
      }
    };

    loadVenues();
  }, []);

  useEffect(() => {
    const loadTopics = async () => {
      setTopicsLoading(true);
      try {
        const response = await api.get("/topics");
        setTopics(response.data || []);
      } catch (error) {
        console.error("Failed to load topics for admin add paper:", error);
        setTopics([]);
      } finally {
        setTopicsLoading(false);
      }
    };

    loadTopics();
  }, []);

  const filteredVenues = useMemo(() => {
    const q = venueQuery.trim().toLowerCase();
    if (!q) return venues.slice(0, 400);
    return venues
      .filter((venue) => venue.name?.toLowerCase().includes(q) || venue.issn?.toLowerCase().includes(q))
      .slice(0, 400);
  }, [venues, venueQuery]);

  const filteredTopics = useMemo(() => {
    const q = topicQuery.trim().toLowerCase();
    if (!q) return topics.slice(0, 400);
    return topics
      .filter((topic) => topic.name?.toLowerCase().includes(q) || topic.field_name?.toLowerCase().includes(q) || topic.domain_name?.toLowerCase().includes(q))
      .slice(0, 400);
  }, [topics, topicQuery]);

  const venueNameById = useMemo(() => {
    return venues.reduce((acc, venue) => {
      acc[String(venue.id)] = venue.name;
      return acc;
    }, {});
  }, [venues]);

  const loadQueue = async () => {
    setQueueLoading(true);
    try {
      const res = await api.get("/admin/paper-suggestions", {
        params: { status: queueFilter, limit: 100, page: 1 },
      });
      setQueue(res.data?.data || []);
    } catch (error) {
      console.error("Failed to load suggestion queue:", error);
      setQueue([]);
    } finally {
      setQueueLoading(false);
    }
  };

  useEffect(() => {
    if (tab !== "queue") return;
    loadQueue();
  }, [tab, queueFilter]);

  const submitManual = async (event) => {
    event.preventDefault();
    if (!canSaveManual) return;

    setManualSaving(true);
    setManualError("");
    setManualMessage("");

    try {
      const paperRes = await api.post("/papers", {
        title: manualForm.title.trim(),
        publication_date: manualForm.publication_date,
        pdf_url: manualForm.pdf_url.trim() || undefined,
        doi: manualForm.doi.trim() || undefined,
        github_repo: manualForm.github_repo.trim() || undefined,
        venue_id: Number(manualForm.venue_id),
      });

      const createdPaperId = paperRes?.data?.data?.id;
      if (!createdPaperId) {
        throw new Error("Paper created but ID missing in response.");
      }

      await api.post(`/papers/${createdPaperId}/topics`, {
        topic_id: Number(manualForm.topic_id),
      });

      for (const authorEntry of manualAuthors) {
        let authorId = authorEntry.author_id ? Number(authorEntry.author_id) : null;
        const normalizedOrcId = normalizeOrcId(authorEntry.orc_id);

        if (!authorId && normalizedOrcId) {
          try {
            const existingAuthor = await api.get("/authors", {
              params: { orc_id: normalizedOrcId, include_claimed: true },
            });
            authorId = existingAuthor?.data?.id || null;
          } catch (lookupError) {
            if (lookupError?.response?.status !== 404) {
              throw lookupError;
            }
          }
        }

        if (!authorId) {
          const authorRes = await api.post("/authors", {
            name: authorEntry.name.trim(),
            orc_id: normalizedOrcId || undefined,
          });
          authorId = authorRes?.data?.data?.id;
        }

        if (!authorId) {
          throw new Error(`Failed to resolve author ID for ${authorEntry.name}.`);
        }

        await api.post(`/authors/${authorId}/papers`, {
          paper_id: Number(createdPaperId),
          position: Number(authorEntry.position),
        });
      }

      setManualForm(MANUAL_INITIAL);
      setManualAuthors(INITIAL_AUTHORS);
      setManualMessage("Paper added successfully.");
    } catch (error) {
      setManualError(error?.response?.data?.message || error?.response?.data?.error || "Failed to add paper.");
    } finally {
      setManualSaving(false);
    }
  };

  const reviewSuggestion = async (suggestionId, action, adminNote) => {
    setReviewingId(suggestionId);
    try {
      await api.patch(`/admin/paper-suggestions/${suggestionId}/review`, {
        action,
        admin_note: adminNote,
      });
      await loadQueue();
    } catch (error) {
      alert(error?.response?.data?.message || "Failed to process suggestion.");
    } finally {
      setReviewingId(null);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl space-y-5">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Admin Add Paper</h1>
          <p className="mt-1 text-sm text-slate-600">
            Use one page for direct paper entry and researcher suggestion moderation.
          </p>

          <div className="mt-4 inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setTab("manual")}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold ${tab === "manual" ? "bg-white text-slate-900" : "text-slate-600"}`}
            >
              Manual Add
            </button>
            <button
              type="button"
              onClick={() => setTab("queue")}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold ${tab === "queue" ? "bg-white text-slate-900" : "text-slate-600"}`}
            >
              Suggestion Queue
            </button>
          </div>
        </section>

        {tab === "manual" ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <form className="grid gap-4 md:grid-cols-2" onSubmit={submitManual}>
              <label className="text-sm text-slate-700 md:col-span-2">
                <span className="mb-1 block font-medium">Title *</span>
                <input
                  type="text"
                  value={manualForm.title}
                  onChange={(e) => updateManual("title", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  required
                />
              </label>

              <label className="text-sm text-slate-700">
                <span className="mb-1 block font-medium">Publication Date *</span>
                <input
                  type="date"
                  value={manualForm.publication_date}
                  onChange={(e) => updateManual("publication_date", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  required
                />
              </label>

              <label className="text-sm text-slate-700">
                <span className="mb-1 block font-medium">Find Venue</span>
                <input
                  type="text"
                  value={venueQuery}
                  onChange={(e) => setVenueQuery(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="Type venue name or ISSN"
                />
              </label>

              <label className="text-sm text-slate-700">
                <span className="mb-1 block font-medium">Venue *</span>
                <select
                  value={manualForm.venue_id}
                  onChange={(e) => updateManual("venue_id", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  required
                  disabled={venuesLoading || filteredVenues.length === 0}
                >
                  <option value="">{venuesLoading ? "Loading venues..." : "Select a venue"}</option>
                  {filteredVenues.map((venue) => (
                    <option key={venue.id} value={venue.id}>
                      {venue.name} {venue.issn ? `(${venue.issn})` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm text-slate-700">
                <span className="mb-1 block font-medium">DOI</span>
                <input
                  type="text"
                  value={manualForm.doi}
                  onChange={(e) => updateManual("doi", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>

              <label className="text-sm text-slate-700">
                <span className="mb-1 block font-medium">PDF URL</span>
                <input
                  type="url"
                  value={manualForm.pdf_url}
                  onChange={(e) => updateManual("pdf_url", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>

              <label className="text-sm text-slate-700 md:col-span-2">
                <span className="mb-1 block font-medium">GitHub Repo</span>
                <input
                  type="url"
                  value={manualForm.github_repo}
                  onChange={(e) => updateManual("github_repo", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>

              <label className="text-sm text-slate-700">
                <span className="mb-1 block font-medium">Find Topic</span>
                <input
                  type="text"
                  value={topicQuery}
                  onChange={(e) => setTopicQuery(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="Type topic, field, or domain"
                />
              </label>

              <label className="text-sm text-slate-700">
                <span className="mb-1 block font-medium">Topic *</span>
                <select
                  value={manualForm.topic_id}
                  onChange={(e) => updateManual("topic_id", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  required
                  disabled={topicsLoading || filteredTopics.length === 0}
                >
                  <option value="">{topicsLoading ? "Loading topics..." : "Select a topic"}</option>
                  {filteredTopics.map((topic) => (
                    <option key={topic.id} value={topic.id}>
                      {topic.name} ({topic.field_name} / {topic.domain_name})
                    </option>
                  ))}
                </select>
              </label>

              <AuthorEntriesEditor authors={manualAuthors} setAuthors={setManualAuthors} disabled={manualSaving} title="Authors *" />

              {manualError ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 md:col-span-2">{manualError}</p> : null}
              {manualMessage ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 md:col-span-2">{manualMessage}</p> : null}

              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={!canSaveManual || manualSaving}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
                >
                  {manualSaving ? "Saving..." : "Add Paper"}
                </button>
              </div>
            </form>
          </section>
        ) : null}

        {tab === "queue" ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">Researcher Suggestions</h2>
              <div className="flex gap-2">
                {["pending", "approved", "rejected", "all"].map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setQueueFilter(option)}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold ${queueFilter === option ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"}`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            {queueLoading ? <p className="mt-4 text-sm text-slate-500">Loading queue...</p> : null}
            {!queueLoading && queue.length === 0 ? (
              <EmptyState
                icon="📭"
                title="No suggestions in this filter"
                body="Switch status filter or check back after researchers submit suggestions."
                className="py-8"
              />
            ) : null}

            {!!queue.length ? (
              <div className="mt-4 space-y-3">
                {queue.map((suggestion) => (
                  <SuggestionItem
                    key={suggestion.id}
                    suggestion={suggestion}
                    reviewing={reviewingId === suggestion.id}
                    venueName={venueNameById[String(suggestion?.suggested_paper?.venue_id)] || null}
                    onReview={reviewSuggestion}
                  />
                ))}
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </main>
  );
}
