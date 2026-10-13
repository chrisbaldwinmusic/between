-- Evaluation tables (post-event survey, QR check-in, per-event checklist, monthly community counts).
-- Adds to an existing between-ops database. Run once:
--   npx wrangler d1 execute between-ops --remote --file=d1/evaluation.sql
--
-- No personal data: no names, emails or IP addresses. Postcodes are stored as the outward code
-- only (e.g. DE14).

-- Public 5-question survey at /feedback/[slug], as set out in the ACE application.
CREATE TABLE IF NOT EXISTS feedback_responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_slug TEXT NOT NULL,
  heard_from TEXT NOT NULL,        -- channel attribution
  prior_events TEXT NOT NULL,      -- 'first' | '2-3' | '4-9' | '10+'
  outward_postcode TEXT,           -- optional, outward code only
  venue_use TEXT NOT NULL,         -- 'yes' | 'maybe' | 'no' (same question as the site's venue poll)
  venue_wants TEXT,                -- optional free text
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_feedback_event ON feedback_responses(event_slug);

-- QR check-in at free daytime events, /feedback/[slug]/checkin.
CREATE TABLE IF NOT EXISTS checkins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_slug TEXT NOT NULL,
  party_size INTEGER NOT NULL DEFAULT 1,
  first_time INTEGER,              -- 1 = first Sonic Boom event, 0 = been before, NULL = not said
  outward_postcode TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_checkins_event ON checkins(event_slug);

-- Per-event evaluation checklist (/team/evaluation).
CREATE TABLE IF NOT EXISTS eval_events (
  event_slug TEXT PRIMARY KEY,
  survey_sent_on TEXT,             -- YYYY-MM-DD; due within 48 hours of the event
  attendance INTEGER,              -- box-office export or headcount; QR check-ins are counted separately
  debrief_on TEXT,                 -- YYYY-MM-DD the delivery-team debrief happened
  notes TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT,
  locked_at TEXT,                  -- set when the numbers are final; locked rows can't be edited
  locked_by TEXT
);

-- Monthly community growth, reported quarterly.
CREATE TABLE IF NOT EXISTS community_counts (
  month TEXT PRIMARY KEY,          -- YYYY-MM
  whatsapp INTEGER,                -- WhatsApp community members
  email INTEGER,                   -- email subscribers
  facebook_page INTEGER,           -- Facebook page followers
  facebook_group INTEGER,          -- Facebook group members
  instagram INTEGER,               -- Instagram account followers
  instagram_channel INTEGER,       -- Instagram broadcast channel members
  tiktok INTEGER,                  -- TikTok followers
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT,
  locked_at TEXT,                  -- set when the month's numbers are final and reported
  locked_by TEXT
);

-- One row per day a reminder digest was sent, so a repeated cron run can't email twice.
CREATE TABLE IF NOT EXISTS reminder_log (
  sent_on TEXT PRIMARY KEY,        -- YYYY-MM-DD (UK)
  subject TEXT,
  items INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
