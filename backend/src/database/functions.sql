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


CREATE OR REPLACE FUNCTION fn_get_researcher_recent_papers(
    researcher_user_id INTEGER,
    p_limit INTEGER DEFAULT 5,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    paper_id INTEGER,
    title VARCHAR,
    publication_date DATE,
    doi VARCHAR,
    venue_name VARCHAR,
    citation_count INTEGER
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    linked_author_id INTEGER;
BEGIN
    linked_author_id := get_author_id(researcher_user_id);

    RETURN QUERY
    SELECT
        p.id AS paper_id,
        p.title,
        p.publication_date,
        p.doi,
        v.name AS venue_name,
        COUNT(c.citing_id)::INT AS citation_count
    FROM paper_author pa
    JOIN paper p ON p.id = pa.paper_id
    JOIN venue v ON v.id = p.venue_id
    LEFT JOIN citation c ON c.cited_id = p.id
    WHERE pa.author_id = linked_author_id
    GROUP BY p.id, v.id
    ORDER BY p.publication_date DESC NULLS LAST, p.id DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;


CREATE OR REPLACE FUNCTION fn_get_venue_top_cited_papers(
    venue_user_id INTEGER,
    p_limit INTEGER DEFAULT 10,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    paper_id INTEGER,
    title VARCHAR,
    publication_date DATE,
    doi VARCHAR,
    citation_count INTEGER
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    linked_venue_id INTEGER;
BEGIN
    SELECT venue_id
    INTO linked_venue_id
    FROM venue_user
    WHERE user_id = venue_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Venue user with user_id % not found', venue_user_id;
    END IF;

    RETURN QUERY
    SELECT
        p.id AS paper_id,
        p.title,
        p.publication_date,
        p.doi,
        COUNT(c.citing_id)::INT AS citation_count
    FROM paper p
    LEFT JOIN citation c ON c.cited_id = p.id
    WHERE p.venue_id = linked_venue_id
    GROUP BY p.id
    ORDER BY citation_count DESC, p.publication_date DESC NULLS LAST, p.id DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;


CREATE OR REPLACE FUNCTION fn_get_venue_published_papers(
    venue_user_id INTEGER,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    paper_id INTEGER,
    title VARCHAR,
    publication_date DATE,
    doi VARCHAR,
    citation_count INTEGER
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    linked_venue_id INTEGER;
BEGIN
    SELECT venue_id
    INTO linked_venue_id
    FROM venue_user
    WHERE user_id = venue_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Venue user with user_id % not found', venue_user_id;
    END IF;

    RETURN QUERY
    SELECT
        p.id AS paper_id,
        p.title,
        p.publication_date,
        p.doi,
        COUNT(c.citing_id)::INT AS citation_count
    FROM paper p
    LEFT JOIN citation c ON c.cited_id = p.id
    WHERE p.venue_id = linked_venue_id
    GROUP BY p.id
    ORDER BY p.publication_date DESC NULLS LAST, p.id DESC
    LIMIT p_limit OFFSET p_offset;
END;
$$;


CREATE OR REPLACE FUNCTION fn_get_venue_prominent_authors(
    venue_user_id INTEGER,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    author_id INTEGER,
    author_name VARCHAR,
    paper_count INTEGER,
    total_citations INTEGER
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    linked_venue_id INTEGER;
BEGIN
    SELECT venue_id
    INTO linked_venue_id
    FROM venue_user
    WHERE user_id = venue_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Venue user with user_id % not found', venue_user_id;
    END IF;

    RETURN QUERY
    SELECT
        a.id AS author_id,
        a.name AS author_name,
        COUNT(DISTINCT p.id)::INT AS paper_count,
        COUNT(c.citing_id)::INT AS total_citations
    FROM paper p
    JOIN paper_author pa ON pa.paper_id = p.id
    JOIN author a ON a.id = pa.author_id
    LEFT JOIN citation c ON c.cited_id = p.id
    WHERE p.venue_id = linked_venue_id
    GROUP BY a.id
    ORDER BY paper_count DESC, total_citations DESC, a.name ASC
    LIMIT p_limit;
END;
$$;
