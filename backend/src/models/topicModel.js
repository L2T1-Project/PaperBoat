const DB_Connection = require('../database/db.js');

class TopicModel {
    constructor() {
        this.db = DB_Connection.getInstance();
    }

    createDomain = async (name) => {
        const query = `
            INSERT INTO domain (name)
            VALUES ($1)
            RETURNING *;
        `;
        const result = await this.db.query_executor(query, [name]);
        return result.rows[0];
    }

    getAllDomains = async () => {
        const query = `SELECT * FROM domain ORDER BY name;`;
        const result = await this.db.query_executor(query);
        return result.rows;
    }

    getDomainById = async (domainId) => {
        const query = `SELECT * FROM domain WHERE id = $1;`;
        const result = await this.db.query_executor(query, [domainId]);
        return result.rows[0] || null;
    }

    updateDomain = async (domainId, name) => {
        const query = `
            UPDATE domain
            SET name = COALESCE($2, name)
            WHERE id = $1
            RETURNING *;
        `;
        const result = await this.db.query_executor(query, [domainId, name]);
        return result.rows[0] || null;
    }

    deleteDomain = async (domainId) => {
        const query = `
            DELETE FROM domain WHERE id = $1 RETURNING id;
        `;
        const result = await this.db.query_executor(query, [domainId]);
        return result.rows[0] || null;
    }

    createField = async (domainId, name) => {
        const query = `
            INSERT INTO field (domain_id, name)
            VALUES ($1, $2)
            RETURNING *;
        `;
        const result = await this.db.query_executor(query, [domainId, name]);
        return result.rows[0];
    }

    getAllFields = async () => {
        const query = `
            SELECT f.*, d.name AS domain_name
            FROM field f
            JOIN domain d ON d.id = f.domain_id
            ORDER BY d.name, f.name;
        `;
        const result = await this.db.query_executor(query);
        return result.rows;
    }

    getFieldById = async (fieldId) => {
        const query = `
            SELECT f.*, d.name AS domain_name
            FROM field f
            JOIN domain d ON d.id = f.domain_id
            WHERE f.id = $1;
        `;
        const result = await this.db.query_executor(query, [fieldId]);
        return result.rows[0] || null;
    }

    getFieldsByDomain = async (domainId) => {
        const query = `
            SELECT f.*, d.name AS domain_name
            FROM field f
            JOIN domain d ON d.id = f.domain_id
            WHERE f.domain_id = $1
            ORDER BY f.name;
        `;
        const result = await this.db.query_executor(query, [domainId]);
        return result.rows;
    }

    updateField = async (fieldId, domainId, name) => {
        const query = `
            UPDATE field
            SET
                domain_id = COALESCE($2, domain_id),
                name      = COALESCE($3, name)
            WHERE id = $1
            RETURNING *;
        `;
        const result = await this.db.query_executor(query, [fieldId, domainId, name]);
        return result.rows[0] || null;
    }

    deleteField = async (fieldId) => {
        const query = `DELETE FROM field WHERE id = $1 RETURNING id;`;
        const result = await this.db.query_executor(query, [fieldId]);
        return result.rows[0] || null;
    }

    createTopic = async (fieldId, name) => {
        const query = `
            INSERT INTO topic (field_id, name)
            VALUES ($1, $2)
            RETURNING *;
        `;
        const result = await this.db.query_executor(query, [fieldId, name]);
        return result.rows[0];
    }

    getAllTopics = async () => {
        const query = `
            SELECT t.*, f.name AS field_name, d.id AS domain_id, d.name AS domain_name
            FROM topic t
            JOIN field f  ON f.id = t.field_id
            JOIN domain d ON d.id = f.domain_id
            ORDER BY d.name, f.name, t.name;
        `;
        const result = await this.db.query_executor(query);
        return result.rows;
    }

    getTopicById = async (topicId) => {
        const query = `
            SELECT t.*, f.name AS field_name, d.id AS domain_id, d.name AS domain_name
            FROM topic t
            JOIN field f  ON f.id = t.field_id
            JOIN domain d ON d.id = f.domain_id
            WHERE t.id = $1;
        `;
        const result = await this.db.query_executor(query, [topicId]);
        return result.rows[0] || null;
    }

    getTopicsByField = async (fieldId) => {
        const query = `
            SELECT t.*, f.name AS field_name, d.id AS domain_id, d.name AS domain_name
            FROM topic t
            JOIN field f  ON f.id = t.field_id
            JOIN domain d ON d.id = f.domain_id
            WHERE t.field_id = $1
            ORDER BY t.name;
        `;
        const result = await this.db.query_executor(query, [fieldId]);
        return result.rows;
    }

    updateTopic = async (topicId, fieldId, name) => {
        const query = `
            UPDATE topic
            SET
                field_id = COALESCE($2, field_id),
                name     = COALESCE($3, name)
            WHERE id = $1
            RETURNING *;
        `;
        const result = await this.db.query_executor(query, [topicId, fieldId, name]);
        return result.rows[0] || null;
    }

    deleteTopic = async (topicId) => {
        const query = `DELETE FROM topic WHERE id = $1 RETURNING id;`;
        const result = await this.db.query_executor(query, [topicId]);
        return result.rows[0] || null;
    }

