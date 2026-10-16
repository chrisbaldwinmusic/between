-- Push notifications for the team app (src/lib/webpush.js): one row per device someone has turned
-- notifications on for. Expired subscriptions are deleted when the push service says so.
-- Run once:
--   npx wrangler d1 execute between-ops --remote --file=d1/push.sql
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  device TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_ok_at TEXT
);
CREATE INDEX IF NOT EXISTS push_subscriptions_email ON push_subscriptions (email);
