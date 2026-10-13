-- Quarterly / six-month / final review write-ups (/team/reviews). One row per review checkpoint in
-- the schedule (schedule_items with "review" in the task). Run once:
--   npx wrangler d1 execute between-ops --remote --file=d1/reviews.sql
CREATE TABLE IF NOT EXISTS reviews (
  schedule_id INTEGER PRIMARY KEY,   -- schedule_items.id of the review
  worked TEXT,                       -- what worked
  didnt TEXT,                        -- what didn't
  learned TEXT,                      -- what we learned (about people, audiences, community)
  actions TEXT,                      -- what we'll change / do next
  updated_at TEXT,
  updated_by TEXT,
  signed_off_at TEXT,                -- signing off locks the write-up
  signed_off_by TEXT
);
