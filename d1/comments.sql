-- Copies of public comments on our own Facebook and Instagram posts, read through the Meta connection
-- (src/lib/comments.js) so the team can count themes and spot story leads. Run once:
--   npx wrangler d1 execute between-ops --remote --file=d1/comments.sql
--
-- Privacy (see /privacy, "Comments on our social media posts"):
--   * No username, profile name or commenter id is ever stored: the sync does not even request them.
--   * platform_id is the comment's id on Facebook/Instagram. It is kept so we can tell when someone
--     deletes their comment (then our copy is deleted too). It is why this is pseudonymous, not anonymous.
--   * Copies are deleted 12 months after the comment was posted, or sooner if removed on the platform.
--   * 'excluded' = "don't use" (for example someone who may be under 16): the text is blanked and kept
--     only as a marker so a sync doesn't bring it back.
--   * Quoting word for word needs quote_ok, which only a lead can set, after the person has agreed.
CREATE TABLE IF NOT EXISTS social_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL,              -- 'facebook' | 'instagram'
  platform_id TEXT NOT NULL UNIQUE,
  post_id TEXT NOT NULL,
  post_url TEXT,
  text TEXT NOT NULL DEFAULT '',
  posted_at TEXT NOT NULL,             -- UTC, 'YYYY-MM-DD HH:MM:SS'
  likes INTEGER NOT NULL DEFAULT 0,
  event_slug TEXT,                     -- guessed from the post, editable
  themes TEXT NOT NULL DEFAULT '',     -- comma-separated, from THEMES in src/lib/comments.js; set by a person, the only ones counted
  suggested_themes TEXT NOT NULL DEFAULT '', -- an AI assistant's guess, shown as a suggestion until a person saves tags
  status TEXT NOT NULL DEFAULT 'new',  -- 'new' | 'reviewed' | 'excluded'
  ask_to_share INTEGER NOT NULL DEFAULT 0,
  quote_ok INTEGER NOT NULL DEFAULT 0,
  synced_at TEXT NOT NULL DEFAULT (datetime('now')),
  checked_at TEXT NOT NULL DEFAULT (datetime('now')),
  replied_at TEXT,                     -- set when a person sent the story-invite reply (once only)
  reviewed_at TEXT,
  reviewed_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_social_comments_post ON social_comments(platform, post_id);
CREATE INDEX IF NOT EXISTS idx_social_comments_posted ON social_comments(posted_at);
CREATE INDEX IF NOT EXISTS idx_social_comments_checked ON social_comments(checked_at);
