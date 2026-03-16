const path = require('path');
const dotenv = require('dotenv');
const DB_Connection = require('../database/db');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const REQUIRED_TABLES = [
  'status',
  'publisher',
  'venue',
  'author',
  'institute',
  'paper',
  'domain',
  'field',
  'topic',
  'paper_author',
  'paper_topic',
  'citation'
];

function printSection(title) {
  console.log(`\n=== ${title} ===`);
}

async function runPreflight(client) {
  printSection('Preflight: Required Tables');
  const tablesRes = await client.query(
    `
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = ANY($1::text[])
    ORDER BY table_name
    `,
    [REQUIRED_TABLES]
  );

  const found = new Set(tablesRes.rows.map((r) => r.table_name));
  const missing = REQUIRED_TABLES.filter((t) => !found.has(t));
  console.log('found:', [...found].join(', '));
  if (missing.length) {
    throw new Error(`Missing tables: ${missing.join(', ')}`);
  }
  console.log('missing: none');

  printSection('Preflight: status id=1 existence');
  const statusRes = await client.query('SELECT id, status_name FROM status WHERE id = 1');
  if (statusRes.rowCount === 0) {
    throw new Error('status row id=1 does not exist. Required by user.status_id DEFAULT 1.');
  }
  console.log(`status id=1 -> ${statusRes.rows[0].status_name || '(null name)'}`);

  printSection('Preflight: Unique Constraint Targets');
  const uqRes = await client.query(`
    SELECT tc.table_name, tc.constraint_name
    FROM information_schema.table_constraints tc
    WHERE tc.table_schema = 'public'
      AND tc.constraint_type = 'UNIQUE'
      AND tc.table_name IN ('author','venue','paper')
    ORDER BY tc.table_name, tc.constraint_name
  `);
  uqRes.rows.forEach((r) => console.log(`${r.table_name}: ${r.constraint_name}`));
}

async function runPostChecks(client) {
  printSection('Counts');
  const countsRes = await client.query(`
    SELECT
      (SELECT COUNT(*) FROM publisher) AS publishers,
      (SELECT COUNT(*) FROM venue) AS venues,
      (SELECT COUNT(*) FROM author) AS authors,
      (SELECT COUNT(*) FROM institute) AS institutes,
      (SELECT COUNT(*) FROM domain) AS domains,
      (SELECT COUNT(*) FROM field) AS fields,
      (SELECT COUNT(*) FROM topic) AS topics,
      (SELECT COUNT(*) FROM paper) AS papers,
      (SELECT COUNT(*) FROM paper_author) AS paper_authors,
      (SELECT COUNT(*) FROM paper_topic) AS paper_topics,
      (SELECT COUNT(*) FROM citation) AS citations
  `);
  console.table(countsRes.rows);

  printSection('Orphan Checks');
  const orphanPaperAuthor = await client.query(`
    SELECT COUNT(*) AS orphan_paper_author
    FROM paper_author pa
    LEFT JOIN paper p ON p.id = pa.paper_id
    LEFT JOIN author a ON a.id = pa.author_id
    WHERE p.id IS NULL OR a.id IS NULL
  `);
  const orphanPaperTopic = await client.query(`
    SELECT COUNT(*) AS orphan_paper_topic
    FROM paper_topic pt
    LEFT JOIN paper p ON p.id = pt.paper_id
    LEFT JOIN topic t ON t.id = pt.topic_id
    WHERE p.id IS NULL OR t.id IS NULL
  `);
  const orphanCitation = await client.query(`
    SELECT COUNT(*) AS orphan_citation
    FROM citation c
    LEFT JOIN paper p1 ON p1.id = c.citing_id
    LEFT JOIN paper p2 ON p2.id = c.cited_id
    WHERE p1.id IS NULL OR p2.id IS NULL
  `);
  console.table([
    orphanPaperAuthor.rows[0],
    orphanPaperTopic.rows[0],
    orphanCitation.rows[0]
  ]);

  printSection('Duplicate Key Safety');
  const dupDoi = await client.query(`
    SELECT COUNT(*) AS duplicate_doi_groups
    FROM (
      SELECT doi
      FROM paper
      WHERE doi IS NOT NULL
      GROUP BY doi
      HAVING COUNT(*) > 1
    ) x
  `);
  const dupOrcid = await client.query(`
    SELECT COUNT(*) AS duplicate_orcid_groups
    FROM (
      SELECT orc_id
      FROM author
      WHERE orc_id IS NOT NULL
      GROUP BY orc_id
      HAVING COUNT(*) > 1
    ) x
  `);
  const dupIssn = await client.query(`
    SELECT COUNT(*) AS duplicate_issn_groups
    FROM (
      SELECT issn
      FROM venue
      WHERE issn IS NOT NULL
      GROUP BY issn
      HAVING COUNT(*) > 1
    ) x
  `);
  const selfCitation = await client.query(`
    SELECT COUNT(*) AS self_citations
    FROM citation
    WHERE citing_id = cited_id
  `);
  console.table([
    dupDoi.rows[0],
    dupOrcid.rows[0],
    dupIssn.rows[0],
    selfCitation.rows[0]
  ]);
}

async function main() {
  const modeArg = process.argv.find((a) => a.startsWith('--mode='));
  const mode = modeArg ? modeArg.split('=')[1] : 'post';

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required in backend/.env');
  }

  const db = DB_Connection.getInstance();
  const client = await db.pool.connect();
  try {
    if (mode === 'preflight') {
      await runPreflight(client);
    } else if (mode === 'post') {
      await runPostChecks(client);
    } else {
      throw new Error(`Unsupported mode: ${mode}`);
    }
  } finally {
    client.release();
    await db.pool.end();
  }
}

main().catch((err) => {
  console.error('Integrity check failed:', err.message);
  process.exitCode = 1;
});
