const DB_Connection = require("../database/db.js");

class UserModel {
  constructor() {
    this.db = DB_Connection.getInstance();
  }

  createUser = async (payload) => {
    const {
      username,
      full_name,
      email,
      password_hash,
      phone_number = null,
      status_id,
      bio = null,
    } = payload;

    const query = `
            INSERT INTO "user"
                (username, full_name, email, password_hash, phone_number, status_id, bio)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, username, full_name, email, phone_number, profile_pic_url, status_id, created_at, bio;
        `;

    const params = [
      username,
      full_name,
      email,
      password_hash,
      phone_number,
      status_id,
      bio,
    ];
    const result = await this.db.query_executor(query, params);
    return result.rows[0];
  };

  getAllUsers = async () => {
    const query = `
            SELECT
                u.id,
                u.username,
                u.full_name,
                u.email,
                u.phone_number,
                u.profile_pic_url,
                u.status_id,
                s.status_name,
                u.created_at,
                u.bio
            FROM "user" u
            JOIN status s ON s.id = u.status_id
            ORDER BY u.created_at DESC;
        `;

    const result = await this.db.query_executor(query);
    return result.rows;
  };

  getUserById = async (id) => {
    const query = `
            SELECT
                u.id,
                u.username,
                u.full_name,
                u.email,
                u.phone_number,
                u.profile_pic_url,
                u.status_id,
                s.status_name,
                u.created_at,
                u.bio
            FROM "user" u
            JOIN status s ON s.id = u.status_id
            WHERE u.id = $1;
        `;

    const params = [id];
    const result = await this.db.query_executor(query, params);
    return result.rows[0] || null;
  };

  getUserDisplayNameById = async (id) => {
    const query = `
            SELECT id AS user_id, username, full_name
            FROM "user"
            WHERE id = $1;
        `;

    const result = await this.db.query_executor(query, [id]);
    return result.rows[0] || null;
  };

  getUserByEmail = async (email) => {
    const query = `
            SELECT *
            FROM "user"
            WHERE email = $1;
        `;

    const params = [email];
    const result = await this.db.query_executor(query, params);
    return result.rows[0] || null;
  };

  getUserByUsername = async (username) => {
    const query = `
            SELECT
                u.id,
                u.username,
                u.full_name,
                u.email,
                u.phone_number,
                u.profile_pic_url,
                u.status_id,
                s.status_name,
                u.created_at,
                u.bio
            FROM "user" u
            JOIN status s ON s.id = u.status_id
            WHERE u.username = $1;
        `;

    const params = [username];
    const result = await this.db.query_executor(query, params);
    return result.rows[0] || null;
  };

  updateUser = async (id, payload) => {
    const {
      username,
      full_name,
      email,
      phone_number = null,
      profile_pic_url = null,
      bio = null,
    } = payload;

    const query = `
            UPDATE "user"
            SET
                username = $2,
                full_name = $3,
                email = $4,
                phone_number = $5,
                profile_pic_url = $6,
                bio = $7
            WHERE id = $1
            RETURNING id, username, full_name, email, phone_number, profile_pic_url, status_id, created_at, bio;
        `;

    const params = [
      id,
      username,
      full_name,
      email,
      phone_number,
      profile_pic_url,
      bio,
    ];
    const result = await this.db.query_executor(query, params);
    return result.rows[0] || null;
  };

  deleteUser = async (id) => {
    const query = `
            DELETE FROM "user"
            WHERE id = $1
            RETURNING id, username, full_name, email;
        `;

    const params = [id];
    const result = await this.db.query_executor(query, params);
    return result.rows[0] || null;
  };

  updateJwtToken = async (userId, token) => {
    const query = `
            UPDATE "user"
            SET jwt_token = $2
            WHERE id = $1
            RETURNING id;
        `;

    const params = [userId, token];
    const result = await this.db.query_executor(query, params);
    return result.rows[0] || null;
  };

  clearJwtToken = async (userId) => {
    const query = `
            UPDATE "user"
            SET jwt_token = NULL
            WHERE id = $1
            RETURNING id;
        `;

    const result = await this.db.query_executor(query, [userId]);
    return result.rows[0] || null;
  };

  getJwtTokenByUserId = async (userId) => {
    const query = `SELECT jwt_token FROM "user" WHERE id = $1;`;
    const result = await this.db.query_executor(query, [userId]);
    return result.rows[0] || null;
  };

  getPasswordHashByUserId = async (userId) => {
    const query = `SELECT password_hash FROM "user" WHERE id = $1;`;
    const result = await this.db.query_executor(query, [userId]);
    return result.rows[0] || null;
  };

  updatePasswordHash = async (userId, passwordHash) => {
    const query = `
            UPDATE "user"
            SET password_hash = $2
            WHERE id = $1
            RETURNING id;
        `;

    const result = await this.db.query_executor(query, [userId, passwordHash]);
    return result.rows[0] || null;
  };

  getStatusByName = async (statusName) => {
    const query = `SELECT id, status_name FROM status WHERE LOWER(status_name) = LOWER($1);`;
    const result = await this.db.query_executor(query, [statusName]);
    return result.rows[0] || null;
  };

  ensureStatusByName = async (statusName) => {
    const existing = await this.getStatusByName(statusName);
    if (existing) {
      return existing;
    }

    const insertQuery = `
            INSERT INTO status (status_name)
            VALUES ($1)
            RETURNING id, status_name;
        `;

    try {
      const created = await this.db.query_executor(insertQuery, [statusName]);
      return created.rows[0] || null;
    } catch (error) {
      // Another request may have inserted the same status concurrently.
      if (error.code === "23505") {
        return this.getStatusByName(statusName);
      }
      throw error;
    }
  };

