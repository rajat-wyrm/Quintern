-- Notifications soft-delete column. The query layer was written assuming
-- `deleted_at IS NULL` exists on every table, but this one was missed at
-- the original migration. Adding it is a no-op for live data and fixes the
-- 500 we're seeing on the /api/notifications endpoint.
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_notifications_user_active
  ON notifications (user_id, created_at DESC)
  WHERE deleted_at IS NULL;
