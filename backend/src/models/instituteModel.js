const DB_Connection = require('../database/db.js');

class InstituteModel {
    constructor() {
        this.db = DB_Connection.getInstance();
    }


    createInstitute = async (payload) => {
        const {
            name,
            country = null,
            website_url = null,
            img_url = null
        } = payload;

        const query = `
            INSERT INTO institute (name, country, website_url, img_url)
            VALUES ($1, $2, $3, $4)
            RETURNING id, name, country, website_url, img_url;
        `;

        const params = [name, country, website_url, img_url];
        const result = await this.db.query_executor(query, params);
        return result.rows[0];
    }

    getAllInstitutes = async () => {
        const query = `
            SELECT id, name, country, website_url, img_url
            FROM institute
            ORDER BY name;
        `;

        const result = await this.db.query_executor(query);
        return result.rows;
    }

    getInstituteById = async (id) => {
        const query = `
            SELECT id, name, country, website_url, img_url
            FROM institute
            WHERE id = $1;
        `;

        const params = [id];
        const result = await this.db.query_executor(query, params);
        return result.rows[0] || null;
    }

    updateInstitute = async (id, payload) => {
        const {
            name,
            country = null,
            website_url = null,
            img_url = null
        } = payload;

        const query = `
            UPDATE institute
            SET
                name        = $2,
                country     = $3,
                website_url = $4,
                img_url     = $5
            WHERE id = $1
            RETURNING id, name, country, website_url, img_url;
        `;

        const params = [id, name, country, website_url, img_url];
        const result = await this.db.query_executor(query, params);
        return result.rows[0] || null;
    }

    deleteInstitute = async (id) => {
        const query = `
            DELETE FROM institute
            WHERE id = $1
            RETURNING id, name;
        `;

        const params = [id];
        const result = await this.db.query_executor(query, params);
        return result.rows[0] || null;
    }

    getResearchersByInstitute = async (instituteId) => {
        const query = `
            SELECT
                u.id AS user_id,
                u.username,
                u.full_name,
                u.profile_pic_url,
                ih.from_date,
                ih.upto_date
            FROM institute_history ih
            JOIN researcher r ON r.user_id = ih.researcher_id
            JOIN "user" u ON u.id = r.user_id
            WHERE ih.institute_id = $1
            ORDER BY ih.from_date DESC;
        `;

        const params = [instituteId];
        const result = await this.db.query_executor(query, params);
        return result.rows;
    }
}

module.exports = InstituteModel;
