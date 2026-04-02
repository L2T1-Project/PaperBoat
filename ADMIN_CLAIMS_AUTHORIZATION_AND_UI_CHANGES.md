# Project Authorization and Claims Handling (Simple Full Guide)

Date: 2026-03-29

This guide explains, in simple language, how access control and moderation flows work in this project.

It covers:
1. Guests viewing paper pages
2. Who can review papers
3. Who can claim papers
4. How admin claim decisions work
5. Who can respond to feedback
6. Which frontend and backend files/functions are involved in each flow

---

## 1) Access Rules (High-Level)

Current behavior:
1. Guests (not logged in) can browse discovery pages and open paper detail pages.
2. Review page is protected by login in frontend.
3. Only researchers can create reviews and vote (backend enforces this).
4. Only researchers can claim papers (backend enforces this).
5. Researchers can manage only their own claims.
6. Only admins can moderate claims.
7. Only admins can read full feedback inbox and respond to feedback.

---

## 2) Public vs Protected API (Backend Entry Point)

Main backend gate:
- backend/src/index.js

How it works:
1. A request first passes through the public route matcher.
2. If route is listed in publicRoutes, no token is required.
3. Otherwise, JWT middleware is required.

Important public routes for paper viewing:
1. GET /api/papers
2. GET /api/papers/:id
3. GET /api/papers/:id/topics
4. GET /api/papers/:id/cited-by

Because of this, guests can load the detailed paper page data.

JWT middleware:
- backend/src/middlewares/authenticateToken.js

This middleware:
1. Reads bearer token
2. Verifies JWT
3. Loads user
4. Ensures token is still valid
5. Attaches req.auth and req.user for role checks

---

## 3) Flow: Guest Opens Paper Detail Page

### Frontend flow
1. Route is public in frontend:
   - frontend/src/App.jsx
   - path /papers/:id renders PaperDetailsPage without ProtectedRoute
2. Page component:
   - frontend/src/pages/PaperDetailsPage.jsx
3. On load, it calls:
   - GET /api/papers/:id
   - GET /api/papers/:id/topics
   - GET /api/papers/:id/cited-by

### Backend flow
1. Request enters backend/src/index.js
2. Route matches publicRoutes and bypasses auth middleware
3. Request goes to:
   - backend/src/routes/paperRoutes.js
   - backend/src/controllers/paperController.js
   - backend/src/models/paperModel.js

Result:
- Guests can view paper details successfully.

---

## 4) Flow: Who Can Review Papers

Important clarification:
- Being signed in is not enough.
- Only users with researcher role can post reviews, replies, and votes.

### Frontend flow
1. Review page route in frontend/src/App.jsx is protected by ProtectedRoute:
   - /papers/:id/reviews
2. ProtectedRoute only enforces logged-in status.
3. The page (frontend/src/pages/PaperReviewsPage.jsx) can open, but backend decides role permission for write actions.

### Backend flow (actual enforcement)
1. POST /api/reviews -> backend/src/routes/reviewRoutes.js -> createReview
2. In backend/src/controllers/reviewController.js, createReview checks:
   - req.auth.userId exists
   - req.user.role must be researcher
3. If role is not researcher, returns 403 with message:
   - Only researchers can create reviews

Voting has same pattern:
1. POST /api/reviews/:id/votes -> castVote
2. DELETE /api/reviews/:id/votes -> removeVote
3. Both check req.user.role === researcher

Result:
- Normal users cannot review or vote, even if logged in.

---

## 5) Flow: Researchers Claim a Paper (Normal Users Cannot)

### Frontend flow
Claim action is shown inside paper details for researchers:
- frontend/src/pages/PaperDetailsPage.jsx

What happens:
1. Researcher opens paper detail page
2. Clicks Claim Paper
3. Enters author position
4. Submits claim
5. Frontend calls:
   - POST /api/researchers/:id/claims

Researcher claim pages:
1. frontend/src/pages/ResearcherClaimsPage.jsx
2. Route in frontend/src/App.jsx:
   - /researchers/:id/claims
3. Protected by:
   - frontend/src/routes/ProtectedRoute.jsx
   - allowedRoles: researcher
   - requireUserIdParam: id

So frontend also prevents researcher A from opening researcher B claim page.

### Backend flow (hard enforcement)
1. Routes in backend/src/routes/researcherRoutes.js:
   - POST /:id/claims
   - GET /:id/claims
   - DELETE /:id/claims/:paperId
2. Controller in backend/src/controllers/researcherController.js uses:
   - ensureResearcherSelf(req, res, researcherId)
3. ensureResearcherSelf checks:
   - role must be researcher
   - token user id must match route id

If checks pass:
1. createPaperClaim calls model function:
   - backend/src/models/researcherModel.js -> createPaperClaim
2. Model transaction does:
   - insert into paper_claim with status_id 5 (Pending)
   - CALL notify_new_claim(researcher_id, paper_id)
   - commit

Result:
- Researchers can claim papers.
- Normal users cannot claim papers.
- Researchers cannot create claims for other researcher ids.

---

## 6) Claim Status and Admin Claim Moderation

