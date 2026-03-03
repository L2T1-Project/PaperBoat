const DB_Connection = require('../database/db.js');

class VenueUserModel {
    constructor() {
        this.db = DB_Connection.getInstance();
    }


    createVenueUser = async (userId, venueId) => {
        const query = `
            INSERT INTO venue_user (user_id, venue_id)
            VALUES ($1, $2)
            RETURNING *;
        `;

        const params = [userId, venueId];
        const result = await this.db.query_executor(query, params);
        return result.rows[0];
    }

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
    }

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
    }

    deleteVenueUser = async (userId) => {
        const query = `
            DELETE FROM venue_user
            WHERE user_id = $1
            RETURNING user_id;
        `;

        const params = [userId];
        const result = await this.db.query_executor(query, params);
        return result.rows[0] || null;
    }
}

module.exports = VenueUserModel;