    getPlatformSummaryStats = async () => {
        const query = `
            SELECT
                (SELECT COUNT(*)::INT FROM paper) AS total_papers,
                (SELECT COUNT(*)::INT FROM author) AS total_authors,
                (SELECT COUNT(*)::INT FROM venue) AS total_venues,
                (SELECT COUNT(*)::INT FROM researcher) AS total_researchers,
                (SELECT COUNT(*)::INT FROM citation) AS total_citations;
        `;

        const result = await this.db.query_executor(query);
        return result.rows[0];
    }

    getTopicMomentum = async (limit = 10, windowDays = 90) => {
        const query = `
            WITH bounds AS (
                SELECT
                    CURRENT_DATE - ($1::INT || ' days')::INTERVAL AS current_start,
                    CURRENT_DATE AS current_end,
                    CURRENT_DATE - (($1::INT * 2) || ' days')::INTERVAL AS previous_start,
                    CURRENT_DATE - ($1::INT || ' days')::INTERVAL AS previous_end
            ),
            topic_activity AS (
                SELECT
                    t.id AS topic_id,
                    t.name AS topic_name,
                    f.id AS field_id,
                    f.name AS field_name,
                    d.id AS domain_id,
                    d.name AS domain_name,
                    COUNT(DISTINCT CASE
                        WHEN p.publication_date >= b.current_start::date
                         AND p.publication_date < b.current_end::date
                        THEN p.id END
                    )::INT AS papers_current,
                    COUNT(DISTINCT CASE
                        WHEN p.publication_date >= b.previous_start::date
                         AND p.publication_date < b.previous_end::date
                        THEN p.id END
                    )::INT AS papers_previous,
                    COUNT(CASE
                        WHEN cp.publication_date >= b.current_start::date
                         AND cp.publication_date < b.current_end::date
                        THEN 1 END
                    )::INT AS citations_current,
                    COUNT(CASE
                        WHEN cp.publication_date >= b.previous_start::date
                         AND cp.publication_date < b.previous_end::date
                        THEN 1 END
                    )::INT AS citations_previous
                FROM topic t
                JOIN field f ON f.id = t.field_id
                JOIN domain d ON d.id = f.domain_id
                LEFT JOIN paper_topic pt ON pt.topic_id = t.id
                LEFT JOIN paper p ON p.id = pt.paper_id
                LEFT JOIN citation c ON c.cited_id = p.id
                LEFT JOIN paper cp ON cp.id = c.citing_id
                CROSS JOIN bounds b
                GROUP BY t.id, t.name, f.id, f.name, d.id, d.name
            )
            SELECT
                topic_id,
                topic_name,
                field_id,
                field_name,
                domain_id,
                domain_name,
                papers_current,
                papers_previous,
                citations_current,
                citations_previous,
                (citations_current - citations_previous) AS citation_delta,
                (papers_current - papers_previous) AS paper_delta,
                ROUND(
                    (
                        0.7 * (
                            (citations_current - citations_previous)::NUMERIC
                            / GREATEST(citations_previous, 1)
                        )
                        +
                        0.3 * (
                            (papers_current - papers_previous)::NUMERIC
                            / GREATEST(papers_previous, 1)
                        )
                    )
                , 4) AS momentum_score
            FROM topic_activity
            ORDER BY momentum_score DESC, citations_current DESC, papers_current DESC, topic_name ASC
            LIMIT $2;
        `;

        const result = await this.db.query_executor(query, [windowDays, limit]);
        return result.rows;
    }

    getMostCitedPapers = async (limit = 10) => {
        const query = `
            SELECT
                p.id AS paper_id,
                p.title,
                p.publication_date,
                p.doi,
                v.id AS venue_id,
                v.name AS venue_name,
                COUNT(c.cited_id)::INT AS citation_count
            FROM paper p
            LEFT JOIN citation c ON c.cited_id = p.id
            LEFT JOIN venue v ON v.id = p.venue_id
            GROUP BY p.id, v.id
            ORDER BY citation_count DESC, p.publication_date DESC NULLS LAST, p.title ASC
            LIMIT $1;
        `;

        const result = await this.db.query_executor(query, [limit]);
        return result.rows;
    }

    getTopAuthorsByTopicCitations = async (topicId, limit = 10) => {
        const query = `
            WITH topic_papers AS (
                SELECT DISTINCT p.id AS paper_id
                FROM paper p
                JOIN paper_topic pt ON pt.paper_id = p.id
                WHERE pt.topic_id = $1
            ),
            citation_counts AS (
                SELECT
                    tp.paper_id,
                    COUNT(c.cited_id)::INT AS paper_citation_count
                FROM topic_papers tp
                LEFT JOIN citation c ON c.cited_id = tp.paper_id
                GROUP BY tp.paper_id
            )
            SELECT
                a.id AS author_id,
                a.name AS author_name,
                a.orc_id,
                COUNT(DISTINCT tp.paper_id)::INT AS paper_count_in_topic,
                COALESCE(SUM(cc.paper_citation_count), 0)::INT AS citation_count_in_topic
            FROM topic_papers tp
            JOIN paper_author pa ON pa.paper_id = tp.paper_id
            JOIN author a ON a.id = pa.author_id
            LEFT JOIN citation_counts cc ON cc.paper_id = tp.paper_id
            GROUP BY a.id, a.name, a.orc_id
            ORDER BY citation_count_in_topic DESC, paper_count_in_topic DESC, a.name ASC
            LIMIT $2;
        `;

        const result = await this.db.query_executor(query, [topicId, limit]);
        return result.rows;
    }
}

module.exports = TopicModel;
