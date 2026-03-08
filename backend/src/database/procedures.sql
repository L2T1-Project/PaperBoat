CREATE OR REPLACE PROCEDURE approve_paper_claim(
    claim_researcher_id INTEGER,
    claim_paper_id      INTEGER,
    author_position     INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    linked_author_id INTEGER;
    paper_title      VARCHAR(500);
    notif_id         INTEGER;
    msg              TEXT;
    follower         RECORD;
BEGIN
    linked_author_id := get_author_id(claim_researcher_id);

    INSERT INTO paper_author (paper_id, author_id, position)
    VALUES (claim_paper_id, linked_author_id, author_position)
    ON CONFLICT (paper_id, author_id) DO NOTHING;


    -- oi resersearcher er follower der notify
    SELECT p.title INTO paper_title FROM paper p WHERE p.id = claim_paper_id;
    msg := 'A paper you may be interested in has been published: "' || paper_title || '"';

    INSERT INTO notification (message) VALUES (msg) RETURNING id INTO notif_id;
    INSERT INTO paper_notification (notification_id, paper_id) VALUES (notif_id, claim_paper_id);

    FOR follower IN
        SELECT f.following_user_id AS user_id
        FROM follows f
        WHERE f.followed_user_id = claim_researcher_id
    LOOP
        INSERT INTO notification_receiver (notification_id, user_id)
        VALUES (notif_id, follower.user_id);
    END LOOP;
END;
$$;



-- follow korle notify
CREATE OR REPLACE PROCEDURE notify_new_follower(
    follower_user_id INTEGER,   -- the user who started following
    followed_user_id INTEGER    -- the user who got followed
)
LANGUAGE plpgsql
AS $$
DECLARE
    notif_id INTEGER;
    username VARCHAR(100);
    msg      TEXT;
BEGIN
    SELECT u.username INTO username FROM "user" u WHERE u.id = follower_user_id;

    msg := username || ' started following you.';

    INSERT INTO notification (message) VALUES (msg) RETURNING id INTO notif_id;
    INSERT INTO user_notification (notification_id, triggered_user_id) VALUES (notif_id, follower_user_id);
    INSERT INTO notification_receiver (notification_id, user_id) VALUES (notif_id, followed_user_id);
END;
$$;


CREATE OR REPLACE PROCEDURE notify_paper_review(
    review_id INTEGER,
    reviewed_paper_id INTEGER
)
LANGUAGE plpgsql
AS $$
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
        VALUES (notif_id, author.user_id);
    END LOOP;
END;
$$;



-- keo tumar review e vote korle
CREATE OR REPLACE PROCEDURE notify_review_vote(
    voted_review_id INTEGER,
    is_upvote       BOOLEAN,
    voter_user_id   INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    notif_id        INTEGER;
    review_author   INTEGER;
    voter_name      TEXT;
    vote_label      TEXT;
    msg             TEXT;
BEGIN
    SELECT r.researcher_id INTO review_author FROM review r WHERE r.id = voted_review_id;
    SELECT u.full_name     INTO voter_name    FROM "user" u WHERE u.id = voter_user_id;

    vote_label := CASE WHEN is_upvote THEN 'upvoted' ELSE 'downvoted' END;
    msg := voter_name || ' ' || vote_label || ' your review.';

    INSERT INTO notification (message) VALUES (msg) RETURNING id INTO notif_id;
    INSERT INTO review_notification (notification_id, review_id) VALUES (notif_id, voted_review_id);
    INSERT INTO notification_receiver (notification_id, user_id) VALUES (notif_id, review_author);
END;
$$;


-- admin ke janano when new keo claim dei
CREATE OR REPLACE PROCEDURE notify_new_claim(
    claim_researcher_id INTEGER,
    claim_paper_id      INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    notif_id        INTEGER;
    paper_title     VARCHAR(500);
    researcher_name TEXT;
    msg             TEXT;
    admin           RECORD;
BEGIN
    SELECT p.title INTO paper_title       FROM paper     p WHERE p.id = claim_paper_id;
    SELECT u.full_name INTO researcher_name FROM "user"  u WHERE u.id = claim_researcher_id;

    msg := researcher_name || ' has submitted a claim for the paper: "' || paper_title || '"';

    INSERT INTO notification (message) VALUES (msg) RETURNING id INTO notif_id;
    INSERT INTO paper_notification (notification_id, paper_id) VALUES (notif_id, claim_paper_id);

    FOR admin IN
        SELECT a.user_id FROM admin a
    LOOP
        INSERT INTO notification_receiver (notification_id, user_id)
        VALUES (notif_id, admin.user_id);
    END LOOP;
END;
$$;
