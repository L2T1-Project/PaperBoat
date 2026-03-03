const { Router } = require('express');
const PaperController = require('../controllers/paperController.js');

class PaperRouter {
    constructor() {
        this.router = Router();
        this.PaperController = new PaperController();
        this.#initRoutes();
    }

    #initRoutes() {
        this.router.post('/',       this.PaperController.createPaper);
        this.router.get('/',        this.PaperController.getAllPapers);
        this.router.get('/:id',     this.PaperController.getPaperById);
        this.router.put('/:id',     this.PaperController.updatePaper);
        this.router.delete('/:id',  this.PaperController.deletePaper);

        this.router.get('/:id/cited-by',                 this.PaperController.getCitedBy);
        this.router.get('/:id/references',               this.PaperController.getReferences);
        this.router.post('/:id/citations',               this.PaperController.addCitation);
        this.router.delete('/:id/citations/:citedId',    this.PaperController.removeCitation);

        this.router.get('/:id/topics',                   this.PaperController.getTopics);
        this.router.post('/:id/topics',                  this.PaperController.addTopic);
        this.router.delete('/:id/topics/:topicId',       this.PaperController.removeTopic);
    }

    getRouter() {
        return this.router;
    }
}

module.exports = PaperRouter;