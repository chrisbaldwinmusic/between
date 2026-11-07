-- Adds the replied marker to a social_comments table made before 7 November 2026 (comments.sql now has it).
--   npx wrangler d1 execute between-ops --remote --file=d1/comments-replied.sql
ALTER TABLE social_comments ADD COLUMN replied_at TEXT;