  getStatusById = async (statusId) => {
    const query = `SELECT id, status_name FROM status WHERE id = $1;`;
    const result = await this.db.query_executor(query, [statusId]);
    return result.rows[0] || null;
  };

  checkResearcherRole = async (userId) => {
    const query = `SELECT user_id FROM researcher WHERE user_id = $1;`;
    const result = await this.db.query_executor(query, [userId]);
    return result.rows[0] || null;
  };

  checkVenueUserRole = async (userId) => {
    const query = `SELECT user_id FROM venue_user WHERE user_id = $1;`;
    const result = await this.db.query_executor(query, [userId]);
    return result.rows[0] || null;
  };

  checkAdminRole = async (userId) => {
    const query = `SELECT user_id FROM admin WHERE user_id = $1;`;
    const result = await this.db.query_executor(query, [userId]);
    return result.rows[0] || null;
  };

  followUser = async (followingUserId, followedUserId) => {
    const query = `
            INSERT INTO follows (following_user_id, followed_user_id)
            VALUES ($1, $2)
            RETURNING following_user_id, followed_user_id;
        `;
    const params = [followingUserId, followedUserId];
    const result = await this.db.query_executor(query, params);
    return result.rows[0];
  };

  unfollowUser = async (followingUserId, followedUserId) => {
    const query = `
            DELETE FROM follows
            WHERE following_user_id = $1 AND followed_user_id = $2
            RETURNING following_user_id, followed_user_id;
        `;
    const params = [followingUserId, followedUserId];
    const result = await this.db.query_executor(query, params);
    return result.rows[0] || null;
  };

  getFollowers = async (userId) => {
    const query = `
            SELECT u.id, u.username, u.full_name, u.profile_pic_url
            FROM follows f
            JOIN "user" u ON u.id = f.following_user_id
            WHERE f.followed_user_id = $1
            ORDER BY u.username;
        `;
    const params = [userId];
    const result = await this.db.query_executor(query, params);
    return result.rows;
  };

  getFollowing = async (userId) => {
    const query = `
            SELECT u.id, u.username, u.full_name, u.profile_pic_url
            FROM follows f
            JOIN "user" u ON u.id = f.followed_user_id
            WHERE f.following_user_id = $1
            ORDER BY u.username;
        `;
    const params = [userId];
    const result = await this.db.query_executor(query, params);
    return result.rows;
  };

  getAllStatuses = async () => {
    const query = `SELECT id, status_name FROM status ORDER BY id;`;
    const result = await this.db.query_executor(query);
    return result.rows;
  };

  addToUserLibrary = async (userId, paperId) => {
    const query = `
            INSERT INTO user_library (user_id, paper_id)
            VALUES ($1, $2)
            RETURNING user_id, paper_id, saved_at;
        `;
    const params = [userId, paperId];
    const result = await this.db.query_executor(query, params);
    return result.rows[0];
  };

  removeFromUserLibrary = async (userId, paperId) => {
    const query = `
            DELETE FROM user_library
            WHERE user_id = $1 AND paper_id = $2
            RETURNING user_id, paper_id;
        `;
    const params = [userId, paperId];
    const result = await this.db.query_executor(query, params);
    return result.rows[0] || null;
  };

  getUserLibrary = async (userId) => {
    const query = `
            SELECT
                p.id,
                p.title,
                p.publication_date,
                p.pdf_url,
                p.doi,
                ul.saved_at,
                v.name AS venue_name
            FROM user_library ul
            JOIN paper p ON p.id = ul.paper_id
            JOIN venue v ON v.id = p.venue_id
            WHERE ul.user_id = $1
            ORDER BY ul.saved_at DESC;
        `;
    const params = [userId];
    const result = await this.db.query_executor(query, params);
    return result.rows;
  };

  createFeedback = async (senderId, receiverId, message) => {
    const query = `
            INSERT INTO feedback (sender_id, receiver_id, message)
            VALUES ($1, $2, $3)
            RETURNING *;
        `;
    const result = await this.db.query_executor(query, [
      senderId,
      receiverId,
      message,
    ]);
    return result.rows[0];
  };

  getFeedbackById = async (feedbackId) => {
    const query = `
            SELECT
                f.*,
                s.username AS sender_username,
                s.full_name AS sender_full_name,
                r.username AS receiver_username,
                r.full_name AS receiver_full_name
            FROM feedback f
            JOIN "user" s ON s.id = f.sender_id
            JOIN "user" r ON r.id = f.receiver_id
            WHERE f.id = $1;
        `;
    const result = await this.db.query_executor(query, [feedbackId]);
    return result.rows[0] || null;
  };

  getFeedbackBySender = async (senderId) => {
    const query = `
            SELECT
                f.*,
                r.username AS receiver_username,
                r.full_name AS receiver_full_name
            FROM feedback f
            JOIN "user" r ON r.id = f.receiver_id
            WHERE f.sender_id = $1
            ORDER BY f.created_at DESC;
        `;
    const result = await this.db.query_executor(query, [senderId]);
    return result.rows;
  };

  getFeedbackByReceiver = async (receiverId) => {
    const query = `
            SELECT
                f.*,
                s.username AS sender_username,
                s.full_name AS sender_full_name
            FROM feedback f
            JOIN "user" s ON s.id = f.sender_id
            WHERE f.receiver_id = $1
            ORDER BY f.created_at DESC;
        `;
    const result = await this.db.query_executor(query, [receiverId]);
    return result.rows;
  };

  deleteFeedback = async (feedbackId) => {
    const query = `DELETE FROM feedback WHERE id = $1 RETURNING id;`;
    const result = await this.db.query_executor(query, [feedbackId]);
    return result.rows[0] || null;
  };
}

module.exports = UserModel;
