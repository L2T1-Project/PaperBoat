# Feature: Duplicate Author / Impersonation Claim Resolution

## Context

**Project:** PaperBoat (ResearchGate-style academic platform)  
**Repo:** `https://github.com/L2T1-Project/PaperBoat`  
**Stack:** React 19 frontend, Express 5 backend, PostgreSQL database  
**Relevant existing tables:** `user`, `researcher`, `author`, `admin`, `notification`, `notification_receiver`, `feedback`

---

## Problem Statement

Currently, when a new user signs up and claims to be a real-world author who is already represented in the system (i.e., an existing `author` record that may already be linked to another `researcher`/`user`), the frontend sends a feedback message directly to the admin via the existing `feedback` table. This needs to be redesigned into a proper backend-driven workflow using database procedures, a new admin page, and a structured resolution process.

---

## Overview of the New Flow

1. During signup, if a user identifies as a duplicate (claims they are the real person behind an existing author profile that someone else already occupies), the system collects their claim along with optional supporting evidence.
2. The claim is stored in a new dedicated table (not the general `feedback` table) via a backend controller that calls **Procedure 1**.
3. Admins see all pending claims on a new dedicated admin page ("Check Duplicacies" or similar).
4. Admins can either **Swap** (approve the claim) or **Keep As Is** (reject the claim).
   - **Swap** triggers **Procedure 2**, which transfers the author profile to the new claimant and demotes the old user.
   - **Keep As Is** triggers **Procedure 3**, which simply sends notifications to both parties.

---

## Detailed Specification

### 1. Frontend Changes (Signup Form)

**Where:** The signup flow — specifically the step where a user who is flagged as a potential duplicate is told they will be logged in as a normal user.

**What to add:**

- After informing the user they will be signed up as a normal user (because the author profile is already claimed), present the following optional UI elements:
  - A **dropdown or toggle** asking: *"Do you believe you are the real author? Submit a claim."*
  - If yes, show:
    - A **text area** for the user to write a message explaining why they are the real author.
    - An **optional input field** for a Google Drive link (or similar) where the user can provide supporting evidence/documents.
  - If no, just proceed with normal user signup as before.

**Important:** The claim message and optional drive link are combined into a single `claim_text` string and sent to the backend. This data must **NOT** go into the existing `feedback` table.

---

### 2. New Database Table

Create a new table to store impersonation/duplicate claims:

```sql
CREATE TABLE author_claim_request (
    id SERIAL PRIMARY KEY,
    claimant_user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    claimed_author_id INTEGER NOT NULL REFERENCES author(id) ON DELETE CASCADE,
    claim_text TEXT NOT NULL,  -- contains the user's message + optional drive link
    status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- 'pending', 'approved', 'rejected'
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    resolved_at TIMESTAMP,
    resolved_by INTEGER REFERENCES admin(user_id) ON DELETE SET NULL
);
```

**Notes:**
- `claimant_user_id` = the new user who just signed up and is claiming to be the real author.
- `claimed_author_id` = the `author.id` they claim to be the real person behind.
- `claim_text` = free text. May contain a Google Drive link and/or a written justification.
- `status` = tracks the lifecycle of the claim.

---

### 3. Backend: Procedure 1 — Submit a Claim

**Trigger:** Called by a backend controller when the frontend submits the claim form during/after signup.

**Route:** `POST /api/claims`  
**Auth:** Requires the claimant to be logged in (they just signed up as a normal user).

**Controller logic:**
1. Extract `claimant_user_id` from `req.user` (the authenticated new user).
2. Extract `claimed_author_id` and `claim_text` from the request body.
3. Validate that the `claimed_author_id` exists and is currently linked to a different researcher.
4. Insert a new row into `author_claim_request` with status = `'pending'`.
5. Return a success response to the frontend.

**SQL Procedure (or function):**

```sql
CREATE OR REPLACE PROCEDURE submit_author_claim(
    p_claimant_user_id INTEGER,
    p_claimed_author_id INTEGER,
    p_claim_text TEXT
)
LANGUAGE plpgsql AS $$
BEGIN
    -- Validate: the author must exist and be linked to some other researcher
    IF NOT EXISTS (
        SELECT 1 FROM researcher WHERE author_id = p_claimed_author_id
    ) THEN
        RAISE EXCEPTION 'No existing researcher is linked to this author.';
    END IF;

    -- Validate: the claimant must not already be a researcher
    IF EXISTS (
        SELECT 1 FROM researcher WHERE user_id = p_claimant_user_id
    ) THEN
        RAISE EXCEPTION 'Claimant is already a researcher.';
    END IF;

    -- Insert the claim
    INSERT INTO author_claim_request (claimant_user_id, claimed_author_id, claim_text)
    VALUES (p_claimant_user_id, p_claimed_author_id, p_claim_text);
END;
$$;
```

