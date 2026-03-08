const DB_Connection = require('../database/db.js');

class ResearcherModel {
    constructor() {
        this.db = DB_Connection.getInstance();
    }


    createResearcher = async (userId, authorId) => {
        const query = `
            INSERT INTO researcher (user_id, author_id)
            VALUES ($1, $2)
            RETURNING user_id, author_id;
        `;

        const params = [userId, authorId];
        const result = await this.db.query_executor(query, params);
        return result.rows[0];
    }

    getAllResearchers = async () => {
        const query = `
            SELECT
                u.id AS user_id,
                u.username,
                u.full_name,
                u.email,
                u.profile_pic_url,
                u.bio,
                a.id AS author_id,
                a.name AS author_name,
                a.orc_id
            FROM researcher r
            JOIN "user" u ON u.id = r.user_id
            JOIN author a ON a.id = r.author_id
            ORDER BY u.full_name;
        `;

        const result = await this.db.query_executor(query);
        return result.rows;
    }

    getResearcherById = async (userId) => {
        const query = `
            SELECT
                u.id AS user_id,
                u.username,
                u.full_name,
                u.email,
                u.profile_pic_url,
                u.bio,
                a.id AS author_id,
                a.name AS author_name,
                a.orc_id
            FROM researcher r
            JOIN "user" u ON u.id = r.user_id
            JOIN author a ON a.id = r.author_id
            WHERE r.user_id = $1;
        `;

        const params = [userId];
        const result = await this.db.query_executor(query, params);
        return result.rows[0] || null;
    }

    deleteResearcher = async (userId) => {
        // Deleting the researcher row cascades from the user; here we delete
        // the researcher entry only (user account stays intact).
        const query = `
            DELETE FROM researcher
            WHERE user_id = $1
            RETURNING user_id, author_id;
        `;

        const params = [userId];
        const result = await this.db.query_executor(query, params);
        return result.rows[0] || null;
    }


    createPaperClaim = async (researcherId, paperId, position) => {
        const query = `
            INSERT INTO paper_claim (researcher_id, paper_id, position, status_id)
            VALUES ($1, $2, $3, (SELECT id FROM status WHERE status_name = 'Pending'))
            RETURNING researcher_id, paper_id, position, status_id, claimed_at;
        `;

        const params = [researcherId, paperId, position];
        const result = await this.db.query_executor(query, params);
        return result.rows[0];
    }

    getPaperClaimsByResearcher = async (researcherId) => {
        const query = `
            SELECT
                pc.paper_id,
                p.title,
                pc.position,
                s.status_name AS claim_status,
                pc.claimed_at
            FROM paper_claim pc
            JOIN paper p  ON p.id = pc.paper_id
            JOIN status s ON s.id = pc.status_id
            WHERE pc.researcher_id = $1
            ORDER BY pc.claimed_at DESC;
        `;

        const params = [researcherId];
        const result = await this.db.query_executor(query, params);
        return result.rows;
    }

    deletePaperClaim = async (researcherId, paperId) => {
        const query = `
            DELETE FROM paper_claim
            WHERE researcher_id = $1 AND paper_id = $2
            RETURNING researcher_id, paper_id;
        `;

        const params = [researcherId, paperId];
        const result = await this.db.query_executor(query, params);
        return result.rows[0] || null;
    }


    addInstituteHistory = async (researcherId, instituteId, fromDate, uptoDate = null) => {
        const query = `
            INSERT INTO institute_history (researcher_id, institute_id, from_date, upto_date)
            VALUES ($1, $2, $3, $4)
            RETURNING researcher_id, institute_id, from_date, upto_date;
        `;

        const params = [researcherId, instituteId, fromDate, uptoDate];
        const result = await this.db.query_executor(query, params);
        return result.rows[0];
    }

    getInstituteHistory = async (researcherId) => {
        const query = `
            SELECT
                i.id AS institute_id,
                i.name AS institute_name,
                i.country,
                i.website_url,
                ih.from_date,
                ih.upto_date
            FROM institute_history ih
            JOIN institute i ON i.id = ih.institute_id
            WHERE ih.researcher_id = $1
            ORDER BY ih.from_date DESC;
        `;

        const params = [researcherId];
        const result = await this.db.query_executor(query, params);
        return result.rows;
    }

    updateInstituteHistory = async (researcherId, instituteId, fromDate, uptoDate) => {
        const query = `
            UPDATE institute_history
            SET upto_date = $4
            WHERE researcher_id = $1
              AND institute_id  = $2
              AND from_date     = $3
            RETURNING researcher_id, institute_id, from_date, upto_date;
        `;

        const params = [researcherId, instituteId, fromDate, uptoDate];
        const result = await this.db.query_executor(query, params);
        return result.rows[0] || null;
    }

    removeInstituteHistory = async (researcherId, instituteId, fromDate) => {
        const query = `
            DELETE FROM institute_history
            WHERE researcher_id = $1
              AND institute_id  = $2
              AND from_date     = $3
            RETURNING researcher_id, institute_id, from_date;
        `;

        const params = [researcherId, instituteId, fromDate];
        const result = await this.db.query_executor(query, params);
        return result.rows[0] || null;
    }
}

module.exports = ResearcherModel;
