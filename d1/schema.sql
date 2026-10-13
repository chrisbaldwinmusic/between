-- Schema for the between-ops D1 database (OPS_DB binding).
-- Backs the /team section — a live, editable project/productivity tool,
-- not static content. Source of truth is the deployed database; this file
-- is for reference and for recreating the database elsewhere.
--
-- Apply with:
--   npx wrangler d1 execute between-ops --remote --file=d1/schema.sql   (production)
--   npx wrangler d1 execute between-ops --local  --file=d1/schema.sql   (local dev)

CREATE TABLE todos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task TEXT NOT NULL,
  owner TEXT,
  area TEXT NOT NULL DEFAULT 'General',
  done INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT,
  completed_by TEXT
);

CREATE TABLE schedule_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  task TEXT NOT NULL,
  owner TEXT,
  status_override TEXT,      -- NULL (automatic from dates), 'blocked', or 'done'
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT
);

CREATE TABLE team_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT,
  remit TEXT,
  status TEXT NOT NULL DEFAULT 'unconfirmed',  -- confirmed | expected | unconfirmed
  source TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT
);

CREATE TABLE activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor TEXT,
  action TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_todos_done ON todos(done);
CREATE INDEX idx_schedule_dates ON schedule_items(start_date, end_date);
CREATE INDEX idx_activity_created ON activity_log(created_at);

-- Budget tracker (/team/budget, leads only). Lines are the ACE application budget; entries are
-- actual spend or income logged against them. Money is stored in pence. Seed: d1/budget.sql.
CREATE TABLE budget_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,              -- 'income' | 'expenditure'
  heading TEXT NOT NULL,           -- ACE budget heading, e.g. 'Artistic spending'
  description TEXT NOT NULL,
  budget_pence INTEGER NOT NULL,
  in_kind INTEGER NOT NULL DEFAULT 0,
  status TEXT,                     -- income only: 'expected' | 'confirmed'
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE budget_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  line_id INTEGER NOT NULL REFERENCES budget_lines(id),
  entry_date TEXT NOT NULL,        -- YYYY-MM-DD
  description TEXT NOT NULL,
  amount_pence INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT
);

CREATE INDEX idx_budget_entries_line ON budget_entries(line_id);
