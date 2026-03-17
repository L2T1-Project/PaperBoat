const DB_Connection = require("../database/db.js");

class NotificationModel {
  constructor() {
    this.db = DB_Connection.getInstance();
  }

  createNotification = async (message) => {
    const query = `
            INSERT INTO notification (message)
            VALUES ($1)
            RETURNING *;
        `;
    const result = await this.db.query_executor(query, [message]);
    return result.rows[0];
  };

  getNotificationById = async (notificationId) => {
    const query = `SELECT * FROM notification WHERE id = $1;`;
    const result = await this.db.query_executor(query, [notificationId]);
    return result.rows[0] || null;
  };

  deleteNotification = async (notificationId) => {
    const query = `DELETE FROM notification WHERE id = $1 RETURNING id;`;
    const result = await this.db.query_executor(query, [notificationId]);
    return result.rows[0] || null;
  };

  addReceiver = async (notificationId, userId) => {
    const query = `
            INSERT INTO notification_receiver (notification_id, user_id)
            VALUES ($1, $2)
            RETURNING *;
        `;
    const result = await this.db.query_executor(query, [
      notificationId,
      userId,
    ]);
    return result.rows[0];
  };

  getNotificationsByUser = async (userId) => {
    const query = `
            SELECT
                n.id,
                n.message,
                n.created_at,
                nr.is_read,
                -- Determine subtype and navigation target
                CASE
                    WHEN rn.review_id IS NOT NULL THEN 'review'
                    WHEN pn.paper_id  IS NOT NULL THEN 'paper'
                    WHEN un.triggered_user_id IS NOT NULL THEN 'user'
                    ELSE NULL
                END AS link_type,
                -- For review & paper notifications, surface the paper id
                COALESCE(r.paper_id, parent_r.paper_id, pn.paper_id) AS link_paper_id,
                -- For user notifications, surface the author id (via researcher)
                a.id AS link_author_id
            FROM notification_receiver nr
            JOIN notification n ON n.id = nr.notification_id
            LEFT JOIN review_notification rn ON rn.notification_id = n.id
            LEFT JOIN review r               ON r.id = rn.review_id
            -- one level up covers reply notifications
            LEFT JOIN review parent_r        ON parent_r.id = r.parent_review_id
            LEFT JOIN paper_notification pn  ON pn.notification_id = n.id
            LEFT JOIN user_notification un   ON un.notification_id = n.id
            LEFT JOIN researcher res         ON res.user_id = un.triggered_user_id
            LEFT JOIN author a               ON a.id = res.author_id
            WHERE nr.user_id = $1
            ORDER BY n.created_at DESC;
        `;
    const result = await this.db.query_executor(query, [userId]);
    return result.rows;
  };

  markAsRead = async (notificationId, userId) => {
    const query = `
            UPDATE notification_receiver
            SET is_read = TRUE
            WHERE notification_id = $1 AND user_id = $2
            RETURNING *;
        `;
    const result = await this.db.query_executor(query, [
      notificationId,
      userId,
    ]);
    return result.rows[0] || null;
  };

  markAllAsRead = async (userId) => {
    const query = `
            UPDATE notification_receiver
            SET is_read = TRUE
            WHERE user_id = $1
            RETURNING notification_id;
        `;
    const result = await this.db.query_executor(query, [userId]);
    return result.rows;
  };

  createUserNotification = async (notificationId, triggeredUserId) => {
    const query = `
            INSERT INTO user_notification (notification_id, triggered_user_id)
            VALUES ($1, $2)
            RETURNING *;
        `;
    const result = await this.db.query_executor(query, [
      notificationId,
      triggeredUserId,
    ]);
    return result.rows[0];
  };

  getUserNotificationById = async (notificationId) => {
    const query = `
            SELECT un.*, n.message, n.created_at
            FROM user_notification un
            JOIN notification n ON n.id = un.notification_id
            WHERE un.notification_id = $1;
        `;
    const result = await this.db.query_executor(query, [notificationId]);
    return result.rows[0] || null;
  };

  createPaperNotification = async (notificationId, paperId) => {
    const query = `
            INSERT INTO paper_notification (notification_id, paper_id)
            VALUES ($1, $2)
            RETURNING *;
        `;
    const result = await this.db.query_executor(query, [
      notificationId,
      paperId,
    ]);
    return result.rows[0];
  };

  getPaperNotificationById = async (notificationId) => {
    const query = `
            SELECT pn.*, n.message, n.created_at
            FROM paper_notification pn
            JOIN notification n ON n.id = pn.notification_id
            WHERE pn.notification_id = $1;
        `;
    const result = await this.db.query_executor(query, [notificationId]);
    return result.rows[0] || null;
  };

  createReviewNotification = async (notificationId, reviewId) => {
    const query = `
            INSERT INTO review_notification (notification_id, review_id)
            VALUES ($1, $2)
            RETURNING *;
        `;
    const result = await this.db.query_executor(query, [
      notificationId,
      reviewId,
    ]);
    return result.rows[0];
  };

  getReviewNotificationById = async (notificationId) => {
    const query = `
            SELECT rn.*, n.message, n.created_at
            FROM review_notification rn
            JOIN notification n ON n.id = rn.notification_id
            WHERE rn.notification_id = $1;
        `;
    const result = await this.db.query_executor(query, [notificationId]);
    return result.rows[0] || null;
  };
}

module.exports = NotificationModel;
