-- Additional indexes inferred from hot query paths. These were missing
-- from the initial schema and would have caused table scans on every
-- page load as data grew.

-- attendance: monthly stats + bulk mark both filter by user + date
CREATE INDEX IF NOT EXISTS idx_attendance_user_date_status
  ON attendance (user_id, date)
  WHERE deleted_at IS NULL;

-- ratings: history queries order by rated_user + created_at DESC
CREATE INDEX IF NOT EXISTS idx_ratings_user_created
  ON ratings (rated_user_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- proof_submissions: aggregations in team.repository + intern "my proofs"
CREATE INDEX IF NOT EXISTS idx_proofs_intern_status
  ON proof_submissions (intern_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_proofs_task_status
  ON proof_submissions (task_id, status)
  WHERE deleted_at IS NULL;

-- notifications: pagination + unread badge
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications (user_id, created_at DESC);

-- audit: hot filters by action + time-ordered
CREATE INDEX IF NOT EXISTS idx_audit_action_created
  ON audit_logs (action, created_at DESC);

-- meetings + attendees: required UNIQUE for the ON CONFLICT DO NOTHING
-- pattern in addAttendee. Without this, every refresh duplicates rows.
CREATE UNIQUE INDEX IF NOT EXISTS uq_meeting_attendees
  ON meeting_attendees (meeting_id, user_id);

-- hierarchy walk: manager_id lookups are the hot path for the recursive CTE
CREATE INDEX IF NOT EXISTS idx_users_manager_active
  ON users (manager_id)
  WHERE deleted_at IS NULL;
