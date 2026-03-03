const { Router } = require('express');
const UserController = require('../controllers/userController.js');

class UserRouter {
    constructor() {
        this.router = Router();
        this.userController = new UserController();
        this.#initRoutes();
    }

    #initRoutes() {
        this.router.post('/',       this.userController.createUser);
        this.router.get('/',        this.userController.getAllUsers);
        this.router.get('/:id',     this.userController.getUserById);
        this.router.put('/:id',     this.userController.updateUser);
        this.router.delete('/:id',  this.userController.deleteUser);

        this.router.post('/:id/follow',              this.userController.followUser);
        this.router.delete('/:id/follow',            this.userController.unfollowUser);
        this.router.get('/:id/followers',            this.userController.getFollowers);
        this.router.get('/:id/following',            this.userController.getFollowing);

        this.router.get('/status/all',               this.userController.getAllStatuses);

        this.router.get('/:id/library',              this.userController.getUserLibrary);
        this.router.post('/:id/library',             this.userController.addToUserLibrary);
        this.router.delete('/:id/library/:paperId',  this.userController.removeFromUserLibrary);
    }

    getRouter() {
        return this.router;
    }
}

module.exports = UserRouter;
