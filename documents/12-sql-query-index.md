# 12 SQL Query Index (Backend)

Purpose: Quickly answer "where is this query written?" in viva.

## Database SQL Files
- backend/src/database/schema.sql
  - table definitions, keys, foreign keys, constraints
- backend/src/database/functions.sql
  - analytics functions, normalization/validation trigger functions
- backend/src/database/procedures.sql
  - claim/notification procedures
- backend/src/database/triggers.sql
  - trigger bindings (if separated)
- backend/src/database/indexing.sql
  - indexing strategy

## Model-Wise Query Locations
- backend/src/models/userModel.js
  - user CRUD, token update, password/profile updates
- backend/src/models/adminModel.js
  - admin CRUD, paper-claim moderation queries
- backend/src/models/researcherModel.js
  - researcher signup and dashboard, paper claims, institute history queries
- backend/src/models/authorModel.js
  - author CRUD/profile/collaborator/institute queries
- backend/src/models/paperModel.js
  - paper CRUD/search, paper-topic/paper-author relations
- backend/src/models/reviewModel.js
  - review CRUD, recursive tree query, vote upsert
- backend/src/models/claimModel.js
  - author claim request + approve/reject transactional SQL
- backend/src/models/notificationModel.js
  - notification insert/retrieve/read state queries
- backend/src/models/followModel.js
  - follow/unfollow/list + notify procedure call
- backend/src/models/libraryModel.js
  - save/unsave/list saved papers
- backend/src/models/topicModel.js
  - domain/field/topic CRUD + topic trends query
- backend/src/models/instituteModel.js
  - institute CRUD + linked researcher retrieval
- backend/src/models/feedbackModel.js
  - feedback and paper suggestion queries
- backend/src/models/venueModel.js
  - publisher/venue CRUD and linked data
- backend/src/models/venueUserModel.js
  - venue user dashboard queries via SQL functions

## Workflow to Query Mapping Quick Table
- Auth login/signup: userController -> userModel (user, status, jwt_token updates)
- Add paper approval: adminController -> feedbackModel/paperModel (feedback, paper, author, paper_author, paper_topic)
- Paper claim decision: adminController/adminModel (paper_claim + procedure calls)
- Author claim review: claimController/claimModel (author_claim_request, researcher, notifications)
- Stats dashboard: researcherModel/venueUserModel + SQL functions
- Cloudinary profile photo: userController/userModel (user.profile_pic_url)
- Notifications: notificationModel + procedures/triggers
- Institute history: researcherModel + institute_history constraints/trigger checks

## Fast Viva Method
1. Identify feature route in backend/src/routes.
2. Open matching controller function in backend/src/controllers.
3. Jump to model call in backend/src/models.
4. Read SQL there or referenced SQL function/procedure in backend/src/database.

## Notes On Functions Not Used Everywhere
- Functions are used where reuse/aggregation is high.
- Direct model SQL is kept where endpoint logic is simple and specific.
- This avoids over-abstracting small queries while preserving performance for heavy analytics.

## Hard Queries To Mention In Viva (Most Technical)
1. Recursive CTE (review thread resolution)
```sql
WITH RECURSIVE thread AS (
  SELECT id, paper_id, parent_review_id FROM review WHERE id = $1
  UNION ALL
  SELECT r.id, r.paper_id, r.parent_review_id
  FROM review r JOIN thread t ON t.parent_review_id = r.id
)
SELECT paper_id FROM thread WHERE paper_id IS NOT NULL LIMIT 1;
```

2. JSON aggregation for nested author payloads
```sql
COALESCE(json_agg(json_build_object('id', a.id, 'name', a.name, 'position', pa.position)
ORDER BY pa.position) FILTER (WHERE a.id IS NOT NULL), '[]'::json)
```

3. Row-level lock for claim decision consistency
```sql
SELECT * FROM paper_claim
WHERE researcher_id = $1 AND paper_id = $2
FOR UPDATE;
```

4. Date-range overlap integrity for institute history
```sql
daterange(ih.from_date, COALESCE(ih.upto_date, 'infinity'::date), '[]')
&& daterange(NEW.from_date, COALESCE(NEW.upto_date, 'infinity'::date), '[]')
```

5. Idempotent upsert patterns
```sql
INSERT INTO paper_author (paper_id, author_id, position)
VALUES ($1, $2, $3)
ON CONFLICT (paper_id, author_id) DO UPDATE SET position = EXCLUDED.position;
```
```sql
INSERT INTO notification_receiver (notification_id, user_id)
VALUES ($1, $2)
ON CONFLICT (notification_id, user_id) DO NOTHING;
```
