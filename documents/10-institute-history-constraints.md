# 10 Institute History Constraints

## What It Does
Maintains valid researcher-institute timeline records without overlapping date ranges for same researcher.

## Main Use Cases
- Add institute history row
- Update date ranges
- Remove wrong entry
- List complete institute timeline

## Main Files
- backend/src/models/researcherModel.js
  - addInstituteHistory()
  - getInstituteHistory()
  - updateInstituteHistory()
  - removeInstituteHistory()
  - getInstituteUptoColumn() for schema compatibility
- backend/src/database/functions.sql (or trigger file)
  - overlap validation trigger function using daterange logic

## Constraint/Trigger Logic
- Prevent overlapping periods for same researcher.
- Validate from_date and upto/to_date sequence.
- Ensure timeline integrity across updates, not only inserts.

## SQL Objects
- institute_history table
- researcher table
- institute table

## Authorization
- History changes are restricted to authorized researcher/admin flows.
- Backend endpoints enforce token and role checks.

## Why This Design
- Historical data must be consistent for profile credibility.
- DB-level overlap prevention is safer than API-only checks.

## Viva Questions
- Why use daterange overlap checks?
- Can two active institute entries exist for one researcher?
- How are open-ended tenures handled?

## Common Confusion
- Frontend date validation is not enough.
- Update path must pass same overlap checks as insert path.

## Technical MCR Map
- R:
  - GET /api/researchers/:id/institutes
  - POST /api/researchers/:id/institutes
  - PUT /api/researchers/:id/institutes/:instituteId
  - DELETE /api/researchers/:id/institutes/:instituteId
- C: researcherController.* institute handlers
- M: researcherModel.getInstituteHistory(), addInstituteHistory(), updateInstituteHistory(), removeInstituteHistory()

## Hard SQL / Constraint Logic
Insert/update pattern:
```sql
INSERT INTO institute_history (researcher_id, institute_id, from_date, upto_date)
VALUES ($1, $2, $3, $4);
```
```sql
UPDATE institute_history
SET upto_date = $4
WHERE researcher_id = $1 AND institute_id = $2 AND from_date = $3;
```
Trigger overlap check:
```sql
SELECT EXISTS (
  SELECT 1
  FROM institute_history ih
  WHERE ih.researcher_id = NEW.researcher_id
    AND daterange(ih.from_date, COALESCE(ih.upto_date, 'infinity'::date), '[]')
        && daterange(NEW.from_date, COALESCE(NEW.upto_date, 'infinity'::date), '[]')
);
```

Schema-compatibility note:
- model probes information_schema to support upto_date vs to_date naming differences.
