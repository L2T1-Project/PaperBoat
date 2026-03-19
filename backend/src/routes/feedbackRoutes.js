const { Router } = require('express');
const FeedbackController = require('../controllers/feedbackController.js');

class FeedbackRouter {
    constructor() {
        this.router = Router();
        this.feedbackController = new FeedbackController();
        this.#initRoutes();
    }

    #initRoutes() {
        // NOTE: /my must come before /:id to avoid param conflict
        this.router.get('/my', this.feedbackController.getMyFeedback);
        this.router.get('/',   this.feedbackController.getAllFeedback);
        this.router.post('/',  this.feedbackController.submitFeedback);
        this.router.put('/:id/respond', this.feedbackController.respondToFeedback);
    }

    getRouter() {
        return this.router;
    }
}

module.exports = FeedbackRouter;
