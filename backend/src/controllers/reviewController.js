const ReviewModel = require('../models/reviewModel.js');

class ReviewController {
    constructor() {
        this.reviewModel = new ReviewModel();
    }

    createReview = async (req, res) => {
        try {
            const { researcher_id, paper_id, parent_review_id, text } = req.body;
            if (!researcher_id || !text) {
                return res.status(400).json({ error: 'researcher_id and text are required' });
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
            const { researcher_id, is_upvote } = req.body;
            if (!researcher_id || is_upvote === undefined) {
                return res.status(400).json({ error: 'researcher_id and is_upvote are required' });
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
            const { researcher_id } = req.body;
            if (!researcher_id) return res.status(400).json({ error: 'researcher_id is required' });
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
