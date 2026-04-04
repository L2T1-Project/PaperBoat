# 08 DB Functions Procedures Triggers Constraints

## What It Does
Explains database-level logic used for analytics, normalization, validation, and workflow side effects.

## Functions (functions.sql)
- get_author_id
- get_paper_citation_count
- get_author_citation_count
- get_researcher_citation_count
- compute_h_index
- fn_get_researcher_recent_papers
- fn_get_venue_top_cited_papers
- fn_get_venue_published_papers
- fn_get_venue_prominent_authors

Purpose:
- Reusable aggregation logic
- Better consistency for metrics

## Procedures (procedures.sql)
- approve_paper_claim
- notify_new_follower
- notify_paper_review
- notify_review_vote
- notify_new_claim
- notify_claim_declined
- submit_author_claim
- approve_author_claim
- reject_author_claim

Purpose:
- Multi-step business operations executed atomically in DB context
- Standardized notification fan-out

## Triggers
Normalization triggers:
- Author normalization
- Venue normalization
- Paper normalization (including DOI cleanup)

Validation triggers:
- prevent self review vote
- prevent institute history overlap for same researcher

Notification triggers:
- notify on paper review insert
- notify on review vote

## Constraints Highlights
- FK constraints with cascades where required
- Self-link prevention in follows/citation patterns
- Composite keys for historical and relation tables
- Date range consistency in institute_history

## Why Needed In Project
- Keeps data quality high even if API layer changes.
- Prevents impossible states at DB boundary.
- Reduces duplicated business logic in controllers.

## Viva Questions
- Why triggers for validation instead of only backend checks?
- Why procedures for claim workflows?
- Which constraints protect institute history correctness?

## Common Confusion
- Triggers should enforce integrity, not random app behavior.
- Procedure use should be for multi-step operations, not trivial one-row updates.

## Technical MCR + SQL Evidence
Primary SQL source files:
- backend/src/database/functions.sql
- backend/src/database/procedures.sql
- backend/src/database/triggers.sql
- backend/src/database/schema.sql

Hard SQL examples:
```sql
CREATE OR REPLACE FUNCTION compute_h_index(target_author_id INTEGER)
RETURNS INTEGER LANGUAGE plpgsql STABLE AS $$
DECLARE h INTEGER := 0; rank INTEGER := 0; cite_count INTEGER;
BEGIN
  FOR cite_count IN
    SELECT get_paper_citation_count(pa.paper_id) AS c
    FROM paper_author pa
    WHERE pa.author_id = target_author_id
    ORDER BY c DESC
  LOOP
    rank := rank + 1;
    IF cite_count >= rank THEN h := rank; ELSE EXIT; END IF;
  END LOOP;
  RETURN h;
END;
$$;
```
```sql
CALL approve_paper_claim($1, $2, $3);
CALL notify_claim_declined($1, $2);
```
```sql
daterange(ih.from_date, COALESCE(ih.upto_date, 'infinity'::date), '[]')
&& daterange(NEW.from_date, COALESCE(NEW.upto_date, 'infinity'::date), '[]')
```

Index-level optimization:
```sql
CREATE INDEX IF NOT EXISTS idx_paper_title_trgm
ON paper USING gin (lower(title) gin_trgm_ops);
```

## Exact Call Sites: Where Each Function/Procedure Is Used

### Functions (functions.sql)
1. `get_author_id(res_id)`
- Called inside DB functions: `get_researcher_citation_count`, `fn_get_researcher_recent_papers`.
- App-layer direct call: not used directly in backend JS.

2. `get_paper_citation_count(target_paper_id)`
- Called in [backend/src/models/authorModel.js](backend/src/models/authorModel.js): `getPapersByAuthor()` select list (`get_paper_citation_count(p.id)`).
- Also used internally by DB functions `get_author_citation_count` and `compute_h_index`.

3. `get_author_citation_count(target_author_id)`
- Called in [backend/src/models/authorModel.js](backend/src/models/authorModel.js): `getAuthorProfile()` select list.

4. `get_researcher_citation_count(researcher_user_id)`
- App-layer direct call: currently no direct usage in backend JS.
- Available for future researcher metrics endpoints.

5. `compute_h_index(target_author_id)`
- Called in [backend/src/models/authorModel.js](backend/src/models/authorModel.js): `getAuthorProfile()` select list.

6. `fn_get_researcher_recent_papers(researcher_user_id, p_limit, p_offset)`
- Called in [backend/src/models/researcherModel.js](backend/src/models/researcherModel.js): `getDashboardPapers()`.

7. `fn_get_venue_top_cited_papers(venue_user_id, p_limit, p_offset)`
- Called in [backend/src/models/venueUserModel.js](backend/src/models/venueUserModel.js): `getDashboardTopCitedPapers()`.

8. `fn_get_venue_published_papers(venue_user_id, p_limit, p_offset)`
- Called in [backend/src/models/venueUserModel.js](backend/src/models/venueUserModel.js): `getDashboardPublishedPapers()`.

9. `fn_get_venue_prominent_authors(venue_user_id, p_limit)`
- Called in [backend/src/models/venueUserModel.js](backend/src/models/venueUserModel.js): `getDashboardProminentAuthors()`.

### Procedures (procedures.sql)
1. `approve_paper_claim(claim_researcher_id, claim_paper_id, author_position)`
- Called in [backend/src/models/adminModel.js](backend/src/models/adminModel.js): `processPaperClaimDecision()` via `CALL approve_paper_claim(...)`.

2. `notify_claim_declined(claim_researcher_id, claim_paper_id)`
- Called in [backend/src/models/adminModel.js](backend/src/models/adminModel.js): `processPaperClaimDecision()` via `CALL notify_claim_declined(...)`.

3. `notify_new_claim(claim_researcher_id, claim_paper_id)`
- Called in [backend/src/models/researcherModel.js](backend/src/models/researcherModel.js): `createPaperClaim()` via `CALL notify_new_claim(...)`.

4. `notify_new_follower(follower_user_id, followed_user_id)`
- Called in [backend/src/models/followModel.js](backend/src/models/followModel.js): follow action after insert.

5. `notify_paper_review(review_id, reviewed_paper_id)`
- Called in [backend/src/models/reviewModel.js](backend/src/models/reviewModel.js): `notifyPaperReview()`.

6. `notify_review_vote(voted_review_id, is_upvote, voter_user_id)`
- Called in [backend/src/models/reviewModel.js](backend/src/models/reviewModel.js): `notifyReviewVote()`.

7. `submit_author_claim(...)`, `approve_author_claim(...)`, `reject_author_claim(...)`
- Current app flow uses model-level transactional SQL in `claimModel` instead of calling these procedures directly.
- They exist as DB-level equivalents and can be adopted later for procedure-centric implementation.
