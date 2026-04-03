-- Migration: Author Claim Request
-- Creates the author_claim_request table and supporting stored procedures
-- for the duplicate author / impersonation claim resolution workflow.

-- ============================================================
-- TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS author_claim_request (
    id                SERIAL PRIMARY KEY,
    claimant_user_id  INTEGER NOT NULL REFERENCES "user"(id)  ON DELETE CASCADE,
    claimed_author_id INTEGER NOT NULL REFERENCES author(id)  ON DELETE CASCADE,
    claim_text        TEXT    NOT NULL,
    status            VARCHAR(20) NOT NULL DEFAULT 'pending',  -- 'pending', 'approved', 'rejected'
    created_at        TIMESTAMP   NOT NULL DEFAULT now(),
    resolved_at       TIMESTAMP,
    resolved_by       INTEGER REFERENCES admin(user_id) ON DELETE SET NULL
);

-- ============================================================
-- PROCEDURE 1: Submit a Claim
-- ============================================================

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

-- ============================================================
-- PROCEDURE 2: Approve a Claim (Swap)
-- ============================================================

CREATE OR REPLACE PROCEDURE approve_author_claim(
    p_claim_id INTEGER,
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

-- ============================================================
-- PROCEDURE 3: Reject a Claim (Keep As Is)
-- ============================================================

CREATE OR REPLACE PROCEDURE reject_author_claim(
    p_claim_id INTEGER,
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

    -- Step 2: Notify old user (the real researcher -- warn them)
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
