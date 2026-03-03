const express = require('express');
const VenueUserController = require('../controllers/venueUserController.js');

class VenueUserRouter {
    #router;
    #controller;

    constructor() {
        this.#router = express.Router();
        this.#controller = new VenueUserController();
        this.#initRoutes();
    }

    #initRoutes() {
        this.#router.post('/',      this.#controller.createVenueUser);
        this.#router.get('/',       this.#controller.getAllVenueUsers);
        this.#router.get('/:id',    this.#controller.getVenueUserById);
        this.#router.delete('/:id', this.#controller.deleteVenueUser);
    }

    getRouter() {
        return this.#router;
    }
}

module.exports = VenueUserRouter;
