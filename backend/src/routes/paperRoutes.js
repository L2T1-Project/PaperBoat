const { Router } = require('express');
const PaperController = require('../controllers/paperController.js');

class PaperRouter {
    constructor() {
        this.router = Router();
        this.PaperController = new PaperController();
        this.#initRoutes();
    }

    #initRoutes() {
        // Specific routes (before :id to avoid conflicts)
        this.router.get('/search',                        this.PaperController.searchPapers);
        this.router.get('/domain/:domainId',              this.PaperController.getPapersByDomain);
        this.router.get('/field/:fieldId',                this.PaperController.getPapersByField);
        this.router.get('/topic/:topicId',                this.PaperController.getPapersByTopic);

        // General CRUD
        this.router.post('/',                             this.PaperController.createPaper);
        this.router.get('/',                              this.PaperController.getAllPapers);
        this.router.get('/:id',                           this.PaperController.getPaperById);
        this.router.put('/:id',                           this.PaperController.updatePaper);
        this.router.delete('/:id',                        this.PaperController.deletePaper);

        // Citations and references
        this.router.get('/:id/cited-by',                  this.PaperController.getCitedBy);
        this.router.get('/:id/references',                this.PaperController.getReferences);
        this.router.post('/:id/citations',                this.PaperController.addCitation);
        this.router.delete('/:id/citations/:citedId',     this.PaperController.removeCitation);

        // Paper topics
        this.router.get('/:id/topics',                    this.PaperController.getPaperTopics);
        this.router.post('/:id/topics',                   this.PaperController.addPaperTopic);
        this.router.delete('/:id/topics/:topicId',        this.PaperController.removePaperTopic);
    }

    getRouter() {
        return this.router;
    }
}

module.exports = PaperRouter;