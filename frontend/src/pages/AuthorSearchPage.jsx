import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../api/axios";

function AuthorCard({ author }) {
  return (
    <Link
      to={`/authors/${author.id}`}
      className="group flex items-start gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 transition-shadow hover:shadow-md"
    >
      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
        {author.name
          .split(" ")
          .map((w) => w[0])
          .slice(0, 2)
          .join("")
          .toUpperCase()}
      </div>

      <div className="min-w-0 flex-1">
        <p className="font-semibold text-slate-800 group-hover:text-primary">
          {author.name}
        </p>
        {author.orc_id && (
          <p className="mt-0.5 text-xs text-green-700">
            ORCID: {author.orc_id}
          </p>
        )}
        {author.latest_paper && (
          <p className="mt-1 truncate text-xs text-slate-500">
            Latest: {author.latest_paper.title}
          </p>
        )}
      </div>

      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mt-1 flex-shrink-0 text-slate-300 group-hover:text-primary"
        aria-hidden="true"
      >
        <path d="M9 18l6-6-6-6" />
      </svg>
    </Link>
  );
}

export default function AuthorSearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  const [inputValue, setInputValue] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(Boolean(initialQuery));
  const [error, setError] = useState("");

  const inputRef = useRef(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const controller = new AbortController();

    const run = async () => {
      try {
        setIsLoading(true);
        setError("");
        setHasSearched(true);

        const res = await api.get("/authors/lookup/name", {
          params: { name: query.trim() },
          signal: controller.signal,
        });

        setResults(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        if (err.name === "CanceledError" || err.name === "AbortError") return;
        if (err.response?.status === 404) {
          setResults([]);
        } else {
          setError("Search failed. Please try again.");
        }
      } finally {
        setIsLoading(false);
      }
    };

    run();
    return () => controller.abort();
  }, [query]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    setSearchParams({ q: trimmed });
    setQuery(trimmed);
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="mb-2 text-2xl font-bold text-slate-900">Authors</h1>
      <p className="mb-6 text-sm text-slate-500">
        Search for researchers and authors by name.
      </p>

      <form onSubmit={handleSubmit} className="mb-8 flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="e.g. Yann LeCun"
          className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          autoFocus
        />
        <button
          type="submit"
          disabled={isLoading || !inputValue.trim()}
          className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
        >
          {isLoading ? "…" : "Search"}
        </button>
      </form>

      {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="h-7 w-7 animate-spin rounded-full border-4 border-slate-200 border-t-primary" />
        </div>
      )}

      {!isLoading && hasSearched && results.length === 0 && !error && (
        <div className="py-12 text-center text-sm text-slate-400">
          No authors found for &ldquo;{query}&rdquo;.
        </div>
      )}

      {!isLoading && results.length > 0 && (
        <>
          <p className="mb-3 text-xs text-slate-400">
            {results.length} result{results.length !== 1 ? "s" : ""} for &ldquo;
            {query}&rdquo;
          </p>
          <div className="flex flex-col gap-3">
            {results.map((author) => (
              <AuthorCard key={author.id} author={author} />
            ))}
          </div>
        </>
      )}

      {!hasSearched && (
        <div className="rounded-xl border border-dashed border-slate-200 py-16 text-center">
          <p className="text-sm text-slate-400">
            Enter a name above to find authors.
          </p>
        </div>
      )}
    </main>
  );
}
