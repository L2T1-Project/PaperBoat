const express = require('express');
const ClaimController = require('../controllers/claimController.js');

class ClaimRouter {
    #router;
    #controller;

    constructor() {
        this.#router = express.Router();
        this.#controller = new ClaimController();
        this.#initRoutes();
    }

    #initRoutes() {
        // User: submit a new duplicate-author claim (POST /api/claims)
        this.#router.post('/', this.#controller.submitClaim);

        // Admin: list all pending claims (GET /api/claims/admin)
        this.#router.get('/admin', this.#controller.getPendingClaims);

        // Admin: approve a claim — swap researcher (POST /api/claims/admin/:claimId/approve)
        this.#router.post('/admin/:claimId/approve', this.#controller.approveClaim);

        // Admin: reject a claim — keep as is (POST /api/claims/admin/:claimId/reject)
        this.#router.post('/admin/:claimId/reject', this.#controller.rejectClaim);
    }

    getRouter() {
        return this.#router;
    }
}

module.exports = ClaimRouter;
