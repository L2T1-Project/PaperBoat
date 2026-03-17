# PaperBoat Auth and Page Flow Documentation

This document explains the recent authentication fixes and the current behavior of the main product pages:

- Login and auth restoration behavior
- Papers discovery page
- Paper details page
- Review page with nested threads
- Dashboard page (role-based)

It is written as an implementation review so the frontend and backend behavior stays aligned.

---

## 1) Authentication Changes (Detailed Review)

### Why this change was needed

A valid user session could still be redirected to the login page after a browser refresh.

This happened because:

1. Auth-protected routes were evaluated before stored auth state finished hydrating from localStorage.
2. Stored user parsing was too strict and could reject a valid `userId` when it was serialized as a string.

### What was changed

#### Frontend auth context

File: `frontend/src/context/AuthContext.jsx`

1. Added `isAuthReady` state.
2. During initial hydration (`useEffect`), auth now sets `isAuthReady = true` after localStorage is checked.
3. `parseStoredUser` now accepts `userId` as either number or string, then validates with `Number(...)`.
4. `login(...)` normalizes and stores `userId` as a number.
5. Context value now exposes:
   - `token`
   - `user`
   - `isAuthReady`
   - `isAuthenticated`
   - `login`
   - `logout`

#### Protected route behavior

File: `frontend/src/routes/ProtectedRoute.jsx`

1. Route now waits until `isAuthReady` is true before deciding redirect.
2. If `isAuthReady` is false, component returns `null` temporarily.
3. Redirect to `/login` only occurs after hydration and only if `isAuthenticated` is false.

### Result

- Page refresh no longer causes premature redirect to login when token is still valid.
- Stored user parsing is resilient to number/string serialization differences.
- Auth state consistency is improved by normalizing `userId` on both restore and login.

### Notes on logout and 401 behavior

- `logout()` clears local storage and redirects to login.
- Axios response interceptor clears auth and redirects to login on HTTP 401.

This is intentional and acts as a fallback for expired/invalid sessions.

---

## 2) Nested Review Tree Changes

### Why this change was needed

Previously, only root reviews and first-level replies were guaranteed to load in the UI flow.
Deep descendants (reply to reply to reply) were not fully reliable in earlier logic.

### What was changed

#### Backend: one API for full review tree

Files:

- `backend/src/models/reviewModel.js`
- `backend/src/controllers/reviewController.js`
- `backend/src/routes/reviewRoutes.js`

Added endpoint:

- `GET /api/reviews/paper/:paperId/tree`

Model now uses a recursive CTE (`WITH RECURSIVE`) to fetch:

1. Root nodes for the paper (`review.paper_id = :paperId`)
2. All descendants by repeatedly joining `review.parent_review_id = parent.id`

Controller returns structured payload:

```json
{
  "roots": [ ... ],
  "repliesByReview": {
    "12": [ ...children of review 12... ],
    "18": [ ...children of review 18... ]
  }
}
```

Sorting behavior:

- Root reviews: newest first (descending `created_at`)
- Replies under each parent: oldest first (ascending `created_at`)

#### Frontend: consume tree endpoint in one call

File: `frontend/src/pages/PaperReviewsPage.jsx`

1. Replaced multi-step loading with one call:
   - `GET /reviews/paper/:id/tree`
2. Sets:
   - `reviews` from `roots`
   - `repliesByReview` from tree map
3. Recursive renderer (`renderReviewNode`) now has complete descendant data and can render arbitrary depth.
4. After posting a reply, page now refreshes full tree to keep hierarchy consistent.

### Result

- Child-of-child and deeper nested comments display correctly.
- Backend is the source of truth for full thread structure.
- Frontend logic is simpler and less error-prone.

---

## 3) Review Page Documentation

File: `frontend/src/pages/PaperReviewsPage.jsx`

### Purpose

Dedicated page for discussion thread of a specific paper.

### Data loaded

1. Paper metadata: `GET /papers/:id`
2. Thread tree: `GET /reviews/paper/:id/tree`
3. Vote snapshots per review node: `GET /reviews/:reviewId/votes`

### Actions

1. Post root review:
   - `POST /reviews` with `paper_id` and `text`
2. Post reply:
   - `POST /reviews` with `parent_review_id` and `text`
3. Vote/unvote:
   - `POST /reviews/:id/votes`
   - `DELETE /reviews/:id/votes`

### Access assumptions

- Route is protected in app routing.
- Backend enforces researcher role for create/vote operations.

---

## 4) Paper Details Page Documentation

File: `frontend/src/pages/PaperDetailsPage.jsx`

### Purpose

Show one paper with bibliographic and citation context, then route users to full discussion page.

### Data loaded

1. `GET /papers/:id`
2. `GET /papers/:id/topics`
3. `GET /papers/:id/cited-by`

### UI sections

1. Title and quick links (DOI/PDF/GitHub/retracted badge)
2. Venue card
3. Publisher card
4. Author list + topic chips
5. Citation snapshot (count + top citing papers)
6. Reviews entry point link:
   - `/papers/:id/reviews`

