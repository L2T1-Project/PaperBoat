-- Normalize values before write so data quality stays consistent.
CREATE OR REPLACE FUNCTION trg_fn_normalize_author()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
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
FOR EACH ROW
EXECUTE FUNCTION trg_fn_normalize_author();


CREATE OR REPLACE FUNCTION trg_fn_normalize_venue()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
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
FOR EACH ROW
EXECUTE FUNCTION trg_fn_normalize_venue();


CREATE OR REPLACE FUNCTION trg_fn_normalize_paper()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
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
FOR EACH ROW
EXECUTE FUNCTION trg_fn_normalize_paper();


-- Prevent self-voting to keep review voting behavior meaningful.
CREATE OR REPLACE FUNCTION trg_fn_prevent_self_review_vote()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    review_author_id INTEGER;
BEGIN
    SELECT r.researcher_id
    INTO review_author_id
    FROM review r
    WHERE r.id = NEW.review_id;

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
FOR EACH ROW
EXECUTE FUNCTION trg_fn_prevent_self_review_vote();


-- Ensure one researcher cannot have overlapping institute periods.
CREATE OR REPLACE FUNCTION trg_fn_validate_institute_history_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    has_overlap BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM institute_history ih
        WHERE ih.researcher_id = NEW.researcher_id
          AND NOT (
              ih.researcher_id = NEW.researcher_id
              AND ih.institute_id = NEW.institute_id
              AND ih.from_date = NEW.from_date
          )
          AND daterange(ih.from_date, COALESCE(ih.upto_date, 'infinity'::date), '[]')
              && daterange(NEW.from_date, COALESCE(NEW.upto_date, 'infinity'::date), '[]')
    )
    INTO has_overlap;

    IF has_overlap THEN
        RAISE EXCEPTION 'Overlapping institute history for researcher % is not allowed', NEW.researcher_id;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_institute_history_overlap
BEFORE INSERT OR UPDATE ON institute_history
FOR EACH ROW
EXECUTE FUNCTION trg_fn_validate_institute_history_overlap();


-- Notify relevant users when a new review is inserted.
-- Top-level review  → notify all researchers who are authors of the paper
--                     (via paper_author → researcher), excluding the reviewer themselves.
-- Reply review      → notify the parent review's author (excluding self-replies).
CREATE OR REPLACE FUNCTION trg_fn_notify_paper_review()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_notification_id INTEGER;
    v_paper_title     VARCHAR(500);
    v_receiver_id     INTEGER;
BEGIN
    IF NEW.paper_id IS NOT NULL THEN
        -- Top-level review on a paper
        SELECT p.title INTO v_paper_title
        FROM paper p
        WHERE p.id = NEW.paper_id;

        INSERT INTO notification (message)
        VALUES ('New review on paper: ' || COALESCE(v_paper_title, 'a paper'))
        RETURNING id INTO v_notification_id;

        INSERT INTO review_notification (notification_id, review_id)
        VALUES (v_notification_id, NEW.id);

        -- Fan out to every researcher who is an actual author of the paper.
        -- paper_author.author_id = researcher.author_id → researcher.user_id is the user to notify.
        -- Skip the reviewer themselves.
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
        -- Reply to an existing review
        SELECT r.researcher_id INTO v_receiver_id
        FROM review r
        WHERE r.id = NEW.parent_review_id;

        -- Only notify when the reply is from a different researcher
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
FOR EACH ROW
EXECUTE FUNCTION trg_fn_notify_paper_review();


-- Notify the review author when someone votes on their review.
-- Self-votes are already blocked by trg_prevent_self_review_vote, but we
-- guard here too so the notification logic is self-contained.
CREATE OR REPLACE FUNCTION trg_fn_notify_review_vote()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_notification_id  INTEGER;
    v_review_author_id INTEGER;
    v_vote_label       TEXT;
BEGIN
    SELECT r.researcher_id INTO v_review_author_id
    FROM review r
    WHERE r.id = NEW.review_id;

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
FOR EACH ROW
EXECUTE FUNCTION trg_fn_notify_review_vote();



































-- -- Normalize values before write so data quality stays consistent.
-- CREATE OR REPLACE FUNCTION trg_fn_normalize_author()
-- RETURNS TRIGGER
-- LANGUAGE plpgsql
-- AS $$
-- BEGIN
--     NEW.name := regexp_replace(trim(NEW.name), '\s+', ' ', 'g');

