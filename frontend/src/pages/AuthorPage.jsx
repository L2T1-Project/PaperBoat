import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api/axios";
import FollowButton from '../components/FollowButton';

function StatCard({ label, value, tooltip }) {
  return (
    <div
      className="flex flex-col items-center rounded-xl border border-slate-200 bg-slate-50 px-6 py-4"
      title={tooltip}
    >
      <span className="text-2xl font-bold text-slate-900">{value ?? "–"}</span>
      <span className="mt-0.5 text-xs font-medium text-slate-500">{label}</span>
    </div>
  );
}

function PaperRow({ paper, position }) {
  return (
    <Link
      to={`/papers/${paper.id}`}
      className="group flex flex-col gap-1 rounded-lg border border-slate-200 bg-white px-4 py-3 transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-slate-800 group-hover:text-primary">
          {position != null && (
            <span className="mr-1.5 text-xs font-normal text-slate-400">
              #{position}
            </span>
          )}
          {paper.title}
          {paper.is_retracted && (
            <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">
              RETRACTED
            </span>
          )}
        </p>
        {paper.citation_count != null && (
          <span className="flex-shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
            {paper.citation_count} cite{paper.citation_count !== 1 ? "s" : ""}
          </span>
        )}
      </div>
      <p className="text-xs text-slate-500">
        {paper.venue_name}
        {paper.publication_date && (
          <> &middot; {new Date(paper.publication_date).getFullYear()}</>
        )}
        {paper.doi && (
          <>
            {" "}
            &middot; <span className="font-mono">{paper.doi}</span>
          </>
        )}
      </p>
    </Link>
  );
}

