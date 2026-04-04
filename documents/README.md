# PaperBoat Technical Documentation Index

Purpose: Viva-ready, concise documentation for all major backend workflows, authorization/authentication, and SQL logic.

## Recommended 10-Minute Presentation Order
1. 01-system-overview.md
2. 02-authentication.md
3. 03-authorization-and-navbar-visibility.md
4. 04-add-paper-approval-decline.md
5. 05-paper-claim-approval.md
6. 06-author-claim-approval-admin-review.md
7. 07-statistics-and-dashboard-queries.md
8. 08-db-functions-procedures-triggers-constraints.md
9. 09-cloudinary-profile-image-upload.md
10. 10-institute-history-constraints.md
11. 11-notifications-architecture.md
12. 12-sql-query-index.md
13. 13-route-to-feature-coverage.md

## How To Read Each File
Each file follows the same format:
- What it does
- End-to-end flow
- Authorization checks
- Main SQL objects
- Why this design
- Viva questions
- Common confusion points

## Scope Covered
- Every core feature workflow (UI to API to SQL)
- Authentication and authorization implementation
- Trigger/procedure/function usage and necessity
- Statistics page query sources
- Paper claim and admin approval flows
- Cloudinary upload flow
- Institute history constraints
- Query location index (models + database SQL files)

## Source Anchors
Backend:
- backend/src/index.js
- backend/src/middlewares/authenticateToken.js
- backend/src/controllers/*.js
- backend/src/models/*.js
- backend/src/database/schema.sql
- backend/src/database/functions.sql
- backend/src/database/procedures.sql
- backend/src/database/triggers.sql

Frontend:
- frontend/src/App.jsx
- frontend/src/routes/ProtectedRoute.jsx
- frontend/src/components/layout/AppHeader.jsx
- frontend/src/pages/*.jsx

## MCR Legend (Used In All Docs)
- M: Model method where SQL is written.
- C: Controller method that orchestrates workflow and authorization.
- R: Route endpoint exposed by backend.

## SQL Evidence Style
Every workflow file now includes:
1. Route -> Controller -> Model chain.
2. Hard SQL snippet/function/procedure names.
3. Tables/index/trigger objects touched.
