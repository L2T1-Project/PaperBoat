const DB_Connection = require('../database/db.js');

class ClaimModel {
    constructor() {
        this.db = DB_Connection.getInstance();
    }

    submitClaim = async (claimantUserId, claimedAuthorId, claimText) => {
            const client = await this.db.pool.connect();
            try {
                await client.query('BEGIN');

                // Validate: the author must be linked to an existing researcher
                const researcherCheck = await client.query(
                    `SELECT 1 FROM researcher WHERE author_id = $1`,
                    [claimedAuthorId]
                );
                if (!researcherCheck.rows.length) {
                    const err = new Error('No existing researcher is linked to this author.');
                    err.code = 'NO_RESEARCHER_LINKED';
                    throw err;
                }

                // Validate: the claimant must not already be a researcher
                const claimantCheck = await client.query(
                    `SELECT 1 FROM researcher WHERE user_id = $1`,
                    [claimantUserId]
                );
                if (claimantCheck.rows.length) {
                    const err = new Error('Claimant is already a researcher.');
                    err.code = 'ALREADY_RESEARCHER';
                    throw err;
                }

                const result = await client.query(
                    `INSERT INTO author_claim_request (claimant_user_id, claimed_author_id, claim_text)
                     VALUES ($1, $2, $3)
                     RETURNING id, claimant_user_id, claimed_author_id, claim_text, status, created_at`,
                    [claimantUserId, claimedAuthorId, claimText]
                );

                const claim = result.rows[0];

                // Notify all admins about a newly submitted duplicate-author claim
                const contextResult = await client.query(
                    `SELECT
                        cu.full_name AS claimant_name,
                        a.name AS author_name
                     FROM "user" cu
                     JOIN author a ON a.id = $2
                     WHERE cu.id = $1`,
                    [claimantUserId, claimedAuthorId]
                );

                const claimantName = contextResult.rows[0]?.claimant_name || 'A user';
                const authorName = contextResult.rows[0]?.author_name || 'an author profile';
                const message = `New duplicate-author claim submitted: ${claimantName} claims ownership of "${authorName}".`;

                const notifResult = await client.query(
                    `INSERT INTO notification (message)
                     VALUES ($1)
                     RETURNING id`,
                    [message]
                );

                const notificationId = notifResult.rows[0].id;
                await client.query(
                    `INSERT INTO notification_receiver (notification_id, user_id)
                     SELECT $1, a.user_id
                     FROM admin a
                     ON CONFLICT (notification_id, user_id) DO NOTHING`,
                    [notificationId]
                );

                await client.query('COMMIT');
                return claim;
            } catch (error) {
                try { await client.query('ROLLBACK'); } catch (_) { /* ignore */ }
                throw error;
            } finally {
                client.release();
            }
    };

    getPendingClaims = async () => {
        const result = await this.db.query_executor(
            `SELECT
               acr.id,
               acr.claimant_user_id,
               acr.claimed_author_id,
               acr.claim_text,
               acr.status,
               acr.created_at,
               cu.full_name         AS claimant_name,
               cu.email             AS claimant_email,
               r.user_id            AS current_researcher_user_id,
               ou.full_name         AS current_researcher_name,
               ou.email             AS current_researcher_email,
               a.name               AS author_name,
               a.orc_id             AS author_orc_id
             FROM author_claim_request acr
             JOIN "user" cu  ON cu.id = acr.claimant_user_id
             JOIN author  a  ON a.id  = acr.claimed_author_id
             LEFT JOIN researcher r ON r.author_id = acr.claimed_author_id
             LEFT JOIN "user" ou    ON ou.id = r.user_id
             WHERE acr.status = 'pending'
             ORDER BY acr.created_at DESC`
        );
        return result.rows;
    };

