# Notification System — PaperBoat

## Overview

Every notification follows the same two-step pattern regardless of how it was created:

1. Insert a row into `notification` (the message text)
2. Insert one row into `notification_receiver` per recipient (links user ↔ notification, tracks `is_read`)

Optionally, one **subtype row** is inserted into `user_notification`, `paper_notification`, `review_notification`, or `feedback_notification`. The subtype is what allows the frontend to know *where to navigate* when the notification is clicked.

---

## Database Tables

```
notification             — base record: id, message, created_at
notification_receiver    — fan-out: notification_id, user_id, is_read
                           PRIMARY KEY (notification_id, user_id)

── Subtype tables (one per notification, at most one subtype) ──
user_notification        — notification_id, triggered_user_id
paper_notification       — notification_id, paper_id
review_notification      — notification_id, review_id
feedback_notification    — notification_id, feedback_id
```

The subtype tables are mutually exclusive by convention — a notification has exactly one subtype row (or none for generic messages).

---

## Two Creation Paths

The system uses two different mechanisms to create notifications:

| Mechanism | Used for |
|---|---|
| **Database triggers** (auto-fire on INSERT) | Reviews, review votes |
| **JS model methods** (called explicitly in controllers) | Follows, paper publish, feedback |
| **Stored procedures** (called via `CALL` from JS) | Also used for follows and claims |

In practice, review and vote notifications are handled entirely by triggers — the JS controller does not call any notification code explicitly; the database handles it automatically.

---

## Event Reference

### 1. New Follower

**Trigger:** `POST /api/follows` → `followController.followResearcher()`

**Creation path:** JS model → `notificationModel.notifyNewFollower(followerUserId, followedUserId, followerName)`

```javascript
// notificationModel.js — notifyNewFollower
const message = `${followerName} started following you.`;
const notif = await this.createNotification(message);    // INSERT INTO notification
await this.addReceiver(notif.id, followedUserId);         // INSERT INTO notification_receiver
await this.createUserNotification(notif.id, followerUserId); // INSERT INTO user_notification
```

**Recipient:** The user who was followed (1 receiver).

**Frontend navigation:** `link_type = 'user'` → `/authors/{link_author_id}`

---

### 2. Paper Published

**Trigger:** `POST /api/papers` → `paperController.createPaper()` (researcher only)

**Creation path:** JS model → `notificationModel.notifyFollowersPaperPublished(authorUserId, paperId, paperTitle, authorName)`

```javascript
// notificationModel.js — notifyFollowersPaperPublished

// Step 1: Get all followers of this researcher
SELECT following_user_id FROM follows WHERE followed_user_id = $1

// Step 2: Create one shared notification
const message = `${authorName} published a new paper: "${paperTitle}"`;
INSERT INTO notification (message) VALUES ($1) RETURNING id

// Step 3: Tag it as a paper notification (for navigation)
INSERT INTO paper_notification (notification_id, paper_id) VALUES ($1, $2)

// Step 4: Fan out — one receiver row per follower
for (const userId of followers) {
    INSERT INTO notification_receiver (notification_id, user_id) VALUES ($1, $2)
}
```

**Recipients:** All users who follow the author (N receivers, one notification row).

**Frontend navigation:** `link_type = 'paper'` → `/papers/{paper_id}`

---

### 3. New Review on a Paper

**Trigger:** `INSERT ON review` — fires automatically via database trigger `trg_notify_paper_review`

The JS controller (`reviewController.createReview`) does not call any notification code. The trigger fires automatically after every INSERT on the `review` table.

