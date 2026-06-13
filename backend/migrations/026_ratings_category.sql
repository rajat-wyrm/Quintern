-- ============================================================================
-- 026: ratings.category for multi-context rating (PERFORMANCE / TASK / etc.)
-- ============================================================================
-- Existing rows default to PERFORMANCE so historical ratings continue to
-- aggregate into the same averages. The 1-10 score range was widened in 022.
-- ============================================================================
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS category VARCHAR(30) NOT NULL DEFAULT 'PERFORMANCE';
CREATE INDEX IF NOT EXISTS idx_ratings_category ON ratings(category);
