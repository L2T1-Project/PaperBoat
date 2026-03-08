const { Router } = require('express');
const ResearcherController = require('../controllers/researcherController.js');

class ResearcherRouter {
    constructor() {
        this.router = Router();
        this.researcherController = new ResearcherController();
        this.#initRoutes();
    }

    #initRoutes() {
        this.router.post('/',  this.researcherController.createResearcher);
        this.router.get('/',  this.researcherController.getAllResearchers);
        this.router.get('/:id',  this.researcherController.getResearcherById);
        this.router.delete('/:id', this.researcherController.deleteResearcher);

        this.router.get('/:id/claims',  this.researcherController.getPaperClaimsByResearcher);
        this.router.post('/:id/claims',  this.researcherController.createPaperClaim);
        this.router.delete('/:id/claims/:paperId',  this.researcherController.deletePaperClaim);

        this.router.get('/:id/institutes', this.researcherController.getInstituteHistory);
        this.router.post('/:id/institutes',  this.researcherController.addInstituteHistory);
        this.router.put('/:id/institutes/:instituteId', this.researcherController.updateInstituteHistory);
        this.router.delete('/:id/institutes/:instituteId',  this.researcherController.removeInstituteHistory);
    }

    getRouter() {
        return this.router;
    }
}

module.exports = ResearcherRouter;
