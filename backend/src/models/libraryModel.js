const DB_Connection = require("../database/db.js");

class LibraryModel {
  constructor() {
    this.db = DB_Connection.getInstance();
  }

  savePaper = async (userId, paperId) => {
    await this.db.query_executor(
      `INSERT INTO user_library (user_id, paper_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [userId, paperId]
    );
  };

  unsavePaper = async (userId, paperId) => {
    await this.db.query_executor(
      `DELETE FROM user_library WHERE user_id = $1 AND paper_id = $2`,
      [userId, paperId]
    );
  };

  isSaved = async (userId, paperId) => {
    const result = await this.db.query_executor(
      `SELECT 1 FROM user_library WHERE user_id = $1 AND paper_id = $2`,
      [userId, paperId]
    );
    return result.rowCount > 0;
  };

  getSavedPapers = async (userId) => {
    const result = await this.db.query_executor(`
      SELECT
        p.id, p.title, p.publication_date, p.doi, p.is_retracted, p.pdf_url,
        ul.saved_at,
        v.id   AS venue_id,
        v.name AS venue_name,
        v.type AS venue_type,
        COUNT(DISTINCT c.cited_id) AS citation_count,
        COALESCE(
          json_agg(
            json_build_object('id', a.id, 'name', a.name)
            ORDER BY pa.position
          ) FILTER (WHERE a.id IS NOT NULL),
          '[]'
        ) AS authors
      FROM user_library ul
      JOIN paper         p  ON p.id  = ul.paper_id
      JOIN venue         v  ON v.id  = p.venue_id
      LEFT JOIN citation     c  ON c.citing_id = p.id
      LEFT JOIN paper_author pa ON pa.paper_id = p.id
      LEFT JOIN author       a  ON a.id        = pa.author_id
      WHERE ul.user_id = $1
      GROUP BY p.id, v.id, ul.saved_at
      ORDER BY ul.saved_at DESC
    `, [userId]);
    return result.rows;
  };
}

module.exports = LibraryModel;
