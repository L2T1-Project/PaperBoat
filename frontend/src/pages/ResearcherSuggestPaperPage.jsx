import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import EmptyState from "../components/common/EmptyState";
import AuthorEntriesEditor from "../components/papers/AuthorEntriesEditor";

const createInitialForm = () => ({
  title: "",
  publication_date: "",
  doi: "",
  pdf_url: "",
  github_repo: "",
  venue_id: "",
  topic_id: "",
  notes: "",
});

const createInitialAuthors = () => [{ name: "", position: 1, author_id: null, orc_id: "" }];

function normalizeOrcId(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  return raw.replace(/^https?:\/\/orcid\.org\//i, "").toUpperCase();
}

function buildAuthorPayload(authorEntries) {
  const cleaned = (authorEntries || [])
    .map((entry) => ({
      name: entry?.name?.trim() || "",
      author_id: entry?.author_id ? Number(entry.author_id) : null,
      position: Number(entry?.position),
      orc_id: normalizeOrcId(entry?.orc_id),
    }))
    .filter((entry) => entry.name || entry.author_id);

  const usedPositions = new Set();
  return cleaned.map((entry, index) => {
    let resolvedPosition = Number.isInteger(entry.position) && entry.position > 0 ? entry.position : index + 1;
    while (usedPositions.has(resolvedPosition)) {
      resolvedPosition += 1;
    }
    usedPositions.add(resolvedPosition);

    const payloadEntry = {
      position: resolvedPosition,
      name: entry.name,
    };

    if (entry.author_id) {
      payloadEntry.author_id = entry.author_id;
    }

    if (!entry.author_id && entry.orc_id) {
      payloadEntry.orc_id = entry.orc_id;
    }

    return payloadEntry;
  });
}

function SuggestionStatusBadge({ status }) {
  if (status === "approved") {
    return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">Approved</span>;
  }

  if (status === "rejected") {
    return <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">Rejected</span>;
  }

  return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">Pending</span>;
}

export default function ResearcherSuggestPaperPage() {
  const { user } = useAuth();
  const userId = user?.userId;

  const [form, setForm] = useState(createInitialForm);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [duplicateHints, setDuplicateHints] = useState([]);

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [venues, setVenues] = useState([]);
  const [venueQuery, setVenueQuery] = useState("");
  const [venuesLoading, setVenuesLoading] = useState(true);
  const [topics, setTopics] = useState([]);
  const [topicQuery, setTopicQuery] = useState("");
  const [topicsLoading, setTopicsLoading] = useState(true);
  const [authors, setAuthors] = useState(createInitialAuthors);

  const canSubmit = useMemo(() => {
    const hasRequiredPaperFields = !!form.title.trim() && !!form.publication_date && !!form.venue_id && !!form.topic_id;
    if (!hasRequiredPaperFields) return false;
    return buildAuthorPayload(authors).length > 0;
  }, [form, authors]);

  const loadHistory = async () => {
    if (!userId) return;
    setHistoryLoading(true);
    try {
      const res = await api.get(`/researchers/${userId}/paper-suggestions`);
      setHistory(res.data?.data || []);
    } catch (error) {
      console.error("Failed to load paper suggestions:", error);
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [userId]);

  useEffect(() => {
    const loadVenues = async () => {
      setVenuesLoading(true);
      try {
        const response = await api.get("/venues");
        const venueRows = response.data?.data || [];
        setVenues(venueRows);
      } catch (error) {
        console.error("Failed to load venues:", error);
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
        const topicRows = response.data || [];
        setTopics(topicRows);
      } catch (error) {
        console.error("Failed to load topics:", error);
        setTopics([]);
      } finally {
        setTopicsLoading(false);
      }
    };

    loadTopics();
  }, []);

  const filteredVenues = useMemo(() => {
    const q = venueQuery.trim().toLowerCase();
    if (!q) return venues.slice(0, 300);
    return venues
      .filter((venue) => venue.name?.toLowerCase().includes(q) || venue.issn?.toLowerCase().includes(q))
      .slice(0, 300);
  }, [venues, venueQuery]);

  const filteredTopics = useMemo(() => {
    const q = topicQuery.trim().toLowerCase();
    if (!q) return topics.slice(0, 300);
    return topics
      .filter((topic) => topic.name?.toLowerCase().includes(q) || topic.field_name?.toLowerCase().includes(q) || topic.domain_name?.toLowerCase().includes(q))
      .slice(0, 300);
  }, [topics, topicQuery]);

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit || !userId) return;

    setSaving(true);
    setSubmitError("");
    setSuccessMessage("");
    setDuplicateHints([]);

    try {
      const authorPayload = buildAuthorPayload(authors);
      if (!authorPayload.length) {
        setSubmitError("Please add at least one valid author.");
        setSaving(false);
        return;
      }

      await api.post(`/researchers/${userId}/paper-suggestions`, {
        title: form.title.trim(),
        publication_date: form.publication_date,
        doi: form.doi.trim() || undefined,
        pdf_url: form.pdf_url.trim() || undefined,
        github_repo: form.github_repo.trim() || undefined,
        venue_id: Number(form.venue_id),
        topic_id: Number(form.topic_id),
        authors: authorPayload,
        notes: form.notes.trim() || undefined,
      });

      setForm(createInitialForm());
      setAuthors(createInitialAuthors());
      setSuccessMessage("Suggestion submitted. Admin will review it in the Add Paper queue.");
      await loadHistory();
    } catch (error) {
      const apiMessage = error?.response?.data?.message;
      setSubmitError(apiMessage || "Failed to submit suggestion.");
      setDuplicateHints(error?.response?.data?.data?.duplicates || []);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Suggest a Paper</h1>
          <p className="mt-1 text-sm text-slate-600">
            Submit papers that are missing from the catalog. Admins can approve and add them directly.
          </p>

          <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
            <label className="text-sm text-slate-700 md:col-span-2">
              <span className="mb-1 block font-medium">Title *</span>
              <input
                type="text"
                value={form.title}
                onChange={(e) => updateField("title", e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                required
              />
            </label>

            <label className="text-sm text-slate-700">
              <span className="mb-1 block font-medium">Publication Date *</span>
              <input
                type="date"
                value={form.publication_date}
                onChange={(e) => updateField("publication_date", e.target.value)}
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
                value={form.venue_id}
                onChange={(e) => updateField("venue_id", e.target.value)}
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
                value={form.doi}
                onChange={(e) => updateField("doi", e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>

            <label className="text-sm text-slate-700">
              <span className="mb-1 block font-medium">PDF URL</span>
              <input
                type="url"
                value={form.pdf_url}
                onChange={(e) => updateField("pdf_url", e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>

            <label className="text-sm text-slate-700 md:col-span-2">
              <span className="mb-1 block font-medium">GitHub Repo</span>
              <input
                type="url"
                value={form.github_repo}
                onChange={(e) => updateField("github_repo", e.target.value)}
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
                value={form.topic_id}
                onChange={(e) => updateField("topic_id", e.target.value)}
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

            <label className="text-sm text-slate-700 md:col-span-2">
              <span className="mb-1 block font-medium">Notes for Admin</span>
              <textarea
                rows={4}
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="Optional context: source, reason, or metadata confidence."
              />
            </label>

            <AuthorEntriesEditor authors={authors} setAuthors={setAuthors} disabled={saving} title="Authors *" />

            {submitError ? (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 md:col-span-2">
                {submitError}
              </p>
            ) : null}

            {successMessage ? (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 md:col-span-2">
                {successMessage}
              </p>
            ) : null}

            {!!duplicateHints.length ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 md:col-span-2">
                <p className="font-semibold">Possible duplicates:</p>
                <ul className="mt-2 space-y-1">
                  {duplicateHints.map((item, idx) => (
                    <li key={`${item.id || idx}`}>
                      {item.title || "Pending suggestion"}
                      {item.venue_name ? ` (${item.venue_name})` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={!canSubmit || saving}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Submitting..." : "Submit Suggestion"}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">My Suggestion History</h2>
          {historyLoading ? <p className="mt-3 text-sm text-slate-500">Loading suggestions...</p> : null}

          {!historyLoading && history.length === 0 ? (
            <EmptyState
              icon="📝"
              title="No suggestions yet"
              body="Your submitted paper suggestions will appear here with moderation status."
              className="py-8"
            />
          ) : null}

          {!!history.length ? (
            <div className="mt-4 space-y-3">
              {history.map((entry) => (
                <article key={entry.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-slate-900">{entry.suggested_paper?.title || "Untitled suggestion"}</p>
                    <SuggestionStatusBadge status={entry.suggestion_status} />
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    Submitted: {new Date(entry.created_at).toLocaleString()}
                  </p>
                  {entry.suggested_paper?.doi ? (
                    <p className="mt-1 text-xs text-slate-600">DOI: {entry.suggested_paper.doi}</p>
                  ) : null}
                  {entry.moderation_note ? (
                    <p className="mt-2 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700">
                      Admin note: {entry.moderation_note}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