```sql
-- triggers.sql — trg_fn_notify_paper_review (top-level review branch)
-- Fires: AFTER INSERT ON review FOR EACH ROW

IF NEW.paper_id IS NOT NULL THEN
    -- Get the paper title
    SELECT p.title INTO v_paper_title FROM paper p WHERE p.id = NEW.paper_id;

    -- Create the notification
    INSERT INTO notification (message)
    VALUES ('New review on paper: ' || COALESCE(v_paper_title, 'a paper'))
    RETURNING id INTO v_notification_id;

    -- Tag as review notification (links review → paper for navigation)
    INSERT INTO review_notification (notification_id, review_id)
    VALUES (v_notification_id, NEW.id);

    -- Fan out to every researcher who is an actual author of the paper,
    -- excluding the reviewer themselves
    FOR v_receiver_id IN
        SELECT res.user_id
        FROM paper_author pa
        JOIN researcher res ON res.author_id = pa.author_id
        WHERE pa.paper_id = NEW.paper_id
          AND res.user_id <> NEW.researcher_id   -- exclude the reviewer
    LOOP
        INSERT INTO notification_receiver (notification_id, user_id, is_read)
        VALUES (v_notification_id, v_receiver_id, FALSE)
        ON CONFLICT DO NOTHING;
    END LOOP;
END IF;
```

**Recipients:** All researchers who are listed as authors of the paper (via `paper_author → researcher`), except the reviewer themselves.

**Frontend navigation:** `link_type = 'review'` → `/papers/{link_paper_id}/reviews`

---

### 4. Reply to a Review

**Trigger:** Same `trg_notify_paper_review` trigger, different branch (`NEW.paper_id IS NULL AND NEW.parent_review_id IS NOT NULL`)

```sql
-- triggers.sql — trg_fn_notify_paper_review (reply branch)

ELSIF NEW.parent_review_id IS NOT NULL THEN
    -- Find the author of the parent review
    SELECT r.researcher_id INTO v_receiver_id
    FROM review r
    WHERE r.id = NEW.parent_review_id;

    -- Only notify if reply is from a different researcher
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
```

**Recipients:** The author of the parent review (1 receiver), unless it's a self-reply.

**Frontend navigation:** `link_type = 'review'` → `/papers/{link_paper_id}/reviews`

---

### 5. Review Vote (Upvote or Downvote)

**Trigger:** `INSERT ON review_vote` — fires automatically via `trg_notify_review_vote`

```sql
-- triggers.sql — trg_fn_notify_review_vote
-- Fires: AFTER INSERT ON review_vote FOR EACH ROW

-- Get the review's author
SELECT r.researcher_id INTO v_review_author_id
FROM review r
WHERE r.id = NEW.review_id;

-- Guard: skip if review not found OR self-vote
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
```

**Recipients:** The author of the voted review (1 receiver).

**Frontend navigation:** `link_type = 'review'` → `/papers/{link_paper_id}/reviews`

---

### 6. Paper Claim Submitted

**Trigger:** `POST /api/researchers/:id/claims` → stored procedure `notify_new_claim`

```sql
-- procedures.sql — notify_new_claim(claim_researcher_id, claim_paper_id)

SELECT p.title INTO paper_title FROM paper p WHERE p.id = claim_paper_id;
SELECT u.full_name INTO researcher_name FROM "user" u WHERE u.id = claim_researcher_id;

msg := researcher_name || ' has submitted a claim for the paper: "' || paper_title || '"';

INSERT INTO notification (message) VALUES (msg) RETURNING id INTO notif_id;
INSERT INTO paper_notification (notification_id, paper_id) VALUES (notif_id, claim_paper_id);

-- Fan out to every admin
FOR admin IN SELECT a.user_id FROM admin a LOOP
    INSERT INTO notification_receiver (notification_id, user_id)
    VALUES (notif_id, admin.user_id)
    ON CONFLICT (notification_id, user_id) DO NOTHING;
END LOOP;
```

**Recipients:** All admins.

---

### 7. Paper Claim Approved

**Trigger:** Admin approves claim → stored procedure `approve_paper_claim`

