# 01 System Overview

## What It Does
PaperBoat is a research-paper management and discovery system with role-based access and PostgreSQL-backed workflows for papers, authors, reviews, claims, notifications, and dashboards.

## End-to-End Request Lifecycle
1. Frontend page calls API via Axios (frontend/src/api/axios.js).
2. Request hits backend route in backend/src/routes/*.js.
3. Global middleware in backend/src/index.js applies auth except listed public routes.
4. Controller in backend/src/controllers/*.js validates input and business rules.
5. Model in backend/src/models/*.js runs SQL queries against PostgreSQL.
6. Response returns JSON back to frontend page/component.

## Project Layer Responsibility
- Routes: endpoint mapping.
- Controllers: workflow orchestration + role checks.
- Models: SQL and DB interaction.
- Database SQL files: schema, functions, procedures, triggers, indexes.
- Frontend pages/components: role-based UI and feature entry points.

## Main DB Areas
- Identity: user, admin, researcher, venue_user.
- Paper graph: paper, author, paper_author, topic hierarchy, citation.
- Workflow: paper_claim, author_claim_request, feedback.
- Engagement: review, review_vote, follows, library.
- Notifications: notification + receiver + subtype tables.

## Why This Design
- Separation of concerns keeps workflow logic clean.
- SQL remains centralized in models for traceability.
- Stored procedures/triggers handle data integrity and side effects close to data.
- Role checks exist in both frontend and backend for defense in depth.

## Viva Questions
- Why split controller and model layers?
- Where exactly does a request become SQL?
- Why keep some logic in PostgreSQL functions/triggers?

## Common Confusion
- Frontend route protection is not enough; backend auth still enforces rules.
- Middleware decides access first, then controller checks role-specific permissions.

## CS-Level Technical Addendum: MCR + SQL
R layer:
- backend/src/routes/*.js expose endpoint contracts.

C layer:
- backend/src/controllers/*.js apply validation + role gates.

M layer:
- backend/src/models/*.js execute SQL via parameterized queries ($1, $2...).

Hard SQL examples across system:
```sql
SELECT p.id, p.title,
       COALESCE(json_agg(json_build_object('id', a.id, 'name', a.name) ORDER BY pa.position)
       FILTER (WHERE a.id IS NOT NULL), '[]'::json) AS authors
FROM paper p
LEFT JOIN paper_author pa ON pa.paper_id = p.id
LEFT JOIN author a ON a.id = pa.author_id
GROUP BY p.id;
```
```sql
WITH RECURSIVE thread AS (
  SELECT id, paper_id, parent_review_id FROM review WHERE id = $1
  UNION ALL
  SELECT r.id, r.paper_id, r.parent_review_id
  FROM review r JOIN thread t ON t.parent_review_id = r.id
)
SELECT paper_id FROM thread WHERE paper_id IS NOT NULL LIMIT 1;
```
