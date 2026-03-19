const DB_Connection = require('../database/db.js');

class AdminModel {
    constructor() {
        this.db = DB_Connection.getInstance();
        this.APPROVED_STATUS_ID = 3;
        this.DECLINED_STATUS_ID = 4;
        this.PENDING_STATUS_ID = 5;
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


    getAllPaperClaims = async () => {
        const query = `
            SELECT
                pc.researcher_id,
                pc.paper_id,
                pc.position,
                s.id   AS status_id,
                s.status_name AS claim_status,
                pc.claimed_at,
                u.username,
                u.full_name,
                p.title AS paper_title
            FROM paper_claim pc
            JOIN researcher r ON r.user_id = pc.researcher_id
            JOIN "user" u      ON u.id = r.user_id
            JOIN paper p       ON p.id = pc.paper_id
            JOIN status s      ON s.id = pc.status_id
            ORDER BY pc.claimed_at DESC;
        `;
        const result = await this.db.query_executor(query);
        return result.rows;
    }

    getPaperClaimsByStatus = async (statusName) => {
        const query = `
            SELECT
                pc.researcher_id,
                pc.paper_id,
                pc.position,
                s.id   AS status_id,
                s.status_name AS claim_status,
                pc.claimed_at,
                u.username,
                u.full_name,
                p.title AS paper_title
            FROM paper_claim pc
            JOIN researcher r ON r.user_id = pc.researcher_id
            JOIN "user" u      ON u.id = r.user_id
            JOIN paper p       ON p.id = pc.paper_id
            JOIN status s      ON s.id = pc.status_id
            WHERE s.status_name = $1
            ORDER BY pc.claimed_at DESC;
        `;
        const result = await this.db.query_executor(query, [statusName]);
        return result.rows;
    }

    processPaperClaimDecision = async (researcherId, paperId, statusId) => {
        const client = await this.db.pool.connect();
        try {
            await client.query('BEGIN');

            const currentClaimResult = await client.query(
                `SELECT researcher_id, paper_id, position, status_id, claimed_at
                 FROM paper_claim
                 WHERE researcher_id = $1 AND paper_id = $2
                 FOR UPDATE;`,
                [researcherId, paperId]
            );

            const currentClaim = currentClaimResult.rows[0] || null;
            if (!currentClaim) {
                await client.query('ROLLBACK');
                return null;
            }

            if (Number(currentClaim.status_id) !== this.PENDING_STATUS_ID) {
                const error = new Error('Only pending claims can be reviewed.');
                error.code = 'CLAIM_NOT_PENDING';
                throw error;
            }

            if (Number(statusId) === this.APPROVED_STATUS_ID) {
                await client.query('CALL approve_paper_claim($1, $2, $3);', [researcherId, paperId, currentClaim.position]);
            } else if (Number(statusId) === this.DECLINED_STATUS_ID) {
                await client.query('CALL notify_claim_declined($1, $2);', [researcherId, paperId]);
            } else {
                const error = new Error('Unsupported claim status transition.');
                error.code = 'INVALID_CLAIM_STATUS';
                throw error;
            }

            const updateResult = await client.query(
                `UPDATE paper_claim
                 SET status_id = $3
                 WHERE researcher_id = $1 AND paper_id = $2
                 RETURNING researcher_id, paper_id, position, status_id, claimed_at;`,
                [researcherId, paperId, statusId]
            );

            await client.query('COMMIT');
            return updateResult.rows[0] || null;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
}

module.exports = AdminModel;
