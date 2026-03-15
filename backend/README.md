# PaperBoat Backend Documentation

This document is a compact but detailed technical reference for the backend service in this repository.

## 1. Overview

PaperBoat backend is an Express + PostgreSQL API for a research-paper social platform.

Main capabilities:

- User authentication and profile management
- Role-oriented account flows (user, researcher, venue user, admin)
- Paper, author, venue, institute, topic, and review management
- Social graph features (follow/unfollow)
- User libraries, paper claims, and notifications

Core runtime stack:

- Node.js + Express 5
- PostgreSQL (via `pg` Pool)
- JWT auth (`jsonwebtoken`)
- Password hashing (`bcrypt`)

## 2. Directory Map

- `src/index.js`: Application bootstrap, middleware, route mounting
- `src/middlewares/authenticateToken.js`: JWT validation + token revocation check
- `src/database/db.js`: Singleton DB pool and query executor
- `src/controllers/`: Request validation and HTTP response orchestration
- `src/models/`: SQL/query layer
- `src/routes/`: Endpoint declarations and controller mapping
- `src/database/schema.sql`: Database schema definition
- `src/database/functions.sql`: SQL helper functions (citations/h-index)
- `src/database/procedures.sql`: Business procedures (notification, claim approval)
- `src/database/triggers.sql`: Trigger automation on DB events

## 3. App Startup and Request Flow

1. `dotenv` loads env from backend `.env`.
2. Express JSON parser + CORS are enabled globally.
3. Auth middleware runs for all routes except explicit public route list.
4. Routers are mounted under `/api/*`.
5. Server starts on `PORT` (default `3000`).

Request flow (protected route):

1. Client sends `Authorization: Bearer <jwt>`.
2. Middleware verifies JWT signature (`JWT_SECRET`).
3. Middleware checks user exists.
4. Middleware checks presented token matches `user.jwt_token` in DB.
5. Controller executes business logic through model methods.

## 4. Authentication and Access Model

### 4.1 JWT Behavior

- JWT payload includes: `userId`, `role`
- Token lifetime: `7d`
- Token is persisted in DB (`user.jwt_token`)
- Logout clears stored token
- Password change clears stored token (forces re-login)

### 4.2 Public Routes (no auth required)

- `POST /api/users/login`
- `POST /api/users`
- `GET /api/users/statuses`
- `GET /api/users/status/all`
- `GET /api/authors/lookup/orc-id`
- `GET /api/authors/lookup/name`
- `POST /api/researchers`
- `GET /api/venues/lookup/issn`
- `GET /api/venues/lookup/name`
- `POST /api/venue-users`

All other mounted routes require a valid token unless `BYPASS=true`.

### 4.3 Login Protection

Login endpoint includes in-memory rate limiting per IP:

- Window: 15 minutes
- Maximum failed attempts: 5
- On exceed: `429 Too Many Requests`

## 5. Environment Variables

| Variable             | Required | Purpose                                     |
| -------------------- | -------- | ------------------------------------------- |
| `PORT`               | No       | HTTP port (default 3000)                    |
| `DATABASE_URL`       | Yes      | PostgreSQL connection string                |
| `JWT_SECRET`         | Yes      | JWT signing/verification secret             |
| `BCRYPT_SALT_ROUNDS` | No       | Password hash cost (default 12)             |
| `LOG_SQL`            | No       | Enable SQL query logging when `true`        |
| `BYPASS`             | No       | Skip auth middleware when `true` (dev only) |

## 6. API Base and Response Pattern

Base URL prefix: `/api`

Common response shape (many endpoints):

- Success list: `{ success: true, count, data }`
- Success single: `{ success: true, data }` or resource object
- Error: `{ error: "..." }` or `{ success: false, message: "..." }`

## 7. Complete Endpoint Catalog

Auth column:

- `Public`: no token required
- `Protected`: token required

### 7.1 Users (`/api/users`)

