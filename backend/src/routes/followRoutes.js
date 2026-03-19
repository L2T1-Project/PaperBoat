const { Router } = require('express');
const FollowController = require('../controllers/followController.js');

class FollowRouter {
    constructor() {
        this.router = Router();
        this.followController = new FollowController();
        this.#initRoutes();
    }

    #initRoutes() {
        // NOTE: /status/:userId, /followers, /following must come before /:userId
        this.router.get('/status/:userId', this.followController.getFollowStatus);
        this.router.get('/followers',      this.followController.getMyFollowers);
        this.router.get('/following',      this.followController.getMyFollowing);
        this.router.post('/:userId',       this.followController.followResearcher);
        this.router.delete('/:userId',     this.followController.unfollowResearcher);
    }

    getRouter() {
        return this.router;
    }
}

module.exports = FollowRouter;
