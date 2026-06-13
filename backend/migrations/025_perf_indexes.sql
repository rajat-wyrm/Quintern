-- ============================================================================
-- 025: Performance / observability indexes
-- ============================================================================
-- Hot query paths the audit + dashboard endpoints will run on every page
-- load. Each index is selective (low duplicate ratio) and small enough
-- to be cached in RAM on a 1000+ user deployment.
-- ============================================================================

-- Audit log: by (action, created_at DESC) is the most common filter
-- (admin scanning "all logins" or "all attendance marks" within a range).
CREATE INDEX IF NOT EXISTS idx_audit_action_created ON audit_logs(action, created_at DESC);
-- Audit log: "all activity by user X in time range" needs (user, created_at).
CREATE INDEX IF NOT EXISTS idx_audit_user_created  ON audit_logs(user_id, created_at DESC);

-- Notifications: the badge uses unread-only; the page uses (user, read, created).
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, created_at DESC) WHERE read = FALSE;

-- Ratings: aggregation per user is on (rated_user_id, created_at DESC).
CREATE INDEX IF NOT EXISTS idx_ratings_rated_created ON ratings(rated_user_id, created_at DESC);

-- Project members: a user's project list is on the dashboard.
CREATE INDEX IF NOT EXISTS idx_project_members_user_joined ON project_members(user_id, joined_at DESC);

-- Project tasks: kanban view groups by (project, status, position).
CREATE INDEX IF NOT EXISTS idx_project_tasks_board ON project_tasks(project_id, status, position) WHERE deleted_at IS NULL;