### Design decision

Review writing and thread rendering are intentionally separated into the review page for clearer responsibilities and cleaner detail page UX.

---

## 5) Dashboard Page Documentation

File: `frontend/src/pages/DashboardPage.jsx`

### Purpose

Role-specific workspace summary.

### Identity display strategy

Dashboard does not depend on username in JWT payload.
It uses `userId` from local auth storage and fetches display name from backend.

Endpoint:

- `GET /users/:id/display-name`

### Researcher widgets

Endpoints:

- `GET /researchers/:id/dashboard/papers?limit=5&offset=0`
- `GET /researchers/:id/dashboard/papers?limit=50&offset=0`

Widgets:

1. Recent papers
2. Horizontal scroll for broader paper list

### Venue user widgets

Endpoints:

- `GET /venue-users/:id/dashboard/top-cited-papers`
- `GET /venue-users/:id/dashboard/published-papers`
- `GET /venue-users/:id/dashboard/prominent-authors`

Widgets:

1. Top 10 most cited papers
2. Toggleable all-published list
3. Prominent authors summary

### UX summary

- Greeting uses first name derived from fetched display name.
- Layout remains role-aware and data-driven.

---

## 6) General Papers Discovery Page Documentation

File: `frontend/src/pages/PapersDiscoveryPage.jsx`

### Purpose

Primary browsing surface for public paper discovery.

### Filter hierarchy

1. Domain
2. Field (inside selected domain)
3. Topic (inside selected field)

### Data flow

Initial taxonomy loads:

- `GET /topics/domains`
- `GET /topics/domains/:domainId/fields`
- `GET /topics/fields/:fieldId/topics`

Paper list endpoint chosen by state priority:

1. Search text active:
   - `GET /papers/search?q=...`
2. Topic selected:
   - `GET /papers/topic/:topicId`
3. Field selected:
   - `GET /papers/field/:fieldId`
4. Domain selected:
   - `GET /papers/domain/:domainId`
5. Default:
   - `GET /papers`

All list calls use pagination params (`page`, `limit`).

### Client-side sort options

- Newest
- Oldest
- Title A-Z
- Title Z-A

### Output

Cards link to paper details page (`/papers/:id`).

---

## 7) Routing Summary

Frontend routes of interest:

- `/papers` public discovery
- `/papers/:id` public details
- `/papers/:id/reviews` protected reviews
- `/dashboard` protected dashboard
- `/login` and `/signup` auth pages

Protected routes rely on `isAuthReady` + `isAuthenticated` from auth context.

---

## 8) API Summary for This Scope

### Auth/session

- `POST /api/users/login`
- `POST /api/users/logout`
- `GET /api/users/:id/display-name`

### Papers

- `GET /api/papers`
- `GET /api/papers/search`
- `GET /api/papers/domain/:domainId`
- `GET /api/papers/field/:fieldId`
- `GET /api/papers/topic/:topicId`
- `GET /api/papers/:id`
- `GET /api/papers/:id/topics`
- `GET /api/papers/:id/cited-by`

### Topics taxonomy

- `GET /api/topics/domains`
- `GET /api/topics/domains/:domainId/fields`
- `GET /api/topics/fields/:fieldId/topics`

### Reviews

- `GET /api/reviews/paper/:paperId/tree`
- `POST /api/reviews`
- `GET /api/reviews/:id/votes`
- `POST /api/reviews/:id/votes`
- `DELETE /api/reviews/:id/votes`

### Dashboard

- `GET /api/researchers/:id/dashboard/papers`
- `GET /api/venue-users/:id/dashboard/top-cited-papers`
- `GET /api/venue-users/:id/dashboard/published-papers`
- `GET /api/venue-users/:id/dashboard/prominent-authors`

---

## 9) Test Checklist (Recommended)

### Auth

1. Login as researcher and refresh `/dashboard`.
2. Login as venue user and refresh `/dashboard`.
3. Open protected review URL directly and refresh.
4. Confirm no redirect when token valid.
5. Confirm redirect on forced 401 response.

### Reviews

1. Create root comment.
2. Reply to root.
3. Reply to that reply (depth 2+).
4. Refresh page and verify full thread still renders.
5. Vote up/down and remove vote on nested nodes.

### Papers

1. Apply domain -> field -> topic filters.
2. Search with text and ensure endpoint precedence.
3. Open paper details and verify topics/citation data.
4. Use link to review page and confirm continuity.

### Dashboard

1. Researcher widgets load expected cards.
2. Venue widgets load top cited, all published, prominent authors.
3. Display name resolves from `/users/:id/display-name`.

---

## 10) Maintenance Notes

1. Keep auth context normalization logic unchanged unless backend login response changes shape.
2. Keep review tree endpoint as canonical source for nested rendering.
3. If review volume grows significantly, consider paginating root-level reviews and lazy-loading subtrees.
4. If voting load becomes heavy, expose vote aggregates in tree payload to reduce per-node vote requests.
