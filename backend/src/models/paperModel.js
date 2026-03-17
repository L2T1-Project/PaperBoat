const DB_connection = require('../database/db.js');

class PaperModel {
    constructor() {
        this.db = DB_connection.getInstance();
    }

    createPaper = async (payload) => {
        const{
            title,
            publication_date,
            pdf_url = null,
            doi = null,
            is_retracted = false,
            github_repo = null,
            venue_id
        } = payload;

        // const checkVenue = `
        //     SELECT 
        // `;

        const query = `
            INSERT into "paper"
            (title, publication_date, pdf_url, doi, is_retracted, github_repo, venue_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING title, publication_date, pdf_url, doi, is_retracted, github_repo, venue_id;
        `;

        const params = [title, publication_date, pdf_url, doi, is_retracted, github_repo, venue_id];
        const result = await this.db.query_executor(query, params);

        return result.rows[0];
    }

    getAllPapers = async (limit = 10, offset = 0) => {
        const query = `
            SELECT p.id,
            p.title,
            p.publication_date,
            p.pdf_url,
            p.doi,
            p.is_retracted,
            p.github_repo,
            p.venue_id,
            v.name AS venue_name,
            v.type,
            v.issn,
            pub.name AS publisher_name
            FROM "paper" p
            JOIN venue v ON p.venue_id = v.id
            LEFT JOIN publisher pub ON pub.id = v.publisher_id
            ORDER BY p.publication_date DESC NULLS LAST
            LIMIT $1 OFFSET $2;
        `;

        const result = await this.db.query_executor(query, [limit, offset]);
        return result.rows;
    }

    getTotalPapersCount = async () => {
        const query = `SELECT COUNT(*)::INT AS total FROM paper;`;
        const result = await this.db.query_executor(query);
        return result.rows[0]?.total || 0;
    }

    searchPapers = async (searchTerm, limit = 10, offset = 0) => {
        const query = `
            SELECT p.id,
            p.title,
            p.publication_date,
            p.pdf_url,
            p.doi,
            p.is_retracted,
            p.github_repo,
            p.venue_id,
            v.name AS venue_name,
            v.type,
            v.issn,
            pub.name AS publisher_name
            FROM "paper" p
            JOIN venue v ON p.venue_id = v.id
            LEFT JOIN publisher pub ON pub.id = v.publisher_id
            WHERE p.title ILIKE $1
            ORDER BY p.publication_date DESC NULLS LAST
            LIMIT $2 OFFSET $3;
        `;

        const result = await this.db.query_executor(query, [`%${searchTerm}%`, limit, offset]);
        return result.rows;
    }

    countSearchResults = async (searchTerm) => {
        const query = `SELECT COUNT(*)::INT AS total FROM paper WHERE title ILIKE $1;`;
        const result = await this.db.query_executor(query, [`%${searchTerm}%`]);
        return result.rows[0]?.total || 0;
    }

    getPapersByDomain = async (domainId, limit = 10, offset = 0) => {
        const query = `
            SELECT DISTINCT p.id,
            p.title,
            p.publication_date,
            p.pdf_url,
            p.doi,
            p.is_retracted,
            p.github_repo,
            p.venue_id,
            v.name AS venue_name,
            v.type,
            v.issn,
            pub.name AS publisher_name
            FROM "paper" p
            JOIN venue v ON p.venue_id = v.id
            LEFT JOIN publisher pub ON pub.id = v.publisher_id
            JOIN paper_topic pt ON p.id = pt.paper_id
            JOIN topic t ON t.id = pt.topic_id
            JOIN field f ON f.id = t.field_id
            WHERE f.domain_id = $1
            ORDER BY p.publication_date DESC NULLS LAST
            LIMIT $2 OFFSET $3;
        `;

        const result = await this.db.query_executor(query, [domainId, limit, offset]);
        return result.rows;
    }

    countPapersByDomain = async (domainId) => {
        const query = `
            SELECT COUNT(DISTINCT p.id)::INT AS total
            FROM paper p
            JOIN paper_topic pt ON p.id = pt.paper_id
            JOIN topic t ON t.id = pt.topic_id
            JOIN field f ON f.id = t.field_id
            WHERE f.domain_id = $1;
        `;

        const result = await this.db.query_executor(query, [domainId]);
        return result.rows[0]?.total || 0;
    }

