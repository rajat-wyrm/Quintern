-- ============================================================================
-- 022: Extend attendance_status enum with LEAVE / EXAM_LEAVE / WFH
-- ============================================================================
-- Adding values to an existing PostgreSQL enum is safe; old rows are preserved.
-- The new statuses are optional and require a manager to actively assign them.
-- ============================================================================
ALTER TYPE attendance_status ADD VALUE IF NOT EXISTS 'LEAVE';
ALTER TYPE attendance_status ADD VALUE IF NOT EXISTS 'EXAM_LEAVE';
ALTER TYPE attendance_status ADD VALUE IF NOT EXISTS 'WFH';

-- ============================================================================
-- 023: Widen the ratings score range to 1..10
-- ============================================================================
-- The constraint is dropped then re-applied with the new range. Any rows
-- created before the change (1..5) remain valid since 1..5 ⊂ 1..10.
-- ============================================================================
ALTER TABLE ratings DROP CONSTRAINT IF EXISTS ratings_score_check;
ALTER TABLE ratings ADD CONSTRAINT ratings_score_check CHECK (score >= 1 AND score <= 10);
