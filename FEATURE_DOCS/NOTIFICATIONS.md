# Notification System — Feature Documentation

> Covers all notification-related features: how they are triggered, what backend code runs, and how the frontend displays them.

---

## Table of Contents

1. [Database Schema](#1-database-schema)
2. [How Notifications Are Created (Three Paths)](#2-how-notifications-are-created-three-paths)
3. [Feature: New Review on Paper](#3-feature-new-review-on-paper)
4. [Feature: Reply to a Review](#4-feature-reply-to-a-review)
5. [Feature: Review Vote Notification](#5-feature-review-vote-notification)
6. [Feature: New Follower Notification](#6-feature-new-follower-notification)
7. [Feature: Paper Published — Notify Followers](#7-feature-paper-published--notify-followers)
8. [Feature: Paper Claim Submitted — Notify Admins](#8-feature-paper-claim-submitted--notify-admins)
9. [Feature: Paper Claim Approved/Declined](#9-feature-paper-claim-approveddeclined)
10. [Feature: Duplicate Author Claim Approved/Rejected](#10-feature-duplicate-author-claim-approvedrejected)
11. [Feature: Feedback Submitted — Notify Admin](#11-feature-feedback-submitted--notify-admin)
12. [Feature: Feedback Response — Notify User](#12-feature-feedback-response--notify-user)
13. [Feature: Fetching & Displaying Notifications (Bell)](#13-feature-fetching--displaying-notifications-bell)
14. [Feature: Mark as Read / Mark All as Read](#14-feature-mark-as-read--mark-all-as-read)
15. [API Endpoint Reference](#15-api-endpoint-reference)

---

## 1. Database Schema

Notifications use a **base + subtype + fan-out** design. Every notification starts with one row in the base table; recipients are tracked separately; a subtype table links back to the related entity.

```
notification
├── id              SERIAL PRIMARY KEY
├── message         TEXT
└── created_at      TIMESTAMP DEFAULT now()

notification_receiver          ← one row per recipient, tracks read state
├── notification_id  FK → notification
├── user_id          FK → user
├── is_read          BOOLEAN DEFAULT FALSE
└── PRIMARY KEY (notification_id, user_id)

-- Subtypes (exactly one of these rows per notification, tells frontend WHERE to navigate)
user_notification
├── notification_id  PK/FK → notification
└── triggered_user_id FK → user          (who caused this — e.g. the follower)

paper_notification
├── notification_id  PK/FK → notification
└── paper_id         FK → paper

review_notification
├── notification_id  PK/FK → notification
└── review_id        FK → review

feedback_notification
├── notification_id  PK/FK → notification
└── feedback_id      FK → feedback
```

**Key files:**
- `backend/src/database/schema.sql` — table definitions
- `backend/src/models/notificationModel.js` — all DB operations

---

## 2. How Notifications Are Created (Three Paths)

The system uses three different mechanisms depending on the event:

| Path | Mechanism | When used |
|------|-----------|-----------|
| **A** | PostgreSQL Trigger (automatic) | Review inserted, review vote inserted |
| **B** | JavaScript model method (explicit call from controller) | Follow, paper publish, feedback events |
| **C** | PostgreSQL Stored Procedure (called via JS) | Claim approve/decline, author claim resolution |

All three paths ultimately write to the same three tables: `notification`, `notification_receiver`, and one subtype table.

---

## 3. Feature: New Review on Paper

**What happens:** When a researcher writes a review on a paper, all researchers who are listed as authors of that paper receive a notification. The reviewer themselves is excluded.

### Trigger Path (Path A)

**File:** [`backend/src/database/triggers.sql:139`](backend/src/database/triggers.sql#L139)

```sql
CREATE OR REPLACE FUNCTION trg_fn_notify_paper_review()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_notification_id INTEGER;
    v_paper_title     VARCHAR(500);
    v_receiver_id     INTEGER;
BEGIN
    IF NEW.paper_id IS NOT NULL THEN
        SELECT p.title INTO v_paper_title FROM paper p WHERE p.id = NEW.paper_id;

        -- Step 1: Insert into notification table
        INSERT INTO notification (message)
        VALUES ('New review on paper: ' || COALESCE(v_paper_title, 'a paper'))
        RETURNING id INTO v_notification_id;

        -- Step 2: Insert subtype row for navigation
        INSERT INTO review_notification (notification_id, review_id)
        VALUES (v_notification_id, NEW.id);

        -- Step 3: Fan-out to all paper authors (skip reviewer)
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
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_paper_review
AFTER INSERT ON review
FOR EACH ROW EXECUTE FUNCTION trg_fn_notify_paper_review();
```

There is also a fallback stored procedure call from the review controller:

**File:** [`backend/src/controllers/reviewController.js:33`](backend/src/controllers/reviewController.js#L33)

```js
// Called after review creation succeeds — catches edge cases the trigger misses
await this.reviewModel.notifyPaperReview(review.id, reviewedPaperId);
```

### Full Workflow

```
User submits review
       │
       ▼
POST /api/reviews  (reviewController.js)
       │
       ▼
INSERT INTO review  ←── DB trigger fires automatically
       │                  trg_fn_notify_paper_review()
       │                    ├─ INSERT notification
       │                    ├─ INSERT review_notification (subtype)
       │                    └─ INSERT notification_receiver × N authors
       │
       ▼
Controller also calls notifyPaperReview() as fallback (reviewController.js:33)
       │
       ▼
Frontend polls GET /api/notifications every 5s
       │
       ▼
Bell icon shows red badge + message "New review on paper: {title}"
       │
       ▼
User clicks → navigated to /papers/{paper_id}/reviews
```

---

## 4. Feature: Reply to a Review

**What happens:** When a researcher replies to an existing review (i.e. a review with a `parent_review_id`), the original review's author gets a notification.

### Trigger Path (Path A)

Same trigger function as above — different branch:

**File:** [`backend/src/database/triggers.sql:176`](backend/src/database/triggers.sql#L176)

```sql
ELSIF NEW.parent_review_id IS NOT NULL THEN
    -- Get original review's author
    SELECT r.researcher_id INTO v_receiver_id
    FROM review r WHERE r.id = NEW.parent_review_id;

    -- Only notify if replier != original author
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
```

### Full Workflow

```
User submits reply (review with parent_review_id set)
       │
       ▼
INSERT INTO review  ←── same trg_notify_paper_review trigger fires
       │                  but takes the ELSIF branch
       │                    ├─ Looks up parent review's author
       │                    ├─ Guard: skip if self-reply
       │                    ├─ INSERT notification ("Someone replied to your review")
       │                    ├─ INSERT review_notification (subtype)
       │                    └─ INSERT notification_receiver (1 recipient)
       │
       ▼
Frontend polls, bell updates, click → /papers/{paper_id}/reviews
```

---

## 5. Feature: Review Vote Notification

**What happens:** When a researcher upvotes or downvotes a review, the review's author is notified. Self-votes are blocked at the DB level by a separate trigger before this fires.

### Trigger Path (Path A)

**File:** [`backend/src/database/triggers.sql:210`](backend/src/database/triggers.sql#L210)

```sql
CREATE OR REPLACE FUNCTION trg_fn_notify_review_vote()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_notification_id  INTEGER;
    v_review_author_id INTEGER;
    v_vote_label       TEXT;
BEGIN
    SELECT r.researcher_id INTO v_review_author_id
    FROM review r WHERE r.id = NEW.review_id;

    -- Guard: skip self-vote (already blocked by trg_prevent_self_review_vote)
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
FOR EACH ROW EXECUTE FUNCTION trg_fn_notify_review_vote();
```

Fallback also in the controller:

**File:** [`backend/src/controllers/reviewController.js:156`](backend/src/controllers/reviewController.js#L156)

```js
await this.reviewModel.notifyReviewVote(id, Boolean(is_upvote), researcher_id);
```

### Full Workflow

```
User clicks upvote/downvote
       │
       ▼
POST /api/reviews/:id/vote  (reviewController.js)
       │
       ▼
INSERT INTO review_vote  ←── trg_prevent_self_review_vote fires first (blocks self-vote)
                         ←── trg_notify_review_vote fires after
                               ├─ INSERT notification ("Someone upvoted your review")
                               ├─ INSERT review_notification (subtype)
                               └─ INSERT notification_receiver (review author)
       │
       ▼
Frontend polls, bell shows "Someone upvoted your review"
Click → /papers/{paper_id}/reviews
```

---

## 6. Feature: New Follower Notification

**What happens:** When User A follows User B, User B gets a notification saying "{username} started following you."

### JavaScript Path (Path B)

**File:** [`backend/src/controllers/followController.js:32`](backend/src/controllers/followController.js#L32)

```js
// After follow is inserted into DB:
this.followModel
  .notifyNewFollower(followingUserId, followedUserId)
  .catch(err => console.error("follow notification procedure error:", err));
```

The model method:

**File:** [`backend/src/models/notificationModel.js:188`](backend/src/models/notificationModel.js#L188)

```js
notifyNewFollower = async (followerUserId, followedUserId, followerName) => {
  const message = `${followerName} started following you.`;
  const notif = await this.createNotification(message);          // INSERT notification
  await this.addReceiver(notif.id, followedUserId);              // INSERT notification_receiver
  await this.createUserNotification(notif.id, followerUserId);   // INSERT user_notification (subtype)
};
```

There is also a stored procedure version in the DB:

**File:** [`backend/src/database/procedures.sql:55`](backend/src/database/procedures.sql#L55)

```sql
CREATE OR REPLACE PROCEDURE notify_new_follower(follower_user_id, followed_user_id)
-- inserts into notification, user_notification, notification_receiver
```

### Full Workflow

```
User clicks "Follow"
       │
       ▼
POST /api/follows  (followController.js)
       │
       ▼
INSERT INTO follows
       │
       ▼
notifyNewFollower(followingUserId, followedUserId) called in JS
       ├─ notificationModel.createNotification("{name} started following you.")
       ├─ notificationModel.addReceiver(notif.id, followedUserId)
       └─ notificationModel.createUserNotification(notif.id, followerUserId)
              │
              └─ INSERT user_notification (for navigation — links to follower's profile)
       │
       ▼
Frontend polls, bell shows message
Click → /authors/{link_author_id}  (resolved from user_notification → researcher → author)
```

---

## 7. Feature: Paper Published — Notify Followers

**What happens:** When a researcher publishes a paper, all users who follow that researcher receive a notification.

### JavaScript Path (Path B)

**File:** [`backend/src/controllers/paperController.js:33`](backend/src/controllers/paperController.js#L33)

```js
// Fire-and-forget after paper creation — does not block the response
this.notificationModel
  .notifyFollowersPaperPublished(authorUserId, paper.id, paper.title, authorName)
  .catch(err => console.error('notifyFollowersPaperPublished error:', err));
```

The model method:

**File:** [`backend/src/models/notificationModel.js:199`](backend/src/models/notificationModel.js#L199)

```js
notifyFollowersPaperPublished = async (authorUserId, paperId, paperTitle, authorName) => {
  // Step 1: Get all followers of this researcher
  const followersResult = await this.db.query_executor(
    `SELECT following_user_id FROM follows WHERE followed_user_id = $1`,
    [authorUserId]
  );
  const followers = followersResult.rows.map(r => r.following_user_id);
  if (followers.length === 0) return 0;

  // Step 2: One notification, N receivers
  const message = `${authorName} published a new paper: "${paperTitle}"`;
  const notif = await this.createNotification(message);
  await this.createPaperNotification(notif.id, paperId);   // subtype row

  for (const userId of followers) {
    await this.addReceiver(notif.id, userId);               // one row per follower
  }
  return followers.length;
};
```

### Full Workflow

```
Researcher submits new paper
       │
       ▼
POST /api/papers  (paperController.js)
       │
       ▼
Paper saved to DB
       │
       ▼
notifyFollowersPaperPublished() called (fire-and-forget)
       ├─ SELECT all followers of the author
       ├─ INSERT notification ("{name} published a new paper: "{title}"")
       ├─ INSERT paper_notification (subtype — for /papers/{id} navigation)
       └─ INSERT notification_receiver × N (one per follower)
       │
       ▼
All followers see notification in their bell
Click → /papers/{paper_id}
```

---

## 8. Feature: Paper Claim Submitted — Notify Admins

**What happens:** When a researcher submits a claim on a paper, all admins get a notification.

### Stored Procedure Path (Path C)

The researcher controller calls a stored procedure after inserting the claim:

**File:** [`backend/src/models/researcherModel.js:162`](backend/src/models/researcherModel.js#L162)

```js
await client.query("CALL notify_new_claim($1, $2);", [researcherId, paperId]);
```

The procedure:

**File:** [`backend/src/database/procedures.sql:144`](backend/src/database/procedures.sql#L144)

```sql
CREATE OR REPLACE PROCEDURE notify_new_claim(claim_researcher_id, claim_paper_id)
LANGUAGE plpgsql AS $$
DECLARE
    admin RECORD;
BEGIN
    -- Build message with researcher name and paper title
    msg := researcher_name || ' has submitted a claim for the paper: "' || paper_title || '"';

    INSERT INTO notification (message) VALUES (msg) RETURNING id INTO notif_id;
    INSERT INTO paper_notification (notification_id, paper_id) VALUES (notif_id, claim_paper_id);

    -- Fan-out to every admin
    FOR admin IN SELECT a.user_id FROM admin a LOOP
        INSERT INTO notification_receiver (notification_id, user_id)
        VALUES (notif_id, admin.user_id)
        ON CONFLICT DO NOTHING;
    END LOOP;
END;
$$;
```

### Full Workflow

```
Researcher clicks "Claim this paper"
       │
       ▼
POST /api/researchers/:id/claims  (researcherModel.createPaperClaim)
       │
       ├─ BEGIN transaction
       ├─ INSERT INTO paper_claim
       └─ CALL notify_new_claim(researcherId, paperId)
              ├─ INSERT notification ("{name} has submitted a claim for ...")
              ├─ INSERT paper_notification (subtype)
              └─ INSERT notification_receiver × all admins
       ▼
All admins see notification in their bell
Click → /papers/{paper_id}
```

---

## 9. Feature: Paper Claim Approved/Declined

**What happens:** When an admin approves a paper claim, the claimant is notified AND all the claimant's followers are notified of the newly linked paper. When declined, only the claimant is notified.

### Stored Procedure Path (Path C)

**Approve — File:** [`backend/src/database/procedures.sql:1`](backend/src/database/procedures.sql#L1)

```sql
CREATE OR REPLACE PROCEDURE approve_paper_claim(claim_researcher_id, claim_paper_id, author_position)
LANGUAGE plpgsql AS $$
BEGIN
    -- 1. Link author to paper
    INSERT INTO paper_author (paper_id, author_id, position) VALUES (...);

    -- 2. Notify claimant: "Your claim for paper X has been approved."
    INSERT INTO notification (message) VALUES (researcher_msg) RETURNING id INTO researcher_notif_id;
    INSERT INTO paper_notification (notification_id, paper_id) VALUES (...);
    INSERT INTO notification_receiver (notification_id, user_id) VALUES (researcher_notif_id, claim_researcher_id);

    -- 3. Notify followers: "A paper you may be interested in has been published: X"
    INSERT INTO notification (message) VALUES (followers_msg) RETURNING id INTO followers_notif_id;
    INSERT INTO paper_notification (notification_id, paper_id) VALUES (...);
    FOR follower IN SELECT following_user_id FROM follows WHERE followed_user_id = claim_researcher_id LOOP
        INSERT INTO notification_receiver (...) VALUES (followers_notif_id, follower.user_id);
    END LOOP;
END;
$$;
```

**Decline — File:** [`backend/src/database/procedures.sql:176`](backend/src/database/procedures.sql#L176)

```sql
CREATE OR REPLACE PROCEDURE notify_claim_declined(claim_researcher_id, claim_paper_id)
-- Inserts notification: "Your claim for paper X has been declined."
-- One receiver: the claimant only
```

### Full Workflow (Approve)

```
Admin clicks "Approve claim"
       │
       ▼
POST /api/admin/claims/:id/approve
       │
       ▼
CALL approve_paper_claim(researcherId, paperId, position)
       ├─ INSERT paper_author (links author to paper)
       ├─ INSERT notification #1 → claimant: "Your claim for ... has been approved."
       │    └─ INSERT paper_notification + notification_receiver (claimant only)
       └─ INSERT notification #2 → followers: "A paper you may be interested in..."
            └─ INSERT paper_notification + notification_receiver × N followers
       │
       ▼
Claimant sees approval; followers see new paper notification
```

---

## 10. Feature: Duplicate Author Claim Approved/Rejected

**What happens:** When a user claims to be the same person as an existing researcher (duplicate author claim), an admin reviews it. On approval, the old researcher is demoted and both parties are notified. On rejection, both are also notified.

### Stored Procedure Path (Path C)

**Approve — File:** [`backend/src/database/procedures.sql:229`](backend/src/database/procedures.sql#L229)

```sql
CREATE OR REPLACE PROCEDURE approve_author_claim(p_claim_id, p_admin_user_id)
LANGUAGE plpgsql AS $$
BEGIN
    -- Swap researcher ownership
    DELETE FROM researcher WHERE author_id = v_claimed_author_id;
    INSERT INTO researcher (user_id, author_id) VALUES (v_claimant_user_id, v_claimed_author_id);

    -- Notify old researcher (demoted):
    -- "Your researcher status for author profile X has been revoked..."
    INSERT INTO notification (message) VALUES (...) RETURNING id INTO v_notif_id;
    INSERT INTO notification_receiver (notification_id, user_id) VALUES (v_notif_id, v_old_researcher_user_id);

    -- Notify claimant (approved):
    -- "Your claim to author profile X has been approved. You are now a verified researcher."
    INSERT INTO notification (message) VALUES (...) RETURNING id INTO v_notif_id;
    INSERT INTO notification_receiver (notification_id, user_id) VALUES (v_notif_id, v_claimant_user_id);
END;
$$;
```

**Reject — File:** [`backend/src/database/procedures.sql:288`](backend/src/database/procedures.sql#L288)

```sql
CREATE OR REPLACE PROCEDURE reject_author_claim(p_claim_id, p_admin_user_id)
LANGUAGE plpgsql AS $$
BEGIN
    -- Notify current researcher (warn):
    -- "Someone attempted to claim your author profile X. No action was taken."
    
    -- Notify claimant (rejected):
    -- "Your claim to author profile X has been reviewed and declined."
END;
$$;
```

### Full Workflow (Approve)

```
Admin approves duplicate author claim
       │
       ▼
PATCH /api/admin/author-claims/:id/approve
       │
       ▼
CALL approve_author_claim(claimId, adminUserId)
       ├─ DELETE old researcher row, INSERT new researcher row (ownership swap)
       ├─ INSERT notification → old researcher: "Your status has been revoked..."
       └─ INSERT notification → new researcher (claimant): "You are now verified..."
       │
       ▼
Both users see their notification in the bell on next poll
```

---

## 11. Feature: Feedback Submitted — Notify Admin

**What happens:** When any user submits feedback/suggestion, one admin receives a notification.

### JavaScript Path (Path B)

**File:** [`backend/src/controllers/feedbackController.js:32`](backend/src/controllers/feedbackController.js#L32)

```js
this.notificationModel
  .notifyAdminNewFeedback(feedback.id, adminUserId, senderName)
  .catch(err => console.error('notifyAdminNewFeedback error:', err));
```

The model method:

**File:** [`backend/src/models/notificationModel.js:232`](backend/src/models/notificationModel.js#L232)

```js
notifyAdminNewFeedback = async (feedbackId, adminUserId, senderName) => {
  const message = `New feedback received from ${senderName}.`;
  const notif = await this.createNotification(message);
  await this.addReceiver(notif.id, adminUserId);                        // INSERT notification_receiver
  await this.createFeedbackNotification(notif.id, feedbackId);          // INSERT feedback_notification (subtype)
};
```

This same logic also exists in `researcherController.js:640` for researcher-submitted suggestions.

### Full Workflow

```
User submits feedback form
       │
       ▼
POST /api/feedback  (feedbackController.js)
       │
       ▼
INSERT INTO feedback table
       │
       ▼
notifyAdminNewFeedback(feedback.id, adminUserId, senderName) — fire-and-forget
       ├─ INSERT notification ("New feedback received from {name}.")
       ├─ INSERT notification_receiver (admin only)
       └─ INSERT feedback_notification (subtype)
       │
       ▼
Admin sees notification in bell
```

---

## 12. Feature: Feedback Response — Notify User

**What happens:** When an admin responds to a feedback message, the original sender gets notified.

### JavaScript Path (Path B)

**File:** [`backend/src/controllers/feedbackController.js:77`](backend/src/controllers/feedbackController.js#L77)

```js
this.notificationModel
  .notifyFeedbackResponse(updated.id, updated.sender_id)
  .catch(err => console.error('notifyFeedbackResponse error:', err));
```

Also called from `adminController.js:377`.

The model method:

**File:** [`backend/src/models/notificationModel.js:221`](backend/src/models/notificationModel.js#L221)

```js
notifyFeedbackResponse = async (feedbackId, recipientUserId) => {
  const message = `The admin has responded to your feedback.`;
  const notif = await this.createNotification(message);
  await this.addReceiver(notif.id, recipientUserId);
  await this.createFeedbackNotification(notif.id, feedbackId);
};
```

### Full Workflow

```
Admin writes response to feedback
       │
       ▼
PATCH /api/feedback/:id/respond  (feedbackController.js or adminController.js)
       │
       ▼
UPDATE feedback SET response = ...
       │
       ▼
notifyFeedbackResponse(feedbackId, sender_id) — fire-and-forget
       ├─ INSERT notification ("The admin has responded to your feedback.")
       ├─ INSERT notification_receiver (feedback sender only)
       └─ INSERT feedback_notification (subtype)
       │
       ▼
User sees notification in bell
```

---

## 13. Feature: Fetching & Displaying Notifications (Bell)

**What happens:** The bell icon in the header polls the backend every 5 seconds. It shows a red dot/badge when there are unread notifications. Clicking a notification navigates to the relevant page and marks it as read.

### Backend

**Route:** `GET /api/notifications`

**File:** [`backend/src/controllers/notificationController.js:217`](backend/src/controllers/notificationController.js#L217)

```js
getNotifications = async (req, res) => {
  const userId = req.auth.userId;
  const limit  = Math.min(Number(req.query.limit) || 20, 50);

  // Runs both queries in parallel
  const [notifications, unreadCount] = await Promise.all([
    this.notificationModel.getUserNotificationsEnhanced(userId, limit),
    this.notificationModel.getUnreadCount(userId),
  ]);
  res.json({ success: true, data: { notifications, unreadCount } });
}
```

The enhanced query joins all subtype tables in one go:

**File:** [`backend/src/models/notificationModel.js:245`](backend/src/models/notificationModel.js#L245)

```js
getUserNotificationsEnhanced = async (userId, limit = 20) => {
  const query = `
    SELECT
      n.id, n.message, n.created_at, nr.is_read,
      CASE
        WHEN fn.notification_id IS NOT NULL THEN 'feedback'
        WHEN un.notification_id IS NOT NULL THEN 'follow'
        WHEN pn.notification_id IS NOT NULL THEN 'paper'
        WHEN rn.notification_id IS NOT NULL THEN 'review'
        ELSE 'generic'
      END AS type,
      un.triggered_user_id,
      pn.paper_id,
      p.title AS paper_title,
      rn.review_id,
      fn.feedback_id
    FROM notification n
    JOIN notification_receiver nr  ON nr.notification_id = n.id
    LEFT JOIN user_notification un  ON un.notification_id = n.id
    LEFT JOIN paper_notification pn ON pn.notification_id = n.id
    LEFT JOIN paper p               ON p.id = pn.paper_id
    LEFT JOIN review_notification rn ON rn.notification_id = n.id
    LEFT JOIN feedback_notification fn ON fn.notification_id = n.id
    WHERE nr.user_id = $1
    ORDER BY n.created_at DESC LIMIT $2
  `;
};
```

Also used by legacy endpoint `GET /api/notifications/user/:userId`:

**File:** [`backend/src/models/notificationModel.js:43`](backend/src/models/notificationModel.js#L43)

```js
// getNotificationsByUser() — used by useNotifications.js hook
// Same LEFT JOIN pattern, returns link_type + link_paper_id + link_author_id
```

### Frontend — Hook

**File:** [`frontend/src/hooks/useNotifications.js:1`](frontend/src/hooks/useNotifications.js#L1)

```js
const POLL_INTERVAL_MS = 5000;  // polls every 5 seconds

export function useNotifications() {
  const fetchNotifications = useCallback(async () => {
    const res = await api.get(`/notifications/user/${user.userId}`);
    setNotifications(res.data?.data ?? []);
  }, [user?.userId]);

  useEffect(() => {
    fetchNotifications();
    intervalRef.current = setInterval(fetchNotifications, POLL_INTERVAL_MS);
    return () => clearInterval(intervalRef.current);  // cleanup on unmount
  }, [isAuthenticated, fetchNotifications]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // Navigation path resolution
  const getNotificationPath = (n) => {
    if (n.link_type === "review" && n.link_paper_id)  return `/papers/${n.link_paper_id}/reviews`;
    if (n.link_type === "paper"  && n.link_paper_id)  return `/papers/${n.link_paper_id}`;
    if (n.link_type === "user"   && n.link_author_id) return `/authors/${n.link_author_id}`;
    return null;
  };
}
```

### Frontend — Bell Component

**File:** [`frontend/src/components/notifications/NotificationBox.jsx:73`](frontend/src/components/notifications/NotificationBox.jsx#L73)

```jsx
export default function NotificationBox() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, getNotificationPath } = useNotifications();
  const [open, setOpen] = useState(false);

  const handleNotificationClick = (n) => {
    if (!n.is_read) markAsRead(n.id);       // mark read on click
    const path = getNotificationPath(n);
    if (path) { setOpen(false); navigate(path); }
  };

  return (
    <div>
      {/* Bell icon — red dot appears when unreadCount > 0 */}
      <button onClick={() => setOpen(prev => !prev)}>
        <BellIcon hasUnread={unreadCount > 0} />
        {unreadCount > 0 && <span>{unreadCount > 9 ? "9+" : unreadCount}</span>}
      </button>

      {/* Dropdown panel */}
      {open && (
        <ul>
          {notifications.map(n => (
            <li key={n.id}>
              {/* Blue dot on left if unread, click to navigate + mark read */}
              <button onClick={() => handleNotificationClick(n)}>
                <span className={n.is_read ? "transparent" : "bg-blue-500"} />
                <p>{n.message}</p>
                <p>{timeAgo(n.created_at)}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

### Full Workflow

```
Page loads / user logs in
       │
       ▼
useNotifications() hook starts polling every 5s
       │
       ▼
GET /api/notifications/user/:userId
       │
       ▼
notificationController.getNotificationsByUser()
  → notificationModel.getNotificationsByUser()  (big LEFT JOIN query)
       │
       ▼
Returns array of notifications with:
  { id, message, created_at, is_read, link_type, link_paper_id, link_author_id }
       │
       ▼
NotificationBox renders bell with red badge if unreadCount > 0
       │
       ▼
User clicks bell → dropdown opens
User clicks a notification:
  ├─ markAsRead(id) called  →  PATCH /api/notifications/:id/read
  └─ navigate(path)         →  e.g. /papers/42/reviews
```

---

## 14. Feature: Mark as Read / Mark All as Read

### Mark Single as Read

**Hook (optimistic update):** [`frontend/src/hooks/useNotifications.js:35`](frontend/src/hooks/useNotifications.js#L35)

```js
const markAsRead = useCallback(async (notificationId) => {
  // Immediately update UI (optimistic)
  setNotifications(prev => prev.map(n =>
    n.id === notificationId ? { ...n, is_read: true } : n
  ));
  try {
    await api.patch(`/notifications/${notificationId}/read`);
  } catch {
    // Roll back if API call fails
    setNotifications(prev => prev.map(n =>
      n.id === notificationId ? { ...n, is_read: false } : n
    ));
  }
}, []);
```

**Backend:** [`backend/src/controllers/notificationController.js:87`](backend/src/controllers/notificationController.js#L87)

```js
markAsRead = async (req, res) => {
  const { id } = req.params;
  const userId = req.auth?.userId;
  const updated = await this.notificationModel.markAsRead(Number(id), Number(userId));
  // ...
}
```

**Model:** [`backend/src/models/notificationModel.js:78`](backend/src/models/notificationModel.js#L78)

```js
markAsRead = async (notificationId, userId) => {
  const query = `
    UPDATE notification_receiver
    SET is_read = TRUE
    WHERE notification_id = $1 AND user_id = $2
    RETURNING *;
  `;
};
```

### Mark All as Read

**Hook:** [`frontend/src/hooks/useNotifications.js:52`](frontend/src/hooks/useNotifications.js#L52)

```js
const markAllAsRead = useCallback(async () => {
  setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));  // optimistic
  try {
    await api.patch("/notifications/read-all");
  } catch {
    fetchNotifications();  // re-fetch accurate state on failure
  }
}, [fetchNotifications]);
```

**Backend:** [`backend/src/controllers/notificationController.js:105`](backend/src/controllers/notificationController.js#L105)

```js
markAllAsRead = async (req, res) => {
  const userId = req.auth?.userId;
  const updated = await this.notificationModel.markAllAsRead(Number(userId));
  res.status(200).json({ success: true, count: updated.length });
}
```

**Model:** [`backend/src/models/notificationModel.js:92`](backend/src/models/notificationModel.js#L92)

```js
markAllAsRead = async (userId) => {
  const query = `
    UPDATE notification_receiver
    SET is_read = TRUE
    WHERE user_id = $1
    RETURNING notification_id;
  `;
};
```

### Full Workflow (Mark All)

```
User clicks "Mark all read" in dropdown
       │
       ▼
markAllAsRead() called in useNotifications hook
       │
       ├─ Immediately updates all notifications to is_read=true in local state (optimistic UI)
       │
       ▼
PATCH /api/notifications/read-all
       │
       ▼
notificationController.markAllAsRead()
  → notificationModel.markAllAsRead(userId)
  → UPDATE notification_receiver SET is_read = TRUE WHERE user_id = $1
       │
       ▼
Red badge disappears from bell icon
```

---

## 15. API Endpoint Reference

All routes are under `/api/notifications` and require a valid JWT (authentication middleware).

**File:** [`backend/src/routes/notificationRoutes.js`](backend/src/routes/notificationRoutes.js)

| Method | Route | Controller Method | Description |
|--------|-------|-------------------|-------------|
| `GET` | `/` | `getNotifications` | Fetch notifications + unread count for logged-in user (max 50) |
| `GET` | `/user/:userId` | `getNotificationsByUser` | Legacy fetch — used by `useNotifications` hook |
| `PATCH` | `/read-all` | `markAllAsRead` | Mark all of user's notifications as read |
| `POST` | `/` | `createNotification` | Low-level: create a bare notification (no receivers) |
| `GET` | `/:id` | `getNotificationById` | Fetch a single notification |
| `DELETE` | `/:id` | `deleteNotification` | Hard delete a notification |
| `POST` | `/:id/receivers` | `addReceiver` | Add a receiver to an existing notification |
| `PATCH` | `/:id/read` | `markAsRead` | Mark one notification as read for the logged-in user |
| `POST` | `/:id/subtypes/user` | `createUserNotification` | Attach a user (follow) subtype |
| `GET` | `/:id/subtypes/user` | `getUserNotificationById` | Get user subtype details |
| `POST` | `/:id/subtypes/paper` | `createPaperNotification` | Attach a paper subtype |
| `GET` | `/:id/subtypes/paper` | `getPaperNotificationById` | Get paper subtype details |
| `POST` | `/:id/subtypes/review` | `createReviewNotification` | Attach a review subtype |
| `GET` | `/:id/subtypes/review` | `getReviewNotificationById` | Get review subtype details |

---

## Summary: All Notification Events at a Glance

| Event | Creation Method | Who Gets Notified | Navigation on Click |
|-------|----------------|-------------------|---------------------|
| New review on paper | DB Trigger (`trg_notify_paper_review`) | All paper authors (excl. reviewer) | `/papers/:id/reviews` |
| Reply to review | DB Trigger (`trg_notify_paper_review`) | Original review author | `/papers/:id/reviews` |
| Review upvoted/downvoted | DB Trigger (`trg_notify_review_vote`) | Review author | `/papers/:id/reviews` |
| New follower | JS: `notifyNewFollower()` | Followed user | `/authors/:id` |
| Paper published | JS: `notifyFollowersPaperPublished()` | All followers of the author | `/papers/:id` |
| Paper claim submitted | Stored proc: `notify_new_claim()` | All admins | `/papers/:id` |
| Paper claim approved | Stored proc: `approve_paper_claim()` | Claimant + their followers | `/papers/:id` |
| Paper claim declined | Stored proc: `notify_claim_declined()` | Claimant only | `/papers/:id` |
| Author claim approved | Stored proc: `approve_author_claim()` | Old researcher (demoted) + claimant | — |
| Author claim rejected | Stored proc: `reject_author_claim()` | Current researcher (warned) + claimant | — |
| Feedback submitted | JS: `notifyAdminNewFeedback()` | One admin | — |
| Feedback responded to | JS: `notifyFeedbackResponse()` | Feedback sender | — |
