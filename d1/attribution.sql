-- Campaign attribution: daily counts of visits that arrived through a tracked (UTM) link, and of
-- actions (sign-ups, venue votes, surveys, check-ins, stories, WhatsApp clicks) credited to the
-- link the page was opened from. Counts only: no cookies, nothing stored on the visitor's device,
-- nothing linked to a person. Run once:
--   npx wrangler d1 execute between-ops --remote --file=d1/attribution.sql
CREATE TABLE IF NOT EXISTS attribution (
  day TEXT NOT NULL,               -- YYYY-MM-DD (UK)
  kind TEXT NOT NULL,              -- visit | signup | vote | survey | checkin | story | whatsapp
  source TEXT NOT NULL,            -- utm_source, or '(direct)' for actions without one
  medium TEXT NOT NULL DEFAULT '',
  campaign TEXT NOT NULL DEFAULT '',
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, kind, source, medium, campaign)
);
