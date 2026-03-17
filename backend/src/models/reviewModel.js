const DB_Connection = require('../database/db.js');

class ReviewModel {
    constructor() {
        this.db = DB_Connection.getInstance();
    }

    createReview = async (researcherId, paperId, parentReviewId, text) => {
        const query = `
            INSERT INTO review (researcher_id, paper_id, parent_review_id, text)
            VALUES ($1, $2, $3, $4)
            RETURNING *;
        `;
        const result = await this.db.query_executor(query, [researcherId, paperId, parentReviewId, text]);
        return result.rows[0];
    }

    getAllReviews = async () => {
        const query = `
            SELECT
                r.*,
                u.username,
                u.full_name,
                u.profile_pic_url
            FROM review r
            JOIN researcher res ON res.user_id = r.researcher_id
            JOIN "user" u       ON u.id = res.user_id
            ORDER BY r.created_at DESC;
        `;
        const result = await this.db.query_executor(query);
        return result.rows;
    }

    getReviewById = async (reviewId) => {
        const query = `
            SELECT
                r.*,
                u.username,
                u.full_name,
                u.profile_pic_url
            FROM review r
            JOIN researcher res ON res.user_id = r.researcher_id
            JOIN "user" u       ON u.id = res.user_id
            WHERE r.id = $1;
        `;
        const result = await this.db.query_executor(query, [reviewId]);
        return result.rows[0] || null;
    }

    getReviewsByPaper = async (paperId) => {
        const query = `
            SELECT
                r.*,
                u.username,
                u.full_name,
                u.profile_pic_url
            FROM review r
            JOIN researcher res ON res.user_id = r.researcher_id
            JOIN "user" u       ON u.id = res.user_id
            WHERE r.paper_id = $1
            ORDER BY r.created_at DESC;
        `;
        const result = await this.db.query_executor(query, [paperId]);
        return result.rows;
    }

    getRepliesByReview = async (parentReviewId) => {
        const query = `
            SELECT
                r.*,
                u.username,
                u.full_name,
                u.profile_pic_url
            FROM review r
            JOIN researcher res ON res.user_id = r.researcher_id
            JOIN "user" u       ON u.id = res.user_id
            WHERE r.parent_review_id = $1
            ORDER BY r.created_at ASC;
        `;
        const result = await this.db.query_executor(query, [parentReviewId]);
        return result.rows;
    }

    getReviewTreeByPaper = async (paperId) => {
        const query = `
            WITH RECURSIVE review_tree AS (
                SELECT
                    r.*,
                    u.username,
                    u.full_name,
                    u.profile_pic_url
                FROM review r
                JOIN researcher res ON res.user_id = r.researcher_id
                JOIN "user" u       ON u.id = res.user_id
                WHERE r.paper_id = $1

                UNION ALL

                SELECT
                    child.*,
                    u2.username,
                    u2.full_name,
                    u2.profile_pic_url
                FROM review child
                JOIN researcher res2 ON res2.user_id = child.researcher_id
                JOIN "user" u2      ON u2.id = res2.user_id
                JOIN review_tree rt   ON child.parent_review_id = rt.id
            )
            SELECT *
            FROM review_tree;
        `;
        const result = await this.db.query_executor(query, [paperId]);
        return result.rows;
    }

    deleteReview = async (reviewId) => {
        const query = `DELETE FROM review WHERE id = $1 RETURNING id;`;
        const result = await this.db.query_executor(query, [reviewId]);
        return result.rows[0] || null;
    }

    castVote = async (researcherId, reviewId, isUpvote) => {
        const query = `
            INSERT INTO review_vote (researcher_id, review_id, is_upvote)
            VALUES ($1, $2, $3)
            ON CONFLICT (researcher_id, review_id)
            DO UPDATE SET is_upvote = EXCLUDED.is_upvote
            RETURNING *;
        `;
        const result = await this.db.query_executor(query, [researcherId, reviewId, isUpvote]);
        return result.rows[0];
    }

    removeVote = async (researcherId, reviewId) => {
        const query = `
            DELETE FROM review_vote
            WHERE researcher_id = $1 AND review_id = $2
            RETURNING researcher_id;
        `;
        const result = await this.db.query_executor(query, [researcherId, reviewId]);
        return result.rows[0] || null;
    }

    getVotesByReview = async (reviewId) => {
        const query = `
            SELECT
                rv.*,
                u.username,
                u.full_name
            FROM review_vote rv
            JOIN researcher res ON res.user_id = rv.researcher_id
            JOIN "user" u       ON u.id = res.user_id
            WHERE rv.review_id = $1
            ORDER BY rv.created_at DESC;
        `;
        const result = await this.db.query_executor(query, [reviewId]);
        return result.rows;
    }
}

module.exports = ReviewModel;