    getPapersByField = async (fieldId, limit = 10, offset = 0) => {
        const query = `
            SELECT DISTINCT p.id,
            p.title,
            p.publication_date,
            p.pdf_url,
            p.doi,
            p.is_retracted,
            p.github_repo,
            p.venue_id,
            v.name AS venue_name,
            v.type,
            v.issn,
            pub.name AS publisher_name
            FROM "paper" p
            JOIN venue v ON p.venue_id = v.id
            LEFT JOIN publisher pub ON pub.id = v.publisher_id
            JOIN paper_topic pt ON p.id = pt.paper_id
            JOIN topic t ON t.id = pt.topic_id
            WHERE t.field_id = $1
            ORDER BY p.publication_date DESC NULLS LAST
            LIMIT $2 OFFSET $3;
        `;

        const result = await this.db.query_executor(query, [fieldId, limit, offset]);
        return result.rows;
    }

    countPapersByField = async (fieldId) => {
        const query = `
            SELECT COUNT(DISTINCT p.id)::INT AS total
            FROM paper p
            JOIN paper_topic pt ON p.id = pt.paper_id
            JOIN topic t ON t.id = pt.topic_id
            WHERE t.field_id = $1;
        `;

        const result = await this.db.query_executor(query, [fieldId]);
        return result.rows[0]?.total || 0;
    }

    getPapersByTopic = async (topicId, limit = 10, offset = 0) => {
        const query = `
            SELECT p.id,
            p.title,
            p.publication_date,
            p.pdf_url,
            p.doi,
            p.is_retracted,
            p.github_repo,
            p.venue_id,
            v.name AS venue_name,
            v.type,
            v.issn,
            pub.name AS publisher_name
            FROM "paper" p
            JOIN venue v ON p.venue_id = v.id
            LEFT JOIN publisher pub ON pub.id = v.publisher_id
            JOIN paper_topic pt ON p.id = pt.paper_id
            WHERE pt.topic_id = $1
            ORDER BY p.publication_date DESC NULLS LAST
            LIMIT $2 OFFSET $3;
        `;

        const result = await this.db.query_executor(query, [topicId, limit, offset]);
        return result.rows;
    }

    countPapersByTopic = async (topicId) => {
        const query = `
            SELECT COUNT(*)::INT AS total
            FROM paper_topic
            WHERE topic_id = $1;
        `;

        const result = await this.db.query_executor(query, [topicId]);
        return result.rows[0]?.total || 0;
    }

    getPaperById = async (id) => {
        const query = `
            SELECT
                p.id,
                p.title,
                p.publication_date,
                p.pdf_url,
                p.doi,
                p.is_retracted,
                p.github_repo,
                p.venue_id,
                v.name AS venue_name,
                v.type AS venue_type,
                v.issn,
                pub.id AS publisher_id,
                pub.name AS publisher_name,
                NULL::TEXT AS publisher_country,
                NULL::TEXT AS publisher_website,
                COALESCE(
                    json_agg(
                        CASE WHEN a.id IS NOT NULL THEN
                            json_build_object(
                                'id', a.id,
                                'name', a.name,
                                'position', pa.position,
                                'orc_id', a.orc_id
                            )
                        END
                        ORDER BY pa.position
                    ) FILTER (WHERE a.id IS NOT NULL),
                    '[]'::json
                ) AS authors
            FROM "paper" p
            JOIN venue v ON p.venue_id = v.id
            LEFT JOIN publisher pub ON pub.id = v.publisher_id
            LEFT JOIN paper_author pa ON pa.paper_id = p.id
            LEFT JOIN author a ON a.id = pa.author_id
            WHERE p.id = $1
            GROUP BY p.id, v.id, pub.id;
        `;

        const params = [id];
        const result = await this.db.query_executor(query, params);
        return result.rows[0] || null;
    }


    getPaperByName = async (id) => {
        const query = `
            SELECT p.title,
            p.publication_date,
            p.pdf_url,
            p.doi,
            p.is_retracted,
            p.github_repo,
            p.venue_id,
            v.name
            FROM "paper" p
            JOIN venue v on p.venue_id = v.id
            WHERE p.name = $1;
        `;

        const params = [id];
        const result = await this.db.query_executor(query, params);
        return result.rows[0] || null;
    }