```sql
-- procedures.sql — approve_paper_claim(claim_researcher_id, claim_paper_id, author_position)

-- First: link the author to the paper
INSERT INTO paper_author (paper_id, author_id, position)
VALUES (claim_paper_id, linked_author_id, author_position)
ON CONFLICT (paper_id, author_id) DO UPDATE SET position = EXCLUDED.position;

-- Notify the claimant
researcher_msg := 'Your claim for paper "' || paper_title || '" has been approved.';
INSERT INTO notification (message) VALUES (researcher_msg) RETURNING id INTO researcher_notif_id;
INSERT INTO paper_notification (notification_id, paper_id) VALUES (researcher_notif_id, claim_paper_id);
INSERT INTO notification_receiver (notification_id, user_id)
VALUES (researcher_notif_id, claim_researcher_id) ON CONFLICT DO NOTHING;

-- Notify followers of the researcher about the paper
followers_msg := 'A paper you may be interested in has been published: "' || paper_title || '"';
INSERT INTO notification (message) VALUES (followers_msg) RETURNING id INTO followers_notif_id;
INSERT INTO paper_notification (notification_id, paper_id) VALUES (followers_notif_id, claim_paper_id);

FOR follower IN
    SELECT f.following_user_id AS user_id
    FROM follows f WHERE f.followed_user_id = claim_researcher_id
LOOP
    INSERT INTO notification_receiver (notification_id, user_id)
    VALUES (followers_notif_id, follower.user_id) ON CONFLICT DO NOTHING;
END LOOP;
```

**Recipients:** The claiming researcher (claim approved message) + all followers of that researcher (paper published message). Two separate notifications are created.

---

### 8. Paper Claim Declined

**Trigger:** Admin declines claim → stored procedure `notify_claim_declined`

```sql
-- procedures.sql — notify_claim_declined(claim_researcher_id, claim_paper_id)

SELECT p.title INTO paper_title FROM paper p WHERE p.id = claim_paper_id;
msg := 'Your claim for paper "' || paper_title || '" has been declined.';

INSERT INTO notification (message) VALUES (msg) RETURNING id INTO notif_id;
INSERT INTO paper_notification (notification_id, paper_id) VALUES (notif_id, claim_paper_id);
INSERT INTO notification_receiver (notification_id, user_id)
VALUES (notif_id, claim_researcher_id) ON CONFLICT DO NOTHING;
```

**Recipients:** The claiming researcher (1 receiver).

---

### 9. Feedback Submitted (Admin receives)

**Trigger:** `POST /api/feedback` → `feedbackController.submitFeedback()`

```javascript
// notificationModel.js — notifyAdminNewFeedback
const message = `New feedback received from ${senderName}.`;
INSERT INTO notification (message) VALUES ($1) RETURNING id
INSERT INTO notification_receiver (notification_id, user_id) VALUES ($1, adminUserId)
INSERT INTO feedback_notification (notification_id, feedback_id) VALUES ($1, feedbackId)
```

**Recipients:** One admin (whichever `getAnyAdminUserId()` returns).

**Frontend navigation:** `type = 'feedback'` → `/feedback/my`

---

### 10. Feedback Response Received (User receives)

**Trigger:** `PATCH /api/feedback/:id/respond` → `feedbackController.respondToFeedback()`

```javascript
// notificationModel.js — notifyFeedbackResponse
const message = `The admin has responded to your feedback.`;
INSERT INTO notification (message) VALUES ($1) RETURNING id
INSERT INTO notification_receiver (notification_id, user_id) VALUES ($1, recipientUserId)
INSERT INTO feedback_notification (notification_id, feedback_id) VALUES ($1, feedbackId)
```

**Recipients:** The original feedback sender (1 receiver).

---

## Reading Notifications

### Main Query — `getNotificationsByUser` (legacy)

Used by `GET /api/notifications/user/:userId`. Returns raw data with navigation hints.