---

### 4. Admin Page: "Check Duplicacies"

**Where:** A new page in the Admin panel (the `Admin/` directory in the repo).

**Route (frontend):** `/admin/duplicate-claims` (or similar)

**What it displays:**

For each pending claim, show:
- The **new user's info** (claimant): name, email, user ID.
- The **claim text** they submitted (which may include a Drive link — render links as clickable).
- The **current researcher's info** (the person who currently holds the author profile): name, email, user ID, researcher ID.
- The **author profile info**: author name, author ID, ORCID (if any).

**Actions available to the admin (per claim):**
- **"Swap" button** → Triggers Procedure 2 (approve the claim).
- **"Keep As Is" button** → Triggers Procedure 3 (reject the claim).

**Backend endpoints needed:**
- `GET /api/admin/claims?status=pending` — Fetch all pending claims with joined user/researcher/author data.
- `POST /api/admin/claims/:claimId/approve` — Triggers Procedure 2.
- `POST /api/admin/claims/:claimId/reject` — Triggers Procedure 3.

---

### 5. Backend: Procedure 2 — Swap (Approve Claim)

**Trigger:** Admin clicks "Swap" on a claim.

**What happens (in a single transaction):**

1. Identify the `old_researcher` — the user currently linked to the claimed `author_id` via the `researcher` table.
2. **Remove the old researcher record:** Delete the row from the `researcher` table where `author_id = claimed_author_id`. This demotes the old user back to a normal user (they lose researcher status).
3. **Create a new researcher record:** Insert into `researcher` with `user_id = claimant_user_id` and `author_id = claimed_author_id`. The new claimant is now the researcher for that author profile.
4. **Update the claim status:** Set `status = 'approved'`, `resolved_at = now()`, and `resolved_by = admin_user_id` in `author_claim_request`.
5. **Send notification to the OLD user (demoted):**  
   - Create a `notification` with message: `"Your researcher status for author profile [author_name] has been revoked due to a verified ownership claim. If you believe this is an error, please contact support."`
   - Insert into `notification_receiver` for the old user.
6. **Send notification to the NEW user (claimant, approved):**  
   - Create a `notification` with message: `"Your claim to author profile [author_name] has been approved. You are now registered as the researcher for this profile."`
   - Insert into `notification_receiver` for the new user.

**SQL Procedure:**

```sql
CREATE OR REPLACE PROCEDURE approve_author_claim(
    p_claim_id INTEGER,
    p_admin_user_id INTEGER
)
LANGUAGE plpgsql AS $$
DECLARE
    v_claimant_user_id INTEGER;
    v_claimed_author_id INTEGER;
    v_old_researcher_user_id INTEGER;
    v_author_name VARCHAR(255);
    v_notif_id INTEGER;
BEGIN
    -- Fetch claim details
    SELECT claimant_user_id, claimed_author_id
    INTO v_claimant_user_id, v_claimed_author_id
    FROM author_claim_request
    WHERE id = p_claim_id AND status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Claim not found or already resolved.';
    END IF;

    -- Find the old researcher
    SELECT user_id INTO v_old_researcher_user_id
    FROM researcher
    WHERE author_id = v_claimed_author_id;

    -- Get author name for notification messages
    SELECT name INTO v_author_name
    FROM author
    WHERE id = v_claimed_author_id;

    -- Step 1: Remove old researcher link
    DELETE FROM researcher WHERE author_id = v_claimed_author_id;

    -- Step 2: Create new researcher link
    INSERT INTO researcher (user_id, author_id)
    VALUES (v_claimant_user_id, v_claimed_author_id);

    -- Step 3: Update claim status
    UPDATE author_claim_request
    SET status = 'approved', resolved_at = now(), resolved_by = p_admin_user_id
    WHERE id = p_claim_id;

    -- Step 4: Notify old user (demoted)
    INSERT INTO notification (message)
    VALUES ('Your researcher status for author profile "' || v_author_name || '" has been revoked due to a verified ownership claim. Contact support if you believe this is an error.')
    RETURNING id INTO v_notif_id;

    INSERT INTO notification_receiver (notification_id, user_id)
    VALUES (v_notif_id, v_old_researcher_user_id);

    -- Step 5: Notify new user (approved)
    INSERT INTO notification (message)
    VALUES ('Your claim to author profile "' || v_author_name || '" has been approved. You are now a verified researcher.')
    RETURNING id INTO v_notif_id;

    INSERT INTO notification_receiver (notification_id, user_id)
    VALUES (v_notif_id, v_claimant_user_id);
END;
$$;
```

