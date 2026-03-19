const { Router } = require('express');
const LibraryController = require('../controllers/libraryController.js');

class LibraryRouter {
    constructor() {
        this.router = Router();
        this.libraryController = new LibraryController();
        this.#initRoutes();
    }

    #initRoutes() {
        // NOTE: /status/:paperId must come before /:paperId
        this.router.get('/',                 this.libraryController.getSavedPapers);
        this.router.get('/status/:paperId',  this.libraryController.checkSaved);
        this.router.post('/:paperId',        this.libraryController.savePaper);
        this.router.delete('/:paperId',      this.libraryController.unsavePaper);
    }

    getRouter() {
        return this.router;
    }
}

module.exports = LibraryRouter;
