# 07 Statistics And Dashboard Queries

## What This Page Actually Calls From Frontend
Statistics page frontend file: frontend/src/pages/StatisticsPage.jsx

On initial load (and when windowDays changes), frontend sends:
1. GET /api/topics/stats/summary
2. GET /api/topics/stats/momentum?limit=20&windowDays=<days>
3. GET /api/topics/stats/top-cited-papers?limit=10
4. GET /api/topics

When topic dropdown changes, frontend sends:
5. GET /api/topics/stats/topics/:topicId/top-authors?limit=10

Dashboard page frontend file: frontend/src/pages/DashboardPage.jsx

Researcher dashboard calls:
1. GET /api/researchers/:id/dashboard/papers?limit=5&offset=0
2. GET /api/researchers/:id/dashboard/papers?limit=50&offset=0

Venue user dashboard calls:
1. GET /api/venue-users/:id/dashboard/top-cited-papers?limit=10&offset=0
2. GET /api/venue-users/:id/dashboard/published-papers?limit=100&offset=0
3. GET /api/venue-users/:id/dashboard/prominent-authors?limit=8

## What Is Rendered In UI From These Queries
StatisticsPage cards:
- total_papers
- total_authors
- total_venues
- total_researchers
- total_citations

Topic Momentum table:
- topic_name, field_name, domain_name
- momentum_score
- citation_delta
- paper_delta

Most Cited Papers panel:
- paper_id, title, venue_name, citation_count

Top Authors by Topic panel:
- author_id, author_name
- paper_count_in_topic
- citation_count_in_topic

Researcher Dashboard panels:
- paper_id, title, venue_name, citation_count

Venue Dashboard panels:
- top cited papers from venue function
- published papers from venue function
- prominent authors from venue function

## Which Statistics Use Which Functions
StatisticsPage (frontend/src/pages/StatisticsPage.jsx):
- Summary cards (`total_papers`, `total_authors`, `total_venues`, `total_researchers`, `total_citations`)
  - Uses direct SQL in `topicModel.getPlatformSummaryStats()`
  - No DB function call.
- Topic Momentum table
  - Uses direct SQL CTE query in `topicModel.getTopicMomentum()`
  - No DB function call.
- Most Cited Papers panel
  - Uses direct SQL aggregate in `topicModel.getMostCitedPapers()`
  - No DB function call.
- Top Authors by Topic panel
  - Uses direct SQL CTE+aggregate in `topicModel.getTopAuthorsByTopicCitations()`
  - No DB function call.

DashboardPage role-specific analytics:
- Researcher papers list -> DB function `fn_get_researcher_recent_papers`.
- Venue top cited papers -> DB function `fn_get_venue_top_cited_papers`.
- Venue published papers -> DB function `fn_get_venue_published_papers`.
- Venue prominent authors -> DB function `fn_get_venue_prominent_authors`.

Author profile metrics (outside StatisticsPage, but still analytics-related):
- `get_author_citation_count`, `compute_h_index`, and `get_paper_citation_count` are used in `authorModel` queries.

## Exact MCR For StatisticsPage Endpoints
1. Summary Stats
- R: GET /api/topics/stats/summary
- C: topicController.getSummaryStats()
- M: topicModel.getPlatformSummaryStats()
- SQL:
```sql
SELECT
  (SELECT COUNT(*)::INT FROM paper) AS total_papers,
  (SELECT COUNT(*)::INT FROM author) AS total_authors,
  (SELECT COUNT(*)::INT FROM venue) AS total_venues,
  (SELECT COUNT(*)::INT FROM researcher) AS total_researchers,
  (SELECT COUNT(*)::INT FROM citation) AS total_citations;
```

2. Topic Momentum
- R: GET /api/topics/stats/momentum
- C: topicController.getTopicMomentum()
- M: topicModel.getTopicMomentum(limit, windowDays)
- SQL style: CTE with current and previous windows, then weighted score
```sql
WITH bounds AS (...), topic_activity AS (...)
SELECT
  topic_id, topic_name, field_name, domain_name,
  (citations_current - citations_previous) AS citation_delta,
  (papers_current - papers_previous) AS paper_delta,
  ROUND((0.7 * citation_growth) + (0.3 * paper_growth), 4) AS momentum_score
FROM topic_activity
ORDER BY momentum_score DESC
LIMIT $2;
```

### Topic Momentum Query Explained
`topicModel.getTopicMomentum(limit, windowDays)` works in three stages:

