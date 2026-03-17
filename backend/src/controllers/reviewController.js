const ReviewModel = require('../models/reviewModel.js');

class ReviewController {
    constructor() {
        this.reviewModel = new ReviewModel();
    }

    createReview = async (req, res) => {
        try {
            const { paper_id, parent_review_id, text } = req.body;
            const researcher_id = req.auth?.userId;

            if (!researcher_id) {
                return res.status(401).json({ error: 'Authentication required' });
            }
            if (req.user?.role !== 'researcher') {
                return res.status(403).json({ error: 'Only researchers can create reviews' });
            }
            if (!text) {
                return res.status(400).json({ error: 'text is required' });
            }
            if (!paper_id && !parent_review_id) {
                return res.status(400).json({ error: 'Either paper_id or parent_review_id is required' });
            }
            if (paper_id && parent_review_id) {
                return res.status(400).json({ error: 'Provide either paper_id or parent_review_id, not both' });
            }
            const review = await this.reviewModel.createReview(researcher_id, paper_id, parent_review_id, text);
            return res.status(201).json(review);
        } catch (err) {
            if (err.code === '23503') return res.status(400).json({ error: 'Researcher, paper, or parent review not found' });
            if (err.code === '23514') return res.status(400).json({ error: 'Invalid review: check paper_id / parent_review_id constraint' });
            console.error('ReviewController.createReview:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    getAllReviews = async (req, res) => {
        try {
            const reviews = await this.reviewModel.getAllReviews();
            return res.status(200).json(reviews);
        } catch (err) {
            console.error('ReviewController.getAllReviews:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    getReviewById = async (req, res) => {
        try {
            const { id } = req.params;
            const review = await this.reviewModel.getReviewById(id);
            if (!review) return res.status(404).json({ error: 'Review not found' });
            return res.status(200).json(review);
        } catch (err) {
            console.error('ReviewController.getReviewById:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    getReviewsByPaper = async (req, res) => {
        try {
            const { paperId } = req.params;
            const reviews = await this.reviewModel.getReviewsByPaper(paperId);
            return res.status(200).json(reviews);
        } catch (err) {
            console.error('ReviewController.getReviewsByPaper:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    getReviewTreeByPaper = async (req, res) => {
        try {
            const { paperId } = req.params;
            const reviewTree = await this.reviewModel.getReviewTreeByPaper(paperId);

            const roots = [];
            const repliesByReview = {};

            reviewTree.forEach((review) => {
                if (review.parent_review_id) {
                    const parentId = Number(review.parent_review_id);
                    repliesByReview[parentId] = repliesByReview[parentId] || [];
                    repliesByReview[parentId].push(review);
                } else {
                    roots.push(review);
                }
            });

            roots.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            Object.keys(repliesByReview).forEach((parentId) => {
                repliesByReview[parentId].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            });

            return res.status(200).json({ roots, repliesByReview });
        } catch (err) {
            console.error('ReviewController.getReviewTreeByPaper:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    getRepliesByReview = async (req, res) => {
        try {
            const { id } = req.params;
            const replies = await this.reviewModel.getRepliesByReview(id);
            return res.status(200).json(replies);
        } catch (err) {
            console.error('ReviewController.getRepliesByReview:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    deleteReview = async (req, res) => {
        try {
            const { id } = req.params;
            const removed = await this.reviewModel.deleteReview(id);
            if (!removed) return res.status(404).json({ error: 'Review not found' });
            return res.status(200).json({ message: 'Review deleted', id: removed.id });
        } catch (err) {
            console.error('ReviewController.deleteReview:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    castVote = async (req, res) => {
        try {
            const { id } = req.params;
            const { is_upvote } = req.body;
            const researcher_id = req.auth?.userId;

            if (!researcher_id) {
                return res.status(401).json({ error: 'Authentication required' });
            }
            if (req.user?.role !== 'researcher') {
                return res.status(403).json({ error: 'Only researchers can vote' });
            }
            if (is_upvote === undefined) {
                return res.status(400).json({ error: 'is_upvote is required' });
            }
            const vote = await this.reviewModel.castVote(researcher_id, id, is_upvote);
            return res.status(200).json(vote);
        } catch (err) {
            if (err.code === '23503') return res.status(400).json({ error: 'Researcher or review not found' });
            console.error('ReviewController.castVote:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    removeVote = async (req, res) => {
        try {
            const { id } = req.params;
            const researcher_id = req.auth?.userId;

            if (!researcher_id) {
                return res.status(401).json({ error: 'Authentication required' });
            }
            if (req.user?.role !== 'researcher') {
                return res.status(403).json({ error: 'Only researchers can remove votes' });
            }
            const removed = await this.reviewModel.removeVote(researcher_id, id);
            if (!removed) return res.status(404).json({ error: 'Vote not found' });
            return res.status(200).json({ message: 'Vote removed' });
        } catch (err) {
            console.error('ReviewController.removeVote:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    getVotesByReview = async (req, res) => {
        try {
            const { id } = req.params;
            const votes = await this.reviewModel.getVotesByReview(id);
            return res.status(200).json(votes);
        } catch (err) {
            console.error('ReviewController.getVotesByReview:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
}

module.exports = ReviewController;
