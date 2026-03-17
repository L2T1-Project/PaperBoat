/**
 * One-time migration: installs the two notification triggers in the database.
 *
 * Run once from the backend root:
 *   node src/scripts/migrateNotificationTriggers.js
 *
 * Safe to re-run — uses CREATE OR REPLACE FUNCTION and DROP TRIGGER IF EXISTS.
 */

const dotenv = require('dotenv');
const path   = require('path');
const pkg    = require('pg');
const { Pool } = pkg;

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: true,
});

// Each entry is one DDL statement. Order matters — function before trigger.
const statements = [

/* ─── trg_notify_paper_review ──────────────────────────────────────────────── */
`
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
        SELECT p.title INTO v_paper_title
        FROM paper p
        WHERE p.id = NEW.paper_id;

        INSERT INTO notification (message)
        VALUES ('New review on paper: ' || COALESCE(v_paper_title, 'a paper'))
        RETURNING id INTO v_notification_id;

        INSERT INTO review_notification (notification_id, review_id)
        VALUES (v_notification_id, NEW.id);

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
        SELECT r.researcher_id INTO v_receiver_id
        FROM review r
        WHERE r.id = NEW.parent_review_id;

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
$$
`,

`DROP TRIGGER IF EXISTS trg_notify_paper_review ON review`,

`
CREATE TRIGGER trg_notify_paper_review
AFTER INSERT ON review
FOR EACH ROW
EXECUTE FUNCTION trg_fn_notify_paper_review()
`,

/* ─── trg_notify_review_vote ────────────────────────────────────────────────── */
`
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
$$
`,

`DROP TRIGGER IF EXISTS trg_notify_review_vote ON review_vote`,

`
CREATE TRIGGER trg_notify_review_vote
AFTER INSERT ON review_vote
FOR EACH ROW
EXECUTE FUNCTION trg_fn_notify_review_vote()
`,

];

async function migrate() {
    const client = await pool.connect();
    console.log('Connected to database.');

    try {
        await client.query('BEGIN');

        for (const sql of statements) {
            const preview = sql.trim().split('\n')[0].slice(0, 60);
            process.stdout.write(`  Running: ${preview}... `);
            await client.query(sql);
            console.log('OK');
        }

        await client.query('COMMIT');
        console.log('\nMigration complete. Both notification triggers are now installed.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('\nMigration failed — rolled back.');
        console.error(err.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
