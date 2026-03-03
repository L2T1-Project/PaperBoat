const { Router } = require('express');
const InstituteController = require('../controllers/instituteController.js');

class InstituteRouter {
    constructor() {
        this.router = Router();
        this.instituteController = new InstituteController();
        this.#initRoutes();
    }

    #initRoutes() {
        this.router.post('/',  this.instituteController.createInstitute);
        this.router.get('/', this.instituteController.getAllInstitutes);
        this.router.get('/:id', this.instituteController.getInstituteById);
        this.router.put('/:id', this.instituteController.updateInstitute);
        this.router.delete('/:id', this.instituteController.deleteInstitute);

        this.router.get('/:id/researchers', this.instituteController.getResearchersByInstitute);
    }

    getRouter() {
        return this.router;
    }
}

module.exports = InstituteRouter;