export default function AuthorPage() {
  const { id } = useParams();
  const [profile, setProfile] = useState(null);
  const [papers, setPapers] = useState([]);
  const [collaborators, setCollaborators] = useState([]);
  const [expandedCollaboratorId, setExpandedCollaboratorId] = useState(null);
  const [showAllPapers, setShowAllPapers] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const collaboratorsScrollRef = useRef(null);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setIsLoading(true);
        setError("");

        const [profileRes, papersRes, collaboratorsRes] = await Promise.all([
          api.get(`/authors/${id}/profile`),
          api.get(`/authors/${id}/papers`),
          api.get(`/authors/${id}/collaborators`),
        ]);

        setProfile(profileRes.data?.data ?? null);
        setPapers(papersRes.data?.data ?? []);
        setCollaborators(collaboratorsRes.data?.data ?? []);
      } catch (err) {
        console.error("AuthorPage fetch failed:", err);
        setError("Could not load author profile.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchAll();
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-primary" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="mx-auto mt-20 max-w-lg text-center">
        <p className="text-slate-500">{error || "Author not found."}</p>
        <Link
          to="/authors"
          className="mt-4 inline-block text-sm text-primary underline"
        >
          Search authors
        </Link>
      </div>
    );
  }

  const displayName = profile.full_name || profile.name;
  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const scrollCollaborators = (direction) => {
    if (!collaboratorsScrollRef.current) return;
    collaboratorsScrollRef.current.scrollBy({
      left: direction === "left" ? -420 : 420,
      behavior: "smooth",
    });
  };

  const hasMorePapers = papers.length > 5;
  const visiblePapers = showAllPapers ? papers : papers.slice(0, 5);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Profile header */}
      <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="flex-shrink-0">
          {profile.profile_pic_url ? (
            <img
              src={profile.profile_pic_url}
              alt={displayName}
              className="h-20 w-20 rounded-full object-cover ring-2 ring-slate-200"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-xl font-bold text-white ring-2 ring-slate-200">
              {initials}
            </div>
          )}
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{displayName}</h1>
            {profile.user_id && <FollowButton targetUserId={profile.user_id} />}
          </div>

          {profile.username && (
            <p className="mt-0.5 text-sm text-slate-500">@{profile.username}</p>
          )}

          {profile.orc_id && (
            <a
              href={`https://orcid.org/${profile.orc_id}`}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-xs text-green-700 hover:underline"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zm-1.44 17.57H8.97V9.03h1.59v8.54zm-.795-9.73a.92.92 0 1 1 0-1.84.92.92 0 0 1 0 1.84zm7.24 9.73h-1.59v-4.16c0-2.15-2.55-1.99-2.55 0v4.16h-1.59V9.03h1.59v.93c.74-1.37 4.14-1.47 4.14 1.31v6.3z" />
              </svg>
              {profile.orc_id}
            </a>
          )}

          {profile.bio && (
            <p className="mt-2 max-w-prose text-sm text-slate-600">
              {profile.bio}
            </p>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="mb-8 grid grid-cols-3 gap-3 sm:gap-4">
        <StatCard label="Papers" value={profile.paper_count} />
        <StatCard label="Citations" value={profile.total_citations} />
        <StatCard
          label="h-index"
          value={profile.h_index}
          tooltip="h-index: the largest h such that h papers each have ≥ h citations"
        />
      </div>

      {/* h-index explainer */}
      <div className="mb-8 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
        <strong className="text-slate-700">What is h-index?</strong> The largest
        value <em>h</em> such that the author has at least <em>h</em> papers
        each cited at least <em>h</em> times. Computed live from citation data
        in the PaperBoat database.
      </div>

      {/* Papers list */}
      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-800">
            Papers
            {papers.length > 0 && (
              <span className="ml-2 text-sm font-normal text-slate-400">
                ({papers.length})
              </span>
            )}
          </h2>
          {hasMorePapers ? (
            <button
              type="button"
              onClick={() => setShowAllPapers((prev) => !prev)}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              {showAllPapers ? "Show less" : `Show all (${papers.length})`}
              <span>{showAllPapers ? "▴" : "▾"}</span>
            </button>
          ) : null}
        </div>

        {papers.length === 0 ? (
          <p className="text-sm text-slate-400">
            No papers found for this author.
          </p>
        ) : (
          <div className={`flex flex-col gap-2 ${showAllPapers ? "max-h-[28rem] overflow-y-auto pr-1" : ""}`}>
            {visiblePapers.map((paper) => (
              <PaperRow
                key={paper.id}
                paper={paper}
                position={paper.position}
              />
            ))}
          </div>
        )}
      </section>

      {/* Collaborators */}
      <section className="mt-10 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Collaborating Authors</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => scrollCollaborators("left")}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => scrollCollaborators("right")}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
            >
              →
            </button>
          </div>
        </div>

        {!collaborators.length ? (
          <p className="mt-3 text-sm text-slate-500">No collaborators found for this author.</p>
        ) : (
          <div ref={collaboratorsScrollRef} className="mt-4 flex gap-3 overflow-x-auto pb-2">
            {collaborators.map((collaborator) => {
              const isExpanded = expandedCollaboratorId === collaborator.collaborator_id;
              const sharedPapers = collaborator.shared_papers || [];

              return (
                <article
                  key={collaborator.collaborator_id}
                  className="min-w-[320px] rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Link
                        to={`/authors/${collaborator.collaborator_id}`}
                        className="text-sm font-semibold text-slate-900 hover:text-slate-700 hover:underline"
                      >
                        {collaborator.collaborator_name}
                      </Link>
                      <p className="mt-1 text-xs text-slate-500">
                        Shared papers: {collaborator.shared_paper_count || 0}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setExpandedCollaboratorId((prev) =>
                          prev === collaborator.collaborator_id ? null : collaborator.collaborator_id,
                        )
                      }
                      className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      aria-label={`Toggle shared papers for ${collaborator.collaborator_name}`}
                    >
                      {isExpanded ? "▴" : "▾"}
                    </button>
                  </div>

                  {isExpanded ? (
                    <div className="mt-3 space-y-2 border-t border-slate-200 pt-3">
                      {sharedPapers.length ? (
                        sharedPapers.map((paper) => (
                          <Link
                            key={paper.id}
                            to={`/papers/${paper.id}`}
                            className="block rounded-lg border border-slate-200 bg-white px-3 py-2 hover:border-slate-300"
                          >
                            <p className="text-sm font-medium text-slate-800">{paper.title}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {paper.venue_name || "N/A"}
                              {paper.publication_date
                                ? ` • ${new Date(paper.publication_date).getFullYear()}`
                                : ""}
                              {paper.citation_count != null
                                ? ` • ${paper.citation_count} cite${paper.citation_count !== 1 ? "s" : ""}`
                                : ""}
                            </p>
                          </Link>
                        ))
                      ) : (
                        <p className="text-xs text-slate-500">No shared papers found.</p>
                      )}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
