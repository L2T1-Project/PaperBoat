-- Didnt implement this as time fast enough

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CREATE INDEX IF NOT EXISTS idx_follows_followed_user_id
--     ON follows(followed_user_id);

-- CREATE INDEX IF NOT EXISTS idx_follows_following_user_id
--     ON follows(following_user_id);

-- Author/topic/citation traversals.
CREATE INDEX IF NOT EXISTS idx_paper_author_author_id
    ON paper_author(author_id);

CREATE INDEX IF NOT EXISTS idx_paper_topic_topic_id
    ON paper_topic(topic_id);

CREATE INDEX IF NOT EXISTS idx_citation_cited_id
    ON citation(cited_id);


CREATE INDEX IF NOT EXISTS idx_paper_venue_pubdate
    ON paper(venue_id, publication_date DESC);


-- CREATE INDEX IF NOT EXISTS idx_review_paper_created_at
--     ON review(paper_id, created_at DESC)
--     WHERE paper_id IS NOT NULL;

-- CREATE INDEX IF NOT EXISTS idx_review_parent_review_id
--     ON review(parent_review_id)
--     WHERE parent_review_id IS NOT NULL;


-- CREATE INDEX IF NOT EXISTS idx_review_vote_review_id
--     ON review_vote(review_id);


-- CREATE INDEX IF NOT EXISTS idx_notification_receiver_user_read
--     ON notification_receiver(user_id, is_read);


CREATE INDEX IF NOT EXISTS idx_paper_title_trgm
    ON paper USING gin (lower(title) gin_trgm_ops);

-- CREATE INDEX IF NOT EXISTS idx_author_name_trgm
--     ON author USING gin (lower(name) gin_trgm_ops);

-- CREATE INDEX IF NOT EXISTS idx_venue_name_trgm
--     ON venue USING gin (lower(name) gin_trgm_ops);

-- Uncomment only if review lists by researcher become hot.
-- CREATE INDEX IF NOT EXISTS idx_review_researcher_created_at
--     ON review(researcher_id, created_at DESC);