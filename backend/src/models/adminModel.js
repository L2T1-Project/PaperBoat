const DB_Connection = require('../database/db.js');

class AdminModel {
    constructor() {
        this.db = DB_Connection.getInstance();
    }


    createAdmin = async (userId) => {
        const query = `
            INSERT INTO admin (user_id)
            VALUES ($1)
            RETURNING user_id;
        `;

        const params = [userId];
        const result = await this.db.query_executor(query, params);
        return result.rows[0];
    }

    getAllAdmins = async () => {
        const query = `
            SELECT
                u.id AS user_id,
                u.username,
                u.full_name,
                u.email,
                u.profile_pic_url,
                u.created_at
            FROM admin a
            JOIN "user" u ON u.id = a.user_id
            ORDER BY u.full_name;
        `;

        const result = await this.db.query_executor(query);
        return result.rows;
    }

    getAdminById = async (userId) => {
        const query = `
            SELECT
                u.id AS user_id,
                u.username,
                u.full_name,
                u.email,
                u.profile_pic_url,
                u.created_at
            FROM admin a
            JOIN "user" u ON u.id = a.user_id
            WHERE a.user_id = $1;
        `;

        const params = [userId];
        const result = await this.db.query_executor(query, params);
        return result.rows[0] || null;
    }

    deleteAdmin = async (userId) => {
        const query = `
            DELETE FROM admin
            WHERE user_id = $1
            RETURNING user_id;
        `;

        const params = [userId];
        const result = await this.db.query_executor(query, params);
        return result.rows[0] || null;
    }
}

module.exports = AdminModel;
