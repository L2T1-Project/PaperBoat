import { useEffect, useState } from "react";
import api from "../../api/axios";

export function AuthorLookup({
  value,
  onChange,
  onLookupSuccess,
  onClaim,
  fullName,
  disabled = false,
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [isNameLoading, setIsNameLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [author, setAuthor] = useState(null);
  const [resolvedOrcId, setResolvedOrcId] = useState("");
  const [nameMatches, setNameMatches] = useState([]);
  const [showNameSearch, setShowNameSearch] = useState(false);
  const [nameTerm, setNameTerm] = useState("");
  const [selectedAuthor, setSelectedAuthor] = useState(null);

  useEffect(() => {
    if (!resolvedOrcId) {
      return;
    }

    if (value.trim() !== resolvedOrcId) {
      setAuthor(null);
      setLookupError("");
      setResolvedOrcId("");
      setNameMatches([]);
      setNameTerm("");
      setSelectedAuthor(null);
      onLookupSuccess(null);
    }
  }, [value, resolvedOrcId, onLookupSuccess]);

  const runNameSearch = async (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    setIsNameLoading(true);
    setNameMatches([]);
    setLookupError("");
    setSelectedAuthor(null);

    try {
      const nameRes = await api.get("/authors/lookup/name", {
        params: { name: trimmed },
      });
      setNameMatches(nameRes.data);
    } catch (nameErr) {
      setNameMatches([]);
      setLookupError(
        nameErr?.response?.status === 404
          ? "No authors found matching that name."
          : "Failed to search by name. Please try again."
      );
    } finally {
      setIsNameLoading(false);
    }
  };

  const handleLookup = async () => {
    const orcId = value.trim();

    if (!orcId) {
      setLookupError("ORC ID is required before lookup.");
      setAuthor(null);
      setNameMatches([]);
      setSelectedAuthor(null);
      onLookupSuccess(null);
      return;
    }

    setIsLoading(true);
    setLookupError("");
    setNameMatches([]);
    setSelectedAuthor(null);

    try {
      const response = await api.get("/authors/lookup/orc-id", {
        params: { orc_id: orcId },
      });

      setAuthor(response.data);
      setResolvedOrcId(orcId);
      onLookupSuccess(response.data);
    } catch (error) {
      const status = error?.response?.status;
      const apiMessage = error?.response?.data?.error;

      if (status === 404) {
        setAuthor(null);
        setResolvedOrcId("");
        onLookupSuccess(null);

        setShowNameSearch(true);
        if (fullName?.trim()) {
          setNameTerm(fullName.trim());
          setIsLoading(false);
          await runNameSearch(fullName.trim());
        } else {
          setLookupError(
            "No author found with this ORC ID. Use name search below to match your profile."
          );
        }
        return;
      } else if (status === 409 && apiMessage) {
        setLookupError(apiMessage);
      } else if (apiMessage) {
        setLookupError(apiMessage);
      } else {
        setLookupError("Failed to look up author. Please try again.");
      }

      setAuthor(null);
      setResolvedOrcId("");
      onLookupSuccess(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClaim = (match) => {
    setSelectedAuthor(match);
    onClaim(match);
  };

  const toggleNameSearch = () => {
    setShowNameSearch((prev) => !prev);
    if (!showNameSearch && !nameTerm.trim() && fullName?.trim()) {
      setNameTerm(fullName.trim());
    }
  };

  return (
    <div className="space-y-3">
      <label
        htmlFor="orc_id"
        className="block text-sm font-medium text-gray-700"
      >
        ORC ID
      </label>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="orc_id"
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Enter ORC ID"
          disabled={disabled || isLoading || isNameLoading}
          className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:ring-2 focus:ring-slate-400 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
        />

        <button
          type="button"
          onClick={handleLookup}
          disabled={disabled || isLoading || isNameLoading}
          className="inline-flex min-w-28 items-center justify-center rounded-lg bg-slate-800 px-4 py-2 font-semibold text-white transition-all hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Looking...
            </span>
          ) : (
            "Look Up"
          )}
        </button>
      </div>

      <button
        type="button"
        onClick={toggleNameSearch}
        disabled={disabled || isLoading}
        className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span>{showNameSearch ? "Hide name search" : "Don't have ORC ID? Search by name"}</span>
        <span>{showNameSearch ? "▴" : "▾"}</span>
      </button>

      {lookupError ? (
        <p className="text-sm text-red-500">{lookupError}</p>
      ) : null}

      {author ? (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
          <p className="font-semibold">Author Found</p>
          <p>Name: {author.name}</p>
          <p>ORC ID: {author.orc_id}</p>
        </div>
      ) : null}

      {showNameSearch ? (
        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-slate-600">
            Search by name and claim your author profile if ORC ID lookup does not match.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={nameTerm}
              onChange={(e) => setNameTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  runNameSearch(nameTerm);
                }
              }}
              placeholder="Enter your full name"
              disabled={disabled || isNameLoading}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:ring-2 focus:ring-slate-400 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
            />
            <button
              type="button"
              onClick={() => runNameSearch(nameTerm)}
              disabled={disabled || isNameLoading || !nameTerm.trim()}
              className="inline-flex min-w-28 items-center justify-center rounded-lg bg-slate-700 px-4 py-2 font-semibold text-white transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isNameLoading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Searching...
                </span>
              ) : (
                "Search"
              )}
            </button>
          </div>

          {selectedAuthor && !selectedAuthor.is_claimed ? (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
              <p className="font-semibold">Profile Selected</p>
              <p>Name: {selectedAuthor.name}</p>
              {selectedAuthor.latest_paper ? (
                <p className="text-green-700">
                  Paper:{" "}
                  <a
                    href={`/papers/${selectedAuthor.latest_paper.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="underline hover:text-green-900"
                  >
                    {selectedAuthor.latest_paper.title}
                  </a>
                </p>
              ) : null}
              <p className="mt-1 text-green-600">
                You will be registered as a researcher linked to this profile.
              </p>
            </div>
          ) : null}

          {nameMatches.length > 0 && !(selectedAuthor && !selectedAuthor.is_claimed) ? (
            <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3 text-sm">
              <p className="font-medium text-slate-700">
                Do any of these match your author profile?
              </p>
              {nameMatches.map((match) => {
                const isSelected = selectedAuthor?.id === match.id;
                return (
                  <div
                    key={match.id}
                    className={`flex items-start justify-between gap-4 border-b border-slate-200 pb-3 last:border-0 last:pb-0 rounded-lg px-2 py-1 transition-colors ${
                      isSelected ? "bg-amber-50 border-amber-200" : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800">{match.name}</p>
                      {match.latest_paper ? (
                        <a
                          href={`/papers/${match.latest_paper.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-slate-500 hover:underline block truncate"
                        >
                          {match.latest_paper.title}
                        </a>
                      ) : (
                        <span className="text-slate-400">No papers on record</span>
                      )}
                      {match.is_claimed ? (
                        <span className="text-xs text-amber-600">(already claimed)</span>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleClaim(match)}
                      disabled={disabled || isSelected}
                      className={`shrink-0 rounded-lg px-3 py-1 text-xs font-semibold text-white transition-colors disabled:cursor-not-allowed ${
                        isSelected
                          ? "bg-slate-400"
                          : "bg-slate-800 hover:bg-slate-900 disabled:opacity-60"
                      }`}
                    >
                      {isSelected ? "Selected" : "Claim"}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : null}

          {selectedAuthor?.is_claimed ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold">Profile already claimed</p>
              <p>
                The profile for <span className="font-medium">{selectedAuthor.name}</span> is already associated with another account.
              </p>
              <p className="mt-1">
                You will be registered as a general user and the admin will be notified to help link your account.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
