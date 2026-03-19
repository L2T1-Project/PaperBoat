const FeedbackModel = require('../models/feedbackModel.js');
const NotificationModel = require('../models/notificationModel.js');
const DB_Connection = require('../database/db.js');

class FeedbackController {
  constructor() {
    this.feedbackModel = new FeedbackModel();
    this.notificationModel = new NotificationModel();
    this.db = DB_Connection.getInstance();
  }

  submitFeedback = async (req, res) => {
    try {
      const senderId = req.auth.userId;
      const { subject, message } = req.body;
      if (!message?.trim()) {
        return res.status(400).json({ success: false, message: 'Message is required.' });
      }
      const adminUserId = await this.feedbackModel.getAnyAdminUserId();
      if (!adminUserId) {
        return res.status(503).json({ success: false, message: 'No admin available.' });
      }
      const feedback = await this.feedbackModel.createFeedback(
        senderId, adminUserId,
        subject?.trim() || null,
        message.trim()
      );
      const userResult = await this.db.query_executor(
        `SELECT full_name FROM "user" WHERE id = $1`, [senderId]
      );
      const senderName = userResult.rows[0]?.full_name ?? 'A user';
      this.notificationModel.notifyAdminNewFeedback(feedback.id, adminUserId, senderName)
        .catch(err => console.error('feedback admin notif error:', err));
      res.status(201).json({ success: true, data: feedback });
    } catch (err) {
      console.error('submitFeedback error:', err);
      res.status(500).json({ success: false, message: 'Failed to submit feedback.' });
    }
  };

  getAllFeedback = async (req, res) => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required.' });
    }
    try {
      const { page = 1, limit = 50 } = req.query;
      const offset = (Number(page) - 1) * Number(limit);
      const feedbacks = await this.feedbackModel.getAllFeedback(Number(limit), offset);
      res.json({ success: true, data: feedbacks });
    } catch (err) {
      console.error('getAllFeedback error:', err);
      res.status(500).json({ success: false, message: 'Failed to fetch feedback.' });
    }
  };

  getMyFeedback = async (req, res) => {
    try {
      const feedbacks = await this.feedbackModel.getFeedbackBySender(req.auth.userId);
      res.json({ success: true, data: feedbacks });
    } catch (err) {
      console.error('getMyFeedback error:', err);
      res.status(500).json({ success: false, message: 'Failed to fetch your feedback.' });
    }
  };

  respondToFeedback = async (req, res) => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required.' });
    }
    try {
      const { response } = req.body;
      if (!response?.trim()) {
        return res.status(400).json({ success: false, message: 'Response text is required.' });
      }
      const updated = await this.feedbackModel.respondToFeedback(req.params.id, response.trim());
      if (!updated) return res.status(404).json({ success: false, message: 'Feedback not found.' });
      this.notificationModel.notifyFeedbackResponse(updated.id, updated.sender_id)
        .catch(err => console.error('feedback response notif error:', err));
      res.json({ success: true, data: updated });
    } catch (err) {
      console.error('respondToFeedback error:', err);
      res.status(500).json({ success: false, message: 'Failed to respond to feedback.' });
    }
  };
}

module.exports = FeedbackController;
