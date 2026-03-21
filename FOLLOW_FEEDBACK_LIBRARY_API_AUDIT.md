# Follow, Feedback, and Library API Audit

Date: 2026-03-22
Scope: Backend + Frontend API usage audit for follow, feedback, and library flows.

Status update (2026-03-22): Legacy user-domain follow/library/feedback endpoints and their controller/model logic have now been removed from backend code.

## 1) Systems Compared

This repo currently has two systems for overlapping domains:

1. New standalone domain APIs (teammate style):
   - `/api/follows/*`
   - `/api/library/*`
   - `/api/feedback/*`

2. Old user-domain APIs (legacy style):
   - `/api/users/:id/follow*`
   - `/api/users/:id/library*`
   - `/api/users/feedback*` and `/api/users/:id/feedback/*`

## 2) What Frontend Actually Uses

Frontend currently uses the standalone domain APIs for these domains:

- Follow:
  - `GET /api/follows/status/:userId`
  - `POST /api/follows/:userId`
  - `DELETE /api/follows/:userId`
- Library:
  - `GET /api/library`
  - `GET /api/library/status/:paperId`
  - `POST /api/library/:paperId`
  - `DELETE /api/library/:paperId`
- Feedback:
  - `GET /api/feedback/my`
  - `POST /api/feedback`
  - `GET /api/feedback` (admin inbox)
  - `PUT /api/feedback/:id/respond` (admin response)

No active frontend calls were found to old user-domain follow/library/feedback endpoints.

### 2.1) Frontend Caller Map

Follow callers:
- `frontend/src/components/FollowButton.jsx`

Library callers:
- `frontend/src/components/SaveButton.jsx`
- `frontend/src/pages/MyLibraryPage.jsx`

Feedback callers:
- `frontend/src/pages/FeedbackPage.jsx`
- `frontend/src/pages/AdminFeedbackPage.jsx`

Navigation/UI routes tied to these flows:
- `frontend/src/App.jsx`
- `frontend/src/components/layout/AppHeader.jsx`
- `frontend/src/components/layout/NotificationBell.jsx`

## 3) Chain Of Logic (New Standalone APIs)

### A) Follow flow (new)

Route layer:
- `backend/src/routes/followRoutes.js`
  - `GET /status/:userId`
  - `GET /followers`
  - `GET /following`
  - `POST /:userId`
  - `DELETE /:userId`

Controller layer:
- `backend/src/controllers/followController.js`
  - Uses `req.auth.userId` as actor.
  - Prevents self-follow.
  - Creates follow/unfollow.
  - Reads follow status.
  - Returns my followers/following.
  - Triggers async follow notification.

Model layer:
- `backend/src/models/followModel.js`
  - Writes to `follows` with `ON CONFLICT DO NOTHING`.
  - Reads followers/following lists (includes `is_researcher` projection).

DB effect:
- Table: `follows`
- Side effect: notification via `NotificationModel.notifyNewFollower`.

### B) Library flow (new)

Route layer:
- `backend/src/routes/libraryRoutes.js`
  - `GET /`
  - `GET /status/:paperId`
  - `POST /:paperId`
  - `DELETE /:paperId`

Controller layer:
- `backend/src/controllers/libraryController.js`
  - Uses `req.auth.userId` only.
  - Save/unsave/check/list library for logged-in user.

Model layer:
- `backend/src/models/libraryModel.js`
  - Writes to `user_library` with `ON CONFLICT DO NOTHING`.
  - Reads enriched saved papers (venue, citations, authors JSON).

DB effect:
- Table: `user_library`
- Read joins: `paper`, `venue`, `citation`, `paper_author`, `author`.

### C) Feedback flow (new)

Route layer:
- `backend/src/routes/feedbackRoutes.js`
  - `GET /my`
  - `GET /` (admin inbox)
  - `POST /`
  - `PUT /:id/respond`

Controller layer:
- `backend/src/controllers/feedbackController.js`
  - `submitFeedback`:
    - actor = `req.auth.userId`
    - receiver = auto-selected admin (`getAnyAdminUserId`)
    - validates message, supports optional subject
    - sends admin notification
  - `getAllFeedback`:
    - admin-only (`req.user.role === 'admin'`)
  - `getMyFeedback`:
    - sender = logged-in user
  - `respondToFeedback`:
    - admin-only, writes response, sends response notification

Model layer:
- `backend/src/models/feedbackModel.js`
  - Admin lookup from `admin` table.
  - Feedback insert/read/respond methods.
  - Admin inbox query includes sender role projection.

DB effect:
- Table: `feedback`
- Side effects:
  - `notifyAdminNewFeedback`
  - `notifyFeedbackResponse`

