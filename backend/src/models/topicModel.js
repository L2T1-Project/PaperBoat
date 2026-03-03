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
}

module.exports = TopicModel;
