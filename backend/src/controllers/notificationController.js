const NotificationModel = require('../models/notificationModel.js');

class NotificationController {
    constructor() {
        this.notificationModel = new NotificationModel();
    }

    createNotification = async (req, res) => {
        try {
            const { message } = req.body;
            if (!message) {
                return res.status(400).json({ success: false, message: 'message is required.' });
            }
            const notification = await this.notificationModel.createNotification(message);
            return res.status(201).json({ success: true, message: 'Notification created.', data: notification });
        } catch (error) {
            console.error('[createNotification]', error.message);
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    }

    getNotificationById = async (req, res) => {
        try {
            const { id } = req.params;
            if (isNaN(id)) {
                return res.status(400).json({ success: false, message: 'id must be a number.' });
            }
            const notification = await this.notificationModel.getNotificationById(Number(id));
            if (!notification) {
                return res.status(404).json({ success: false, message: `Notification with id ${id} not found.` });
            }
            return res.status(200).json({ success: true, data: notification });
        } catch (error) {
            console.error('[getNotificationById]', error.message);
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    }

    deleteNotification = async (req, res) => {
        try {
            const { id } = req.params;
            if (isNaN(id)) {
                return res.status(400).json({ success: false, message: 'id must be a number.' });
            }
            const removed = await this.notificationModel.deleteNotification(Number(id));
            if (!removed) {
                return res.status(404).json({ success: false, message: `Notification with id ${id} not found.` });
            }
            return res.status(200).json({ success: true, message: 'Notification deleted.', data: removed });
        } catch (error) {
            console.error('[deleteNotification]', error.message);
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    }

    addReceiver = async (req, res) => {
        try {
            const { id } = req.params;
            const { user_id } = req.body;
            if (isNaN(id) || !user_id || isNaN(user_id)) {
                return res.status(400).json({ success: false, message: 'id (param) and user_id (body) must be numbers.' });
            }
            const receiver = await this.notificationModel.addReceiver(Number(id), Number(user_id));
            return res.status(201).json({ success: true, message: 'Receiver added.', data: receiver });
        } catch (error) {
            if (error.code === '23505') return res.status(409).json({ success: false, message: 'User is already a receiver of this notification.' });
            if (error.code === '23503') return res.status(400).json({ success: false, message: 'Notification or user not found.' });
            console.error('[addReceiver]', error.message);
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    }

    getNotificationsByUser = async (req, res) => {
        try {
            const { userId } = req.params;
            if (isNaN(userId)) {
                return res.status(400).json({ success: false, message: 'userId must be a number.' });
            }
            const notifications = await this.notificationModel.getNotificationsByUser(Number(userId));
            return res.status(200).json({ success: true, count: notifications.length, data: notifications });
        } catch (error) {
            console.error('[getNotificationsByUser]', error.message);
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    }

    markAsRead = async (req, res) => {
        try {
            const { id } = req.params;
            const userId = req.auth?.userId;
            if (isNaN(id) || !userId || isNaN(userId)) {
                return res.status(400).json({ success: false, message: 'Invalid notification id or unauthenticated request.' });
            }
            const updated = await this.notificationModel.markAsRead(Number(id), Number(userId));
            if (!updated) {
                return res.status(404).json({ success: false, message: 'Notification receiver record not found.' });
            }
            return res.status(200).json({ success: true, message: 'Marked as read.', data: updated });
        } catch (error) {
            console.error('[markAsRead]', error.message);
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    }

    markAllAsRead = async (req, res) => {
        try {
            const userId = req.auth?.userId;
            if (!userId || isNaN(userId)) {
                return res.status(401).json({ success: false, message: 'Unauthenticated request.' });
            }
            const updated = await this.notificationModel.markAllAsRead(Number(userId));
            return res.status(200).json({ success: true, message: 'All notifications marked as read.', count: updated.length });
        } catch (error) {
            console.error('[markAllAsRead]', error.message);
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    }

    createUserNotification = async (req, res) => {
        try {
            const { id } = req.params;
            const { triggered_user_id } = req.body;
            if (isNaN(id) || !triggered_user_id || isNaN(triggered_user_id)) {
                return res.status(400).json({ success: false, message: 'id (param) and triggered_user_id (body) must be numbers.' });
            }
            const subtype = await this.notificationModel.createUserNotification(Number(id), Number(triggered_user_id));
            return res.status(201).json({ success: true, message: 'User notification subtype created.', data: subtype });
        } catch (error) {
            if (error.code === '23505') return res.status(409).json({ success: false, message: 'User notification subtype already exists for this notification.' });
            if (error.code === '23503') return res.status(400).json({ success: false, message: 'Notification or user not found.' });
            console.error('[createUserNotification]', error.message);
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    }

    getUserNotificationById = async (req, res) => {
        try {
            const { id } = req.params;
            if (isNaN(id)) {
                return res.status(400).json({ success: false, message: 'id must be a number.' });
            }
            const subtype = await this.notificationModel.getUserNotificationById(Number(id));
            if (!subtype) return res.status(404).json({ success: false, message: 'User notification not found.' });
            return res.status(200).json({ success: true, data: subtype });
        } catch (error) {
            console.error('[getUserNotificationById]', error.message);
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    }

    createPaperNotification = async (req, res) => {
        try {
            const { id } = req.params;
            const { paper_id } = req.body;
            if (isNaN(id) || !paper_id || isNaN(paper_id)) {
                return res.status(400).json({ success: false, message: 'id (param) and paper_id (body) must be numbers.' });
            }
            const subtype = await this.notificationModel.createPaperNotification(Number(id), Number(paper_id));
            return res.status(201).json({ success: true, message: 'Paper notification subtype created.', data: subtype });
        } catch (error) {
            if (error.code === '23505') return res.status(409).json({ success: false, message: 'Paper notification subtype already exists for this notification.' });
            if (error.code === '23503') return res.status(400).json({ success: false, message: 'Notification or paper not found.' });
            console.error('[createPaperNotification]', error.message);
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    }

    getPaperNotificationById = async (req, res) => {
        try {
            const { id } = req.params;
            if (isNaN(id)) {
                return res.status(400).json({ success: false, message: 'id must be a number.' });
            }
            const subtype = await this.notificationModel.getPaperNotificationById(Number(id));
            if (!subtype) return res.status(404).json({ success: false, message: 'Paper notification not found.' });
            return res.status(200).json({ success: true, data: subtype });
        } catch (error) {
            console.error('[getPaperNotificationById]', error.message);
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    }

    createReviewNotification = async (req, res) => {
        try {
            const { id } = req.params;
            const { review_id } = req.body;
            if (isNaN(id) || !review_id || isNaN(review_id)) {
                return res.status(400).json({ success: false, message: 'id (param) and review_id (body) must be numbers.' });
            }
            const subtype = await this.notificationModel.createReviewNotification(Number(id), Number(review_id));
            return res.status(201).json({ success: true, message: 'Review notification subtype created.', data: subtype });
        } catch (error) {
            if (error.code === '23505') return res.status(409).json({ success: false, message: 'Review notification subtype already exists for this notification.' });
            if (error.code === '23503') return res.status(400).json({ success: false, message: 'Notification or review not found.' });
            console.error('[createReviewNotification]', error.message);
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    }

    getReviewNotificationById = async (req, res) => {
        try {
            const { id } = req.params;
            if (isNaN(id)) {
                return res.status(400).json({ success: false, message: 'id must be a number.' });
            }
            const subtype = await this.notificationModel.getReviewNotificationById(Number(id));
            if (!subtype) return res.status(404).json({ success: false, message: 'Review notification not found.' });
            return res.status(200).json({ success: true, data: subtype });
        } catch (error) {
            console.error('[getReviewNotificationById]', error.message);
            return res.status(500).json({ success: false, message: 'Internal server error.' });
        }
    }

    // ── Enhanced notification endpoint ────────────────────────────────────

    getNotifications = async (req, res) => {
        try {
            const userId = req.auth.userId;
            const limit  = Math.min(Number(req.query.limit) || 20, 50);
            const [notifications, unreadCount] = await Promise.all([
                this.notificationModel.getUserNotificationsEnhanced(userId, limit),
                this.notificationModel.getUnreadCount(userId),
            ]);
            res.json({ success: true, data: { notifications, unreadCount } });
        } catch (err) {
            console.error('getNotifications error:', err);
            res.status(500).json({ success: false, message: 'Failed to fetch notifications.' });
        }
    }
}

module.exports = NotificationController;
