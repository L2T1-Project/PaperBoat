# 05 Paper Claim Approval Workflow

## What It Does
A researcher claims authorship link for a paper; admin approves or declines claim.

## Important: This Is One Of Two Claim Systems
This file is for `paper_claim` workflow only (claiming authorship position on a specific paper).

Separate workflow exists in `author_claim_request` (document 06), which is identity transfer for an entire author profile.

## End-to-End Flow
1. Researcher creates claim for paper.
2. Claim enters pending state (`status_id = 5`).
3. Admin views pending claims queue.
4. Admin approves or declines.
5. Backend updates claim status and notifies affected users.

Duplicate control:
- `paper_claim` primary key is `(researcher_id, paper_id)`, so duplicate claim rows for same researcher-paper pair are blocked at DB level.

## Main Files
Frontend:
- frontend/src/pages/AdminClaimsPage.jsx

Backend:
- backend/src/routes/adminRoutes.js
  - GET /admin/claims/:status
  - PATCH /admin/claims/:researcherId/:paperId
- backend/src/controllers/adminController.js
  - getPaperClaimsByStatus()
  - updatePaperClaimStatus()
- backend/src/models/adminModel.js
  - processPaperClaimDecision()
- backend/src/models/researcherModel.js
  - createPaperClaim()

DB Procedures:
- approve_paper_claim(...)
- notify_claim_declined(...)

## Authorization
- Claim creation: authenticated researcher.
- Claim decision: admin only.

## Main SQL Objects
- paper_claim
- paper_author
- notification + receiver/subtype tables

## Why This Design
- Claim lifecycle is explicit (pending, approved, declined).
- Procedure-based update keeps multi-step DB logic consistent.
- Notification integration provides user feedback immediately.

## Viva Questions
- What exactly changes on approve?
- Why use stored procedure for approval/decline?
- How do you prevent unauthorized claim decisions?

## Common Confusion
- Paper claim flow is different from author-identity claim flow.
- Decline still triggers notification side effects.

## Technical MCR Map
- R:
  - GET /api/admin/claims/:status
  - PATCH /api/admin/claims/:researcherId/:paperId
- C:
  - adminController.getPaperClaimsByStatus()
  - adminController.updatePaperClaimStatus()
- M:
  - adminModel.getPaperClaimsByStatus()
  - adminModel.processPaperClaimDecision()

## Hard SQL / Procedure Calls
Status-filtered claim query:
```sql
SELECT pc.researcher_id, pc.paper_id, pc.position, s.status_name, p.title
FROM paper_claim pc
JOIN status s ON s.id = pc.status_id
JOIN paper p ON p.id = pc.paper_id
WHERE LOWER(s.status_name) = LOWER($1)
ORDER BY pc.claimed_at DESC;
```
Critical row lock before decision:
```sql
SELECT researcher_id, paper_id, position, status_id
FROM paper_claim
WHERE researcher_id = $1 AND paper_id = $2
FOR UPDATE;
```
Procedure routing:
```sql
CALL approve_paper_claim($1, $2, $3);
CALL notify_claim_declined($1, $2);
```
