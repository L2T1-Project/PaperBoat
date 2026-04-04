# Database Triggers and Stored Procedures

**Project:** PaperBoat
**Database:** PostgreSQL
**Files:** `backend/src/database/triggers.sql`, `backend/src/database/procedures.sql`, `backend/src/database/migrations/001_author_claim_request.sql`

---

## Table of Contents

1. [Triggers](#triggers)
   - [trg_normalize_author](#1-trg_normalize_author)
   - [trg_normalize_venue](#2-trg_normalize_venue)
   - [trg_normalize_paper](#3-trg_normalize_paper)
   - [trg_prevent_self_review_vote](#4-trg_prevent_self_review_vote)
   - [trg_validate_institute_history_overlap](#5-trg_validate_institute_history_overlap)
   - [trg_notify_paper_review](#6-trg_notify_paper_review)
   - [trg_notify_review_vote](#7-trg_notify_review_vote)
2. [Stored Procedures](#stored-procedures)
   - [approve_paper_claim](#1-approve_paper_claim)
   - [notify_new_follower](#2-notify_new_follower)
   - [notify_paper_review](#3-notify_paper_review)
   - [notify_review_vote](#4-notify_review_vote)
   - [notify_new_claim](#5-notify_new_claim)
   - [notify_claim_declined](#6-notify_claim_declined)
   - [submit_author_claim](#7-submit_author_claim)
   - [approve_author_claim](#8-approve_author_claim)
   - [reject_author_claim](#9-reject_author_claim)
3. [Summary Table](#summary-table)

---

## Triggers

A trigger is a database object that automatically executes a function in response to a specific event on a table (`INSERT`, `UPDATE`, or `DELETE`). PaperBoat uses two categories of triggers: **data normalization/validation** (BEFORE triggers) and **reactive notifications** (AFTER triggers).

---

### 1. `trg_normalize_author`

| Property | Value |
|---|---|
| **File** | `triggers.sql` |
| **Table** | `author` |
| **Event** | `BEFORE INSERT OR UPDATE` |
| **Scope** | `FOR EACH ROW` |
| **Function** | `trg_fn_normalize_author()` |

#### Purpose
Ensures author data is stored in a consistent, canonical format regardless of how it was submitted. Prevents near-duplicate records caused by whitespace differences or ORCID URL variations.

#### What it does
- Strips leading/trailing whitespace from `name` and collapses any internal multiple spaces into a single space.
- If `orc_id` is not null: strips the `https://orcid.org/` URL prefix (case-insensitive), trims whitespace, and converts the result to uppercase.

#### Example
| Submitted value | Stored value |
|---|---|
| `"  Jane   Doe  "` | `"Jane Doe"` |
| `"https://orcid.org/0000-0002-1825-0097"` | `"0000-0002-1825-0097"` |
| `"  0000-0002-1825-0097 "` | `"0000-0002-1825-0097"` |

#### SQL
```sql
CREATE OR REPLACE FUNCTION trg_fn_normalize_author()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.name := regexp_replace(trim(NEW.name), '\s+', ' ', 'g');
    IF NEW.orc_id IS NOT NULL THEN
        NEW.orc_id := upper(regexp_replace(trim(NEW.orc_id), '^https?://orcid.org/', '', 'i'));
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_normalize_author
BEFORE INSERT OR UPDATE ON author
FOR EACH ROW EXECUTE FUNCTION trg_fn_normalize_author();
```

---

### 2. `trg_normalize_venue`

| Property | Value |
|---|---|
| **File** | `triggers.sql` |
| **Table** | `venue` |
| **Event** | `BEFORE INSERT OR UPDATE` |
| **Scope** | `FOR EACH ROW` |
| **Function** | `trg_fn_normalize_venue()` |

#### Purpose
Ensures venue names and ISSNs are stored uniformly. Prevents duplicate venues caused by inconsistent formatting of the ISSN (e.g., with or without hyphens, mixed case).

#### What it does
- Strips and collapses whitespace from `name` and `type`.
- If `issn` is not null: removes **all** whitespace (not just leading/trailing) and converts to uppercase.

#### Example
| Submitted value | Stored value |
|---|---|
| `"  IEEE Transactions  "` | `"IEEE Transactions"` |
| `"0028 - 0836"` | `"0028-0836"` |
| `"0028-0836"` → uppercase | `"0028-0836"` |

#### SQL
```sql
CREATE OR REPLACE FUNCTION trg_fn_normalize_venue()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.name := regexp_replace(trim(NEW.name), '\s+', ' ', 'g');
    NEW.type := regexp_replace(trim(NEW.type), '\s+', ' ', 'g');
    IF NEW.issn IS NOT NULL THEN
        NEW.issn := upper(regexp_replace(trim(NEW.issn), '\s+', '', 'g'));
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_normalize_venue
BEFORE INSERT OR UPDATE ON venue
FOR EACH ROW EXECUTE FUNCTION trg_fn_normalize_venue();
```

---

### 3. `trg_normalize_paper`

| Property | Value |
|---|---|
| **File** | `triggers.sql` |
| **Table** | `paper` |
| **Event** | `BEFORE INSERT OR UPDATE` |
| **Scope** | `FOR EACH ROW` |
| **Function** | `trg_fn_normalize_paper()` |

#### Purpose
Ensures paper titles and DOIs are stored in a canonical form. The DOI normalization is critical because the same DOI can arrive in multiple formats (bare, with URL prefix, with `doi:` prefix), and the `doi` column has a `UNIQUE` constraint.

#### What it does
- Strips and collapses whitespace in `title`.
- If `doi` is not null:
  1. Trims and lowercases the whole value.
  2. Strips the `https://doi.org/` or `http://doi.org/` URL prefix.
  3. Strips the `doi:` prefix.

#### Example
| Submitted value | Stored value |
|---|---|
| `"  Deep  Learning  "` | `"Deep Learning"` |
| `"https://doi.org/10.1234/example"` | `"10.1234/example"` |
| `"DOI:10.1234/example"` | `"10.1234/example"` |
| `"10.1234/EXAMPLE"` | `"10.1234/example"` |

#### SQL
```sql
CREATE OR REPLACE FUNCTION trg_fn_normalize_paper()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.title := regexp_replace(trim(NEW.title), '\s+', ' ', 'g');
    IF NEW.doi IS NOT NULL THEN
        NEW.doi := lower(trim(NEW.doi));
        NEW.doi := regexp_replace(NEW.doi, '^https?://doi.org/', '', 'i');
        NEW.doi := regexp_replace(NEW.doi, '^doi:', '', 'i');
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_normalize_paper
BEFORE INSERT OR UPDATE ON paper
FOR EACH ROW EXECUTE FUNCTION trg_fn_normalize_paper();
```

---

### 4. `trg_prevent_self_review_vote`

| Property | Value |
|---|---|
| **File** | `triggers.sql` |
| **Table** | `review_vote` |
| **Event** | `BEFORE INSERT OR UPDATE` |
| **Scope** | `FOR EACH ROW` |
| **Function** | `trg_fn_prevent_self_review_vote()` |

#### Purpose
Enforces a business rule at the database level: a researcher cannot vote on their own review. This cannot be bypassed by the application layer — the database itself rejects the insert.

#### What it does
1. Looks up the `researcher_id` of the review being voted on.
2. If the review does not exist, raises an exception.
3. If the voter's `researcher_id` matches the review author's `researcher_id`, raises an exception.

#### SQL
```sql
CREATE OR REPLACE FUNCTION trg_fn_prevent_self_review_vote()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    review_author_id INTEGER;
BEGIN
    SELECT r.researcher_id INTO review_author_id
    FROM review r WHERE r.id = NEW.review_id;

    IF review_author_id IS NULL THEN
        RAISE EXCEPTION 'Review % does not exist', NEW.review_id;
    END IF;

    IF review_author_id = NEW.researcher_id THEN
        RAISE EXCEPTION 'Self-voting is not allowed for review %', NEW.review_id;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_self_review_vote
BEFORE INSERT OR UPDATE ON review_vote
FOR EACH ROW EXECUTE FUNCTION trg_fn_prevent_self_review_vote();
```

---

### 5. `trg_validate_institute_history_overlap`

| Property | Value |
|---|---|
| **File** | `triggers.sql` |
| **Table** | `institute_history` |
| **Event** | `BEFORE INSERT OR UPDATE` |
| **Scope** | `FOR EACH ROW` |
| **Function** | `trg_fn_validate_institute_history_overlap()` |

#### Purpose
Prevents a researcher from being recorded at two overlapping institute periods simultaneously. Uses PostgreSQL's native `daterange` type and the `&&` (overlap) operator for robust date range comparison, correctly handling open-ended ranges (`upto_date IS NULL` = still active).

#### What it does
1. Queries all existing `institute_history` rows for the same `researcher_id`, excluding the current row (to allow updates).
2. Checks if any existing date range overlaps with the new one using `daterange && daterange`.
3. If an overlap is detected, raises an exception and cancels the insert/update.

#### Example scenario that is blocked
```
Researcher A is at MIT from 2020-01-01 to 2022-12-31.
Attempting to insert: MIT from 2021-06-01 to 2023-01-01 → BLOCKED (overlaps)
Attempting to insert: Harvard from 2023-01-01 onwards → ALLOWED (no overlap)
```

#### SQL
```sql
CREATE OR REPLACE FUNCTION trg_fn_validate_institute_history_overlap()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    has_overlap BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM institute_history ih
        WHERE ih.researcher_id = NEW.researcher_id
          AND NOT (
              ih.researcher_id = NEW.researcher_id
              AND ih.institute_id = NEW.institute_id
              AND ih.from_date = NEW.from_date
          )
          AND daterange(ih.from_date, COALESCE(ih.upto_date, 'infinity'::date), '[]')
              && daterange(NEW.from_date, COALESCE(NEW.upto_date, 'infinity'::date), '[]')
    ) INTO has_overlap;

    IF has_overlap THEN
        RAISE EXCEPTION 'Overlapping institute history for researcher % is not allowed',
            NEW.researcher_id;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_institute_history_overlap
BEFORE INSERT OR UPDATE ON institute_history
FOR EACH ROW EXECUTE FUNCTION trg_fn_validate_institute_history_overlap();
```

---

### 6. `trg_notify_paper_review`

| Property | Value |
|---|---|
| **File** | `triggers.sql` |
| **Table** | `review` |
| **Event** | `AFTER INSERT` |
| **Scope** | `FOR EACH ROW` |
| **Function** | `trg_fn_notify_paper_review()` |

#### Purpose
Automatically delivers in-app notifications whenever a new review is inserted, without any application code needing to handle it. Two notification paths are handled in the same trigger.

#### What it does

**Case 1 — Top-level review (`paper_id IS NOT NULL`):**
1. Fetches the paper's title.
2. Inserts a `notification` row: `"New review on paper: [title]"`.
3. Inserts a `review_notification` subtype row linking to the new review.
4. Loops through every researcher who is a co-author of that paper (via `paper_author → researcher`) and inserts a `notification_receiver` row for each — **excluding the reviewer themselves**.

**Case 2 — Reply review (`parent_review_id IS NOT NULL`):**
1. Fetches the `researcher_id` of the parent review's author.
2. If the reply is from a different researcher, creates a `"Someone replied to your review"` notification and delivers it only to the parent review's author.

#### SQL
```sql
CREATE OR REPLACE FUNCTION trg_fn_notify_paper_review()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_notification_id INTEGER;
    v_paper_title     VARCHAR(500);
    v_receiver_id     INTEGER;
BEGIN
    IF NEW.paper_id IS NOT NULL THEN
        SELECT p.title INTO v_paper_title FROM paper p WHERE p.id = NEW.paper_id;

        INSERT INTO notification (message)
        VALUES ('New review on paper: ' || COALESCE(v_paper_title, 'a paper'))
        RETURNING id INTO v_notification_id;

        INSERT INTO review_notification (notification_id, review_id)
        VALUES (v_notification_id, NEW.id);

        FOR v_receiver_id IN
            SELECT res.user_id
            FROM paper_author pa
            JOIN researcher res ON res.author_id = pa.author_id
            WHERE pa.paper_id = NEW.paper_id
              AND res.user_id <> NEW.researcher_id
        LOOP
            INSERT INTO notification_receiver (notification_id, user_id, is_read)
            VALUES (v_notification_id, v_receiver_id, FALSE)
            ON CONFLICT DO NOTHING;
        END LOOP;

    ELSIF NEW.parent_review_id IS NOT NULL THEN
        SELECT r.researcher_id INTO v_receiver_id
        FROM review r WHERE r.id = NEW.parent_review_id;

        IF v_receiver_id IS NOT NULL AND v_receiver_id <> NEW.researcher_id THEN
            INSERT INTO notification (message)
            VALUES ('Someone replied to your review')
            RETURNING id INTO v_notification_id;

            INSERT INTO review_notification (notification_id, review_id)
            VALUES (v_notification_id, NEW.id);

            INSERT INTO notification_receiver (notification_id, user_id, is_read)
            VALUES (v_notification_id, v_receiver_id, FALSE)
            ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_paper_review
AFTER INSERT ON review
FOR EACH ROW EXECUTE FUNCTION trg_fn_notify_paper_review();
```

---

### 7. `trg_notify_review_vote`

| Property | Value |
|---|---|
| **File** | `triggers.sql` |
| **Table** | `review_vote` |
| **Event** | `AFTER INSERT` |
| **Scope** | `FOR EACH ROW` |
| **Function** | `trg_fn_notify_review_vote()` |

#### Purpose
Automatically notifies a researcher when someone votes on one of their reviews. Fires after every vote insert.

#### What it does
1. Fetches the `researcher_id` of the review's author.
2. If the voter is the same person (self-vote, already blocked by trigger #4), returns early without notifying.
3. Determines the vote label: `"upvoted"` or `"downvoted"`.
4. Inserts a notification: `"Someone upvoted/downvoted your review"`.
5. Links it as a `review_notification` subtype and delivers it to the review's author.

#### SQL
```sql
CREATE OR REPLACE FUNCTION trg_fn_notify_review_vote()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_notification_id  INTEGER;
    v_review_author_id INTEGER;
    v_vote_label       TEXT;
BEGIN
    SELECT r.researcher_id INTO v_review_author_id
    FROM review r WHERE r.id = NEW.review_id;

    IF v_review_author_id IS NULL OR v_review_author_id = NEW.researcher_id THEN
        RETURN NEW;
    END IF;

    v_vote_label := CASE WHEN NEW.is_upvote THEN 'upvoted' ELSE 'downvoted' END;

    INSERT INTO notification (message)
    VALUES ('Someone ' || v_vote_label || ' your review')
    RETURNING id INTO v_notification_id;

    INSERT INTO review_notification (notification_id, review_id)
    VALUES (v_notification_id, NEW.review_id);

    INSERT INTO notification_receiver (notification_id, user_id, is_read)
    VALUES (v_notification_id, v_review_author_id, FALSE)
    ON CONFLICT DO NOTHING;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_review_vote
AFTER INSERT ON review_vote
FOR EACH ROW EXECUTE FUNCTION trg_fn_notify_review_vote();
```

---

## Stored Procedures

A stored procedure in PostgreSQL (`CREATE PROCEDURE`) is used for **multi-step workflows that modify several tables in one operation**. Unlike functions, procedures are called with `CALL` and do not return a value directly. They are ideal when a single logical action (e.g., approving a claim) requires multiple `INSERT`/`UPDATE`/`DELETE` statements across different tables.

---

### 1. `approve_paper_claim`

| Property | Value |
|---|---|
| **File** | `procedures.sql` |
| **Called from** | `adminModel.js` via `CALL approve_paper_claim($1, $2, $3)` |
| **Parameters** | `claim_researcher_id INTEGER`, `claim_paper_id INTEGER`, `author_position INTEGER` |

#### Purpose
Handles the full approval workflow when an admin approves a researcher's claim to a paper. Modifies `paper_author`, `notification`, `paper_notification`, and `notification_receiver` in a single logical operation.

#### Steps
1. Resolves the researcher's linked `author_id` by calling `get_author_id()`.
2. Inserts the researcher as an official author of the paper into `paper_author` at the given position. Uses `ON CONFLICT DO UPDATE` so re-approving doesn't fail.
3. Fetches the paper's title for notification messages.
4. Creates a notification for the **researcher**: *"Your claim for paper '[title]' has been approved."*
5. Loops over all **followers** of the researcher and delivers a notification to each: *"A paper you may be interested in has been published: '[title]'"*

#### SQL
```sql
CREATE OR REPLACE PROCEDURE approve_paper_claim(
    claim_researcher_id INTEGER,
    claim_paper_id INTEGER,
    author_position INTEGER
)
LANGUAGE plpgsql AS $$
DECLARE
    linked_author_id    INTEGER;
    paper_title         VARCHAR(500);
    followers_notif_id  INTEGER;
    researcher_notif_id INTEGER;
    follower            RECORD;
BEGIN
    linked_author_id := get_author_id(claim_researcher_id);

    INSERT INTO paper_author (paper_id, author_id, position)
    VALUES (claim_paper_id, linked_author_id, author_position)
    ON CONFLICT (paper_id, author_id) DO UPDATE SET position = EXCLUDED.position;

    SELECT p.title INTO paper_title FROM paper p WHERE p.id = claim_paper_id;

    INSERT INTO notification (message)
    VALUES ('Your claim for paper "' || paper_title || '" has been approved.')
    RETURNING id INTO researcher_notif_id;

    INSERT INTO paper_notification (notification_id, paper_id)
    VALUES (researcher_notif_id, claim_paper_id);

    INSERT INTO notification_receiver (notification_id, user_id)
    VALUES (researcher_notif_id, claim_researcher_id)
    ON CONFLICT DO NOTHING;

    INSERT INTO notification (message)
    VALUES ('A paper you may be interested in has been published: "' || paper_title || '"')
    RETURNING id INTO followers_notif_id;

    INSERT INTO paper_notification (notification_id, paper_id)
    VALUES (followers_notif_id, claim_paper_id);

    FOR follower IN
        SELECT f.following_user_id AS user_id
        FROM follows f WHERE f.followed_user_id = claim_researcher_id
    LOOP
        INSERT INTO notification_receiver (notification_id, user_id)
        VALUES (followers_notif_id, follower.user_id)
        ON CONFLICT DO NOTHING;
    END LOOP;
END;
$$;
```

---

### 2. `notify_new_follower`

| Property | Value |
|---|---|
| **File** | `procedures.sql` |
| **Parameters** | `follower_user_id INTEGER`, `followed_user_id INTEGER` |

#### Purpose
Creates and delivers a follow notification when one user starts following another.

#### Steps
1. Fetches the follower's username.
2. Inserts a notification: *"[username] started following you."*
3. Links it as a `user_notification` subtype (so the frontend knows it's a user-related notification).
4. Delivers it to the followed user via `notification_receiver`.

#### SQL
```sql
CREATE OR REPLACE PROCEDURE notify_new_follower(
    follower_user_id INTEGER,
    followed_user_id INTEGER
)
LANGUAGE plpgsql AS $$
DECLARE
    notif_id INTEGER;
    username VARCHAR(100);
    msg      TEXT;
BEGIN
    SELECT u.username INTO username FROM "user" u WHERE u.id = follower_user_id;
    msg := username || ' started following you.';

    INSERT INTO notification (message) VALUES (msg) RETURNING id INTO notif_id;
    INSERT INTO user_notification (notification_id, triggered_user_id)
    VALUES (notif_id, follower_user_id);
    INSERT INTO notification_receiver (notification_id, user_id)
    VALUES (notif_id, followed_user_id)
    ON CONFLICT DO NOTHING;
END;
$$;
```

---

### 3. `notify_paper_review`

| Property | Value |
|---|---|
| **File** | `procedures.sql` |
| **Parameters** | `review_id INTEGER`, `reviewed_paper_id INTEGER` |

#### Purpose
Notifies all co-authors of a paper when a new review is submitted on it. This is the explicit-call counterpart to trigger `trg_notify_paper_review`.

#### Steps
1. Fetches the paper's title.
2. Inserts a notification: *"Your paper '[title]' received a new review."*
3. Links it as a `review_notification` subtype.
4. Loops through all researchers who are co-authors of the paper and delivers the notification to each.

#### SQL
```sql
CREATE OR REPLACE PROCEDURE notify_paper_review(
    review_id INTEGER,
    reviewed_paper_id INTEGER
)
LANGUAGE plpgsql AS $$
DECLARE
    notif_id    INTEGER;
    paper_title VARCHAR(500);
    msg         TEXT;
    author      RECORD;
BEGIN
    SELECT p.title INTO paper_title FROM paper p WHERE p.id = reviewed_paper_id;
    msg := 'Your paper "' || paper_title || '" received a new review.';

    INSERT INTO notification (message) VALUES (msg) RETURNING id INTO notif_id;
    INSERT INTO review_notification (notification_id, review_id) VALUES (notif_id, review_id);

    FOR author IN
        SELECT r.user_id
        FROM paper_author pa
        JOIN researcher r ON r.author_id = pa.author_id
        WHERE pa.paper_id = reviewed_paper_id
    LOOP
        INSERT INTO notification_receiver (notification_id, user_id)
        VALUES (notif_id, author.user_id)
        ON CONFLICT DO NOTHING;
    END LOOP;
END;
$$;
```

---

### 4. `notify_review_vote`

| Property | Value |
|---|---|
| **File** | `procedures.sql` |
| **Parameters** | `voted_review_id INTEGER`, `is_upvote BOOLEAN`, `voter_user_id INTEGER` |

#### Purpose
Notifies a review's author when someone votes on it.

#### Steps
1. Fetches the review author's `researcher_id` and the voter's full name.
2. Constructs message: *"[Name] upvoted/downvoted your review."*
3. Inserts notification, links as `review_notification`, delivers to the review author.

#### SQL
```sql
CREATE OR REPLACE PROCEDURE notify_review_vote(
    voted_review_id INTEGER,
    is_upvote       BOOLEAN,
    voter_user_id   INTEGER
)
LANGUAGE plpgsql AS $$
DECLARE
    notif_id       INTEGER;
    review_author  INTEGER;
    voter_name     TEXT;
    vote_label     TEXT;
    msg            TEXT;
BEGIN
    SELECT r.researcher_id INTO review_author FROM review r WHERE r.id = voted_review_id;
    SELECT u.full_name INTO voter_name FROM "user" u WHERE u.id = voter_user_id;

    vote_label := CASE WHEN is_upvote THEN 'upvoted' ELSE 'downvoted' END;
    msg := voter_name || ' ' || vote_label || ' your review.';

    INSERT INTO notification (message) VALUES (msg) RETURNING id INTO notif_id;
    INSERT INTO review_notification (notification_id, review_id) VALUES (notif_id, voted_review_id);
    INSERT INTO notification_receiver (notification_id, user_id)
    VALUES (notif_id, review_author)
    ON CONFLICT DO NOTHING;
END;
$$;
```

---

### 5. `notify_new_claim`

| Property | Value |
|---|---|
| **File** | `procedures.sql` |
| **Parameters** | `claim_researcher_id INTEGER`, `claim_paper_id INTEGER` |

#### Purpose
Notifies **all admins** when a researcher submits a new paper claim. Uses a loop over the `admin` table so every admin account receives the notification.

#### Steps
1. Fetches paper title and researcher's full name.
2. Inserts notification: *"[Name] has submitted a claim for the paper: '[title]'"*
3. Links as `paper_notification`.
4. Loops over every row in `admin` and inserts a `notification_receiver` for each.

#### SQL
```sql
CREATE OR REPLACE PROCEDURE notify_new_claim(
    claim_researcher_id INTEGER,
    claim_paper_id      INTEGER
)
LANGUAGE plpgsql AS $$
DECLARE
    notif_id        INTEGER;
    paper_title     VARCHAR(500);
    researcher_name TEXT;
    msg             TEXT;
    admin           RECORD;
BEGIN
    SELECT p.title INTO paper_title FROM paper p WHERE p.id = claim_paper_id;
    SELECT u.full_name INTO researcher_name FROM "user" u WHERE u.id = claim_researcher_id;

    msg := researcher_name || ' has submitted a claim for the paper: "' || paper_title || '"';

    INSERT INTO notification (message) VALUES (msg) RETURNING id INTO notif_id;
    INSERT INTO paper_notification (notification_id, paper_id) VALUES (notif_id, claim_paper_id);

    FOR admin IN SELECT a.user_id FROM admin a LOOP
        INSERT INTO notification_receiver (notification_id, user_id)
        VALUES (notif_id, admin.user_id)
        ON CONFLICT DO NOTHING;
    END LOOP;
END;
$$;
```

---

### 6. `notify_claim_declined`

| Property | Value |
|---|---|
| **File** | `procedures.sql` |
| **Called from** | `adminModel.js` via `CALL notify_claim_declined($1, $2)` |
| **Parameters** | `claim_researcher_id INTEGER`, `claim_paper_id INTEGER` |

#### Purpose
Notifies the claimant when their paper claim is declined by an admin.

#### Steps
1. Fetches the paper title.
2. Inserts notification: *"Your claim for paper '[title]' has been declined."*
3. Links as `paper_notification` and delivers to the claimant.

#### SQL
```sql
CREATE OR REPLACE PROCEDURE notify_claim_declined(
    claim_researcher_id INTEGER,
    claim_paper_id      INTEGER
)
LANGUAGE plpgsql AS $$
DECLARE
    notif_id    INTEGER;
    paper_title VARCHAR(500);
    msg         TEXT;
BEGIN
    SELECT p.title INTO paper_title FROM paper p WHERE p.id = claim_paper_id;
    msg := 'Your claim for paper "' || paper_title || '" has been declined.';

    INSERT INTO notification (message) VALUES (msg) RETURNING id INTO notif_id;
    INSERT INTO paper_notification (notification_id, paper_id) VALUES (notif_id, claim_paper_id);
    INSERT INTO notification_receiver (notification_id, user_id)
    VALUES (notif_id, claim_researcher_id)
    ON CONFLICT DO NOTHING;
END;
$$;
```

---

### 7. `submit_author_claim`

| Property | Value |
|---|---|
| **File** | `migrations/001_author_claim_request.sql` |
| **Parameters** | `p_claimant_user_id INTEGER`, `p_claimed_author_id INTEGER`, `p_claim_text TEXT` |

#### Purpose
Validates and inserts a new duplicate-author claim during the signup flow. Ensures only valid claims reach the `author_claim_request` table.

#### Steps
1. Checks that the `claimed_author_id` is currently linked to some researcher in the `researcher` table. If not, raises an exception — there is nothing to dispute.
2. Checks that the claimant is not already a researcher themselves. If they are, raises an exception — they don't need to claim.
3. Inserts the claim into `author_claim_request` with `status = 'pending'`.

#### SQL
```sql
CREATE OR REPLACE PROCEDURE submit_author_claim(
    p_claimant_user_id  INTEGER,
    p_claimed_author_id INTEGER,
    p_claim_text        TEXT
)
LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM researcher WHERE author_id = p_claimed_author_id) THEN
        RAISE EXCEPTION 'No existing researcher is linked to this author.';
    END IF;

    IF EXISTS (SELECT 1 FROM researcher WHERE user_id = p_claimant_user_id) THEN
        RAISE EXCEPTION 'Claimant is already a researcher.';
    END IF;

    INSERT INTO author_claim_request (claimant_user_id, claimed_author_id, claim_text)
    VALUES (p_claimant_user_id, p_claimed_author_id, p_claim_text);
END;
$$;
```

---

### 8. `approve_author_claim`

| Property | Value |
|---|---|
| **File** | `migrations/001_author_claim_request.sql` |
| **Parameters** | `p_claim_id INTEGER`, `p_admin_user_id INTEGER` |

#### Purpose
Handles the full **Swap** workflow when an admin approves a duplicate-author claim. This is the most complex procedure in the system — it transfers researcher ownership and notifies both affected users atomically.

#### Steps
1. Fetches the pending claim. Raises an exception if it doesn't exist or is already resolved.
2. Finds the `user_id` of the current researcher holding the claimed author profile.
3. Fetches the author's name for notification messages.
4. **Deletes** the old researcher's link from the `researcher` table (demotes them to a regular user).
5. **Inserts** a new `researcher` row linking the claimant to the author profile.
6. Updates the `author_claim_request` row to `status = 'approved'`, recording `resolved_at` and `resolved_by`.
7. Sends the **old researcher** a demotion notification: *"Your researcher status for author profile '[name]' has been revoked due to a verified ownership claim."*
8. Sends the **claimant** an approval notification: *"Your claim to author profile '[name]' has been approved. You are now a verified researcher."*

#### SQL
```sql
CREATE OR REPLACE PROCEDURE approve_author_claim(
    p_claim_id      INTEGER,
    p_admin_user_id INTEGER
)
LANGUAGE plpgsql AS $$
DECLARE
    v_claimant_user_id       INTEGER;
    v_claimed_author_id      INTEGER;
    v_old_researcher_user_id INTEGER;
    v_author_name            VARCHAR(255);
    v_notif_id               INTEGER;
BEGIN
    SELECT claimant_user_id, claimed_author_id
    INTO v_claimant_user_id, v_claimed_author_id
    FROM author_claim_request
    WHERE id = p_claim_id AND status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Claim not found or already resolved.';
    END IF;

    SELECT user_id INTO v_old_researcher_user_id
    FROM researcher WHERE author_id = v_claimed_author_id;

    SELECT name INTO v_author_name FROM author WHERE id = v_claimed_author_id;

    DELETE FROM researcher WHERE author_id = v_claimed_author_id;

    INSERT INTO researcher (user_id, author_id)
    VALUES (v_claimant_user_id, v_claimed_author_id);

    UPDATE author_claim_request
    SET status = 'approved', resolved_at = now(), resolved_by = p_admin_user_id
    WHERE id = p_claim_id;

    INSERT INTO notification (message)
    VALUES ('Your researcher status for author profile "' || v_author_name ||
            '" has been revoked due to a verified ownership claim. Contact support if you believe this is an error.')
    RETURNING id INTO v_notif_id;
    INSERT INTO notification_receiver (notification_id, user_id)
    VALUES (v_notif_id, v_old_researcher_user_id);

    INSERT INTO notification (message)
    VALUES ('Your claim to author profile "' || v_author_name ||
            '" has been approved. You are now a verified researcher.')
    RETURNING id INTO v_notif_id;
    INSERT INTO notification_receiver (notification_id, user_id)
    VALUES (v_notif_id, v_claimant_user_id);
END;
$$;
```

---

### 9. `reject_author_claim`

| Property | Value |
|---|---|
| **File** | `migrations/001_author_claim_request.sql` |
| **Parameters** | `p_claim_id INTEGER`, `p_admin_user_id INTEGER` |

#### Purpose
Handles the **Keep As Is** workflow when an admin rejects a duplicate-author claim. Makes no changes to researcher ownership but notifies both parties.

#### Steps
1. Fetches the pending claim. Raises an exception if already resolved.
2. Finds the current researcher holding the author profile.
3. Fetches the author's name.
4. Updates the claim to `status = 'rejected'` with timestamp and admin ID.
5. Sends the **current researcher** a vigilance notification: *"Someone attempted to claim your author profile '[name]'. No action was taken."*
6. Sends the **claimant** a rejection notification: *"Your claim to author profile '[name]' has been reviewed and declined."*

#### SQL
```sql
CREATE OR REPLACE PROCEDURE reject_author_claim(
    p_claim_id      INTEGER,
    p_admin_user_id INTEGER
)
LANGUAGE plpgsql AS $$
DECLARE
    v_claimant_user_id       INTEGER;
    v_claimed_author_id      INTEGER;
    v_old_researcher_user_id INTEGER;
    v_author_name            VARCHAR(255);
    v_notif_id               INTEGER;
BEGIN
    SELECT claimant_user_id, claimed_author_id
    INTO v_claimant_user_id, v_claimed_author_id
    FROM author_claim_request
    WHERE id = p_claim_id AND status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Claim not found or already resolved.';
    END IF;

    SELECT user_id INTO v_old_researcher_user_id
    FROM researcher WHERE author_id = v_claimed_author_id;

    SELECT name INTO v_author_name FROM author WHERE id = v_claimed_author_id;

    UPDATE author_claim_request
    SET status = 'rejected', resolved_at = now(), resolved_by = p_admin_user_id
    WHERE id = p_claim_id;

    INSERT INTO notification (message)
    VALUES ('Someone attempted to claim your author profile "' || v_author_name ||
            '". No action was taken. Please stay vigilant.')
    RETURNING id INTO v_notif_id;
    INSERT INTO notification_receiver (notification_id, user_id)
    VALUES (v_notif_id, v_old_researcher_user_id);

    INSERT INTO notification (message)
    VALUES ('Your claim to author profile "' || v_author_name ||
            '" has been reviewed and declined.')
    RETURNING id INTO v_notif_id;
    INSERT INTO notification_receiver (notification_id, user_id)
    VALUES (v_notif_id, v_claimant_user_id);
END;
$$;
```

---

## Summary Table

### Triggers

| Trigger Name | Table | Event | Type | Purpose |
|---|---|---|---|---|
| `trg_normalize_author` | `author` | BEFORE INSERT/UPDATE | Data normalization | Canonicalizes name and ORCID format |
| `trg_normalize_venue` | `venue` | BEFORE INSERT/UPDATE | Data normalization | Canonicalizes name, type, and ISSN |
| `trg_normalize_paper` | `paper` | BEFORE INSERT/UPDATE | Data normalization | Canonicalizes title and DOI |
| `trg_prevent_self_review_vote` | `review_vote` | BEFORE INSERT/UPDATE | Data validation | Blocks a researcher from voting on their own review |
| `trg_validate_institute_history_overlap` | `institute_history` | BEFORE INSERT/UPDATE | Data validation | Prevents overlapping institute date ranges per researcher |
| `trg_notify_paper_review` | `review` | AFTER INSERT | Reactive notification | Notifies paper co-authors on new review; notifies parent review author on reply |
| `trg_notify_review_vote` | `review_vote` | AFTER INSERT | Reactive notification | Notifies review author when their review is voted on |

### Stored Procedures

| Procedure Name | File | Called From | Purpose |
|---|---|---|---|
| `approve_paper_claim` | `procedures.sql` | `adminModel.js` via `CALL` | Inserts paper authorship, notifies claimant and followers |
| `notify_new_follower` | `procedures.sql` | Follow flow | Creates and delivers follow notification |
| `notify_paper_review` | `procedures.sql` | Review flow | Notifies paper co-authors of new review |
| `notify_review_vote` | `procedures.sql` | Vote flow | Notifies review author of new vote |
| `notify_new_claim` | `procedures.sql` | Claim flow | Alerts all admins of a new paper claim |
| `notify_claim_declined` | `procedures.sql` | `adminModel.js` via `CALL` | Notifies claimant of a declined paper claim |
| `submit_author_claim` | `migrations/001_...sql` | Duplicate claim flow | Validates and inserts a duplicate-author claim |
| `approve_author_claim` | `migrations/001_...sql` | Admin swap action | Transfers researcher ownership, notifies both parties |
| `reject_author_claim` | `migrations/001_...sql` | Admin reject action | Marks claim rejected, notifies both parties |
