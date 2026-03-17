const { Router } = require('express');
const ReviewController = require('../controllers/reviewController.js');

class ReviewRouter {
    constructor() {
        this.router = Router();
        this.reviewController = new ReviewController();
        this.#initRoutes();
    }

    #initRoutes() {
        this.router.get('/paper/:paperId',    this.reviewController.getReviewsByPaper);
        this.router.get('/paper/:paperId/tree', this.reviewController.getReviewTreeByPaper);

        this.router.post('/',                 this.reviewController.createReview);
        this.router.get('/',                  this.reviewController.getAllReviews);
        this.router.get('/:id',               this.reviewController.getReviewById);
        this.router.delete('/:id',            this.reviewController.deleteReview);

        this.router.get('/:id/replies',       this.reviewController.getRepliesByReview);

        this.router.get('/:id/votes',         this.reviewController.getVotesByReview);
        this.router.post('/:id/votes',        this.reviewController.castVote);
        this.router.delete('/:id/votes',      this.reviewController.removeVote);
    }

    getRouter() {
        return this.router;
    }
}

module.exports = ReviewRouter;
