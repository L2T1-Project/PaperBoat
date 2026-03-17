import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api/axios";

function PaperReviewsPage() {
  const { id } = useParams();
  const [paper, setPaper] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [repliesByReview, setRepliesByReview] = useState({});
  const [reviewText, setReviewText] = useState("");
  const [replyInputs, setReplyInputs] = useState({});
  const [votesByReview, setVotesByReview] = useState({});
  const [isVotingByReview, setIsVotingByReview] = useState({});
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("pb_user") || "null");
    } catch (err) {
      return null;
    }
  }, []);

  const fetchReviews = async () => {
    try {
      setIsLoading(true);
      setError("");

      const [paperRes, reviewsRes] = await Promise.all([
        api.get(`/papers/${id}`),
        api.get(`/reviews/paper/${id}/tree`),
      ]);

      setPaper(paperRes.data?.data || null);
      const rootReviews = reviewsRes.data?.roots || [];
      setReviews(rootReviews);

      const repliesMap = reviewsRes.data?.repliesByReview || {};
      setRepliesByReview(repliesMap);

      const reviewIds = [
        ...rootReviews.map((review) => review.id),
        ...Object.values(repliesMap).flat().map((reply) => reply.id),
      ];

      const voteEntries = await Promise.all(
        reviewIds.map(async (reviewId) => {
          const response = await api.get(`/reviews/${reviewId}/votes`);
          const votes = response.data || [];
          const upvotes = votes.filter((vote) => vote.is_upvote).length;
          const downvotes = votes.filter((vote) => !vote.is_upvote).length;
          const currentUserVote = currentUser?.userId
            ? votes.find((vote) => Number(vote.researcher_id) === Number(currentUser.userId))
            : null;

          return [
            reviewId,
            {
              upvotes,
              downvotes,
              currentUserVote: currentUserVote
                ? currentUserVote.is_upvote
                  ? "up"
                  : "down"
                : null,
            },
          ];
        }),
      );

      setVotesByReview(Object.fromEntries(voteEntries));
    } catch (err) {
      console.error("Failed loading reviews:", err);
      setError("Could not load reviews.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [id]);

  const submitReview = async (event) => {
    event.preventDefault();
    if (!currentUser?.userId) {
      setError("Please log in as a researcher to post a review.");
      return;
    }
    if (!reviewText.trim()) return;

    try {
      await api.post("/reviews", {
        paper_id: Number(id),
        text: reviewText.trim(),
      });
      setReviewText("");
      fetchReviews();
    } catch (err) {
      console.error("Failed creating review:", err);
      setError(err?.response?.data?.error || "Could not post review.");
    }
  };

  const submitReply = async (parentReviewId) => {
    const text = (replyInputs[parentReviewId] || "").trim();
    if (!text) return;
    if (!currentUser?.userId) {
      setError("Please log in as a researcher to reply.");
      return;
    }

    try {
      await api.post("/reviews", {
        parent_review_id: parentReviewId,
        text,
      });

      setReplyInputs((prev) => ({ ...prev, [parentReviewId]: "" }));
      fetchReviews();
    } catch (err) {
      console.error("Failed creating reply:", err);
      setError(err?.response?.data?.error || "Could not post reply.");
    }
  };

  const voteOnReview = async (reviewId, direction) => {
    if (!currentUser?.userId) {
      setError("Please log in as a researcher to vote.");
      return;
    }

    const currentVote = votesByReview[reviewId]?.currentUserVote || null;

    try {
      setIsVotingByReview((prev) => ({ ...prev, [reviewId]: true }));

      if (currentVote === direction) {
        await api.delete(`/reviews/${reviewId}/votes`);
      } else {
        await api.post(`/reviews/${reviewId}/votes`, {
          is_upvote: direction === "up",
        });
      }

      const response = await api.get(`/reviews/${reviewId}/votes`);
      const votes = response.data || [];
      const upvotes = votes.filter((vote) => vote.is_upvote).length;
      const downvotes = votes.filter((vote) => !vote.is_upvote).length;
      const currentUserVoteEntry = votes.find(
        (vote) => Number(vote.researcher_id) === Number(currentUser.userId),
      );

      setVotesByReview((prev) => ({
        ...prev,
        [reviewId]: {
          upvotes,
          downvotes,
          currentUserVote: currentUserVoteEntry
            ? currentUserVoteEntry.is_upvote
              ? "up"
              : "down"
            : null,
        },
      }));
    } catch (err) {
      console.error("Failed voting review:", err);
      setError(err?.response?.data?.error || "Could not submit vote.");
    } finally {
      setIsVotingByReview((prev) => ({ ...prev, [reviewId]: false }));
    }
  };

  const renderVoteBar = (reviewId) => {
    const voteState = votesByReview[reviewId] || { upvotes: 0, downvotes: 0, currentUserVote: null };
    const isVoting = !!isVotingByReview[reviewId];

    return (
      <div className="mt-2 flex items-center gap-2 text-xs">
        <button
          type="button"
          onClick={() => voteOnReview(reviewId, "up")}
          disabled={isVoting}
          className={`rounded-md border px-2 py-1 ${
            voteState.currentUserVote === "up"
              ? "border-slate-700 bg-slate-200 text-slate-900"
              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
          } disabled:opacity-50`}
        >
          Upvote {voteState.upvotes}
        </button>
        <button
          type="button"
          onClick={() => voteOnReview(reviewId, "down")}
          disabled={isVoting}
          className={`rounded-md border px-2 py-1 ${
            voteState.currentUserVote === "down"
              ? "border-red-400 bg-red-50 text-red-700"
              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
          } disabled:opacity-50`}
        >
          Downvote {voteState.downvotes}
        </button>
      </div>
    );
  };

  const renderReviewNode = (node, depth = 0) => {
    const children = repliesByReview[node.id] || [];

    return (
      <div key={node.id} className={depth > 0 ? "mt-2 rounded-md bg-white p-2" : "rounded-xl border border-slate-200 bg-slate-50 p-4"}>
        <p className="text-sm font-semibold text-slate-900">{node.full_name || node.username || "User"}</p>
        <p className="mt-1 text-sm text-slate-700">{node.text}</p>
        <p className="mt-1 text-xs text-slate-500">{new Date(node.created_at).toLocaleString()}</p>
        {renderVoteBar(node.id)}

        <div className="mt-3 flex gap-2">
          <input
            value={replyInputs[node.id] || ""}
            onChange={(event) =>
              setReplyInputs((prev) => ({
                ...prev,
                [node.id]: event.target.value,
              }))
            }
            placeholder="Write a reply"
            className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-slate-700"
          />
          <button
            type="button"
            onClick={() => submitReply(node.id)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Reply
          </button>
        </div>

        {children.length ? (
          <div className="mt-3 space-y-2 border-l-2 border-slate-200 pl-4">
            {children.map((child) => renderReviewNode(child, depth + 1))}
          </div>
        ) : null}
      </div>
    );
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-slate-50 py-10">
        <div className="mx-auto max-w-5xl px-4 text-sm text-slate-600">Loading reviews...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 py-10">
      <div className="mx-auto w-full max-w-5xl space-y-5 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <Link to={`/papers/${id}`} className="text-sm font-medium text-slate-700 hover:underline">
            Back to paper details
          </Link>
        </div>

        {paper && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reviewing</p>
            <h1 className="mt-2 text-xl font-bold text-slate-900">{paper.title}</h1>
          </section>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Reviews & Comments</h2>
          {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

          <form onSubmit={submitReview} className="mt-3">
            <textarea
              rows={3}
              value={reviewText}
              onChange={(event) => setReviewText(event.target.value)}
              placeholder="Write your review or comment"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-slate-700"
            />
            <div className="mt-2">
              <button
                type="submit"
                className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900"
              >
                Post Review
              </button>
            </div>
          </form>

          <div className="mt-5 space-y-4">
            {reviews.length ? (
              reviews.map((review) => renderReviewNode(review))
            ) : (
              <p className="mt-4 text-sm text-slate-500">No reviews yet. Be the first to comment.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

export default PaperReviewsPage;
