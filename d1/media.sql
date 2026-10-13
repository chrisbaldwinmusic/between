-- Team photo and screenshot uploads (/team/media): photos from events and screenshots of social
-- media reactions, stored privately in R2 (bucket between-evidence, binding EVIDENCE). Run once:
--   npx wrangler d1 execute between-ops --remote --file=d1/media.sql
CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  r2_key TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL,              -- 'event' (photo from an event) | 'social' (screenshot of a reaction)
  event_slug TEXT,                 -- optional
  platform TEXT,                   -- social only: whatsapp | facebook | instagram | tiktok | other
  caption TEXT,                    -- the story: who, what, why it mattered
  alt TEXT NOT NULL,               -- accessible description of the image
  credit TEXT,                     -- photographer or account
  content_type TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  uploaded_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_media_event ON media(event_slug);
