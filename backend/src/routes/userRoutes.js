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
    }

    getRouter() {
        return this.router;
    }
}

module.exports = UserRouter;
