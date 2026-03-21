import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";

const SORT_OPTIONS = [
  { value: "recent", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "title_asc", label: "Title A-Z" },
  { value: "title_desc", label: "Title Z-A" },
];

function PapersDiscoveryPage() {
  const [domains, setDomains] = useState([]);
  const [fields, setFields] = useState([]);
  const [topics, setTopics] = useState([]);

  const [selectedDomainId, setSelectedDomainId] = useState(null);
  const [selectedFieldId, setSelectedFieldId] = useState(null);
  const [selectedTopicId, setSelectedTopicId] = useState(null);
  const [expandedDomainId, setExpandedDomainId] = useState(null);
  const [showAllTopics, setShowAllTopics] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState("recent");

  const [papers, setPapers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  const [isLoadingDomains, setIsLoadingDomains] = useState(true);
  const [isLoadingPapers, setIsLoadingPapers] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchDomains = async () => {
      try {
        setIsLoadingDomains(true);
        const response = await api.get("/topics/domains");
        setDomains(response.data || []);
      } catch (err) {
        console.error("Failed to load domains:", err);
        setError("Could not load domains.");
      } finally {
        setIsLoadingDomains(false);
      }
    };

    fetchDomains();
  }, []);

  useEffect(() => {
    const fetchFields = async () => {
      if (!selectedDomainId) {
        setFields([]);
        return;
      }

      try {
        const response = await api.get(`/topics/domains/${selectedDomainId}/fields`);
        setFields(response.data || []);
      } catch (err) {
        console.error("Failed to load fields:", err);
        setFields([]);
      }
    };

    fetchFields();
  }, [selectedDomainId]);

  useEffect(() => {
    const fetchTopics = async () => {
      if (!selectedFieldId) {
        setTopics([]);
        return;
      }

      try {
        const response = await api.get(`/topics/fields/${selectedFieldId}/topics`);
        setTopics(response.data || []);
      } catch (err) {
        console.error("Failed to load topics:", err);
        setTopics([]);
      }
    };

    fetchTopics();
  }, [selectedFieldId]);

  useEffect(() => {
    const fetchPapers = async () => {
      try {
        setIsLoadingPapers(true);
        setError("");

        const params = { page, limit };
        let endpoint = "/papers";

        if (searchQuery) {
          endpoint = "/papers/search";
          params.q = searchQuery;
        } else if (selectedTopicId) {
          endpoint = `/papers/topic/${selectedTopicId}`;
        } else if (selectedFieldId) {
          endpoint = `/papers/field/${selectedFieldId}`;
        } else if (selectedDomainId) {
          endpoint = `/papers/domain/${selectedDomainId}`;
        }

        const response = await api.get(endpoint, { params });
        setPapers(response.data?.data || []);
        setTotal(response.data?.pagination?.total || 0);
        setTotalPages(response.data?.pagination?.totalPages || 1);
      } catch (err) {
        console.error("Failed to load papers:", err);
        setPapers([]);
        setError("Could not load papers.");
      } finally {
        setIsLoadingPapers(false);
      }
    };

    fetchPapers();
  }, [selectedDomainId, selectedFieldId, selectedTopicId, searchQuery, page, limit]);

  const selectedDomain = useMemo(
    () => domains.find((domain) => domain.id === selectedDomainId) || null,
    [domains, selectedDomainId],
  );

  const selectedField = useMemo(
    () => fields.find((field) => field.id === selectedFieldId) || null,
    [fields, selectedFieldId],
  );

  const selectedTopic = useMemo(
    () => topics.find((topic) => topic.id === selectedTopicId) || null,
    [topics, selectedTopicId],
  );

  const resetAllFilters = () => {
    setSelectedDomainId(null);
    setSelectedFieldId(null);
    setSelectedTopicId(null);
    setExpandedDomainId(null);
    setSearchInput("");
    setSearchQuery("");
    setSort("recent");
    setPage(1);
  };

  const handleDomainSelect = (domainId) => {
    const isSame = selectedDomainId === domainId;
    const nextDomainId = isSame ? null : domainId;

    setSelectedDomainId(nextDomainId);
    setSelectedFieldId(null);
    setSelectedTopicId(null);
    setExpandedDomainId(nextDomainId);
    setShowAllTopics(false);
    setPage(1);
  };

  const handleDomainExpand = (domainId) => {
    const isExpanded = expandedDomainId === domainId;

    if (isExpanded) {
      setExpandedDomainId(null);
      return;
    }

    setExpandedDomainId(domainId);
      setShowAllTopics(false);

    if (selectedDomainId !== domainId) {
      setSelectedDomainId(domainId);
      setSelectedFieldId(null);
      setSelectedTopicId(null);
      setPage(1);
    }
  };

  const handleFieldSelect = (fieldId) => {
    const isSame = selectedFieldId === fieldId;
    setSelectedFieldId(isSame ? null : fieldId);
    setSelectedTopicId(null);
    setShowAllTopics(false);
    setPage(1);
  };

  const handleTopicSelect = (topicId) => {
    const isSame = selectedTopicId === topicId;
    setSelectedTopicId(isSame ? null : topicId);
    setPage(1);
  };

  const handleSubmitSearch = (event) => {
    event.preventDefault();
    setPage(1);
    setSearchQuery(searchInput.trim());
  };

  const pageButtons = useMemo(() => {
    const pages = [];
    const maxButtons = 5;
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, start + maxButtons - 1);

    for (let i = start; i <= end; i += 1) {
      pages.push(i);
    }

    return pages;
  }, [page, totalPages]);

  const visibleTopics = useMemo(() => {
    if (showAllTopics) return topics;
    return topics.slice(0, 12);
  }, [topics, showAllTopics]);

  const sortedPapers = useMemo(() => {
    const copy = [...papers];

    if (sort === "title_asc") {
      copy.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
      return copy;
    }

    if (sort === "title_desc") {
      copy.sort((a, b) => (b.title || "").localeCompare(a.title || ""));
      return copy;
    }

    if (sort === "oldest") {
      copy.sort((a, b) => new Date(a.publication_date || 0) - new Date(b.publication_date || 0));
      return copy;
    }

    copy.sort((a, b) => new Date(b.publication_date || 0) - new Date(a.publication_date || 0));
    return copy;
  }, [papers, sort]);

  return (
    <main className="min-h-screen bg-slate-50 py-10">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <header className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Explore Papers</h1>
          <p className="mt-1 text-sm text-slate-600">
            Browse by domain, field, and topic. If nothing is selected, latest papers are shown.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Domains</h2>
            <button
              type="button"
              onClick={resetAllFilters}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Clear All
            </button>
          </div>

          {isLoadingDomains ? (
            <p className="mt-4 text-sm text-slate-500">Loading domains...</p>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              {domains.map((domain) => {
                const isSelected = selectedDomainId === domain.id;
                const isExpanded = expandedDomainId === domain.id;

                return (
                  <div key={domain.id} className="inline-flex overflow-hidden rounded-lg border border-slate-200">
                    <button
                      type="button"
                      onClick={() => handleDomainSelect(domain.id)}
                      className={`px-4 py-2 text-sm font-medium ${
                        isSelected
                          ? "bg-slate-800 text-white"
                          : "bg-white text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {domain.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDomainExpand(domain.id)}
                      className={`px-3 text-sm ${
                        isExpanded ? "bg-slate-200 text-slate-900" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                      aria-label={`Toggle fields for ${domain.name}`}
                    >
                      ▾
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {expandedDomainId && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="mb-2 text-sm font-semibold text-slate-700">Fields</p>
              <div className="mb-4 flex flex-wrap gap-2">
                {fields.length ? (
                  fields.map((field) => {
                    const selected = selectedFieldId === field.id;
                    return (
                      <button
                        type="button"
                        key={field.id}
                        onClick={() => handleFieldSelect(field.id)}
                        className={`rounded-full px-3 py-1.5 text-sm ${
                          selected
                            ? "bg-slate-800 text-white"
                            : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        {field.name}
                      </button>
                    );
                  })
                ) : (
                  <span className="text-sm text-slate-500">No fields found for this domain.</span>
                )}
              </div>

              {selectedField && (
                <>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-700">Topics in {selectedField.name}</p>
                    {topics.length > 12 ? (
                      <button
                        type="button"
                        onClick={() => setShowAllTopics((prev) => !prev)}
                        className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        {showAllTopics ? "Collapse topics" : `Show all topics (${topics.length})`}
                      </button>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {topics.length ? (
                      visibleTopics.map((topic) => {
                        const selected = selectedTopicId === topic.id;
                        return (
                          <button
                            type="button"
                            key={topic.id}
                            onClick={() => handleTopicSelect(topic.id)}
                            className={`rounded-full px-3 py-1.5 text-sm ${
                              selected
                                ? "bg-slate-900 text-white"
                                : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                            }`}
                          >
                            {topic.name}
                          </button>
                        );
                      })
                    ) : (
                      <span className="text-sm text-slate-500">No topics found for this field.</span>
                    )}
                  </div>
                  {topics.length > 12 && !showAllTopics ? (
                    <p className="mt-2 text-xs text-slate-500">Showing first 12 topics for readability.</p>
                  ) : null}
                </>
              )}
            </div>
          )}
        </section>

        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <form onSubmit={handleSubmitSearch} className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-center">
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search paper title"
              className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-800 outline-none focus:border-slate-700"
            />
            <select
              value={sort}
              onChange={(event) => {
                setSort(event.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-700"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-lg bg-slate-800 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-900"
            >
              Search
            </button>
          </form>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
            <p>
              {selectedDomain ? `Domain: ${selectedDomain.name}` : "All domains"}
              {selectedField ? ` > ${selectedField.name}` : ""}
              {selectedTopic ? ` > ${selectedTopic.name}` : ""}
            </p>
            <p>Total results: {total}</p>
          </div>
        </section>

        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          {isLoadingPapers ? (
            <p className="text-sm text-slate-500">Loading papers...</p>
          ) : sortedPapers.length ? (
            <div className="space-y-3">
              {sortedPapers.map((paper) => (
                <article key={paper.id} className="rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-400">
                  <Link
                    to={`/papers/${paper.id}`}
                    className="text-base font-semibold text-slate-900 hover:text-slate-700 hover:underline"
                  >
                    {paper.title}
                  </Link>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                    <span>Venue: {paper.venue_name || "N/A"}</span>
                    <span>Date: {paper.publication_date ? String(paper.publication_date).slice(0, 10) : "N/A"}</span>
                    {paper.doi ? <span>DOI: {paper.doi}</span> : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No papers found for your current filters.</p>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page === 1}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 disabled:opacity-40"
            >
              Prev
            </button>

            {pageButtons.map((pageNumber) => (
              <button
                type="button"
                key={pageNumber}
                onClick={() => setPage(pageNumber)}
                className={`rounded-md px-3 py-1.5 text-sm ${
                  pageNumber === page
                    ? "bg-slate-800 text-white"
                    : "border border-slate-300 text-slate-700 hover:bg-slate-100"
                }`}
              >
                {pageNumber}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

export default PapersDiscoveryPage;
