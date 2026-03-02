-- Function to handle claim approval
CREATE OR REPLACE FUNCTION approve_claim()
RETURNS TRIGGER AS $$
DECLARE
    auth_id INTEGER;
BEGIN
    -- Only act when claim is approved
    IF NEW.is_approved = TRUE THEN
        -- Get the author_id linked to this researcher
        SELECT author_id INTO auth_id
        FROM researcher
        WHERE user_id = NEW.researcher_id;

        -- Insert into paper_author using the claimed position
        INSERT INTO paper_author (paper_id, author_id, position)
        VALUES (NEW.paper_id, auth_id, NEW.position);

        -- Delete the claim row (since it has been resolved)
        DELETE FROM paper_claim
        WHERE researcher_id = NEW.researcher_id
          AND paper_id = NEW.paper_id;
    END IF;

    -- Return NULL because the claim row is removed
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger that fires after claim approval
CREATE TRIGGER claim_approval_trigger
AFTER UPDATE OF is_approved ON paper_claim
FOR EACH ROW
WHEN (NEW.is_approved = TRUE)
EXECUTE FUNCTION approve_claim();


--write triggers for follow, review, paper notification sending

-- Function for user_notification child -> parent delete
CREATE OR REPLACE FUNCTION delete_notification_from_user()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM notification WHERE id = OLD.notification_id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Function for paper_notification child -> parent delete
CREATE OR REPLACE FUNCTION delete_notification_from_paper()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM notification WHERE id = OLD.notification_id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Function for review_notification child -> parent delete
CREATE OR REPLACE FUNCTION delete_notification_from_review()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM notification WHERE id = OLD.notification_id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;


-- Trigger on user_notification
CREATE TRIGGER user_notification_delete_trigger
AFTER DELETE ON user_notification
FOR EACH ROW
EXECUTE FUNCTION delete_notification_from_user();

-- Trigger on paper_notification
CREATE TRIGGER paper_notification_delete_trigger
AFTER DELETE ON paper_notification
FOR EACH ROW
EXECUTE FUNCTION delete_notification_from_paper();

-- Trigger on review_notification
CREATE TRIGGER review_notification_delete_trigger
AFTER DELETE ON review_notification
FOR EACH ROW
EXECUTE FUNCTION delete_notification_from_review();


-- write similiar trigger for user -> researcher, venue_user subtype