const DB_Connection = require("../database/db.js");

class AuthorModel {
  constructor() {
    this.db = DB_Connection.getInstance();
  }

  createAuthor = async (payload) => {
    const { name, orc_id = null } = payload;

    const query = `
            INSERT INTO author (name, orc_id)
            VALUES ($1, $2)
            RETURNING id, name, orc_id;
        `;

    const params = [name, orc_id];
    const result = await this.db.query_executor(query, params);
    return result.rows[0];
  };

  getAllAuthors = async () => {
    const query = `
            SELECT id, name, orc_id
            FROM author
            ORDER BY name;
        `;

    const result = await this.db.query_executor(query);
    return result.rows;
  };

  getAuthorById = async (id) => {
    const query = `
            SELECT id, name, orc_id
            FROM author
            WHERE id = $1;
        `;

    const params = [id];
    const result = await this.db.query_executor(query, params);
    return result.rows[0] || null;
  };

  updateAuthor = async (id, payload) => {
    const { name, orc_id = null } = payload;

    const query = `
            UPDATE author
            SET
                name   = $2,
                orc_id = $3
            WHERE id = $1
            RETURNING id, name, orc_id;
        `;

    const params = [id, name, orc_id];
    const result = await this.db.query_executor(query, params);
    return result.rows[0] || null;
  };

  deleteAuthor = async (id) => {
    const query = `
            DELETE FROM author
            WHERE id = $1
            RETURNING id, name;
        `;

    const params = [id];
    const result = await this.db.query_executor(query, params);
    return result.rows[0] || null;
  };

  // All papers written by this author
  getPapersByAuthor = async (authorId) => {
    const query = `
            SELECT
                p.id,
                p.title,
                p.publication_date,
                p.pdf_url,
                p.doi,
                p.is_retracted,
                p.github_repo,
                pa.position,
                v.name AS venue_name
            FROM paper_author pa
            JOIN paper p ON p.id = pa.paper_id
            JOIN venue v ON v.id = p.venue_id
            WHERE pa.author_id = $1
            ORDER BY p.publication_date DESC;
        `;

    const params = [authorId];
    const result = await this.db.query_executor(query, params);
    return result.rows;
  };

  // All authors of a specific paper (with position)
  getAuthorsByPaper = async (paperId) => {
    const query = `
            SELECT
                a.id,
                a.name,
                a.orc_id,
                pa.position
            FROM paper_author pa
            JOIN author a ON a.id = pa.author_id
            WHERE pa.paper_id = $1
            ORDER BY pa.position;
        `;

    const params = [paperId];
    const result = await this.db.query_executor(query, params);
    return result.rows;
  };

  //paper_author table ta te insert kortesi
  createPaperAuthor = async (authorId, paperId, position) => {
    const query = `
            INSERT INTO paper_author (paper_id, author_id, position)
            VALUES ($1, $2, $3)
            RETURNING paper_id, author_id, position;
        `;

    const params = [paperId, authorId, position];
    const result = await this.db.query_executor(query, params);
    return result.rows[0];
  };

  deletePaperAuthor = async (authorId, paperId) => {
    const query = `
            DELETE FROM paper_author
            WHERE author_id = $1 AND paper_id = $2
            RETURNING paper_id, author_id;
        `;

    const params = [authorId, paperId];
    const result = await this.db.query_executor(query, params);
    return result.rows[0] || null;
  };

  getAuthorByOrcId = async (orcId) => {
    const query = `
            SELECT id, name, orc_id
            FROM author
            WHERE orc_id = $1;
        `;

    const params = [orcId];
    const result = await this.db.query_executor(query, params);
    return result.rows[0] || null;
  };

  isAuthorClaimed = async (authorId) => {
    const query = `SELECT user_id FROM researcher WHERE author_id = $1;`;
    const result = await this.db.query_executor(query, [authorId]);
    return result.rows[0] || null;
  };

  // All authors matching a name (case-insensitive), each with their most
  // recent paper — used when no ORC ID is provided so the user can
  // identify themselves from the list
  getAuthorsByName = async (name) => {
    const query = `
            SELECT
                a.id,
                a.name,
                a.orc_id,
                sample.paper_id,
                sample.paper_title
            FROM author a
            LEFT JOIN LATERAL (
                SELECT
                    p.id   AS paper_id,
                    p.title AS paper_title
                FROM paper_author pa
                JOIN paper p ON p.id = pa.paper_id
                WHERE pa.author_id = a.id
                ORDER BY p.publication_date DESC
                LIMIT 1
            ) sample ON true
            WHERE a.name ILIKE '%' || $1 || '%'
            ORDER BY a.name;
        `;

    const params = [name];
    const result = await this.db.query_executor(query, params);
    return result.rows;
  };
  // Full author profile: basic info + h-index + citation stats.
  // Computes h-index inline via CTE — works for all authors, including
  // those without a researcher account (same algorithm as compute_h_index() in functions.sql).
  getAuthorProfile = async (authorId) => {
    const query = `
      WITH paper_cites AS (
          SELECT pa.paper_id,
                 COUNT(c.citing_id)::INT AS cites
          FROM paper_author pa
          LEFT JOIN citation c ON c.cited_id = pa.paper_id
          WHERE pa.author_id = $1
          GROUP BY pa.paper_id
      ),
      h_calc AS (
          SELECT COALESCE(MAX(ranked.rnk), 0) AS h_index
          FROM (
              SELECT cites,
                     ROW_NUMBER() OVER (ORDER BY cites DESC) AS rnk
              FROM paper_cites
          ) ranked
          WHERE ranked.cites >= ranked.rnk
      )
      SELECT
          a.id,
          a.name,
          a.orc_id,
          res.user_id          AS researcher_user_id,
          u.username,
          u.full_name,
          u.profile_pic_url,
          u.bio,
          (SELECT COUNT(*)::INT FROM paper_author pa2 WHERE pa2.author_id = a.id) AS paper_count,
          COALESCE((SELECT SUM(cites)::INT FROM paper_cites), 0)                  AS total_citations,
          (SELECT h_index FROM h_calc)                                            AS h_index
      FROM author a
      LEFT JOIN researcher res ON res.author_id = a.id
      LEFT JOIN "user" u       ON u.id = res.user_id
      WHERE a.id = $1;
    `;
    const result = await this.db.query_executor(query, [authorId]);
    return result.rows[0] || null;
  };
}

module.exports = AuthorModel;
