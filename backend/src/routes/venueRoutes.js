const express = require('express');
const VenueController = require('../controllers/venueController.js');

class VenueRouter {
    #router;
    #controller;

    constructor() {
        this.#router = express.Router();
        this.#controller = new VenueController();
        this.#initRoutes();
    }

    #initRoutes() {
        this.#router.post('/publishers',          this.#controller.createPublisher);
        this.#router.get('/publishers',           this.#controller.getAllPublishers);
        this.#router.get('/publishers/:id',       this.#controller.getPublisherById);
        this.#router.put('/publishers/:id',       this.#controller.updatePublisher);
        this.#router.delete('/publishers/:id',    this.#controller.deletePublisher);

        this.#router.get('/lookup/issn',          this.#controller.lookupByIssn);
        this.#router.get('/lookup/name',          this.#controller.lookupByName);

        this.#router.post('/',                    this.#controller.createVenue);
        this.#router.get('/',                     this.#controller.getAllVenues);
        this.#router.get('/:id/stats',            this.#controller.getVenueStatsHandler);
        this.#router.get('/:id/papers',           this.#controller.getVenuePapers);
        this.#router.get('/:id/authors',          this.#controller.getVenueAuthors);
        this.#router.get('/:id',                  this.#controller.getVenueById);
        this.#router.put('/:id',                  this.#controller.updateVenue);
        this.#router.delete('/:id',               this.#controller.deleteVenue);
    }

    getRouter() {
        return this.#router;
    }
}

module.exports = VenueRouter;
