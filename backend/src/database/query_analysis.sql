-- Query-measurement checklist (OpenAlex-populated tables only)
-- Scope: publisher, venue, paper, author, institute, domain, field, topic,
--        paper_author, paper_topic, citation.

SET statement_timeout = '30s';
SET idle_in_transaction_session_timeout = '30s';

-- Refresh planner stats before probes.
ANALYZE;


-- ==========================
-- Probe 1: Papers by venue
-- Typical pattern: list recent papers for a venue page.
-- ==========================
EXPLAIN (ANALYZE, BUFFERS)
WITH sample_venue AS (
	SELECT p.venue_id
	FROM paper p
	GROUP BY p.venue_id
	ORDER BY COUNT(*) DESC
	LIMIT 1
)
SELECT p.id, p.title, p.publication_date, p.doi
FROM paper p
JOIN sample_venue sv ON sv.venue_id = p.venue_id
ORDER BY p.publication_date DESC
LIMIT 100;


-- ==========================
-- Probe 2: Author -> Papers
-- Typical pattern: author profile with publications.
-- ==========================
EXPLAIN (ANALYZE, BUFFERS)
WITH sample_author AS (
	SELECT pa.author_id
	FROM paper_author pa
	GROUP BY pa.author_id
	ORDER BY COUNT(*) DESC
	LIMIT 1
)
SELECT p.id, p.title, p.publication_date, pa.position
FROM paper_author pa
JOIN paper p ON p.id = pa.paper_id
JOIN sample_author sa ON sa.author_id = pa.author_id
ORDER BY p.publication_date DESC
LIMIT 100;


-- ==========================
-- Probe 3: Topic -> Papers
-- Typical pattern: topic exploration pages.
-- ==========================
EXPLAIN (ANALYZE, BUFFERS)
WITH sample_topic AS (
	SELECT pt.topic_id
	FROM paper_topic pt
	GROUP BY pt.topic_id
	ORDER BY COUNT(*) DESC
	LIMIT 1
)
SELECT p.id, p.title, p.publication_date
FROM paper_topic pt
JOIN paper p ON p.id = pt.paper_id
JOIN sample_topic st ON st.topic_id = pt.topic_id
ORDER BY p.publication_date DESC
LIMIT 100;


-- ==========================
-- Probe 4: Citation outgoing (references)
-- Typical pattern: papers referenced by a given paper.
-- ==========================
EXPLAIN (ANALYZE, BUFFERS)
WITH sample_paper AS (
	SELECT c.citing_id
	FROM citation c
	GROUP BY c.citing_id
	ORDER BY COUNT(*) DESC
	LIMIT 1
)
SELECT p2.id, p2.title, p2.publication_date
FROM citation c
JOIN sample_paper sp ON sp.citing_id = c.citing_id
JOIN paper p2 ON p2.id = c.cited_id
LIMIT 100;


-- ==========================
-- Probe 5: Citation incoming (cited-by)
-- Typical pattern: citation count and citing papers.
-- ==========================
EXPLAIN (ANALYZE, BUFFERS)
WITH sample_cited AS (
	SELECT c.cited_id
	FROM citation c
	GROUP BY c.cited_id
	ORDER BY COUNT(*) DESC
	LIMIT 1
)
SELECT p1.id, p1.title, p1.publication_date
FROM citation c
JOIN sample_cited sc ON sc.cited_id = c.cited_id
JOIN paper p1 ON p1.id = c.citing_id
LIMIT 100;


-- ==========================
-- Probe 6: Venue by publisher
-- Typical pattern: publisher page listing venues.
-- ==========================
EXPLAIN (ANALYZE, BUFFERS)
WITH sample_publisher AS (
	SELECT v.publisher_id
	FROM venue v
	GROUP BY v.publisher_id
	ORDER BY COUNT(*) DESC
	LIMIT 1
)
SELECT v.id, v.name, v.type, v.issn
FROM venue v
JOIN sample_publisher sp ON sp.publisher_id = v.publisher_id
ORDER BY v.name
LIMIT 200;


-- ==========================
-- Probe 7: Domain -> Field -> Topic tree
-- Typical pattern: taxonomy browsing.
-- ==========================
EXPLAIN (ANALYZE, BUFFERS)
WITH sample_domain AS (
	SELECT d.id
	FROM domain d
	JOIN field f ON f.domain_id = d.id
	GROUP BY d.id
	ORDER BY COUNT(*) DESC
	LIMIT 1
)
SELECT d.id AS domain_id,
	   f.id AS field_id,
	   t.id AS topic_id,
	   d.name AS domain_name,
	   f.name AS field_name,
	   t.name AS topic_name
FROM sample_domain sd
JOIN domain d ON d.id = sd.id
JOIN field f ON f.domain_id = d.id
LEFT JOIN topic t ON t.field_id = f.id
ORDER BY f.name, t.name
LIMIT 500;


-- ==========================
-- Probe 8: Institute lookup by country
-- Typical pattern: filtering institute directory.
-- ==========================
EXPLAIN (ANALYZE, BUFFERS)
WITH sample_country AS (
	SELECT i.country
	FROM institute i
	WHERE i.country IS NOT NULL
	GROUP BY i.country
	ORDER BY COUNT(*) DESC
	LIMIT 1
)
SELECT i.id, i.name, i.country
FROM institute i
JOIN sample_country sc ON sc.country = i.country
ORDER BY i.name
LIMIT 300;


-- ==========================
-- Probe 9: DOI lookup
-- Typical pattern: exact DOI fetch.
-- ==========================
EXPLAIN (ANALYZE, BUFFERS)
WITH sample_doi AS (
	SELECT p.doi
	FROM paper p
	WHERE p.doi IS NOT NULL
	LIMIT 1
)
SELECT p.id, p.title, p.publication_date, p.doi
FROM paper p
JOIN sample_doi sd ON sd.doi = p.doi;


-- ==========================
-- Optional search probes
-- Run these before deciding trigram indexes.
-- ==========================
EXPLAIN (ANALYZE, BUFFERS)
SELECT p.id, p.title
FROM paper p
WHERE lower(p.title) LIKE '%graph%'
ORDER BY p.publication_date DESC
LIMIT 20;

EXPLAIN (ANALYZE, BUFFERS)
SELECT a.id, a.name
FROM author a
WHERE lower(a.name) LIKE '%smith%'
LIMIT 20;

EXPLAIN (ANALYZE, BUFFERS)
SELECT v.id, v.name
FROM venue v
WHERE lower(v.name) LIKE '%journal%'
LIMIT 20;


-- Decision rubric:
-- 1) If scan node is Seq Scan on a large table and execution time is high, consider index.
-- 2) Re-run probe after adding index; keep only if plan/time clearly improve.
-- 3) Skip indexes that do not materially reduce latency.