| Method | Path                     | Auth      | Description                 |
| ------ | ------------------------ | --------- | --------------------------- |
| POST   | `/login`                 | Public    | Login and issue JWT         |
| GET    | `/statuses`              | Public    | List account statuses       |
| GET    | `/status/all`            | Public    | Alias for statuses          |
| GET    | `/verify`                | Protected | Verify token and role       |
| POST   | `/logout`                | Protected | Revoke current token        |
| POST   | `/change-password`       | Protected | Change password             |
| POST   | `/`                      | Public    | Register general user       |
| GET    | `/`                      | Protected | List users                  |
| GET    | `/:id`                   | Protected | Get user by id              |
| PUT    | `/:id`                   | Protected | Update user                 |
| DELETE | `/:id`                   | Protected | Delete user                 |
| POST   | `/:id/follow`            | Protected | Follow target user          |
| DELETE | `/:id/follow`            | Protected | Unfollow target user        |
| GET    | `/:id/followers`         | Protected | List followers              |
| GET    | `/:id/following`         | Protected | List following              |
| GET    | `/:id/library`           | Protected | List saved papers           |
| POST   | `/:id/library`           | Protected | Add paper to library        |
| DELETE | `/:id/library/:paperId`  | Protected | Remove paper from library   |
| GET    | `/feedback/:id`          | Protected | Get feedback by feedback id |
| POST   | `/feedback`              | Protected | Create feedback             |
| GET    | `/:id/feedback/sent`     | Protected | Feedback sent by user       |
| GET    | `/:id/feedback/received` | Protected | Feedback received by user   |
| DELETE | `/feedback/:id`          | Protected | Delete feedback             |

### 7.2 Papers (`/api/papers`)

| Method | Path                      | Auth      | Description                     |
| ------ | ------------------------- | --------- | ------------------------------- |
| POST   | `/`                       | Protected | Create paper                    |
| GET    | `/`                       | Protected | List papers                     |
| GET    | `/:id`                    | Protected | Get paper by id                 |
| PUT    | `/:id`                    | Protected | Update paper                    |
| DELETE | `/:id`                    | Protected | Delete paper                    |
| GET    | `/:id/cited-by`           | Protected | Papers citing this paper        |
| GET    | `/:id/references`         | Protected | Papers referenced by this paper |
| POST   | `/:id/citations`          | Protected | Add citation edge               |
| DELETE | `/:id/citations/:citedId` | Protected | Remove citation edge            |
| GET    | `/:id/topics`             | Protected | List paper topics               |
| POST   | `/:id/topics`             | Protected | Link topic to paper             |
| DELETE | `/:id/topics/:topicId`    | Protected | Unlink topic from paper         |

### 7.3 Authors (`/api/authors`)

| Method | Path                   | Auth      | Description              |
| ------ | ---------------------- | --------- | ------------------------ |
| GET    | `/lookup/orc-id`       | Public    | Search author by ORC ID  |
| GET    | `/lookup/name`         | Public    | Search author by name    |
| GET    | `/paper/:paperId`      | Protected | Authors of paper         |
| POST   | `/`                    | Protected | Create author            |
| GET    | `/`                    | Protected | List authors             |
| GET    | `/:id`                 | Protected | Get author               |
| PUT    | `/:id`                 | Protected | Update author            |
| DELETE | `/:id`                 | Protected | Delete author            |
| GET    | `/:id/papers`          | Protected | Papers by author         |
| POST   | `/:id/papers`          | Protected | Link author to paper     |
| DELETE | `/:id/papers/:paperId` | Protected | Remove author-paper link |

### 7.4 Researchers (`/api/researchers`)

| Method | Path                           | Auth      | Description                               |
| ------ | ------------------------------ | --------- | ----------------------------------------- |
| POST   | `/`                            | Public    | Researcher signup (claims author profile) |
| GET    | `/`                            | Protected | List researchers                          |
| GET    | `/:id`                         | Protected | Get researcher by user id                 |
| DELETE | `/:id`                         | Protected | Delete researcher                         |
| GET    | `/:id/claims`                  | Protected | Get researcher paper claims               |
| POST   | `/:id/claims`                  | Protected | Create paper claim                        |
| DELETE | `/:id/claims/:paperId`         | Protected | Delete paper claim                        |
| GET    | `/:id/institutes`              | Protected | Institute history                         |
| POST   | `/:id/institutes`              | Protected | Add institute history entry               |
| PUT    | `/:id/institutes/:instituteId` | Protected | Update institute history                  |
| DELETE | `/:id/institutes/:instituteId` | Protected | Remove institute history                  |

