-- Adds which call to action a reply carried, to a social_comments table made before 7 November 2026
-- (comments.sql now has the column).
--   npx wrangler d1 execute between-ops --remote --file=d1/comments-replied-cta.sql
ALTER TABLE social_comments ADD COLUMN replied_cta TEXT;
