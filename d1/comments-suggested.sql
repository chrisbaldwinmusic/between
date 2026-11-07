-- Adds suggested tags to a social_comments table made before 7 November 2026 (comments.sql now has the column).
--   npx wrangler d1 execute between-ops --remote --file=d1/comments-suggested.sql
ALTER TABLE social_comments ADD COLUMN suggested_themes TEXT NOT NULL DEFAULT '';