--     IF NEW.orc_id IS NOT NULL THEN
--         NEW.orc_id := upper(regexp_replace(trim(NEW.orc_id), '^https?://orcid.org/', '', 'i'));
--     END IF;

--     RETURN NEW;
-- END;
-- $$;

-- CREATE TRIGGER trg_normalize_author
-- BEFORE INSERT OR UPDATE ON author
-- FOR EACH ROW
-- EXECUTE FUNCTION trg_fn_normalize_author();


-- CREATE OR REPLACE FUNCTION trg_fn_normalize_venue()
-- RETURNS TRIGGER
-- LANGUAGE plpgsql
-- AS $$
-- BEGIN
--     NEW.name := regexp_replace(trim(NEW.name), '\s+', ' ', 'g');
--     NEW.type := regexp_replace(trim(NEW.type), '\s+', ' ', 'g');

--     IF NEW.issn IS NOT NULL THEN
--         NEW.issn := upper(regexp_replace(trim(NEW.issn), '\s+', '', 'g'));
--     END IF;

--     RETURN NEW;
-- END;
-- $$;

-- CREATE TRIGGER trg_normalize_venue
-- BEFORE INSERT OR UPDATE ON venue
-- FOR EACH ROW
-- EXECUTE FUNCTION trg_fn_normalize_venue();


-- CREATE OR REPLACE FUNCTION trg_fn_normalize_paper()
-- RETURNS TRIGGER
-- LANGUAGE plpgsql
-- AS $$
-- BEGIN
--     NEW.title := regexp_replace(trim(NEW.title), '\s+', ' ', 'g');

--     IF NEW.doi IS NOT NULL THEN
--         NEW.doi := lower(trim(NEW.doi));
--         NEW.doi := regexp_replace(NEW.doi, '^https?://doi.org/', '', 'i');
--         NEW.doi := regexp_replace(NEW.doi, '^doi:', '', 'i');
--     END IF;

--     RETURN NEW;
-- END;
-- $$;

-- CREATE TRIGGER trg_normalize_paper
-- BEFORE INSERT OR UPDATE ON paper
-- FOR EACH ROW
-- EXECUTE FUNCTION trg_fn_normalize_paper();


-- -- Prevent self-voting to keep review voting behavior meaningful.
-- CREATE OR REPLACE FUNCTION trg_fn_prevent_self_review_vote()
-- RETURNS TRIGGER
-- LANGUAGE plpgsql
-- AS $$
-- DECLARE
--     review_author_id INTEGER;
-- BEGIN
--     SELECT r.researcher_id
--     INTO review_author_id
--     FROM review r
--     WHERE r.id = NEW.review_id;

--     IF review_author_id IS NULL THEN
--         RAISE EXCEPTION 'Review % does not exist', NEW.review_id;
--     END IF;

--     IF review_author_id = NEW.researcher_id THEN
--         RAISE EXCEPTION 'Self-voting is not allowed for review %', NEW.review_id;
--     END IF;

--     RETURN NEW;
-- END;
-- $$;

-- CREATE TRIGGER trg_prevent_self_review_vote
-- BEFORE INSERT OR UPDATE ON review_vote
-- FOR EACH ROW
-- EXECUTE FUNCTION trg_fn_prevent_self_review_vote();


-- -- Ensure one researcher cannot have overlapping institute periods.
-- CREATE OR REPLACE FUNCTION trg_fn_validate_institute_history_overlap()
-- RETURNS TRIGGER
-- LANGUAGE plpgsql
-- AS $$
-- DECLARE
--     has_overlap BOOLEAN;
-- BEGIN
--     SELECT EXISTS (
--         SELECT 1
--         FROM institute_history ih
--         WHERE ih.researcher_id = NEW.researcher_id
--           AND NOT (
--               ih.researcher_id = NEW.researcher_id
--               AND ih.institute_id = NEW.institute_id
--               AND ih.from_date = NEW.from_date
--           )
--           AND daterange(ih.from_date, COALESCE(ih.upto_date, 'infinity'::date), '[]')
--               && daterange(NEW.from_date, COALESCE(NEW.upto_date, 'infinity'::date), '[]')
--     )
--     INTO has_overlap;

--     IF has_overlap THEN
--         RAISE EXCEPTION 'Overlapping institute history for researcher % is not allowed', NEW.researcher_id;
--     END IF;

--     RETURN NEW;
-- END;
-- $$;

-- CREATE TRIGGER trg_validate_institute_history_overlap
-- BEFORE INSERT OR UPDATE ON institute_history
-- FOR EACH ROW
-- EXECUTE FUNCTION trg_fn_validate_institute_history_overlap();