## 4) Chain Of Logic (Old User-Domain APIs)

### A) Follow flow (old)

Route layer:
- `backend/src/routes/userRoutes.js`
  - `POST /:id/follow`
  - `DELETE /:id/follow`
  - `GET /:id/followers`
  - `GET /:id/following`

Controller layer:
- `backend/src/controllers/userController.js`
  - Takes target id from route.
  - Takes acting follower id from request body (`followingUserId`) for post/delete.
  - Followers/following reads by any provided `:id`.

Model layer:
- `backend/src/models/userModel.js`
  - Inserts/deletes directly into `follows`.
  - Reads basic followers/following lists.

### B) Library flow (old)

Route layer:
- `backend/src/routes/userRoutes.js`
  - `GET /:id/library`
  - `POST /:id/library`
  - `DELETE /:id/library/:paperId`

Controller layer:
- `backend/src/controllers/userController.js`
  - User id comes from route param.
  - `paper_id` comes from request body for add.

Model layer:
- `backend/src/models/userModel.js`
  - Inserts/deletes from `user_library`.
  - Reads basic library payload.

### C) Feedback flow (old)

Route layer:
- `backend/src/routes/userRoutes.js`
  - `GET /feedback/:id`
  - `POST /feedback`
  - `GET /:id/feedback/sent`
  - `GET /:id/feedback/received`
  - `DELETE /feedback/:id`

Controller layer:
- `backend/src/controllers/userController.js`
  - Create requires body `sender_id`, `receiver_id`, `message`.
  - Read/delete actions work by route/body ids.

Model layer:
- `backend/src/models/userModel.js`
  - Generic CRUD on `feedback`.

## 5) Removed Duplicate Endpoints

These overlapping legacy endpoints were removed from backend user-domain routing:

### Follow (duplicate)
- `POST /api/users/:id/follow`
- `DELETE /api/users/:id/follow`
- `GET /api/users/:id/followers`
- `GET /api/users/:id/following`

Canonical replacement:
- `/api/follows/*`

### Library (duplicate)
- `GET /api/users/:id/library`
- `POST /api/users/:id/library`
- `DELETE /api/users/:id/library/:paperId`

Canonical replacement:
- `/api/library/*`

### Feedback (duplicate or conflicting style)
- `GET /api/users/feedback/:id`
- `POST /api/users/feedback`
- `GET /api/users/:id/feedback/sent`
- `GET /api/users/:id/feedback/received`
- `DELETE /api/users/feedback/:id`

Canonical replacement:
- `/api/feedback/*`

## 6) Mismatches Found

### Security/authorization mismatches

1. Old follow/library/feedback APIs rely on caller-supplied ids (`:id`, `followingUserId`, `sender_id`) rather than consistently binding actor identity to token user.
2. New standalone APIs are actor-bound via `req.auth.userId` and are safer by default.
3. Old feedback read/delete endpoints can expose or mutate data based on numeric id routes without ownership checks in controller.

### Behavior/response mismatches

1. Follow list payload differs:
   - New follow model includes `is_researcher` and sorts by full name.
   - Old user model follow list is simpler and sorts by username.
2. Library list payload differs:
   - New library payload is enriched (citation_count, authors JSON, venue metadata).
   - Old user library payload is basic.
3. Feedback semantics differ:
   - New feedback flow is admin helpdesk style (submit to admin, admin responds).
   - Old feedback flow is generic user-to-user messaging style.

### Route design mismatches

1. Two route families implement overlapping concerns, increasing maintenance and drift risk.
2. Frontend is already standardized on standalone routes, but old routes remain reachable in backend.

## 7) Additional Mismatch Check (Beyond Requested Three Domains)

No other frontend/backend mismatch was found in this audit for follow/library/feedback domain usage: frontend calls are aligned to standalone endpoints.

Potential broader mismatch risk not changed here:
- Any external clients (Postman scripts, teammates, or older integrations) may still call old `/api/users/*` duplicate endpoints.

## 8) Post-Removal Verification Checklist

1. Retest frontend flows:
   - follow/unfollow/status
   - save/unsave/library/status
   - feedback submit/my/admin inbox/respond
2. If there are external consumers, notify them these user-domain endpoints are removed.
3. Keep standalone APIs as the only supported surface for these domains.

## 9) Quick Ownership Rule

Canonical ownership going forward:
- Follow: `followRoutes` + `followController` + `followModel`
- Library: `libraryRoutes` + `libraryController` + `libraryModel`
- Feedback: `feedbackRoutes` + `feedbackController` + `feedbackModel`

Legacy user-domain variants should be considered compatibility-only and removed after migration window.
