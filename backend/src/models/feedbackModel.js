const DB_Connection = require("../database/db.js");

class FeedbackModel {
  constructor() {
    this.db = DB_Connection.getInstance();
  }

  getAnyAdminUserId = async () => {
    const result = await this.db.query_executor(`SELECT user_id FROM admin LIMIT 1`);
    return result.rows[0]?.user_id ?? null;
  };

  createFeedback = async (senderId, adminUserId, subject, message) => {
    const result = await this.db.query_executor(
      `INSERT INTO feedback (sender_id, receiver_id, subject, message)
       VALUES ($1, $2, $3, $4)
       RETURNING id, sender_id, receiver_id, subject, message, created_at`,
      [senderId, adminUserId, subject, message]
    );
    return result.rows[0];
  };

  getAllFeedback = async (limit = 50, offset = 0) => {
    const result = await this.db.query_executor(`
      SELECT
        f.id, f.subject, f.message, f.created_at,
        f.response, f.responded_at,
        u.id              AS sender_id,
        u.full_name       AS sender_name,
        u.email           AS sender_email,
        u.profile_pic_url AS sender_pic,
        CASE
          WHEN r.user_id  IS NOT NULL THEN 'researcher'
          WHEN vu.user_id IS NOT NULL THEN 'venue_user'
          WHEN a.user_id  IS NOT NULL THEN 'admin'
          ELSE 'user'
        END AS sender_role
      FROM feedback f
      JOIN "user" u       ON u.id  = f.sender_id
      LEFT JOIN researcher  r  ON r.user_id  = f.sender_id
      LEFT JOIN venue_user  vu ON vu.user_id = f.sender_id
      LEFT JOIN admin       a  ON a.user_id  = f.sender_id
      ORDER BY f.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);
    return result.rows;
  };

  getFeedbackBySender = async (senderId) => {
    const result = await this.db.query_executor(`
      SELECT id, subject, message, created_at, response, responded_at
      FROM feedback
      WHERE sender_id = $1
      ORDER BY created_at DESC
    `, [senderId]);
    return result.rows;
  };

  respondToFeedback = async (feedbackId, responseText) => {
    const result = await this.db.query_executor(`
      UPDATE feedback
      SET response = $1, responded_at = now()
      WHERE id = $2
      RETURNING id, sender_id, response, responded_at
    `, [responseText, feedbackId]);
    return result.rows[0];
  };
}

module.exports = FeedbackModel;
