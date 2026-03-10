CREATE OR REPLACE FUNCTION get_author_id(res_id INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_author_id INTEGER;
BEGIN
    SELECT author_id
    INTO v_author_id
    FROM researcher
    WHERE user_id = res_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Researcher with user_id % not found', res_id;
    END IF;

    RETURN v_author_id;
END;
$$;


CREATE OR REPLACE FUNCTION get_paper_citation_count(target_paper_id INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    citation_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO citation_count
    FROM citation
    WHERE cited_id = target_paper_id;

    RETURN COALESCE(citation_count, 0);
END;
$$;


CREATE OR REPLACE FUNCTION get_researcher_citation_count(researcher_user_id INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    linked_author_id INTEGER;
    total INTEGER := 0;
    curr_paper_id INTEGER;
BEGIN
    linked_author_id := get_author_id(researcher_user_id);

    FOR curr_paper_id IN
        SELECT paper_id
        FROM paper_author
        WHERE author_id = linked_author_id
    LOOP
        total := total + get_paper_citation_count(curr_paper_id);
    END LOOP;

    RETURN total;
END;
$$;


-- Computes the h-index for a researcher.
-- h-index = the largest h where the researcher has at least h papers,
-- each cited at least h times.
CREATE OR REPLACE FUNCTION compute_h_index(researcher_user_id INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    linked_author_id INTEGER;
    h INTEGER := 0;
    rank INTEGER := 0;
    cite_count INTEGER;
BEGIN
    linked_author_id := get_author_id(researcher_user_id);

    -- cite count wise desc sorting
    FOR cite_count IN
        SELECT get_paper_citation_count(pa.paper_id) AS c
        FROM paper_author pa
        WHERE pa.author_id = linked_author_id
        ORDER BY c DESC
    LOOP
        rank := rank + 1;
        -- The rank-th paper must have >= rank citations to count
        IF cite_count >= rank THEN
            h := rank;
        ELSE
            EXIT; 
        END IF;
    END LOOP;

    RETURN h;
END;
$$;