### 7.5 Admin (`/api/admin`)

| Method | Path                             | Auth      | Description                   |
| ------ | -------------------------------- | --------- | ----------------------------- |
| POST   | `/`                              | Protected | Promote user to admin         |
| GET    | `/`                              | Protected | List admins                   |
| GET    | `/claims`                        | Protected | List all paper claims         |
| GET    | `/claims/:status`                | Protected | Filter paper claims by status |
| PATCH  | `/claims/:researcherId/:paperId` | Protected | Update claim status           |
| GET    | `/:id`                           | Protected | Get admin by user id          |
| DELETE | `/:id`                           | Protected | Demote admin                  |

### 7.6 Venues (`/api/venues`)

| Method | Path              | Auth      | Description          |
| ------ | ----------------- | --------- | -------------------- |
| POST   | `/publishers`     | Protected | Create publisher     |
| GET    | `/publishers`     | Protected | List publishers      |
| GET    | `/publishers/:id` | Protected | Get publisher        |
| PUT    | `/publishers/:id` | Protected | Update publisher     |
| DELETE | `/publishers/:id` | Protected | Delete publisher     |
| GET    | `/lookup/issn`    | Public    | Lookup venue by ISSN |
| GET    | `/lookup/name`    | Public    | Lookup venue by name |
| POST   | `/`               | Protected | Create venue         |
| GET    | `/`               | Protected | List venues          |
| GET    | `/:id`            | Protected | Get venue            |
| PUT    | `/:id`            | Protected | Update venue         |
| DELETE | `/:id`            | Protected | Delete venue         |

### 7.7 Venue Users (`/api/venue-users`)

| Method | Path   | Auth      | Description                              |
| ------ | ------ | --------- | ---------------------------------------- |
| POST   | `/`    | Public    | Venue-user signup (claims venue profile) |
| GET    | `/`    | Protected | List venue users                         |
| GET    | `/:id` | Protected | Get venue user                           |
| DELETE | `/:id` | Protected | Delete venue user                        |

### 7.8 Topics (`/api/topics`)

| Method | Path                  | Auth      | Description      |
| ------ | --------------------- | --------- | ---------------- |
| POST   | `/domains`            | Protected | Create domain    |
| GET    | `/domains`            | Protected | List domains     |
| GET    | `/domains/:id`        | Protected | Get domain       |
| PUT    | `/domains/:id`        | Protected | Update domain    |
| DELETE | `/domains/:id`        | Protected | Delete domain    |
| GET    | `/domains/:id/fields` | Protected | Fields in domain |
| POST   | `/fields`             | Protected | Create field     |
| GET    | `/fields`             | Protected | List fields      |
| GET    | `/fields/:id`         | Protected | Get field        |
| PUT    | `/fields/:id`         | Protected | Update field     |
| DELETE | `/fields/:id`         | Protected | Delete field     |
| GET    | `/fields/:id/topics`  | Protected | Topics in field  |
| POST   | `/`                   | Protected | Create topic     |
| GET    | `/`                   | Protected | List topics      |
| GET    | `/:id`                | Protected | Get topic        |
| PUT    | `/:id`                | Protected | Update topic     |
| DELETE | `/:id`                | Protected | Delete topic     |

### 7.9 Reviews (`/api/reviews`)

| Method | Path              | Auth      | Description          |
| ------ | ----------------- | --------- | -------------------- |
| GET    | `/paper/:paperId` | Protected | Reviews for paper    |
| POST   | `/`               | Protected | Create review/reply  |
| GET    | `/`               | Protected | List reviews         |
| GET    | `/:id`            | Protected | Get review           |
| DELETE | `/:id`            | Protected | Delete review        |
| GET    | `/:id/replies`    | Protected | Replies under review |
| GET    | `/:id/votes`      | Protected | Votes for review     |
| POST   | `/:id/votes`      | Protected | Cast vote            |
| DELETE | `/:id/votes`      | Protected | Remove vote          |