    updatePaper = async(id, payload) => {
        const{
            title,
            publication_date,
            pdf_url = null,
            doi = null,
            is_retracted = false,
            github_repo = null,
            venue_id
        } = payload;

        const query = `
            UPDATE "paper"
            SET
                title = $2,
                publication_date = $3,
                pdf_url = $4,
                doi = $5,
                is_retracted = $6,
                github_repo = $7,
                venue_id = $8
            WHERE id = $1
            RETURNING title, publication_date, pdf_url, doi, is_retracted, github_repo, venue_id; 
        `;

        const params = [id, title, publication_date, pdf_url, doi, is_retracted, github_repo, venue_id];
        const result = await this.db.query_executor(query, params);

        return result.rows[0] || null;
    }

    deletePaper = async(id) => {
        const query = `
            DELETE from "paper"
            WHERE id = $1
            RETURNING id, title, publication_date;
        `;

        const params = [id];
        const result = await this.db.query_executor(query, params);
        return result.rows[0] || null;
    }


    // Papers that cite the given paper
    getCitedBy = async (paperId) => {
        const query = `
            SELECT p.id, p.title, p.publication_date, p.doi, v.name AS venue_name
            FROM citation c
            JOIN paper p ON p.id = c.citing_id
            JOIN venue v ON v.id = p.venue_id
            WHERE c.cited_id = $1
            ORDER BY p.publication_date DESC;
        `;
        const params = [paperId];
        const result = await this.db.query_executor(query, params);
        return result.rows;
    }

    // Papers that this paper cites 
    getReferences = async (paperId) => {
        const query = `
            SELECT p.id, p.title, p.publication_date, p.doi, v.name AS venue_name
            FROM citation c
            JOIN paper p ON p.id = c.cited_id
            JOIN venue v ON v.id = p.venue_id
            WHERE c.citing_id = $1
            ORDER BY p.publication_date DESC;
        `;
        const params = [paperId];
        const result = await this.db.query_executor(query, params);
        return result.rows;
    }

    addCitation = async (citingId, citedId) => {
        const query = `
            INSERT INTO citation (citing_id, cited_id)
            VALUES ($1, $2)
            RETURNING citing_id, cited_id;
        `;
        const params = [citingId, citedId];
        const result = await this.db.query_executor(query, params);
        return result.rows[0];
    }

    removeCitation = async (citingId, citedId) => {
        const query = `
            DELETE FROM citation
            WHERE citing_id = $1 AND cited_id = $2
            RETURNING citing_id, cited_id;
        `;
        const params = [citingId, citedId];
        const result = await this.db.query_executor(query, params);
        return result.rows[0] || null;
    }

    //paper topic er name ta inconsistent - change korte hobe
    //LEFT TO DO

    getPaperTopics = async (paperId) => {
        const query = `
            SELECT t.id, t.name AS topic_name,
                   f.id AS field_id, f.name AS field_name,
                   d.id AS domain_id, d.name AS domain_name
            FROM paper_topic pt
            JOIN topic t ON t.id = pt.topic_id
            JOIN field f ON f.id = t.field_id
            JOIN domain d ON d.id = f.domain_id
            WHERE pt.paper_id = $1
            ORDER BY d.name, f.name, t.name;
        `;
        const params = [paperId];
        const result = await this.db.query_executor(query, params);
        return result.rows;
    }

    addPaperTopic = async (paperId, topicId) => {
        const query = `
            INSERT INTO paper_topic (paper_id, topic_id)
            VALUES ($1, $2)
            RETURNING paper_id, topic_id;
        `;
        const params = [paperId, topicId];
        const result = await this.db.query_executor(query, params);
        return result.rows[0];
    }

    removePaperTopic = async (paperId, topicId) => {
        const query = `
            DELETE FROM paper_topic
            WHERE paper_id = $1 AND topic_id = $2
            RETURNING paper_id, topic_id;
        `;
        const params = [paperId, topicId];
        const result = await this.db.query_executor(query, params);
        return result.rows[0] || null;
    }
}

module.exports = PaperModel;