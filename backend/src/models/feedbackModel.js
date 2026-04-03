const DB_Connection = require("../database/db.js");

class FeedbackModel {
  constructor() {
    this.db = DB_Connection.getInstance();
    this.PAPER_SUGGESTION_SUBJECT = 'PAPER_SUGGESTION';
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
      WHERE COALESCE(f.subject, '') <> $3
      ORDER BY f.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset, this.PAPER_SUGGESTION_SUBJECT]);
    return result.rows;
  };

  getFeedbackBySender = async (senderId) => {
    const result = await this.db.query_executor(`
      SELECT id, subject, message, created_at, response, responded_at
      FROM feedback
      WHERE sender_id = $1
        AND COALESCE(subject, '') <> $2
      ORDER BY created_at DESC
    `, [senderId, this.PAPER_SUGGESTION_SUBJECT]);
    return result.rows;
  };

  createPaperSuggestion = async (senderId, adminUserId, payload) => {
    const result = await this.db.query_executor(
      `INSERT INTO feedback (sender_id, receiver_id, subject, message)
       VALUES ($1, $2, $3, $4)
       RETURNING id, sender_id, receiver_id, subject, message, created_at`,
      [
        senderId,
        adminUserId,
        this.PAPER_SUGGESTION_SUBJECT,
        JSON.stringify(payload),
      ],
    );
    return result.rows[0];
  };

  getPaperSuggestions = async (status = 'pending', limit = 50, offset = 0) => {
    const result = await this.db.query_executor(
      `SELECT
         f.id,
         f.sender_id,
         f.receiver_id,
         f.message,
         f.created_at,
         f.response,
         f.responded_at,
         u.full_name AS sender_name,
         u.email AS sender_email,
         CASE
           WHEN f.response IS NULL THEN 'pending'
           WHEN f.response LIKE 'APPROVED::%' THEN 'approved'
           ELSE 'rejected'
         END AS suggestion_status
       FROM feedback f
       JOIN "user" u ON u.id = f.sender_id
       WHERE f.subject = $1
         AND (
           $2 = 'all'
           OR ($2 = 'pending' AND f.response IS NULL)
           OR ($2 = 'approved' AND f.response LIKE 'APPROVED::%')
           OR ($2 = 'rejected' AND f.response IS NOT NULL AND f.response NOT LIKE 'APPROVED::%')
         )
       ORDER BY f.created_at DESC
       LIMIT $3 OFFSET $4`,
      [this.PAPER_SUGGESTION_SUBJECT, status, limit, offset],
    );
    return result.rows;
  };

  getPaperSuggestionById = async (id) => {
    const result = await this.db.query_executor(
      `SELECT
         f.id,
         f.sender_id,
         f.receiver_id,
         f.message,
         f.created_at,
         f.response,
         f.responded_at,
         u.full_name AS sender_name,
         u.email AS sender_email,
         CASE
           WHEN f.response IS NULL THEN 'pending'
           WHEN f.response LIKE 'APPROVED::%' THEN 'approved'
           ELSE 'rejected'
         END AS suggestion_status
       FROM feedback f
       JOIN "user" u ON u.id = f.sender_id
       WHERE f.subject = $1 AND f.id = $2`,
      [this.PAPER_SUGGESTION_SUBJECT, id],
    );
    return result.rows[0] || null;
  };

  getPaperSuggestionsBySender = async (senderId) => {
    const result = await this.db.query_executor(
      `SELECT
         id,
         sender_id,
         receiver_id,
         message,
         created_at,
         response,
         responded_at,
         CASE
           WHEN response IS NULL THEN 'pending'
           WHEN response LIKE 'APPROVED::%' THEN 'approved'
           ELSE 'rejected'
         END AS suggestion_status
       FROM feedback
       WHERE subject = $1 AND sender_id = $2
       ORDER BY created_at DESC`,
      [this.PAPER_SUGGESTION_SUBJECT, senderId],
    );
    return result.rows;
  };

  findPendingPaperSuggestionDuplicates = async (title, doi = null) => {
    const params = [this.PAPER_SUGGESTION_SUBJECT, title.trim().toLowerCase()];
    let doiClause = '';
    if (doi) {
      params.push(doi.trim().toLowerCase());
      doiClause = `OR LOWER(COALESCE(f.message::jsonb ->> 'doi', '')) = $3`;
    }

    const result = await this.db.query_executor(
      `SELECT
         f.id,
         f.created_at,
         u.full_name AS sender_name,
         f.message,
         f.response
       FROM feedback f
       JOIN "user" u ON u.id = f.sender_id
       WHERE f.subject = $1
         AND f.response IS NULL
         AND (
           LOWER(COALESCE(f.message::jsonb ->> 'title', '')) = $2
           ${doiClause}
         )
       ORDER BY f.created_at DESC`,
      params,
    );

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
