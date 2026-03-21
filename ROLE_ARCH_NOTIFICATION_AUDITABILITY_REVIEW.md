# Role-Specific IA, Notification Preferences, and Admin Auditability Review

Date: 2026-03-22

## 1. Role-Specific Information Architecture

### 1.1 Current role behavior

Current top navigation and dashboard behavior is moving toward role-awareness, but still partially shared.

Current high-level patterns:
1. All users can browse Papers, Authors, Venues.
2. Authenticated users get Dashboard.
3. Researchers get claim-centric actions.
4. Admins get claim queue and feedback inbox.
5. Venue users now get a profile shortcut near notifications.

### 1.2 Proposed target IA by role

#### Guest
1. Top nav: Papers, Authors, Venues, Login, Signup.
2. No feedback submission, no library, no dashboard.

#### User (general)
1. Top nav: Papers, Authors, Venues, Dashboard, My Library, Feedback.
2. Personal dashboard cards are lightweight discovery suggestions.

#### Researcher
1. Top nav: Papers, Authors, Venues, Dashboard, My Library, Feedback, My Claims.
2. Profile shortcut near notification bell should point to linked author profile.
3. Dashboard should prioritize claims, recent papers, review engagement.

#### Venue User
1. Top nav: Papers, Authors, Venues, Dashboard, My Library, Feedback.
2. Profile shortcut near notification bell should point to venue profile.
3. Dashboard should prioritize venue analytics and venue publication quality signals.

#### Admin
1. Top nav: Papers, Authors, Venues, Dashboard, Claim Queue, Feedback Inbox.
2. My Library and user feedback page should not be shown in top nav.
3. Admin dashboard should be operational: queue health, SLA, moderation quality.

### 1.3 IA implementation checklist

1. Keep navigation role policy in one source of truth (shared nav config object).
2. Add role-to-destination mapping for profile shortcut.
3. Add route-level guard tests for each role.
4. Add visual smoke tests for top-nav items by role.

## 2. Notification Preference Architecture

## 2.1 Why needed

Current notifications are event-driven but do not expose end-user controls such as mute, in-app only, or digest behavior.

## 2.2 Data model extension

Add a notification preference table:
1. notification_preference
   - user_id (PK/FK)
   - type_follow_enabled boolean default true
   - type_review_enabled boolean default true
   - type_paper_enabled boolean default true
   - type_feedback_enabled boolean default true
   - delivery_in_app boolean default true
   - delivery_email boolean default false
   - digest_frequency text default 'none' (none|daily|weekly)
   - updated_at timestamp

Optional advanced extension:
1. notification_preference_override
   - user_id
   - source_type (author|venue|paper)
   - source_id
   - muted boolean

## 2.3 Backend API design

Add endpoints:
1. GET /api/notifications/preferences
2. PUT /api/notifications/preferences

Validation rules:
1. User can only read/write own preferences.
2. Unknown fields are rejected.
3. Digest frequency must be enum-safe.

## 2.4 Notification pipeline integration

Before sending notification_receiver rows:
1. Resolve notification type.
2. Check receiver preference for that type and channel.
3. Skip receiver insert when disabled.

Apply to:
1. notify_new_follower procedure path.
2. review notification flows.
3. feedback admin-response and inbox notifications.
4. claim notifications.

## 2.5 Frontend UX

Add a notification settings panel:
1. Location: user menu or dashboard settings card.
2. Controls: per-type toggles + channel toggles + digest selector.
3. Save flow: optimistic UI + rollback on failure.
4. Empty copy: explain that disabling in-app alerts hides new alerts in bell feed.

## 2.6 Rollout strategy

1. Ship DB migration with safe defaults enabled.
2. Read preferences in notification senders.
3. Ship settings UI after backend is stable.
4. Add telemetry for muted-rate and delivery success.

## 3. Admin Auditability Design

## 3.1 What to audit

High-risk actions:
1. Claim approve/decline actions.
2. Feedback response create/edit.
3. Any future admin delete/hide operations.

## 3.2 Audit table

Add admin_audit_log:
1. id bigserial PK
2. actor_user_id int not null
3. actor_role text not null
4. action_type text not null
5. target_type text not null
6. target_id text not null
7. before_json jsonb null
8. after_json jsonb null
9. reason text null
10. request_id text null
11. ip_address text null
12. created_at timestamptz default now()

## 3.3 Logging policy

1. Log in same transaction as admin mutation when possible.
2. For asynchronous side effects, include request_id correlation.
3. Keep immutable append-only records.
4. Add retention and export policy.

## 3.4 Admin audit UI

Add admin audit page:
1. Filters: action type, actor, date range, target type.
2. Drill-down: before/after diff and reason.
3. Export: CSV for compliance review.

## 3.5 Operational controls

1. Alert on unusual spikes (for example bulk declines).
2. Daily report for moderation actions.
3. Break-glass event marker for emergency actions.

## 4. Empty-State and Disabled-State Inconsistencies

Below are current inconsistencies observed in role pages and adjacent role UX.

### 4.1 Empty-state inconsistencies

1. Dashboard venue section has no empty-state text when All Published Papers is expanded and list is empty.
   - File: frontend/src/pages/DashboardPage.jsx
   - Impact: blank block after toggling Show all.

2. Researcher dashboard uses simple text empty state, while library/feedback/admin pages use icon + richer CTA styles.
   - Files:
     - frontend/src/pages/DashboardPage.jsx
     - frontend/src/pages/MyLibraryPage.jsx
     - frontend/src/pages/FeedbackPage.jsx
     - frontend/src/pages/AdminFeedbackPage.jsx
   - Impact: inconsistent perceived product quality and guidance depth.

3. Claims pages use minimal empty text without action CTA links.
   - Files:
     - frontend/src/pages/ResearcherClaimsPage.jsx
     - frontend/src/pages/AdminClaimsPage.jsx
   - Impact: users are not guided to the next best step.

### 4.2 Disabled-state explanation inconsistencies

1. Many disabled actions do not provide reason text/tooltips.
   - Examples:
     - Submit button in feedback page disables on empty message but no inline hint near button.
     - Approve/Decline buttons in admin claims page disable during update without contextual message.

2. Previously, author follow action disappeared if no linked user account.
   - Now addressed by showing disabled Follow unavailable state with tooltip.
   - Files:
     - frontend/src/components/FollowButton.jsx
     - frontend/src/pages/AuthorPage.jsx

3. Review/vote actions show auth-required errors after click, but no pre-disabled affordance for guests.
   - File: frontend/src/pages/PaperReviewsPage.jsx
   - Impact: reactive error feedback rather than proactive guidance.

## 5. Immediate Next Improvements (Practical)

1. Create a shared EmptyState component with icon, title, body, and CTA slot.
2. Create a shared DisabledReason helper (tooltip + assistive text) for disabled controls.
3. Add role-specific nav config in one place to avoid drift.
4. Add an admin audit_log write path for claim and feedback moderation events first.
5. Add notification preferences backend first, then lightweight frontend settings panel.

## 6. Specific Check: Admin Feedback Response Edit Notification

Current behavior:
1. When admin responds or edits response, notification is sent to feedback sender via notifyFeedbackResponse.
2. If sender is a researcher, researcher receives the notification.
3. This behavior is implemented in feedback controller respond flow.

Suggested hardening:
1. Add integration test that verifies notification_receiver insert after response edit.
2. Add idempotency rule if you want to avoid repeated notifications on minor response edits.