1. `bounds` CTE defines two time windows from `windowDays`:
- Current window: `[today - windowDays, today)`
- Previous window: `[today - 2*windowDays, today - windowDays)`

2. `topic_activity` CTE computes per-topic counts:
- `papers_current`, `papers_previous`
- `citations_current`, `citations_previous`
It joins topic -> field -> domain, then `paper_topic`, `paper`, and citation links (`citation` + citing paper dates).

3. Final select computes deltas and score:
- `citation_delta = citations_current - citations_previous`
- `paper_delta = papers_current - papers_previous`
- `momentum_score = round(0.7 * citation_growth_rate + 0.3 * paper_growth_rate, 4)`
  - growth rates use division by `GREATEST(previous, 1)` to avoid divide-by-zero.

Why this matters:
- It favors citation acceleration more than paper volume growth.
- It compares relative growth, not just absolute counts.
- Ordering by momentum score ranks fastest-rising topics first.

3. Most Cited Papers
- R: GET /api/topics/stats/top-cited-papers
- C: topicController.getMostCitedPapers()
- M: topicModel.getMostCitedPapers(limit)
- SQL:
```sql
SELECT
  p.id AS paper_id,
  p.title,
  v.name AS venue_name,
  COUNT(c.cited_id)::INT AS citation_count
FROM paper p
LEFT JOIN citation c ON c.cited_id = p.id
LEFT JOIN venue v ON v.id = p.venue_id
GROUP BY p.id, v.id
ORDER BY citation_count DESC, p.publication_date DESC NULLS LAST
LIMIT $1;
```

4. Top Authors By Topic
- R: GET /api/topics/stats/topics/:topicId/top-authors
- C: topicController.getTopAuthorsByTopic()
- M: topicModel.getTopAuthorsByTopicCitations(topicId, limit)
- SQL style: topic_papers CTE + citation_counts CTE + grouped author ranking
```sql
WITH topic_papers AS (...), citation_counts AS (...)
SELECT
  a.id AS author_id,
  a.name AS author_name,
  COUNT(DISTINCT tp.paper_id)::INT AS paper_count_in_topic,
  COALESCE(SUM(cc.paper_citation_count), 0)::INT AS citation_count_in_topic
FROM topic_papers tp
JOIN paper_author pa ON pa.paper_id = tp.paper_id
JOIN author a ON a.id = pa.author_id
LEFT JOIN citation_counts cc ON cc.paper_id = tp.paper_id
GROUP BY a.id, a.name
ORDER BY citation_count_in_topic DESC, paper_count_in_topic DESC
LIMIT $2;
```

## Exact MCR For Dashboard Analytics Endpoints
Researcher dashboard papers:
- R: GET /api/researchers/:id/dashboard/papers
- C: researcherController.getDashboardPapers()
- M: researcherModel.getDashboardPapers(researcherId, limit, offset)
- SQL call:
```sql
SELECT *
FROM fn_get_researcher_recent_papers($1, $2, $3);
```

Venue dashboard top cited:
- R: GET /api/venue-users/:id/dashboard/top-cited-papers
- C: venueUserController.getDashboardTopCitedPapers()
- M: venueUserModel.getDashboardTopCitedPapers(userId, limit, offset)
- SQL call:
```sql
SELECT *
FROM fn_get_venue_top_cited_papers($1, $2, $3);
```

Venue dashboard published papers:
- R: GET /api/venue-users/:id/dashboard/published-papers
- C: venueUserController.getDashboardPublishedPapers()
- M: venueUserModel.getDashboardPublishedPapers(userId, limit, offset)
- SQL call:
```sql
SELECT *
FROM fn_get_venue_published_papers($1, $2, $3);
```

Venue dashboard prominent authors:
- R: GET /api/venue-users/:id/dashboard/prominent-authors
- C: venueUserController.getDashboardProminentAuthors()
- M: venueUserModel.getDashboardProminentAuthors(userId, limit)
- SQL call:
```sql
SELECT *
FROM fn_get_venue_prominent_authors($1, $2);
```

## Authorization Rules For These Endpoints
- Statistics page routes are authenticated because they are not in backend publicRoutes allowlist.
- Researcher and venue dashboard controllers also enforce owner check:
  - req.auth.userId must equal URL :id, otherwise 403.

## Why This Split Exists
- Platform-wide analytics (topic summary, momentum, citation leaders) use topicModel direct SQL with CTEs and aggregation.
- Role-specific dashboard analytics use SQL functions for reusable, optimized per-role result sets.
