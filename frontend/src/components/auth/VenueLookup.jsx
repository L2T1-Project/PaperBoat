import { useEffect, useState } from "react";
import api from "../../api/axios";

const CLAIMED_MESSAGE =
  "This venue has already been claimed by another account.";

export function VenueLookup({
  value,
  onChange,
  onLookupSuccess,
  disabled = false,
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [venue, setVenue] = useState(null);
  const [resolvedIssn, setResolvedIssn] = useState("");

  useEffect(() => {
    if (!resolvedIssn) {
      return;
    }

    if (value.trim() !== resolvedIssn) {
      setVenue(null);
      setLookupError("");
      setResolvedIssn("");
      onLookupSuccess(null);
    }
  }, [value, resolvedIssn, onLookupSuccess]);

  const handleLookup = async () => {
    const issn = value.trim();

    if (!issn) {
      setLookupError("ISSN is required before lookup.");
      setVenue(null);
      onLookupSuccess(null);
      return;
    }

    setIsLoading(true);
    setLookupError("");

    try {
      const response = await api.get("/venues/lookup/issn", {
        params: { issn },
      });
      const resolvedVenue = response.data;

      if (resolvedVenue?.is_claimed) {
        setLookupError(CLAIMED_MESSAGE);
        setVenue(null);
        setResolvedIssn("");
        onLookupSuccess(null);
        return;
      }

      setVenue(resolvedVenue);
      setResolvedIssn(issn);
      onLookupSuccess(resolvedVenue);
    } catch (error) {
      const status = error?.response?.status;
      const apiMessage = error?.response?.data?.error;

      if (status === 404) {
        setLookupError("No venue found with this ISSN.");
      } else if (apiMessage) {
        setLookupError(apiMessage);
      } else {
        setLookupError("Failed to look up venue. Please try again.");
      }

      setVenue(null);
      setResolvedIssn("");
      onLookupSuccess(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <label htmlFor="issn" className="block text-sm font-medium text-gray-700">
        ISSN
      </label>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="issn"
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Enter ISSN"
          disabled={disabled || isLoading}
          className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:ring-2 focus:ring-slate-400 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
        />

        <button
          type="button"
          onClick={handleLookup}
          disabled={disabled || isLoading}
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

      {lookupError ? (
        <p className="text-sm text-red-500">{lookupError}</p>
      ) : null}

      {venue ? (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-900">
          <p className="font-semibold">Venue Found</p>
          <p>Name: {venue.name}</p>
          <p>ISSN: {venue.issn}</p>
          <p>Type: {venue.type}</p>
          <p>Publisher: {venue.publisher_name}</p>
        </div>
      ) : null}
    </div>
  );
}
