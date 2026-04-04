# 06 Author Claim Approval (Admin Review)

## What It Does
Handles identity-level author claims (who should be linked to an author profile), including admin moderation and ownership transfer.

## Important: Not A Duplicate Of Paper Claim
This workflow uses `author_claim_request` and changes who owns an author profile.

It does not edit `paper_claim` rows directly.

## End-to-End Flow
1. Claimant submits author claim request.
2. System notifies all admins about the new pending duplicate-author claim.
3. Admin checks pending claims.
4. Admin approves or rejects claim.
5. On approval: old researcher link is replaced by claimant link inside transaction.
6. Notifications are sent to both previous and new linked users.

## Main Files
- backend/src/routes/claimRoutes.js
- backend/src/controllers/claimController.js
  - getPendingClaims(), approveClaim(), rejectClaim()
- backend/src/models/claimModel.js
  - submitClaim(), getPendingClaims(), approveClaim(), rejectClaim()

## Authorization
- Admin-only review endpoints.
- Backend controller enforces role check.

## Main SQL Objects
- author_claim_request
- researcher
- notification related tables

## Transaction Logic (Approve)
- Lock relevant claim row.
- Resolve current researcher for claimed author.
- Delete old researcher mapping.
- Insert claimant as researcher mapping.
- Invalidate JWT tokens for both affected users (forces re-login with updated role permissions).
- Update claim status to approved.
- Insert notifications.
- Commit or rollback.

## Why This Design
- Transaction guarantees consistency for ownership transfer.
- Prevents partial updates where claim status changes but ownership does not.

## Viva Questions
- Why transaction is mandatory here?
- How do you ensure only one active owner mapping?
- What notifications are sent and to whom?

## Common Confusion
- This flow is about author identity mapping, not paper moderation.
- Rollback is critical when any step fails.

## Technical MCR Map
- R:
  - GET /api/claims/admin
  - POST /api/claims/admin/:claimId/approve
  - POST /api/claims/admin/:claimId/reject
- C:
  - claimController.getPendingClaims(), approveClaim(), rejectClaim()
- M:
  - claimModel.getPendingClaims(), approveClaim(), rejectClaim()

## Hard SQL Transaction (Approve)
```sql
BEGIN;
SELECT * FROM author_claim_request WHERE id = $1 FOR UPDATE;
DELETE FROM researcher WHERE author_id = $2;
INSERT INTO researcher (user_id, author_id) VALUES ($3, $2);
UPDATE author_claim_request
SET status = 'approved', resolved_by = $4, resolved_at = NOW()
WHERE id = $1;
COMMIT;
```
Reject path:
```sql
UPDATE author_claim_request
SET status = 'rejected', resolved_by = $2, resolved_at = NOW()
WHERE id = $1;
```
This is a true ownership transfer workflow, not just status flip.
