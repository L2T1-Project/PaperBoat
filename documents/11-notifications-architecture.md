# 11 Notifications Architecture

## What It Does
Generates and serves notifications for claims, follows, reviews, votes, and related user actions.

## Notification Generation Sources
- New follower
- Paper claim created/approved/declined
- Review created on paper
- Review vote cast
- Author claim moderation results

## Main Files
- backend/src/models/notificationModel.js
- backend/src/controllers/notificationController.js
- backend/src/routes/notificationRoutes.js
- backend/src/database/procedures.sql
- backend/src/database/functions.sql and/or triggers.sql for trigger-based events

## Retrieval Flow
1. Client requests user notifications.
2. Backend joins base notification with subtype tables.
3. API returns enriched payload with link target context.
4. Client marks notification read individually or bulk.

## SQL Objects
- notification
- notification_receiver
- user_notification
- paper_notification
- review_notification

## Authorization
- Notification read/update endpoints require auth token.
- User can only read/mark their own notifications.

## Why This Design
- Subtype tables keep payload typed without overloading one table.
- Supports rich links (paper/review/user context) in UI.
- Clean fan-out for admin/follower broadcasts.

## Viva Questions
- Why separate notification subtype tables?
- How does mark-all-as-read work safely?
- Which workflows call procedures vs direct inserts?

## Common Confusion
- Base notification text and receiver mapping are separate concerns.
- Not every event must use trigger; some are explicit procedure calls.

## Technical MCR Map
- R:
  - GET /api/notifications
  - PATCH /api/notifications/:id/read
  - PATCH /api/notifications/read-all
- C:
  - notificationController.getNotificationsByUser()
  - markAsRead(), markAllAsRead()
- M:
  - notificationModel.getNotificationsByUser(), markAsRead(), markAllAsRead()

## Hard SQL Query Shape
Enriched retrieval (base + subtype joins):
```sql
SELECT n.id, n.message, nr.is_read, n.created_at,
       pn.paper_id, rn.review_id, un.triggered_user_id
FROM notification_receiver nr
JOIN notification n ON n.id = nr.notification_id
LEFT JOIN paper_notification pn ON pn.notification_id = n.id
LEFT JOIN review_notification rn ON rn.notification_id = n.id
LEFT JOIN user_notification un ON un.notification_id = n.id
WHERE nr.user_id = $1
ORDER BY n.created_at DESC;
```
Read updates:
```sql
UPDATE notification_receiver
SET is_read = TRUE, read_at = NOW()
WHERE user_id = $1 AND notification_id = $2;
```
```sql
UPDATE notification_receiver
SET is_read = TRUE, read_at = NOW()
WHERE user_id = $1 AND is_read = FALSE;
```

Trigger/procedure fan-out used by workflows:
- notify_new_claim, notify_claim_declined, notify_new_follower, notify_paper_review, notify_review_vote.
