const DB_Connection = require('../database/db.js');

class VenueModel {
    constructor() {
        this.db = DB_Connection.getInstance();
    }


    createPublisher = async (name, country, website) => {
        const query = `
            INSERT INTO publisher (name, country, website)
            VALUES ($1, $2, $3)
            RETURNING *;
        `;

        const params = [name, country, website];
        const result = await this.db.query_executor(query, params);
        return result.rows[0];
    }

    getAllPublishers = async () => {
        const query = `
            SELECT * FROM publisher
            ORDER BY name;
        `;

        const result = await this.db.query_executor(query);
        return result.rows;
    }

    getPublisherById = async (publisherId) => {
        const query = `
            SELECT * FROM publisher
            WHERE id = $1;
        `;

        const params = [publisherId];
        const result = await this.db.query_executor(query, params);
        return result.rows[0] || null;
    }

    updatePublisher = async (publisherId, name, country, website) => {
        const query = `
            UPDATE publisher
            SET
                name      = COALESCE($2, name),
                country   = COALESCE($3, country),
                website   = COALESCE($4, website)
            WHERE id = $1
            RETURNING *;
        `;

        const params = [publisherId, name, country, website];
        const result = await this.db.query_executor(query, params);
        return result.rows[0] || null;
    }

    deletePublisher = async (publisherId) => {
        const query = `
            DELETE FROM publisher
            WHERE id = $1
            RETURNING id;
        `;

        const params = [publisherId];
        const result = await this.db.query_executor(query, params);
        return result.rows[0] || null;
    }


    createVenue = async (name, type, issn, publisherId) => {
        const query = `
            INSERT INTO venue (name, type, issn, publisher_id)
            VALUES ($1, $2, $3, $4)
            RETURNING *;
        `;

        const params = [name, type, issn, publisherId];
        const result = await this.db.query_executor(query, params);
        return result.rows[0];
    }

    getAllVenues = async () => {
        const query = `
            SELECT
                v.*,
                p.name       AS publisher_name,
                p.country    AS publisher_country,
                p.website    AS publisher_website
            FROM venue v
            LEFT JOIN publisher p ON p.id = v.publisher_id
            ORDER BY v.name;
        `;

        const result = await this.db.query_executor(query);
        return result.rows;
    }

    getVenueById = async (venueId) => {
        const query = `
            SELECT
                v.*,
                p.name       AS publisher_name,
                p.country    AS publisher_country,
                p.website    AS publisher_website
            FROM venue v
            LEFT JOIN publisher p ON p.id = v.publisher_id
            WHERE v.id = $1;
        `;

        const params = [venueId];
        const result = await this.db.query_executor(query, params);
        return result.rows[0] || null;
    }

    updateVenue = async (venueId, name, type, issn, publisherId) => {
        const query = `
            UPDATE venue
            SET
                name         = COALESCE($2, name),
                type         = COALESCE($3, type),
                issn         = COALESCE($4, issn),
                publisher_id = COALESCE($5, publisher_id)
            WHERE id = $1
            RETURNING *;
        `;

        const params = [venueId, name, type, issn, publisherId];
        const result = await this.db.query_executor(query, params);
        return result.rows[0] || null;
    }

    deleteVenue = async (venueId) => {
        const query = `
            DELETE FROM venue
            WHERE id = $1
            RETURNING id;
        `;

        const params = [venueId];
        const result = await this.db.query_executor(query, params);
        return result.rows[0] || null;
    }


    //for venue user reg
    getVenueByIssn = async (issn) => {
        const query = `
            SELECT
                v.*,
                p.name       AS publisher_name,
                p.country    AS publisher_country,
                p.website    AS publisher_website
            FROM venue v
            LEFT JOIN publisher p ON p.id = v.publisher_id
            WHERE v.issn = $1;
        `;

        const params = [issn];
        const result = await this.db.query_executor(query, params);
        return result.rows[0] || null;
    }

    getVenuesByNameAndPublisher = async (venueName, publisherName) => {
        const query = `
            SELECT
                v.*,
                p.name       AS publisher_name,
                p.country    AS publisher_country,
                p.website    AS publisher_website
            FROM venue v
            LEFT JOIN publisher p ON p.id = v.publisher_id
            WHERE
                v.name ILIKE '%' || $1 || '%'
                AND ($2::text IS NULL OR p.name ILIKE '%' || $2 || '%')
            ORDER BY v.name;
        `;

        const params = [venueName, publisherName || null];
        const result = await this.db.query_executor(query, params);
        return result.rows;
    }
}

module.exports = VenueModel;
