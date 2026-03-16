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
