const DB_Connection = require("../database/db.js");

class VenueUserModel {
  constructor() {
    this.db = DB_Connection.getInstance();
  }

  signupVenueUser = async (payload) => {
    const client = await this.db.pool.connect();
    try {
      await client.query("BEGIN");

      const userQuery = `
                INSERT INTO "user"
                    (username, full_name, email, password_hash, phone_number, status_id, bio)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING id, username, full_name, email;
            `;

      const userResult = await client.query(userQuery, [
        payload.username,
        payload.full_name,
        payload.email,
        payload.password_hash,
        payload.phone_number || null,
        payload.status_id,
        payload.bio || null,
      ]);
      const user = userResult.rows[0];

      const venueUserQuery = `
                INSERT INTO venue_user (user_id, venue_id)
                VALUES ($1, $2)
                RETURNING user_id, venue_id;
            `;

      await client.query(venueUserQuery, [user.id, payload.venue_id]);

      await client.query("COMMIT");
      return user;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  };

  createVenueUser = async (userId, venueId) => {
    const query = `
            INSERT INTO venue_user (user_id, venue_id)
            VALUES ($1, $2)
            RETURNING *;
        `;

    const params = [userId, venueId];
    const result = await this.db.query_executor(query, params);
    return result.rows[0];
  };

  getAllVenueUsers = async () => {
    const query = `
            SELECT
                vu.user_id,
                vu.venue_id,
                u.username,
                u.full_name,
                u.email,
                v.name          AS venue_name,
                v.type          AS venue_type,
                v.issn,
                p.name          AS publisher_name,
                p.country       AS publisher_country
            FROM venue_user vu
            JOIN "user" u ON u.id = vu.user_id
            JOIN venue v  ON v.id = vu.venue_id
            LEFT JOIN publisher p ON p.id = v.publisher_id
            ORDER BY u.full_name;
        `;

    const result = await this.db.query_executor(query);
    return result.rows;
  };

  getVenueUserById = async (userId) => {
    const query = `
            SELECT
                vu.user_id,
                vu.venue_id,
                u.username,
                u.full_name,
                u.email,
                v.name          AS venue_name,
                v.type          AS venue_type,
                v.issn,
                p.name          AS publisher_name,
                p.country       AS publisher_country
            FROM venue_user vu
            JOIN "user" u ON u.id = vu.user_id
            JOIN venue v  ON v.id = vu.venue_id
            LEFT JOIN publisher p ON p.id = v.publisher_id
            WHERE vu.user_id = $1;
        `;

    const params = [userId];
    const result = await this.db.query_executor(query, params);
    return result.rows[0] || null;
  };

  deleteVenueUser = async (userId) => {
    const query = `
            DELETE FROM venue_user
            WHERE user_id = $1
            RETURNING user_id;
        `;

    const params = [userId];
    const result = await this.db.query_executor(query, params);
    return result.rows[0] || null;
  };

  getDashboardTopCitedPapers = async (userId, limit = 10, offset = 0) => {
    const query = `
            SELECT *
            FROM fn_get_venue_top_cited_papers($1, $2, $3);
        `;

    const result = await this.db.query_executor(query, [userId, limit, offset]);
    return result.rows;
  };

  getDashboardPublishedPapers = async (userId, limit = 20, offset = 0) => {
    const query = `
            SELECT *
            FROM fn_get_venue_published_papers($1, $2, $3);
        `;

    const result = await this.db.query_executor(query, [userId, limit, offset]);
    return result.rows;
  };

  getDashboardProminentAuthors = async (userId, limit = 10) => {
    const query = `
            SELECT *
            FROM fn_get_venue_prominent_authors($1, $2);
        `;

    const result = await this.db.query_executor(query, [userId, limit]);
    return result.rows;
  };
}

module.exports = VenueUserModel;
