const { Router } = require('express');
const TopicController = require('../controllers/topicController.js');

class TopicRouter {
    constructor() {
        this.router = Router();
        this.topicController = new TopicController();
        this.#initRoutes();
    }

    #initRoutes() {
        this.router.post('/domains',              this.topicController.createDomain);
        this.router.get('/domains',               this.topicController.getAllDomains);
        this.router.get('/domains/:id',           this.topicController.getDomainById);
        this.router.put('/domains/:id',           this.topicController.updateDomain);
        this.router.delete('/domains/:id',        this.topicController.deleteDomain);
        this.router.get('/domains/:id/fields',    this.topicController.getFieldsByDomain);

        this.router.post('/fields',               this.topicController.createField);
        this.router.get('/fields',                this.topicController.getAllFields);
        this.router.get('/fields/:id',            this.topicController.getFieldById);
        this.router.put('/fields/:id',            this.topicController.updateField);
        this.router.delete('/fields/:id',         this.topicController.deleteField);
        this.router.get('/fields/:id/topics',     this.topicController.getTopicsByField);

        this.router.post('/',                     this.topicController.createTopic);
        this.router.get('/',                      this.topicController.getAllTopics);
        this.router.get('/:id',                   this.topicController.getTopicById);
        this.router.put('/:id',                   this.topicController.updateTopic);
        this.router.delete('/:id',                this.topicController.deleteTopic);
    }

    getRouter() {
        return this.router;
    }
}

module.exports = TopicRouter;
