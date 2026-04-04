# 04 Add Paper Approval Decline Workflow

## What It Does
Researchers submit paper suggestions; admins review and either approve (paper added) or decline.

## Where Paper Suggestions Are Stored (No Separate Table)
There is no dedicated `paper_suggestion` table. Suggestions are stored in `feedback` table:
- `subject = 'PAPER_SUGGESTION'`
- `message` contains JSON payload (`title`, `publication_date`, `venue_id`, `topic_id`, `authors`, optional `doi`, `pdf_url`, `github_repo`)
- `response` is NULL while pending
- `response` is written as marker text after review:
  - `APPROVED::<paper_id>::<admin_note>`
  - `REJECTED::<admin_note>`

## What Is `normalizedAuthors` In Admin Review
In `adminController.reviewPaperSuggestion()`, backend reads `authors` from the JSON payload and normalizes each row before DB writes.

Normalization logic per author entry:
- `author_id`: converted to number or null
- `name`: trimmed string or null
- `position`: converted to number
- `orc_id`: normalized through ORCID utility (strips URL prefix, uppercases, validates checksum/format)

Validation after normalization:
- At least one of valid `author_id` or non-empty `name` must exist
- `position` must be positive integer
- positions must be unique across author list

If validation fails, API returns 400 and approval is blocked.

Why this exists:
- Input from suggestion JSON can be inconsistent
- normalization creates a clean, typed structure used safely in transactional inserts
- prevents corrupt author ordering and invalid ORCID data entering catalog tables

## How Authors Are Shown On Admin Frontend Without Separate Suggestion Table
There is no separate suggestion-author table because author rows are embedded inside `feedback.message` JSON.

Display path in queue tab:
1. Frontend calls `GET /api/admin/paper-suggestions`.
2. Backend `feedbackModel.getPaperSuggestions()` returns rows from `feedback`.
3. `adminController.normalizeSuggestionRow()` parses JSON using `parseSuggestionPayload(row.message)`.
4. Response includes `suggested_paper.authors` array.
5. `AdminAddPaperPage.jsx` reads `suggestion.suggested_paper.authors` and renders list items like `#position: name (ID x/new)`.

So admin UI sees authors from parsed JSON payload, not from a dedicated suggestion-author relation table.

## End-to-End Flow
1. Researcher submits suggestion (stored in feedback as paper suggestion payload).
2. Admin page loads pending suggestions.
3. Admin clicks approve/decline.
4. Backend processes decision in admin controller.
5. On approve: creates paper and related entities.
6. On decline: updates suggestion with decline response.

## Main Files
Frontend:
- frontend/src/pages/AdminAddPaperPage.jsx

Backend:
- backend/src/routes/adminRoutes.js
  - GET /admin/paper-suggestions
  - PATCH /admin/paper-suggestions/:id/review
- backend/src/controllers/adminController.js
  - getPaperSuggestions()
  - reviewPaperSuggestion()
- backend/src/models/feedbackModel.js
  - getPaperSuggestions()
  - getPaperSuggestionById()
  - createPaperSuggestion(), getPaperSuggestionsBySender(), findPendingPaperSuggestionDuplicates(), respondToFeedback()
- backend/src/models/paperModel.js
  - paper/topic insertion helpers

## Authorization
- Admin-only endpoint.
- Controller rejects non-admin with 403.

## Main SQL Objects
- feedback (suggestion source)
- paper
- author, paper_author
- topic, paper_topic
- no status table is used for suggestion state; state is derived from `feedback.response`

## Why This Design
- Suggestion data is separated from official publication data.
- Admin review prevents bad/duplicate entries.
- Approval path is traceable and auditable.

## Viva Questions
- Why not allow direct paper insertion by researchers?
- What are the exact tables touched on approval?
- How is decline represented in database state?

## Common Confusion
- Suggestion is not a paper until admin approves.
- Approval may involve multiple inserts (paper + author links + topics).

## Technical MCR Map
- R:
  - GET /api/admin/paper-suggestions
  - PATCH /api/admin/paper-suggestions/:id/review
- C:
  - adminController.getPaperSuggestions()
  - adminController.reviewPaperSuggestion()
- M:
  - feedbackModel.getPaperSuggestions()
  - feedbackModel.getPaperSuggestionById()
  - feedbackModel.createPaperSuggestion(), respondToFeedback(), findPendingPaperSuggestionDuplicates()
  - adminController directly executes transactional SQL for paper/author/topic inserts

## Hard SQL Fragments
Suggestion creation (researcher side):
```sql
INSERT INTO feedback (sender_id, receiver_id, subject, message)
VALUES ($1, $2, $3, $4)
RETURNING id, sender_id, receiver_id, subject, message, created_at;
```

Suggestion list (admin side, state derived from response marker):
```sql
SELECT
  f.id,
  f.sender_id,
  f.receiver_id,
  f.message,
  f.created_at,
  f.response,
  f.responded_at,
  CASE
    WHEN f.response IS NULL THEN 'pending'
    WHEN f.response LIKE 'APPROVED::%' THEN 'approved'
    ELSE 'rejected'
  END AS suggestion_status
FROM feedback f
JOIN "user" u ON u.id = f.sender_id
WHERE f.subject = $1
ORDER BY f.created_at DESC;
```

Duplicate guard before approve (against real paper catalog):
```sql
SELECT p.id, p.title, p.doi, p.publication_date, v.name AS venue_name
FROM paper p
JOIN venue v ON v.id = p.venue_id
WHERE LOWER(p.title) = $1
  [OR LOWER(COALESCE(p.doi, '')) = $2] -- appended only when DOI is present
ORDER BY p.publication_date DESC NULLS LAST, p.id DESC
LIMIT 20;
```

Approve transaction writes (inside `BEGIN ... COMMIT`):
```sql
INSERT INTO "paper"
  (title, publication_date, pdf_url, doi, is_retracted, github_repo, venue_id)
VALUES
  ($1, $2, $3, $4, $5, $6, $7)
RETURNING id, title, publication_date, doi, venue_id;
```
```sql
INSERT INTO paper_topic (paper_id, topic_id)
VALUES ($1, $2);
```

How multiple authors are inserted:
1. Validate authors array and enforce unique positive `position`.
2. For each author entry:
   - If `author_id` exists, use it.
   - Else if `orc_id` provided: lookup existing author.
   - Else create new author.
3. Insert one row per author into `paper_author`.

Author lookup/insert and mapping SQL:
```sql
SELECT id FROM author WHERE orc_id = $1 LIMIT 1;
```
```sql
INSERT INTO author (name, orc_id)
VALUES ($1, $2)
RETURNING id;
```
```sql
INSERT INTO paper_author (paper_id, author_id, position)
VALUES ($1, $2, $3);
```

Final suggestion-state update after decision:
```sql
UPDATE feedback
SET response = $1, responded_at = now()
WHERE id = $2
RETURNING id, sender_id, response, responded_at;
```