    approveClaim = async (claimId, adminUserId) => {
        const client = await this.db.pool.connect();
        try {
            await client.query('BEGIN');

            const claimResult = await client.query(
                `SELECT claimant_user_id, claimed_author_id
                 FROM author_claim_request
                 WHERE id = $1 AND status = 'pending'`,
                [claimId]
            );
            if (!claimResult.rows.length) {
                const err = new Error('Claim not found or already resolved.');
                err.code = 'CLAIM_NOT_FOUND';
                throw err;
            }
            const { claimant_user_id, claimed_author_id } = claimResult.rows[0];

            const oldResearcherResult = await client.query(
                `SELECT user_id FROM researcher WHERE author_id = $1`,
                [claimed_author_id]
            );
            const old_researcher_user_id = oldResearcherResult.rows[0]?.user_id ?? null;

            const authorResult = await client.query(
                `SELECT name FROM author WHERE id = $1`,
                [claimed_author_id]
            );
            const author_name = authorResult.rows[0]?.name ?? 'Unknown';

            // Remove old researcher link
            await client.query(
                `DELETE FROM researcher WHERE author_id = $1`,
                [claimed_author_id]
            );

            // Create new researcher link
            await client.query(
                `INSERT INTO researcher (user_id, author_id) VALUES ($1, $2)`,
                [claimant_user_id, claimed_author_id]
            );

            // Invalidate JWT tokens so both users are forced to re-login
            // with their new roles (old researcher → user, claimant → researcher)
            const idsToInvalidate = [claimant_user_id, old_researcher_user_id].filter(Boolean);
            if (idsToInvalidate.length) {
                await client.query(
                    `UPDATE "user" SET jwt_token = NULL WHERE id = ANY($1::int[])`,
                    [idsToInvalidate]
                );
            }

            // Update claim status
            await client.query(
                `UPDATE author_claim_request
                 SET status = 'approved', resolved_at = now(), resolved_by = $1
                 WHERE id = $2`,
                [adminUserId, claimId]
            );

            // Notify old user (demoted)
            if (old_researcher_user_id) {
                const notif1 = await client.query(
                    `INSERT INTO notification (message) VALUES ($1) RETURNING id`,
                    [`Your researcher status for author profile "${author_name}" has been revoked due to a verified ownership claim. Contact support if you believe this is an error.`]
                );
                await client.query(
                    `INSERT INTO notification_receiver (notification_id, user_id) VALUES ($1, $2)`,
                    [notif1.rows[0].id, old_researcher_user_id]
                );
            }

            // Notify new user (approved)
            const notif2 = await client.query(
                `INSERT INTO notification (message) VALUES ($1) RETURNING id`,
                [`Your claim to author profile "${author_name}" has been approved. You are now a verified researcher.`]
            );
            await client.query(
                `INSERT INTO notification_receiver (notification_id, user_id) VALUES ($1, $2)`,
                [notif2.rows[0].id, claimant_user_id]
            );

            await client.query('COMMIT');
            return { claimId, status: 'approved' };
        } catch (error) {
            try { await client.query('ROLLBACK'); } catch (_) { /* ignore */ }
            throw error;
        } finally {
            client.release();
        }
    };

    rejectClaim = async (claimId, adminUserId) => {
        const client = await this.db.pool.connect();
        try {
            await client.query('BEGIN');

            const claimResult = await client.query(
                `SELECT claimant_user_id, claimed_author_id
                 FROM author_claim_request
                 WHERE id = $1 AND status = 'pending'`,
                [claimId]
            );
            if (!claimResult.rows.length) {
                const err = new Error('Claim not found or already resolved.');
                err.code = 'CLAIM_NOT_FOUND';
                throw err;
            }
            const { claimant_user_id, claimed_author_id } = claimResult.rows[0];

            const oldResearcherResult = await client.query(
                `SELECT user_id FROM researcher WHERE author_id = $1`,
                [claimed_author_id]
            );
            const old_researcher_user_id = oldResearcherResult.rows[0]?.user_id ?? null;

            const authorResult = await client.query(
                `SELECT name FROM author WHERE id = $1`,
                [claimed_author_id]
            );
            const author_name = authorResult.rows[0]?.name ?? 'Unknown';

            // Update claim status
            await client.query(
                `UPDATE author_claim_request
                 SET status = 'rejected', resolved_at = now(), resolved_by = $1
                 WHERE id = $2`,
                [adminUserId, claimId]
            );

            // Notify old user (real researcher — warn them)
            if (old_researcher_user_id) {
                const notif1 = await client.query(
                    `INSERT INTO notification (message) VALUES ($1) RETURNING id`,
                    [`Someone attempted to claim your author profile "${author_name}". No action was taken. Please stay vigilant.`]
                );
                await client.query(
                    `INSERT INTO notification_receiver (notification_id, user_id) VALUES ($1, $2)`,
                    [notif1.rows[0].id, old_researcher_user_id]
                );
            }

            // Notify claimant (rejected)
            const notif2 = await client.query(
                `INSERT INTO notification (message) VALUES ($1) RETURNING id`,
                [`Your claim to author profile "${author_name}" has been reviewed and declined.`]
            );
            await client.query(
                `INSERT INTO notification_receiver (notification_id, user_id) VALUES ($1, $2)`,
                [notif2.rows[0].id, claimant_user_id]
            );

            await client.query('COMMIT');
            return { claimId, status: 'rejected' };
        } catch (error) {
            try { await client.query('ROLLBACK'); } catch (_) { /* ignore */ }
            throw error;
        } finally {
            client.release();
        }
    };
}

module.exports = ClaimModel;