### 7.10 Notifications (`/api/notifications`)

| Method | Path                     | Auth      | Description                        |
| ------ | ------------------------ | --------- | ---------------------------------- |
| GET    | `/user/:userId`          | Protected | Notifications for user             |
| PATCH  | `/user/:userId/read-all` | Protected | Mark all as read                   |
| POST   | `/`                      | Protected | Create notification                |
| GET    | `/:id`                   | Protected | Get notification                   |
| DELETE | `/:id`                   | Protected | Delete notification                |
| POST   | `/:id/receivers`         | Protected | Add receiver                       |
| PATCH  | `/:id/receivers/read`    | Protected | Mark receiver read                 |
| POST   | `/:id/subtypes/user`     | Protected | Create user-notification subtype   |
| GET    | `/:id/subtypes/user`     | Protected | Get user-notification subtype      |
| POST   | `/:id/subtypes/paper`    | Protected | Create paper-notification subtype  |
| GET    | `/:id/subtypes/paper`    | Protected | Get paper-notification subtype     |
| POST   | `/:id/subtypes/review`   | Protected | Create review-notification subtype |
| GET    | `/:id/subtypes/review`   | Protected | Get review-notification subtype    |

## 8. Database Design Summary

### 8.1 Core Entities

- Identity and roles: `status`, `user`, `admin`, `researcher`, `venue_user`
- Academic metadata: `author`, `publisher`, `venue`, `institute`
- Taxonomy: `domain`, `field`, `topic`
- Publishing graph: `paper`, `paper_author`, `paper_topic`, `citation`
- Social and engagement: `follows`, `review`, `review_vote`, `feedback`, `user_library`
- Workflow: `paper_claim`
- Notifications: `notification`, `notification_receiver`, `user_notification`, `paper_notification`, `review_notification`

### 8.2 Important Constraints

- Uniqueness on `user.email`, `user.username`, `author.orc_id`, `venue.issn`
- No self-follow (`follows_self_check`)
- No self-citation (`chk_no_self_citation`)
- Review is either top-level (paper) or reply (parent review), never both (`review_parent_check`)
- Position fields constrained positive where applicable

## 9. SQL Functions, Procedures, and Triggers

### 9.1 Functions (`functions.sql`)

- `get_author_id(res_id)`
- `get_paper_citation_count(target_paper_id)`
- `get_researcher_citation_count(researcher_user_id)`
- `compute_h_index(researcher_user_id)`

### 9.2 Procedures (`procedures.sql`)

- `approve_paper_claim(...)`: adds paper-author relationship, notifies followers
- `notify_new_follower(...)`
- `notify_paper_review(...)`
- `notify_review_vote(...)`
- `notify_new_claim(...)`

### 9.3 Triggers (`triggers.sql`)

- On claim approval status update: executes claim approval procedure
- On follow insert: notifies followed user
- On review insert: notifies paper authors
- On review vote insert: notifies review author
- On paper claim insert: notifies admins

## 10. Utilities and Realtime

- `src/utils/runWithLogging.js`: helper wrapper for action-scoped logging
- `src/utils/cloudinary.js`: present but currently empty
- `src/utils/emailUtils.js`: present but currently empty
- `src/realtime/socketHub.js`: present but empty
- `src/realtime/socketServer.js`: present but empty

## 11. Operational Notes

- A table route file exists (`src/routes/tableRoutes.js`) but is not mounted in `src/index.js`, so its endpoint is currently inactive.
- DB connection uses `ssl: true` in pool configuration.
- SQL logging can expose query text and params if enabled; use carefully in production.

## 12. Local Run

From `backend` directory:

1. Install dependencies:
   - `npm install`
2. Configure `.env` with required variables.
3. Start dev server:
   - `npm run dev`

Default URL: `http://localhost:3000`

---

If you want, this can be extended with a Postman-ready request/response sample section for every endpoint group.
