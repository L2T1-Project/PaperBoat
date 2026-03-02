const DB_Connection = require('../database/db.js');

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
            bio = null
        } = payload;

        const query = `
            INSERT INTO "user"
                (username, full_name, email, password_hash, phone_number, status_id, bio)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, username, full_name, email, phone_number, profile_pic_url, status_id, created_at, bio;
        `;

        const params = [username, full_name, email, password_hash, phone_number, status_id, bio];
        const result = await this.db.query_executor(query, params);
        return result.rows[0];
    }

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
    }

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
    }

    getUserByEmail = async (email) => {
        const query = `
            SELECT *
            FROM "user"
            WHERE email = $1;
        `;

        const params = [email];
        const result = await this.db.query_executor(query, params);
        return result.rows[0] || null;
    }

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
    }

    updateUser = async (id, payload) => {
        const {
            username,
            full_name,
            email,
            phone_number = null,
            profile_pic_url = null,
            bio = null
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

        const params = [id, username, full_name, email, phone_number, profile_pic_url, bio];
        const result = await this.db.query_executor(query, params);
        return result.rows[0] || null;
    }

    deleteUser = async (id) => {
        const query = `
            DELETE FROM "user"
            WHERE id = $1
            RETURNING id, username, full_name, email;
        `;

        const params = [id];
        const result = await this.db.query_executor(query, params);
        return result.rows[0] || null;
    }

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
    }
}

module.exports = UserModel;
