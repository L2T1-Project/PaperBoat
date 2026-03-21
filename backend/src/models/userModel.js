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

  getMyProfile = async (userId) => {
    const query = `
            SELECT
                u.id AS user_id,
                u.username,
                u.full_name,
                u.email,
                u.phone_number,
                u.profile_pic_url,
                u.bio,
                CASE
                    WHEN a.user_id IS NOT NULL THEN 'admin'
                    WHEN r.user_id IS NOT NULL THEN 'researcher'
                    WHEN vu.user_id IS NOT NULL THEN 'venue_user'
                    ELSE 'user'
                END AS role,
                au.orc_id,
                v.id AS venue_id,
                v.issn,
                v.name AS venue_name
            FROM "user" u
            LEFT JOIN admin a       ON a.user_id  = u.id
            LEFT JOIN researcher r  ON r.user_id  = u.id
            LEFT JOIN author au     ON au.id      = r.author_id
            LEFT JOIN venue_user vu ON vu.user_id = u.id
            LEFT JOIN venue v       ON v.id       = vu.venue_id
            WHERE u.id = $1;
        `;

    const result = await this.db.query_executor(query, [userId]);
    return result.rows[0] || null;
  };

  updateMyProfile = async (userId, payload) => {
    const setClauses = [];
    const values = [userId];

    const pushField = (column, value) => {
      values.push(value);
      setClauses.push(`${column} = $${values.length}`);
    };

    if (Object.prototype.hasOwnProperty.call(payload, "full_name")) {
      pushField("full_name", payload.full_name);
    }
    if (Object.prototype.hasOwnProperty.call(payload, "phone_number")) {
      pushField("phone_number", payload.phone_number);
    }
    if (Object.prototype.hasOwnProperty.call(payload, "bio")) {
      pushField("bio", payload.bio);
    }
    if (Object.prototype.hasOwnProperty.call(payload, "profile_pic_url")) {
      pushField("profile_pic_url", payload.profile_pic_url);
    }

    if (!setClauses.length) {
      return this.getMyProfile(userId);
    }

    const query = `
            UPDATE "user"
            SET ${setClauses.join(", ")}
            WHERE id = $1
            RETURNING id;
        `;

    await this.db.query_executor(query, values);
    return this.getMyProfile(userId);
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

  getAllStatuses = async () => {
    const query = `SELECT id, status_name FROM status ORDER BY id;`;
    const result = await this.db.query_executor(query);
    return result.rows;
  };
}

module.exports = UserModel;
