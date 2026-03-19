# Admin Claims, Authorization, and UI Changes

This document summarizes the recent implementation for:

- strict authorization for claim workflows,
- researcher and admin claim pages,
- claim decision procedures and notifications,
- dashboard/header behavior updates,
- author page paper-list UX.

Date: 2026-03-19

## 1. Status Mapping (Canonical)

The paper-claim status IDs are treated as:

- `3` = `Approved`
- `4` = `Declined`
- `5` = `Pending`

Backend validation and admin claim actions now use these IDs explicitly.

## 2. Why Procedures Are Called in Backend (Not Frontend)

Database procedures are invoked from backend controllers/models only.

Reasons:

1. Security: frontend must never hold database credentials.
2. Authorization: backend verifies role + identity before DB mutation.
3. Consistency: status updates and procedure calls run in one transaction.
4. Auditability: backend can enforce trusted user identity from JWT.

## 3. Strict Authorization Changes

### 3.1 Researcher claim ownership enforcement

File: `backend/src/controllers/researcherController.js`

Added `ensureResearcherSelf(req, res, researcherId)` and applied it to claim endpoints:

- `POST /api/researchers/:id/claims`
- `GET /api/researchers/:id/claims`
- `DELETE /api/researchers/:id/claims/:paperId`

Checks performed:

1. `req.user.role` must be `researcher`.
2. `req.auth.userId` must match route `:id`.

This prevents one researcher from reading/modifying another researcher’s claims.

### 3.2 Admin-only backend enforcement

File: `backend/src/controllers/adminController.js`

Added/reused `ensureAdmin(req, res)` and applied to:

- admin management endpoints (`promote`, `get all`, `get by id`, `demote`)
- claim moderation endpoints (`get claims`, `get claims by status`, `update claim status`)

Only authenticated admins can access these routes now.

### 3.3 Frontend role/identity route guard

Files:

- `frontend/src/routes/ProtectedRoute.jsx`
- `frontend/src/App.jsx`

`ProtectedRoute` now supports:

- `allowedRoles` (role whitelist)
- `requireUserIdParam` (route param must match logged-in user ID)

Applied routes:

- `GET /researchers/:id/claims` page: requires role `researcher` and `:id === auth userId`.
- `GET /admin/claims` page: requires role `admin`.

## 4. Claim Lifecycle and Procedure Wiring

### 4.1 On claim creation (researcher)

File: `backend/src/models/researcherModel.js`

`createPaperClaim(...)` now:

1. starts transaction,
2. inserts claim with status `5` (`Pending`),
3. calls `CALL notify_new_claim(researcher_id, paper_id)`,
4. commits.

If any step fails, transaction is rolled back.

### 4.2 On admin approval/decline

File: `backend/src/models/adminModel.js`

Added transactional decision flow `processPaperClaimDecision(...)`:

1. lock target claim row (`FOR UPDATE`),
2. allow moderation only if current status is `Pending (5)`,
3. if next status is `Approved (3)`, call `approve_paper_claim(...)`,
4. if next status is `Declined (4)`, call `notify_claim_declined(...)`,
5. update claim `status_id`,
6. commit.

Errors include state guards like `CLAIM_NOT_PENDING`.

File: `backend/src/controllers/adminController.js`

`updatePaperClaimStatus` now validates only `3` or `4` as legal transitions for moderation action.

## 5. Procedure Updates

File: `backend/src/database/procedures.sql`

### 5.1 `approve_paper_claim(...)` upgraded

Now sends:

1. direct notification to the claimant (`Your claim ... has been approved`),
2. follower notification as before.

### 5.2 New procedure `notify_claim_declined(...)`

Added to notify claimant when an admin declines a claim.

## 6. Role Detection Fix (Admin Dashboard Not Showing)

Files:

- `backend/src/models/userModel.js`
- `backend/src/controllers/userController.js`
- `frontend/src/context/AuthContext.jsx`

### Backend fix

Added `checkAdminRole(userId)` and changed login role resolution priority to:

1. admin,
2. researcher,
3. venue_user,
4. user.

This ensures admin accounts receive JWT role `admin` and can access admin UI/routes.

### Frontend normalization

Auth context now normalizes stored/login roles to lowercase.

This prevents role comparison bugs caused by mixed casing.

## 7. Header and Dashboard UX Updates

### 7.1 Header role area -> researcher profile link

File: `frontend/src/components/layout/AppHeader.jsx`

Where role text appeared next to notifications:

- for researchers: now shows `Your Profile` link.
- link resolves to the researcher’s author page by fetching `author_id` from `/api/researchers/:userId`.
- for non-researchers: role badge is still shown.

### 7.2 Admin and researcher claim navigation

File: `frontend/src/components/layout/AppHeader.jsx`

Added role-aware nav links:

- researcher: `My Claims`
- admin: `Claim Queue`

## 8. Author Page Papers Scroll Behavior

File: `frontend/src/pages/AuthorPage.jsx`

Behavior now:

1. shows first 5 papers by default,
2. `Show all` reveals full list,
3. expanded list is vertically scrollable (`max-height + overflow-y-auto`),
4. `Show less` returns to compact view.

This preserves readability while supporting long bibliographies.

## 9. Claim Pages

Files:

- `frontend/src/pages/ResearcherClaimsPage.jsx`
- `frontend/src/pages/AdminClaimsPage.jsx`

### Researcher claims page

- grouped sections: Pending, Approved, Declined,
- pending claims can be retracted,
- accessible only to same researcher identity (backend + route guard).

### Admin claims page

- tabs for Pending, Approved, Declined,
- pending actions: Approve/Decline,
- approval and decline invoke transactional backend moderation flow.

## 10. Additional Notes and Known Follow-ups

1. After SQL/procedure edits, run updated SQL in Neon to ensure procedures exist there.
2. Restart backend after code changes.
3. Optional hardening: add `decided_by`, `decided_at`, and `decline_reason` columns in `paper_claim` for full moderation audit trail.
4. Optional UX: map claim notifications to dedicated claim pages in notification navigation if claim-specific link metadata is added.

## 11. Quick Verification Checklist

1. Login as admin -> role in token should be `admin`, admin dashboard/components visible.
2. Login as researcher A and open `/researchers/B/claims` -> should be blocked.
3. Non-admin opening `/admin/claims` -> should be blocked.
4. Researcher submits claim -> admin receives new-claim notification.
5. Admin approves claim -> claimant receives approved notification and claim leaves Pending tab.
6. Admin declines claim -> claimant receives declined notification and claim appears in Declined tab.
7. Header near notification shows `Your Profile` for researcher and navigates to own author page.
8. Author page papers: default 5; expanded mode scrolls vertically.
