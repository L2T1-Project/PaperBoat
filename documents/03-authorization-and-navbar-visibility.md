# 03 Authorization And Navbar Visibility

## What It Does
Authorization controls feature access by role (admin, researcher, venue_user, user), and UI visibility is role-based in navbar and routes.

## Where User Role Is Decided
Role is decided on backend during login in `backend/src/controllers/userController.js` (`login()`).

Decision order:
1. `checkAdminRole(user.id)` -> role = `admin`
2. else `checkResearcherRole(user.id)` -> role = `researcher`
3. else `checkVenueUserRole(user.id)` -> role = `venue_user`
4. else default role = `user`

JWT is then signed with `{ userId, role }` and saved in DB (`user.jwt_token`). Frontend does not decide role; it only reads and uses it.

## Backend Authorization
1. Global auth middleware in backend/src/index.js blocks protected endpoints.
2. Controllers perform strict role checks like:
   - req.user.role === 'admin'
   - req.user.role === 'researcher'
3. If role check fails, API returns 403 Forbidden.

## Frontend Authorization
- ProtectedRoute component in frontend/src/routes/ProtectedRoute.jsx:
  - Redirects unauthenticated users to login.
  - Enforces allowedRoles per route.
  - Can enforce URL user-id match for ownership pages.

When ProtectedRoute is used in frontend (`frontend/src/App.jsx`):
- Any route that must require login, such as `/dashboard`, `/statistics`, `/library`, `/feedback`, `/profile/edit`, `/papers/:id/reviews`.
- Role-restricted routes, such as:
  - `allowedRoles={["researcher"]}` for `/researchers/:id/claims`, `/researchers/:id/suggest-paper`
  - `allowedRoles={["admin"]}` for `/admin/claims`, `/admin/papers`, `/admin/feedback`

## Navbar Role Visibility
Role-based menus are handled in frontend/src/components/layout/AppHeader.jsx using role nav mapping.

Examples:
- Admin sees claim queue, add paper moderation, feedback inbox.
- Researcher sees suggest paper and my claims.
- Guest sees public browsing links only.

Important: Hidden link in UI does not grant security. Backend role checks are final authority.

## Public vs Protected Routes
- Public routes include login/signup and selected read-only discovery endpoints.
- All other routes require valid Bearer token.

## Frontend ProtectedRoute vs Backend Protected Routes
Frontend `ProtectedRoute`:
- Runs in browser.
- Controls page navigation/UX.
- Prevents opening restricted UI screens.

Backend protection (`backend/src/index.js` + `authenticateToken` middleware + controller role checks):
- Runs on server.
- Verifies JWT and compares token with DB-stored `jwt_token` (revocation support).
- Enforces actual security for API execution.

Key difference: frontend guard improves UX; backend guard is the real security boundary.

## Why This Design
- Better UX: users only see relevant actions.
- Better security: backend still blocks unauthorized direct API calls.
- Easy maintenance: role checks are explicit in controllers.

## Viva Questions
- If a non-admin manually calls admin API from Postman, what happens?
- Why have both frontend and backend authorization layers?
- Where is role assigned and where is it enforced?

## Common Confusion
- UI hiding is convenience, not security.
- Role is computed on login and then enforced at API level.

## Technical MCR Map
Authorization is enforced in two places:
1. API: authenticateToken middleware + controller role checks.
2. UI: ProtectedRoute + AppHeader role-based nav rendering.

R/C/M evidence:
- R: /api/admin/*
- C: adminController.ensureAdmin()/admin-only handlers
- M: adminModel.* queries only execute after role gate passes

## Role Gate Pattern
```js
if (req.user?.role !== 'admin') {
  return res.status(403).json({ message: 'Forbidden' });
}
```

## SQL Objects Affected By Authorization Paths
- admin moderation paths touch: paper_claim, feedback, notification, paper_author
- researcher-only paths touch: review, paper_claim, institute_history

## Navbar Technical Note
UI hides links by role, but security is backend-enforced.
A user cannot bypass by calling endpoint directly because middleware+controller still reject.
