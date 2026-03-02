CREATE TABLE "user" (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    full_name VARCHAR(200) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    jwt_token VARCHAR(2000),
    profile_pic_url VARCHAR(300),
    phone_number VARCHAR(20),
    status VARCHAR(50),
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    bio TEXT
);



CREATE TABLE follows (
    following_user_id INTEGER NOT NULL,
    followed_user_id INTEGER NOT NULL,
    CONSTRAINT fk_following FOREIGN KEY (following_user_id) REFERENCES "user"(id) ON DELETE CASCADE,
    CONSTRAINT fk_followed FOREIGN KEY (followed_user_id) REFERENCES "user"(id) ON DELETE CASCADE,
    CONSTRAINT follows_unique PRIMARY KEY (following_user_id, followed_user_id),
    CONSTRAINT follows_self_check CHECK (following_user_id <> followed_user_id)
);

CREATE TABLE admin (
    user_id INTEGER PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE
);

CREATE TABLE institute (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    country VARCHAR(100),
    website_url VARCHAR(300),
    img_url VARCHAR(300)
);

CREATE TABLE publisher (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    img_url VARCHAR(300)
);

-- Author table
--h_index INTEGER DEFAULT 0 - I think eta derived

CREATE TABLE author (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    orc_id VARCHAR(50) UNIQUE
);


-- Researcher table
-- PK = user.id, also FK → user
-- 1-to-1 relation with author (every researcher is an author)
CREATE TABLE researcher (
    user_id INTEGER PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
    author_id INTEGER UNIQUE REFERENCES author(id) ON DELETE CASCADE
);


-- Venue table
-- issn can be null
CREATE TABLE venue (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    issn VARCHAR(50) UNIQUE,
    publisher_id INTEGER NOT NULL REFERENCES publisher(id) ON DELETE CASCADE
);


-- Venue_user table
-- PK = user.id, also FK → user
-- 1-to-1 relation with venue (every venue_user identifies as a venue)
CREATE TABLE venue_user (
    user_id INTEGER PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
    venue_id INTEGER UNIQUE REFERENCES venue(id) ON DELETE CASCADE
);


-- Institute history (many-to-many between researcher and institute)
-- with extra attributes: from_date, to_date
CREATE TABLE institute_history (
    researcher_id INTEGER REFERENCES researcher(user_id) ON DELETE CASCADE,
    institute_id INTEGER REFERENCES institute(id) ON DELETE CASCADE,
    from_date DATE NOT NULL,
    upto_date DATE,
    PRIMARY KEY (researcher_id, institute_id, from_date),
    CONSTRAINT valid_date_range CHECK (upto_date IS NULL OR upto_date >= from_date)
);


CREATE TABLE paper (
    id SERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    publication_date DATE NOT NULL,
    pdf_url VARCHAR(500),
    doi VARCHAR(100) UNIQUE,
    is_retracted BOOLEAN DEFAULT FALSE,
    github_repo VARCHAR(500),
    venue_id INTEGER NOT NULL REFERENCES venue(id) ON DELETE CASCADE
);

CREATE TABLE user_library (
    user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    paper_id INTEGER NOT NULL REFERENCES paper(id) ON DELETE CASCADE,
    saved_at TIMESTAMP NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, paper_id)
);


CREATE TABLE domain (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE field (
    id SERIAL PRIMARY KEY,
    domain_id INTEGER NOT NULL REFERENCES domain(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    CONSTRAINT unique_field_per_domain UNIQUE (domain_id, name)
);

CREATE TABLE topic (
    id SERIAL PRIMARY KEY,
    field_id INTEGER NOT NULL REFERENCES field(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    CONSTRAINT unique_topic_per_field UNIQUE (field_id, name)
);



-- WRITES: AUTHOR <-> PAPER with author order /position
CREATE TABLE paper_author (
    paper_id INTEGER NOT NULL REFERENCES paper(id) ON DELETE CASCADE,
    author_id INTEGER NOT NULL REFERENCES author(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    PRIMARY KEY (paper_id, author_id),
    CONSTRAINT check_positive_position CHECK (position >= 1)
    --CONSTRAINT unique_author_position_per_paper UNIQUE (paper_id, position)
);

CREATE TABLE paper_topic (
    paper_id INTEGER NOT NULL REFERENCES paper(id) ON DELETE CASCADE,
    topic_id INTEGER NOT NULL REFERENCES topic(id) ON DELETE CASCADE,
    PRIMARY KEY (paper_id, topic_id)
);

CREATE TABLE citation (
    citing_id INTEGER NOT NULL REFERENCES paper(id) ON DELETE CASCADE,
    cited_id INTEGER NOT NULL REFERENCES paper(id) ON DELETE CASCADE,
    PRIMARY KEY (citing_id, cited_id),
    CONSTRAINT chk_no_self_citation CHECK (citing_id <> cited_id)
);


CREATE TABLE review (
    id SERIAL PRIMARY KEY,

    researcher_id INTEGER NOT NULL REFERENCES researcher(user_id) ON DELETE CASCADE,

    paper_id INTEGER REFERENCES paper(id) ON DELETE CASCADE,

    parent_review_id INTEGER REFERENCES review(id) ON DELETE CASCADE,

    text TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now(),

     CONSTRAINT review_parent_check CHECK (
        (paper_id IS NOT NULL AND parent_review_id IS NULL) OR
        (paper_id IS NULL AND parent_review_id IS NOT NULL)
    )
);


CREATE TABLE review_vote (
    researcher_id INTEGER NOT NULL REFERENCES researcher(user_id) ON DELETE CASCADE,
    review_id INTEGER NOT NULL REFERENCES review(id) ON DELETE CASCADE,
    is_upvote BOOLEAN NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    PRIMARY KEY (researcher_id, review_id)
);


CREATE TABLE paper_claim (
    researcher_id INTEGER NOT NULL REFERENCES researcher(user_id) ON DELETE CASCADE,
    paper_id INTEGER NOT NULL REFERENCES paper(id) ON DELETE CASCADE,
    position INTEGER NOT NULL CHECK (position > 0),
    is_approved BOOLEAN NOT NULL DEFAULT FALSE,
    claimed_at TIMESTAMP NOT NULL DEFAULT now(),
    PRIMARY KEY (researcher_id, paper_id)
);


CREATE TABLE feedback (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    receiver_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT no_self_feedback CHECK (sender_id <> receiver_id)
);

CREATE TABLE notification (
    id SERIAL PRIMARY KEY,
    message TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);


-- Notification-User relation (many-to-many with is_read)
CREATE TABLE notification_receiver (
    notification_id INTEGER NOT NULL REFERENCES notification(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (notification_id, user_id)
)

CREATE TABLE user_notification (
    notification_id INTEGER PRIMARY KEY REFERENCES notification(id) ON DELETE CASCADE,
    triggered_user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
);

CREATE TABLE paper_notification (
    notification_id INTEGER PRIMARY KEY REFERENCES notification(id) ON DELETE CASCADE,
    paper_id INTEGER NOT NULL REFERENCES paper(id) ON DELETE CASCADE
);


CREATE TABLE review_notification (
    notification_id INTEGER PRIMARY KEY REFERENCES notification(id) ON DELETE CASCADE,
    review_id INTEGER NOT NULL REFERENCES review(id) ON DELETE CASCADE
);
