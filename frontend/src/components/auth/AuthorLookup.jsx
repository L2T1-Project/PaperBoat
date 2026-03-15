import { useEffect, useState } from "react";
import api from "../../api/axios";

export function AuthorLookup({
  value,
  onChange,
  onLookupSuccess,
  disabled = false,
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [author, setAuthor] = useState(null);
  const [resolvedOrcId, setResolvedOrcId] = useState("");

  useEffect(() => {
    if (!resolvedOrcId) {
      return;
    }

    if (value.trim() !== resolvedOrcId) {
      setAuthor(null);
      setLookupError("");
      setResolvedOrcId("");
      onLookupSuccess(null);
    }
  }, [value, resolvedOrcId, onLookupSuccess]);

  const handleLookup = async () => {
    const orcId = value.trim();

    if (!orcId) {
      setLookupError("ORC ID is required before lookup.");
      setAuthor(null);
      onLookupSuccess(null);
      return;
    }

    setIsLoading(true);
    setLookupError("");

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
        setLookupError("No author found with this ORC ID.");
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
          disabled={disabled || isLoading}
          className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-100"
        />

        <button
          type="button"
          onClick={handleLookup}
          disabled={disabled || isLoading}
          className="inline-flex min-w-28 items-center justify-center rounded-lg bg-[#1a6eb5] px-4 py-2 font-semibold text-white transition-all hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
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
    </div>
  );
}
