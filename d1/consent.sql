-- Photo, video, audio and words consent, given through /feedback/consent (the QR code on posters
-- at events). One row per form. Leads and community managers read them in /team/consents; leads mark
-- one withdrawn when someone asks. Run once:
--   npx wrangler d1 execute between-ops --remote --file=d1/consent.sql
CREATE TABLE IF NOT EXISTS media_consents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,                -- who is giving permission (the parent or carer, for a child)
  email TEXT,                        -- optional: only to confirm or to act on a withdrawal
  child_names TEXT,                  -- set when a parent or carer answers for a child under 16
  event_slug TEXT,                   -- optional
  photo INTEGER NOT NULL DEFAULT 0,
  video INTEGER NOT NULL DEFAULT 0,
  audio INTEGER NOT NULL DEFAULT 0,
  words INTEGER NOT NULL DEFAULT 0,  -- quotes and what they say, in writing or on a recording
  use_web INTEGER NOT NULL DEFAULT 0,
  use_social INTEGER NOT NULL DEFAULT 0,
  use_print INTEGER NOT NULL DEFAULT 0,    -- posters, leaflets, press
  use_funders INTEGER NOT NULL DEFAULT 0,  -- reports and applications to funders
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  withdrawn_at TEXT,
  withdrawn_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_media_consents_created ON media_consents(created_at);