-- -- Notify relevant users when a new review is inserted.
-- -- Top-level review  → notify all researchers who claimed the paper (excluding the reviewer).
-- -- Reply review      → notify the parent review's author (excluding self-replies).
-- CREATE OR REPLACE FUNCTION trg_fn_notify_paper_review()
-- RETURNS TRIGGER
-- LANGUAGE plpgsql
-- AS $$
-- DECLARE
--     v_notification_id INTEGER;
--     v_paper_title     VARCHAR(500);
--     v_receiver_id     INTEGER;
-- BEGIN
--     IF NEW.paper_id IS NOT NULL THEN
--         -- Top-level review on a paper
--         SELECT p.title INTO v_paper_title
--         FROM paper p
--         WHERE p.id = NEW.paper_id;

--         INSERT INTO notification (message)
--         VALUES ('New review on paper: ' || COALESCE(v_paper_title, 'a paper'))
--         RETURNING id INTO v_notification_id;

--         INSERT INTO review_notification (notification_id, review_id)
--         VALUES (v_notification_id, NEW.id);

--         -- Fan out to every researcher who claimed the paper (skip the reviewer themselves)
--         FOR v_receiver_id IN
--             SELECT pc.researcher_id
--             FROM paper_claim pc
--             WHERE pc.paper_id = NEW.paper_id
--               AND pc.researcher_id <> NEW.researcher_id
--         LOOP
--             INSERT INTO notification_receiver (notification_id, user_id, is_read)
--             VALUES (v_notification_id, v_receiver_id, FALSE)
--             ON CONFLICT DO NOTHING;
--         END LOOP;

--     ELSIF NEW.parent_review_id IS NOT NULL THEN
--         -- Reply to an existing review
--         SELECT r.researcher_id INTO v_receiver_id
--         FROM review r
--         WHERE r.id = NEW.parent_review_id;

--         -- Only notify when the reply is from a different researcher
--         IF v_receiver_id IS NOT NULL AND v_receiver_id <> NEW.researcher_id THEN
--             INSERT INTO notification (message)
--             VALUES ('Someone replied to your review')
--             RETURNING id INTO v_notification_id;

--             INSERT INTO review_notification (notification_id, review_id)
--             VALUES (v_notification_id, NEW.id);

--             INSERT INTO notification_receiver (notification_id, user_id, is_read)
--             VALUES (v_notification_id, v_receiver_id, FALSE)
--             ON CONFLICT DO NOTHING;
--         END IF;
--     END IF;

--     RETURN NEW;
-- END;
-- $$;

-- CREATE TRIGGER trg_notify_paper_review
-- AFTER INSERT ON review
-- FOR EACH ROW
-- EXECUTE FUNCTION trg_fn_notify_paper_review();


-- -- Notify the review author when someone votes on their review.
-- -- Self-votes are already blocked by trg_prevent_self_review_vote, but we
-- -- guard here too so the notification logic is self-contained.
-- CREATE OR REPLACE FUNCTION trg_fn_notify_review_vote()
-- RETURNS TRIGGER
-- LANGUAGE plpgsql
-- AS $$
-- DECLARE
--     v_notification_id  INTEGER;
--     v_review_author_id INTEGER;
--     v_vote_label       TEXT;
-- BEGIN
--     SELECT r.researcher_id INTO v_review_author_id
--     FROM review r
--     WHERE r.id = NEW.review_id;

--     IF v_review_author_id IS NULL OR v_review_author_id = NEW.researcher_id THEN
--         RETURN NEW;
--     END IF;

--     v_vote_label := CASE WHEN NEW.is_upvote THEN 'upvoted' ELSE 'downvoted' END;

--     INSERT INTO notification (message)
--     VALUES ('Someone ' || v_vote_label || ' your review')
--     RETURNING id INTO v_notification_id;

--     INSERT INTO review_notification (notification_id, review_id)
--     VALUES (v_notification_id, NEW.review_id);

--     INSERT INTO notification_receiver (notification_id, user_id, is_read)
--     VALUES (v_notification_id, v_review_author_id, FALSE)
--     ON CONFLICT DO NOTHING;

--     RETURN NEW;
-- END;
-- $$;

-- CREATE TRIGGER trg_notify_review_vote
-- AFTER INSERT ON review_vote
-- FOR EACH ROW
-- EXECUTE FUNCTION trg_fn_notify_review_vote();