```sql
-- notificationModel.js — getNotificationsByUser
SELECT
    n.id,
    n.message,
    n.created_at,
    nr.is_read,

    -- Determine which subtype this notification belongs to
    CASE
        WHEN rn.review_id IS NOT NULL            THEN 'review'
        WHEN pn.paper_id  IS NOT NULL            THEN 'paper'
        WHEN un.triggered_user_id IS NOT NULL    THEN 'user'
        ELSE NULL
    END AS link_type,

    -- Surface the paper_id for navigation
    -- For review notifications: go through review → paper
    -- For reply notifications: go through review → parent_review → paper
    COALESCE(r.paper_id, parent_r.paper_id, pn.paper_id) AS link_paper_id,

    -- Surface author_id for user (follow) notifications
    a.id AS link_author_id

FROM notification_receiver nr
JOIN notification n              ON n.id  = nr.notification_id
LEFT JOIN review_notification rn ON rn.notification_id = n.id
LEFT JOIN review r               ON r.id  = rn.review_id
LEFT JOIN review parent_r        ON parent_r.id = r.parent_review_id  -- handles reply nav
LEFT JOIN paper_notification pn  ON pn.notification_id = n.id
LEFT JOIN user_notification un   ON un.notification_id = n.id
LEFT JOIN researcher res         ON res.user_id = un.triggered_user_id
LEFT JOIN author a               ON a.id = res.author_id
WHERE nr.user_id = $1
ORDER BY n.created_at DESC;
```

**Key design point:** The `COALESCE(r.paper_id, parent_r.paper_id, pn.paper_id)` handles two cases:
- A top-level review has `r.paper_id` directly
- A reply review has no `paper_id` on the review row itself, so it follows `r.parent_review_id → parent_r.paper_id`

---

### Enhanced Query — `getUserNotificationsEnhanced` (used by the bell)

Used by `GET /api/notifications/` (the main bell endpoint). Returns richer data including type labels and extra fields for frontend display.

```sql
-- notificationModel.js — getUserNotificationsEnhanced
SELECT
    n.id,
    n.message,
    n.created_at,
    nr.is_read,

    -- Type label for the frontend icon/routing
    CASE
        WHEN fn.notification_id IS NOT NULL THEN 'feedback'
        WHEN un.notification_id IS NOT NULL THEN 'follow'
        WHEN pn.notification_id IS NOT NULL THEN 'paper'
        WHEN rn.notification_id IS NOT NULL THEN 'review'
        ELSE                                     'generic'
    END AS type,

    -- Follow: who triggered it
    un.triggered_user_id,
    u_trig.full_name AS triggered_user_name,

    -- Paper / review: which paper
    pn.paper_id,
    p.title AS paper_title,

    -- Review: which review
    rn.review_id,

    -- Feedback: which feedback thread
    fn.feedback_id

FROM notification n
JOIN notification_receiver nr       ON nr.notification_id = n.id
LEFT JOIN user_notification un      ON un.notification_id = n.id
LEFT JOIN "user" u_trig             ON u_trig.id = un.triggered_user_id
LEFT JOIN paper_notification pn     ON pn.notification_id = n.id
LEFT JOIN paper p                   ON p.id = pn.paper_id
LEFT JOIN review_notification rn    ON rn.notification_id = n.id
LEFT JOIN feedback_notification fn  ON fn.notification_id = n.id
WHERE nr.user_id = $1
ORDER BY n.created_at DESC
LIMIT $2   -- default 20, max 50
```

**Difference from the legacy query:** This one includes `feedback` as a type, surfaces `triggered_user_name` and `paper_title` directly (no second query needed), and omits the review→paper navigation join (the frontend uses `paper_id` from `pn` directly).

---

### Unread Count — `getUnreadCount`

```sql
-- notificationModel.js — getUnreadCount
SELECT COUNT(*) AS count
FROM notification_receiver
WHERE user_id = $1 AND is_read = FALSE
```