Canonical status ids:
1. 3 = Approved
2. 4 = Declined
3. 5 = Pending

### Admin UI flow
Admin claim queue page:
- frontend/src/pages/AdminClaimsPage.jsx

Route:
- frontend/src/App.jsx -> /admin/claims
- wrapped with ProtectedRoute allowedRoles: admin

Actions:
1. Admin opens pending tab
2. Clicks Approve or Decline
3. Frontend sends PATCH to admin claim endpoint

### Backend flow
Routes:
- backend/src/routes/adminRoutes.js (claim endpoints)

Controller:
- backend/src/controllers/adminController.js

Authorization:
1. ensureAdmin(req, res) must pass for all admin claim endpoints

Decision handling:
1. updatePaperClaimStatus accepts only 3 or 4
2. Calls model:
   - backend/src/models/adminModel.js -> processPaperClaimDecision

Model transaction steps:
1. Lock target claim row FOR UPDATE
2. Ensure current status is Pending (5)
3. If Approved (3): CALL approve_paper_claim(researcher_id, paper_id, position)
4. If Declined (4): CALL notify_claim_declined(researcher_id, paper_id)
5. Update paper_claim.status_id
6. Commit

Result:
- Only admins can approve/decline.
- Only pending claims can be processed.

---

## 7) Stored Procedures Used in Claim Workflow

File:
- backend/src/database/procedures.sql

### approve_paper_claim
Used when admin approves.

What it does:
1. Adds/updates paper_author link for approved researcher author position
2. Sends direct approval notification to claimant
3. Sends follower notification about relevant paper activity

### notify_claim_declined
Used when admin declines.

What it does:
1. Sends decline notification to claimant

### notify_new_claim
Used when researcher submits a new claim.

What it does:
1. Sends admin notification that a new claim was submitted

---

## 8) Flow: Feedback and Who Can Respond

### User submits feedback
Frontend page:
- frontend/src/pages/FeedbackPage.jsx

Backend endpoint:
- POST /api/feedback

Controller:
- backend/src/controllers/feedbackController.js -> submitFeedback

What happens:
1. Uses authenticated sender id
2. Finds an admin receiver
3. Creates feedback row
4. Sends admin notification via notification model

### Admin feedback inbox
Frontend page:
- frontend/src/pages/AdminFeedbackPage.jsx

Route:
- /admin/feedback protected by allowedRoles: admin

Backend list endpoint:
- GET /api/feedback
- feedbackController.getAllFeedback checks req.user.role === admin

### Admin response
Backend endpoint:
- PUT /api/feedback/:id/respond

Controller:
- feedbackController.respondToFeedback

Authorization:
- Only admin role can respond

What happens:
1. Saves response text
2. Sends notification to original sender

Result:
- Others cannot respond to feedback.
- Admin-only response path is enforced in both frontend route guard and backend role check.

---

## 9) Signup Edge Case: Already Claimed Author

Frontend file:
- frontend/src/components/auth/SignupForm.jsx

Current behavior when selected author is already claimed:
1. User is not created as researcher in that branch
2. Fallback account is created as general user
3. Frontend auto-submits feedback to admin with claim conflict details

Admin then sees this in feedback inbox and can handle manually.

---

## 10) Quick End-to-End Verification Checklist

1. Guest opens /papers/:id -> should load paper details.
2. Logged-in normal user tries POST /api/reviews -> should get 403.
3. Researcher opens own claims page -> allowed.
4. Researcher opens another researcher claim page -> blocked.
5. Normal user tries claim endpoint -> blocked.
6. Researcher submits claim -> admin receives new-claim notification.
7. Admin approves claim -> claimant gets approved notification.
8. Admin declines claim -> claimant gets declined notification.
9. Non-admin opens admin feedback inbox -> blocked.
10. Admin responds to feedback -> sender receives feedback-response notification.

---

## 11) Main Files to Know

Frontend:
1. frontend/src/App.jsx
2. frontend/src/routes/ProtectedRoute.jsx
3. frontend/src/pages/PaperDetailsPage.jsx
4. frontend/src/pages/PaperReviewsPage.jsx
5. frontend/src/pages/ResearcherClaimsPage.jsx
6. frontend/src/pages/AdminClaimsPage.jsx
7. frontend/src/pages/FeedbackPage.jsx
8. frontend/src/pages/AdminFeedbackPage.jsx
9. frontend/src/components/auth/SignupForm.jsx

Backend:
1. backend/src/index.js
2. backend/src/middlewares/authenticateToken.js
3. backend/src/routes/researcherRoutes.js
4. backend/src/controllers/researcherController.js
5. backend/src/models/researcherModel.js
6. backend/src/routes/adminRoutes.js
7. backend/src/controllers/adminController.js
8. backend/src/models/adminModel.js
9. backend/src/routes/reviewRoutes.js
10. backend/src/controllers/reviewController.js
11. backend/src/routes/feedbackRoutes.js
12. backend/src/controllers/feedbackController.js
13. backend/src/models/feedbackModel.js
14. backend/src/database/procedures.sql
