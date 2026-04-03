CREATE OR REPLACE PROCEDURE approve_paper_claim(
    claim_researcher_id INTEGER,
    claim_paper_id INTEGER,
    author_position INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    linked_author_id INTEGER;
    paper_title VARCHAR(500);
    followers_notif_id INTEGER;
    researcher_notif_id INTEGER;
    followers_msg TEXT;
    researcher_msg TEXT;
    follower RECORD;
BEGIN
    linked_author_id := get_author_id(claim_researcher_id);

    INSERT INTO paper_author (paper_id, author_id, position)
    VALUES (claim_paper_id, linked_author_id, author_position)
    ON CONFLICT (paper_id, author_id) DO UPDATE
    SET position = EXCLUDED.position;

    -- Notify claimant directly that claim is approved.
    SELECT p.title INTO paper_title FROM paper p WHERE p.id = claim_paper_id;
    researcher_msg := 'Your claim for paper "' || paper_title || '" has been approved.';

    INSERT INTO notification (message) VALUES (researcher_msg) RETURNING id INTO researcher_notif_id;
    INSERT INTO paper_notification (notification_id, paper_id) VALUES (researcher_notif_id, claim_paper_id);
    INSERT INTO notification_receiver (notification_id, user_id)
    VALUES (researcher_notif_id, claim_researcher_id)
    ON CONFLICT (notification_id, user_id) DO NOTHING;

    -- Notify followers that a relevant paper was published/claimed.
    followers_msg := 'A paper you may be interested in has been published: "' || paper_title || '"';

    INSERT INTO notification (message) VALUES (followers_msg) RETURNING id INTO followers_notif_id;
    INSERT INTO paper_notification (notification_id, paper_id) VALUES (followers_notif_id, claim_paper_id);

    FOR follower IN
        SELECT f.following_user_id AS user_id
        FROM follows f
        WHERE f.followed_user_id = claim_researcher_id
    LOOP
        INSERT INTO notification_receiver (notification_id, user_id)
        VALUES (followers_notif_id, follower.user_id)
        ON CONFLICT (notification_id, user_id) DO NOTHING;
    END LOOP;
END;
$$;



-- follow korle notify
CREATE OR REPLACE PROCEDURE notify_new_follower(
    follower_user_id INTEGER,
    followed_user_id INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    notif_id INTEGER;
    username VARCHAR(100);
    msg TEXT;
BEGIN
    SELECT u.username INTO username FROM "user" u WHERE u.id = follower_user_id;

    msg := username || ' started following you.';

    INSERT INTO notification (message) VALUES (msg) RETURNING id INTO notif_id;
    INSERT INTO user_notification (notification_id, triggered_user_id) VALUES (notif_id, follower_user_id);
    INSERT INTO notification_receiver (notification_id, user_id)
    VALUES (notif_id, followed_user_id)
    ON CONFLICT (notification_id, user_id) DO NOTHING;
END;
$$;


CREATE OR REPLACE PROCEDURE notify_paper_review(
    review_id INTEGER,
    reviewed_paper_id INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    notif_id INTEGER;
    paper_title VARCHAR(500);
    msg TEXT;
    author RECORD;
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
        ON CONFLICT (notification_id, user_id) DO NOTHING;
    END LOOP;
END;
$$;



-- keo tumar review e vote korle
CREATE OR REPLACE PROCEDURE notify_review_vote(
    voted_review_id INTEGER,
    is_upvote BOOLEAN,
    voter_user_id INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    notif_id INTEGER;
    review_author INTEGER;
    voter_name TEXT;
    vote_label TEXT;
    msg TEXT;
BEGIN
    SELECT r.researcher_id INTO review_author FROM review r WHERE r.id = voted_review_id;
    SELECT u.full_name INTO voter_name FROM "user" u WHERE u.id = voter_user_id;

    vote_label := CASE WHEN is_upvote THEN 'upvoted' ELSE 'downvoted' END;
    msg := voter_name || ' ' || vote_label || ' your review.';

    INSERT INTO notification (message) VALUES (msg) RETURNING id INTO notif_id;
    INSERT INTO review_notification (notification_id, review_id) VALUES (notif_id, voted_review_id);
    INSERT INTO notification_receiver (notification_id, user_id)
    VALUES (notif_id, review_author)
    ON CONFLICT (notification_id, user_id) DO NOTHING;
END;
$$;


-- admin ke janano when new keo claim dei
CREATE OR REPLACE PROCEDURE notify_new_claim(
    claim_researcher_id INTEGER,
    claim_paper_id INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    notif_id INTEGER;
    paper_title VARCHAR(500);
    researcher_name TEXT;
    msg TEXT;
    admin RECORD;
BEGIN
    SELECT p.title INTO paper_title FROM paper p WHERE p.id = claim_paper_id;
    SELECT u.full_name INTO researcher_name FROM "user" u WHERE u.id = claim_researcher_id;

    msg := researcher_name || ' has submitted a claim for the paper: "' || paper_title || '"';

    INSERT INTO notification (message) VALUES (msg) RETURNING id INTO notif_id;
    INSERT INTO paper_notification (notification_id, paper_id) VALUES (notif_id, claim_paper_id);

    FOR admin IN
        SELECT a.user_id FROM admin a
    LOOP
        INSERT INTO notification_receiver (notification_id, user_id)
        VALUES (notif_id, admin.user_id)
        ON CONFLICT (notification_id, user_id) DO NOTHING;
    END LOOP;
END;
$$;


CREATE OR REPLACE PROCEDURE notify_claim_declined(
    claim_researcher_id INTEGER,
    claim_paper_id INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    notif_id INTEGER;
    paper_title VARCHAR(500);
    msg TEXT;
BEGIN
    SELECT p.title INTO paper_title FROM paper p WHERE p.id = claim_paper_id;

    msg := 'Your claim for paper "' || paper_title || '" has been declined.';

    INSERT INTO notification (message) VALUES (msg) RETURNING id INTO notif_id;
    INSERT INTO paper_notification (notification_id, paper_id) VALUES (notif_id, claim_paper_id);
    INSERT INTO notification_receiver (notification_id, user_id)
    VALUES (notif_id, claim_researcher_id)
    ON CONFLICT (notification_id, user_id) DO NOTHING;
END;
$$;


-- validate and insert a duplicate-author claim submitted during signup
CREATE OR REPLACE PROCEDURE submit_author_claim(
    p_claimant_user_id  INTEGER,
    p_claimed_author_id INTEGER,
    p_claim_text        TEXT
)
LANGUAGE plpgsql AS $$
BEGIN
    -- the claimed author must already be linked to some researcher
    IF NOT EXISTS (
        SELECT 1 FROM researcher WHERE author_id = p_claimed_author_id
    ) THEN
        RAISE EXCEPTION 'No existing researcher is linked to this author.';
    END IF;

    -- the claimant must not already be a researcher themselves
    IF EXISTS (
        SELECT 1 FROM researcher WHERE user_id = p_claimant_user_id
    ) THEN
        RAISE EXCEPTION 'Claimant is already a researcher.';
    END IF;

    INSERT INTO author_claim_request (claimant_user_id, claimed_author_id, claim_text)
    VALUES (p_claimant_user_id, p_claimed_author_id, p_claim_text);
END;
$$;


-- swap researcher ownership when admin approves a duplicate-author claim
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

    -- demote the old researcher
    DELETE FROM researcher WHERE author_id = v_claimed_author_id;

    -- promote the claimant
    INSERT INTO researcher (user_id, author_id)
    VALUES (v_claimant_user_id, v_claimed_author_id);

    UPDATE author_claim_request
    SET status = 'approved', resolved_at = now(), resolved_by = p_admin_user_id
    WHERE id = p_claim_id;

    -- notify old researcher (demoted)
    INSERT INTO notification (message)
    VALUES ('Your researcher status for author profile "' || v_author_name ||
            '" has been revoked due to a verified ownership claim. Contact support if you believe this is an error.')
    RETURNING id INTO v_notif_id;

    INSERT INTO notification_receiver (notification_id, user_id)
    VALUES (v_notif_id, v_old_researcher_user_id);

    -- notify claimant (approved)
    INSERT INTO notification (message)
    VALUES ('Your claim to author profile "' || v_author_name ||
            '" has been approved. You are now a verified researcher.')
    RETURNING id INTO v_notif_id;

    INSERT INTO notification_receiver (notification_id, user_id)
    VALUES (v_notif_id, v_claimant_user_id);
END;
$$;


-- reject a duplicate-author claim and notify both parties
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

    -- notify current researcher (warn them of the attempt)
    INSERT INTO notification (message)
    VALUES ('Someone attempted to claim your author profile "' || v_author_name ||
            '". No action was taken. Please stay vigilant.')
    RETURNING id INTO v_notif_id;

    INSERT INTO notification_receiver (notification_id, user_id)
    VALUES (v_notif_id, v_old_researcher_user_id);

    -- notify claimant (rejected)
    INSERT INTO notification (message)
    VALUES ('Your claim to author profile "' || v_author_name ||
            '" has been reviewed and declined.')
    RETURNING id INTO v_notif_id;

    INSERT INTO notification_receiver (notification_id, user_id)
    VALUES (v_notif_id, v_claimant_user_id);
END;
$$;
