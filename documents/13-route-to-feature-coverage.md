# 13 Route To Feature Coverage

Purpose: Demonstrate complete backend feature coverage by route group.

## Route Groups
- backend/src/routes/userRoutes.js
  - user signup/login/logout/profile/status and profile image upload
- backend/src/routes/adminRoutes.js
  - admin management, paper claim moderation, paper suggestion review
- backend/src/routes/researcherRoutes.js
  - researcher profile, claims, institute history, dashboard
- backend/src/routes/claimRoutes.js
  - author identity claim moderation workflow
- backend/src/routes/paperRoutes.js
  - paper CRUD/search/topic/domain/field browsing and citation-related fetches
- backend/src/routes/reviewRoutes.js
  - review/reply/vote operations and retrieval
- backend/src/routes/notificationRoutes.js
  - list notifications and read-state updates
- backend/src/routes/followRoutes.js
  - follow/unfollow and follower lists
- backend/src/routes/libraryRoutes.js
  - saved papers management
- backend/src/routes/topicRoutes.js
  - domain/field/topic discovery and management
- backend/src/routes/authorRoutes.js
  - author lookups, profile and authored papers
- backend/src/routes/venueRoutes.js
  - venue and publisher operations
- backend/src/routes/venueUserRoutes.js
  - venue user profile and dashboard analytics
- backend/src/routes/instituteRoutes.js
  - institute CRUD and linked researcher data
- backend/src/routes/feedbackRoutes.js
  - user feedback and suggestion pathways
- backend/src/routes/tableRoutes.js
  - table/maintenance utility endpoints (if enabled)

## How To Explain Any Endpoint In Viva
1. Route file and path
2. Controller function name
3. Model function name
4. SQL table/function/procedure touched
5. Auth check type (public/authenticated/role-restricted)

## Quick Proof Pattern
Use this sentence pattern:
"This feature is exposed in route X, controlled by function Y, query runs in model Z, and authorization is enforced by middleware plus role check R."

## Precise MCR Pointers (Examples)
Auth login:
- R: POST /api/users/login
- C: userController.login()
- M: userModel.getUserByEmail(), updateJwtToken()
- SQL: SELECT user by email; UPDATE user.jwt_token

Paper claim decision:
- R: PATCH /api/admin/claims/:researcherId/:paperId
- C: adminController.updatePaperClaimStatus()
- M: adminModel.processPaperClaimDecision()
- SQL: SELECT ... FOR UPDATE on paper_claim; CALL approve_paper_claim or notify_claim_declined

Review tree fetch:
- R: GET /api/reviews/paper/:paperId/tree
- C: reviewController.getReviewTreeByPaper()
- M: reviewModel.getReviewTreeByPaper()
- SQL: WITH RECURSIVE over review(parent_review_id)

Library save:
- R: POST /api/library/:paperId
- C: libraryController.savePaper()
- M: libraryModel.savePaper()
- SQL: INSERT ... ON CONFLICT DO NOTHING into user_library

Follow:
- R: POST /api/follows/:userId
- C: followController.followResearcher()
- M: followModel.followUser(), notifyNewFollower()
- SQL: INSERT into follows; CALL notify_new_follower
