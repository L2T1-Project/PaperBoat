const DB_Connection = require("../database/db.js");

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
  };

  getAllPublishers = async () => {
    const query = `
            SELECT * FROM publisher
            ORDER BY name;
        `;

    const result = await this.db.query_executor(query);
    return result.rows;
  };

  getPublisherById = async (publisherId) => {
    const query = `
            SELECT * FROM publisher
            WHERE id = $1;
        `;

    const params = [publisherId];
    const result = await this.db.query_executor(query, params);
    return result.rows[0] || null;
  };

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
  };

  deletePublisher = async (publisherId) => {
    const query = `
            DELETE FROM publisher
            WHERE id = $1
            RETURNING id;
        `;

    const params = [publisherId];
    const result = await this.db.query_executor(query, params);
    return result.rows[0] || null;
  };

  createVenue = async (name, type, issn, publisherId) => {
    const query = `
            INSERT INTO venue (name, type, issn, publisher_id)
            VALUES ($1, $2, $3, $4)
            RETURNING *;
        `;

    const params = [name, type, issn, publisherId];
    const result = await this.db.query_executor(query, params);
    return result.rows[0];
  };

  getAllVenues = async () => {
    const query = `
            SELECT
                v.*,
                p.name       AS publisher_name,
          NULL::TEXT   AS publisher_country,
          NULL::TEXT   AS publisher_website,
          p.img_url    AS publisher_img_url
            FROM venue v
            LEFT JOIN publisher p ON p.id = v.publisher_id
            ORDER BY v.name;
        `;

    const result = await this.db.query_executor(query);
    return result.rows;
  };

  getVenueById = async (venueId) => {
    const query = `
            SELECT
                v.*,
                p.name       AS publisher_name,
          NULL::TEXT   AS publisher_country,
          NULL::TEXT   AS publisher_website,
          p.img_url    AS publisher_img_url
            FROM venue v
            LEFT JOIN publisher p ON p.id = v.publisher_id
            WHERE v.id = $1;
        `;

    const params = [venueId];
    const result = await this.db.query_executor(query, params);
    return result.rows[0] || null;
  };

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
  };

  deleteVenue = async (venueId) => {
    const query = `
            DELETE FROM venue
            WHERE id = $1
            RETURNING id;
        `;

    const params = [venueId];
    const result = await this.db.query_executor(query, params);
    return result.rows[0] || null;
  };

  //for venue user reg
  getVenueByIssn = async (issn) => {
    const query = `
            SELECT
                v.*,
                p.name       AS publisher_name,
          NULL::TEXT   AS publisher_country,
          NULL::TEXT   AS publisher_website,
          p.img_url    AS publisher_img_url
            FROM venue v
            LEFT JOIN publisher p ON p.id = v.publisher_id
        WHERE regexp_replace(UPPER(COALESCE(v.issn, '')), '[^0-9X]', '', 'g') =
            regexp_replace(UPPER(COALESCE($1, '')), '[^0-9X]', '', 'g');
        `;

    const params = [issn];
    const result = await this.db.query_executor(query, params);
    return result.rows[0] || null;
  };

  isVenueClaimed = async (venueId) => {
    const query = `SELECT user_id FROM venue_user WHERE venue_id = $1;`;
    const result = await this.db.query_executor(query, [venueId]);
    return result.rows[0] || null;
  };

  getVenuesByNameWithClaimed = async (name) => {
    const query = `
            SELECT
                v.id,
                v.name,
                v.issn,
                v.type,
                p.id   AS publisher_id,
                p.name AS publisher_name,
                CASE WHEN vu.user_id IS NOT NULL THEN true ELSE false END AS is_claimed
            FROM venue v
            JOIN publisher p ON p.id = v.publisher_id
            LEFT JOIN venue_user vu ON vu.venue_id = v.id
            WHERE v.name ILIKE '%' || $1 || '%'
            ORDER BY v.name;
        `;

    const result = await this.db.query_executor(query, [name]);
    return result.rows;
  };

  getVenuesByNameAndPublisher = async (venueName, publisherName) => {
    const query = `
            SELECT
                v.*,
                p.name       AS publisher_name,
          NULL::TEXT   AS publisher_country,
          NULL::TEXT   AS publisher_website,
          p.img_url    AS publisher_img_url
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
  };

  // ── Venue Profile Endpoints ────────────────────────────────────────────

  getVenueStats = async (venueId) => {
    const query = `
      SELECT
        COUNT(DISTINCT paper.id)           AS paper_count,
        COUNT(DISTINCT pa.author_id)       AS author_count,
        COALESCE(SUM(cite_counts.cnt), 0)  AS citation_count
      FROM venue v
      LEFT JOIN paper ON paper.venue_id = v.id
      LEFT JOIN paper_author pa ON pa.paper_id = paper.id
      LEFT JOIN (
        SELECT citing_id, COUNT(*) AS cnt
        FROM citation GROUP BY citing_id
      ) cite_counts ON cite_counts.citing_id = paper.id
      WHERE v.id = $1
    `;
    const result = await this.db.query_executor(query, [venueId]);
    return result.rows[0];
  };

  getVenuePapers = async (venueId, limit = 20, offset = 0) => {
    const query = `
      SELECT
        p.id, p.title, p.publication_date, p.doi, p.is_retracted, p.pdf_url,
        COUNT(c.cited_id) AS citation_count,
        COALESCE(
          json_agg(
            json_build_object('id', a.id, 'name', a.name)
            ORDER BY pa.position
          ) FILTER (WHERE a.id IS NOT NULL),
          '[]'
        ) AS authors
      FROM paper p
      LEFT JOIN citation     c  ON c.citing_id  = p.id
      LEFT JOIN paper_author pa ON pa.paper_id  = p.id
      LEFT JOIN author       a  ON a.id         = pa.author_id
      WHERE p.venue_id = $1
      GROUP BY p.id
      ORDER BY p.publication_date DESC NULLS LAST
      LIMIT $2 OFFSET $3
    `;
    const result = await this.db.query_executor(query, [venueId, limit, offset]);
    return result.rows;
  };

  getVenueAuthors = async (venueId) => {
    const query = `
      SELECT
        a.id, a.name, a.orc_id,
        COUNT(DISTINCT pa.paper_id) AS paper_count,
        r.user_id AS researcher_user_id
      FROM paper p
      JOIN paper_author pa ON pa.paper_id  = p.id
      JOIN author       a  ON a.id         = pa.author_id
      LEFT JOIN researcher r ON r.author_id = a.id
      WHERE p.venue_id = $1
      GROUP BY a.id, a.name, a.orc_id, r.user_id
      ORDER BY paper_count DESC
      LIMIT 50
    `;
    const result = await this.db.query_executor(query, [venueId]);
    return result.rows;
  };
}

module.exports = VenueModel;
