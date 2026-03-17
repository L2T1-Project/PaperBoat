const { Router } = require('express');
const NotificationController = require('../controllers/notificationController.js');

class NotificationRouter {
    constructor() {
        this.router = Router();
        this.notificationController = new NotificationController();
        this.#initRoutes();
    }

    #initRoutes() {
        this.router.get('/user/:userId',                         this.notificationController.getNotificationsByUser);
        this.router.patch('/read-all',                          this.notificationController.markAllAsRead);

        this.router.post('/',                                   this.notificationController.createNotification);
        this.router.get('/:id',                                 this.notificationController.getNotificationById);
        this.router.delete('/:id',                              this.notificationController.deleteNotification);

        this.router.post('/:id/receivers',                      this.notificationController.addReceiver);

        this.router.patch('/:id/read',                         this.notificationController.markAsRead);

        this.router.post('/:id/subtypes/user',                  this.notificationController.createUserNotification);
        this.router.get('/:id/subtypes/user',                   this.notificationController.getUserNotificationById);

        this.router.post('/:id/subtypes/paper',                 this.notificationController.createPaperNotification);
        this.router.get('/:id/subtypes/paper',                  this.notificationController.getPaperNotificationById);

        this.router.post('/:id/subtypes/review',                this.notificationController.createReviewNotification);
        this.router.get('/:id/subtypes/review',                 this.notificationController.getReviewNotificationById);
    }

    getRouter() {
        return this.router;
    }
}

module.exports = NotificationRouter;