---

### 6. Backend: Procedure 3 — Keep As Is (Reject Claim)

**Trigger:** Admin clicks "Keep As Is" on a claim.

**What happens:**

1. **Update the claim status:** Set `status = 'rejected'`, `resolved_at = now()`, and `resolved_by = admin_user_id`.
2. **Notify the OLD user (actual researcher — the one being impersonated):**  
   - Message: `"Someone attempted to claim your author profile [author_name]. No changes were made. Stay vigilant and contact support if you have concerns."`
3. **Notify the NEW user (claimant — rejected):**  
   - Message: `"Your claim to author profile [author_name] has been reviewed and declined."`

**SQL Procedure:**

```sql
CREATE OR REPLACE PROCEDURE reject_author_claim(
    p_claim_id INTEGER,
    p_admin_user_id INTEGER
)
LANGUAGE plpgsql AS $$
DECLARE
    v_claimant_user_id INTEGER;
    v_claimed_author_id INTEGER;
    v_old_researcher_user_id INTEGER;
    v_author_name VARCHAR(255);
    v_notif_id INTEGER;
BEGIN
    -- Fetch claim details
    SELECT claimant_user_id, claimed_author_id
    INTO v_claimant_user_id, v_claimed_author_id
    FROM author_claim_request
    WHERE id = p_claim_id AND status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Claim not found or already resolved.';
    END IF;

    -- Find the current researcher and author name
    SELECT user_id INTO v_old_researcher_user_id
    FROM researcher
    WHERE author_id = v_claimed_author_id;

    SELECT name INTO v_author_name
    FROM author
    WHERE id = v_claimed_author_id;

    -- Step 1: Update claim status
    UPDATE author_claim_request
    SET status = 'rejected', resolved_at = now(), resolved_by = p_admin_user_id
    WHERE id = p_claim_id;

    -- Step 2: Notify old user (the real researcher — warn them)
    INSERT INTO notification (message)
    VALUES ('Someone attempted to claim your author profile "' || v_author_name || '". No action was taken. Please stay vigilant.')
    RETURNING id INTO v_notif_id;

    INSERT INTO notification_receiver (notification_id, user_id)
    VALUES (v_notif_id, v_old_researcher_user_id);

    -- Step 3: Notify claimant (rejected)
    INSERT INTO notification (message)
    VALUES ('Your claim to author profile "' || v_author_name || '" has been reviewed and declined.')
    RETURNING id INTO v_notif_id;

    INSERT INTO notification_receiver (notification_id, user_id)
    VALUES (v_notif_id, v_claimant_user_id);
END;
$$;
```

---

## Summary of Changes Required

### Database
- New table: `author_claim_request`
- New procedure: `submit_author_claim`
- New procedure: `approve_author_claim`
- New procedure: `reject_author_claim`

### Backend (Express)
- New route file: `routes/claimRoutes.js`
- New controller: `controllers/claimController.js`
- New model: `models/claimModel.js`
- Endpoints:
  - `POST /api/claims` — User submits a claim (calls Procedure 1)
  - `GET /api/admin/claims?status=pending` — Admin fetches pending claims
  - `POST /api/admin/claims/:claimId/approve` — Admin approves (calls Procedure 2)
  - `POST /api/admin/claims/:claimId/reject` — Admin rejects (calls Procedure 3)

### Frontend (React)
- **Signup form modification:** Add optional claim submission UI (dropdown/toggle, text area, drive link field) when duplicate author is detected.
- **New admin page:** `Admin/pages/CheckDuplicacies.jsx` (or similar) displaying pending claims with Swap and Keep As Is buttons.

### Key Constraint
- Claim data must **not** go into the existing `feedback` table. It goes into the new `author_claim_request` table exclusively.
- The flow is entirely backend-driven (controller → procedure), not frontend → feedback as before.
