import { useState } from "react";
import api from "../../api/axios";

function createEmptyAuthor(nextPosition = 1) {
  return {
    name: "",
    position: nextPosition,
    author_id: null,
    orc_id: "",
  };
}

export default function AuthorEntriesEditor({
  authors,
  setAuthors,
  disabled = false,
  title = "Authors",
}) {
  const [matchOptions, setMatchOptions] = useState({});
  const [matchLoading, setMatchLoading] = useState({});
  const [matchError, setMatchError] = useState({});

  const updateAuthor = (index, patch) => {
    setAuthors((prev) => prev.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
  };

  const addAuthor = () => {
    const maxPosition = authors.reduce((max, entry) => Math.max(max, Number(entry.position) || 0), 0);
    setAuthors((prev) => [...prev, createEmptyAuthor(maxPosition + 1)]);
  };

  const removeAuthor = (index) => {
    setAuthors((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  };

  const searchMatches = async (index) => {
    const name = authors[index]?.name?.trim();
    if (!name) {
      setMatchError((prev) => ({ ...prev, [index]: "Type a name before searching." }));
      setMatchOptions((prev) => ({ ...prev, [index]: [] }));
      return;
    }

    setMatchLoading((prev) => ({ ...prev, [index]: true }));
    setMatchError((prev) => ({ ...prev, [index]: "" }));

    try {
      const response = await api.get("/authors/lookup/name", { params: { name } });
      setMatchOptions((prev) => ({ ...prev, [index]: response.data || [] }));
      if (!response.data?.length) {
        setMatchError((prev) => ({ ...prev, [index]: "No existing authors found for this name." }));
      }
    } catch (error) {
      if (error?.response?.status === 404) {
        setMatchOptions((prev) => ({ ...prev, [index]: [] }));
        setMatchError((prev) => ({ ...prev, [index]: "No existing authors found. A new author will be created." }));
      } else {
        setMatchError((prev) => ({ ...prev, [index]: "Author lookup failed. You can still submit as new author." }));
      }
    } finally {
      setMatchLoading((prev) => ({ ...prev, [index]: false }));
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        <button
          type="button"
          onClick={addAuthor}
          disabled={disabled}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
        >
          Add Author
        </button>
      </div>

      <div className="space-y-4">
        {authors.map((entry, index) => {
          const options = matchOptions[index] || [];
          const selectedId = entry.author_id ? String(entry.author_id) : "";

          return (
            <article key={index} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="grid gap-3 md:grid-cols-4">
                <label className="text-sm text-slate-700 md:col-span-2">
                  <span className="mb-1 block font-medium">Author Name *</span>
                  <input
                    type="text"
                    value={entry.name}
                    onChange={(e) => updateAuthor(index, { name: e.target.value, author_id: null })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    placeholder="Type full author name"
                    disabled={disabled}
                    required
                  />
                </label>

                <label className="text-sm text-slate-700">
                  <span className="mb-1 block font-medium">Position *</span>
                  <input
                    type="number"
                    min="1"
                    value={entry.position}
                    onChange={(e) => updateAuthor(index, { position: Number(e.target.value) || "" })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    disabled={disabled}
                    required
                  />
                </label>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => removeAuthor(index)}
                    disabled={disabled || authors.length <= 1}
                    className="w-full rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => searchMatches(index)}
                  disabled={disabled || matchLoading[index]}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                >
                  {matchLoading[index] ? "Searching..." : "Search existing author"}
                </button>

                {entry.author_id ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                    Existing author selected (ID {entry.author_id})
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                    New author will be created if not selected
                  </span>
                )}
              </div>

              {options.length ? (
                <label className="mt-3 block text-sm text-slate-700">
                  <span className="mb-1 block font-medium">Select Existing Match (optional)</span>
                  <select
                    value={selectedId}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (!value) {
                        updateAuthor(index, { author_id: null });
                        return;
                      }
                      const match = options.find((item) => String(item.id) === value);
                      if (match) {
                        updateAuthor(index, {
                          author_id: Number(match.id),
                          name: match.name,
                          orc_id: match.orc_id || "",
                        });
                      }
                    }}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    disabled={disabled}
                  >
                    <option value="">Do not select (create new by typed name)</option>
                    {options.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} {item.orc_id ? `| ORC: ${item.orc_id}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {!entry.author_id ? (
                <label className="mt-3 block text-sm text-slate-700">
                  <span className="mb-1 block font-medium">ORCID (optional, for new author)</span>
                  <input
                    type="text"
                    value={entry.orc_id || ""}
                    onChange={(e) => updateAuthor(index, { orc_id: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    placeholder="0000-0002-1825-0097 or https://orcid.org/..."
                    disabled={disabled}
                  />
                </label>
              ) : null}

              {matchError[index] ? <p className="mt-2 text-xs text-slate-500">{matchError[index]}</p> : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
