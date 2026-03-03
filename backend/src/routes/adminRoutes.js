const express = require('express');
const AdminController = require('../controllers/adminController.js');

class AdminRouter {
    #router;
    #controller;

    constructor() {
        this.#router = express.Router();
        this.#controller = new AdminController();
        this.#initRoutes();
    }

    #initRoutes() {
        this.#router.post('/',     this.#controller.promoteUser);
        this.#router.get('/',      this.#controller.getAllAdmins);
        this.#router.get('/:id',   this.#controller.getAdminById);
        this.#router.delete('/:id',this.#controller.demoteAdmin);
    }

    getRouter() {
        return this.#router;
    }
}

module.exports = AdminRouter;
