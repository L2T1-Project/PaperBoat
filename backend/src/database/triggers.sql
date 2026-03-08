CREATE OR REPLACE FUNCTION trg_fn_approve_claim()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    approved_status_id INTEGER;
BEGIN
    SELECT id INTO approved_status_id FROM status WHERE status_name = 'approved';

    IF NEW.status_id = approved_status_id AND OLD.status_id IS DISTINCT FROM NEW.status_id THEN
        CALL approve_paper_claim(NEW.researcher_id, NEW.paper_id, NEW.position);
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_approve_claim
AFTER UPDATE ON paper_claim
FOR EACH ROW
EXECUTE FUNCTION trg_fn_approve_claim();




CREATE OR REPLACE FUNCTION trg_fn_notify_follow()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    CALL notify_new_follower(NEW.following_user_id, NEW.followed_user_id);
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_follow
AFTER INSERT ON follows
FOR EACH ROW
EXECUTE FUNCTION trg_fn_notify_follow();


-- paper_review er trigger
CREATE OR REPLACE FUNCTION trg_paper_notify_review()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.paper_id IS NOT NULL THEN
        CALL notify_paper_review(NEW.id, NEW.paper_id);
    END IF;
    RETURN NEW;
END;
$$;


CREATE TRIGGER trg_notify_review
AFTER INSERT ON review
FOR EACH ROW
EXECUTE FUNCTION trg_fn_notify_review();


-- review vote proc er
CREATE OR REPLACE FUNCTION trg_fn_notify_vote()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    CALL notify_review_vote(NEW.review_id, NEW.is_upvote, NEW.researcher_id);
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_vote
AFTER INSERT ON review_vote
FOR EACH ROW
EXECUTE FUNCTION trg_fn_notify_vote();


-- admin er claim notification jabe, etar trigger ta
CREATE OR REPLACE FUNCTION trg_fn_notify_claim()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    CALL notify_new_claim(NEW.researcher_id, NEW.paper_id);
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_claim
AFTER INSERT ON paper_claim
FOR EACH ROW
EXECUTE FUNCTION trg_fn_notify_claim();
