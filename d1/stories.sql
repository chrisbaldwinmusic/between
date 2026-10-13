-- People's stories, shared through /feedback/story and approved in /team/stories before they appear
-- on the home page. Run once:
--   npx wrangler d1 execute between-ops --remote --file=d1/stories.sql
CREATE TABLE IF NOT EXISTS stories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  story TEXT NOT NULL,
  credit TEXT,                       -- how they'd like to be credited; NULL = anonymous
  about TEXT,                        -- e.g. "came to Firelight with her gran"
  event_slug TEXT,                   -- optional
  email TEXT,                        -- optional, only to check details; cleared on approval
  consent_web INTEGER NOT NULL DEFAULT 0,
  consent_social INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'new', -- 'new' | 'approved' | 'declined'
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT,
  reviewed_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_stories_status ON stories(status);