Called in parallel with `getUserNotificationsEnhanced` by the controller so the bell badge and list load in one round-trip.

---

## Marking as Read

### Single notification

```sql
-- notificationModel.js — markAsRead
UPDATE notification_receiver
SET is_read = TRUE
WHERE notification_id = $1 AND user_id = $2
RETURNING *;
```

Route: `PATCH /api/notifications/:id/read`

### All notifications

```sql
-- notificationModel.js — markAllAsRead
UPDATE notification_receiver
SET is_read = TRUE
WHERE user_id = $1
RETURNING notification_id;
```

Route: `PATCH /api/notifications/read-all`

---

## API Endpoints

All notification routes require authentication (JWT). None are public.

| Method | Path | Handler | Purpose |
|---|---|---|---|
| `GET` | `/api/notifications/` | `getNotifications` | Bell data: list + unread count |
| `GET` | `/api/notifications/user/:userId` | `getNotificationsByUser` | Legacy list by user |
| `PATCH` | `/api/notifications/read-all` | `markAllAsRead` | Mark all read |
| `PATCH` | `/api/notifications/:id/read` | `markAsRead` | Mark one read |
| `POST` | `/api/notifications/` | `createNotification` | Low-level create |
| `GET` | `/api/notifications/:id` | `getNotificationById` | Fetch one |
| `DELETE` | `/api/notifications/:id` | `deleteNotification` | Delete one |
| `POST` | `/api/notifications/:id/receivers` | `addReceiver` | Add a recipient |
| `POST` | `/api/notifications/:id/subtypes/user` | `createUserNotification` | Tag as follow notif |
| `POST` | `/api/notifications/:id/subtypes/paper` | `createPaperNotification` | Tag as paper notif |
| `POST` | `/api/notifications/:id/subtypes/review` | `createReviewNotification` | Tag as review notif |

The `POST` subtypes and `POST /` are low-level primitives mostly used internally. Feature code calls the high-level model methods instead.

---

## Frontend Polling

The bell component (`NotificationBox.jsx`) uses `useNotifications.js` which polls every **5 seconds** while authenticated.

```javascript
// useNotifications.js
const POLL_INTERVAL_MS = 5_000;

// On mount and every 5s:
GET /notifications?limit=20
// Returns: { notifications: [...], unreadCount: N }
```

Each notification object from `getUserNotificationsEnhanced` has a `type` field. The frontend maps type → navigation path:

| `type` | Navigate to |
|---|---|
| `paper` | `/papers/{paper_id}` |
| `follow` | `/authors/{triggered_user_id}` |
| `feedback` | `/feedback/my` |
| `review` | `/papers/{paper_id}/reviews` (via `link_paper_id` in legacy, `paper_id` in enhanced) |
| `generic` | no navigation |

---

## Summary: Who Creates What

| Event | Created by | Tables touched |
|---|---|---|
| User followed | JS: `notifyNewFollower` | notification, notification_receiver, user_notification |
| Paper published | JS: `notifyFollowersPaperPublished` | notification, notification_receiver, paper_notification |
| Review on paper | DB trigger: `trg_notify_paper_review` | notification, notification_receiver, review_notification |
| Reply to review | DB trigger: `trg_notify_paper_review` | notification, notification_receiver, review_notification |
| Review voted | DB trigger: `trg_notify_review_vote` | notification, notification_receiver, review_notification |
| Claim submitted | Stored proc: `notify_new_claim` | notification, notification_receiver, paper_notification |
| Claim approved | Stored proc: `approve_paper_claim` | notification (×2), notification_receiver (×N), paper_notification (×2) |
| Claim declined | Stored proc: `notify_claim_declined` | notification, notification_receiver, paper_notification |
| Feedback sent | JS: `notifyAdminNewFeedback` | notification, notification_receiver, feedback_notification |
| Feedback responded | JS: `notifyFeedbackResponse` | notification, notification_receiver, feedback_notification |
