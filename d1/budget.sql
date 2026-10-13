-- Adds the budget tracker tables to an existing between-ops database and seeds them with the
-- budget from the Arts Council England application (Supporting Grassroots Music, round 11,
-- SGRM-00869135-R11, submitted 18 Sep 2026). Run once:
--   npx wrangler d1 execute between-ops --remote --file=d1/budget.sql

CREATE TABLE IF NOT EXISTS budget_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  heading TEXT NOT NULL,
  description TEXT NOT NULL,
  budget_pence INTEGER NOT NULL,
  in_kind INTEGER NOT NULL DEFAULT 0,
  status TEXT,
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS budget_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  line_id INTEGER NOT NULL REFERENCES budget_lines(id),
  entry_date TEXT NOT NULL,
  description TEXT NOT NULL,
  amount_pence INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_budget_entries_line ON budget_entries(line_id);

INSERT INTO budget_lines (kind, heading, description, budget_pence, in_kind, status, sort) VALUES
  -- Income: cash
  ('income', 'Arts Council England', 'Supporting Grassroots Music grant', 2600000, 0, 'confirmed', 10),
  ('income', 'Earned income', 'Ticket sales from 3 ticketed evenings (Firelight ~50, Winter Sounds ~70, Love Your Local ~50)', 120000, 0, 'expected', 20),
  ('income', 'Earned income', 'Founding Membership (around 40 members at ~£15 in year one)', 60000, 0, 'expected', 30),
  -- Income: support in kind
  ('income', 'Support in kind', 'Partner venue hire and community equipment donation', 120000, 1, 'expected', 40),
  ('income', 'Support in kind', 'Chris Baldwin project management (24 days)', 360000, 1, 'confirmed', 50),
  ('income', 'Support in kind', 'Volunteer artist liaison', 150000, 1, 'confirmed', 60),
  ('income', 'Support in kind', 'Volunteer technical & production support', 180000, 1, 'confirmed', 70),
  -- Expenditure: cash
  ('expenditure', 'Artistic spending', 'Artist fees (average £800 per event x 10 events)', 800000, 0, NULL, 110),
  ('expenditure', 'Artistic spending', 'Production support: PA, lighting, engineers (£340 per event x 10 events)', 340000, 0, NULL, 120),
  ('expenditure', 'Artistic spending', 'Venue hire (donation)', 20000, 0, NULL, 130),
  ('expenditure', 'Marketing and developing audiences', 'Freelance community managers, Vikki and Emma (£175 per day x 40 days)', 700000, 0, NULL, 140),
  ('expenditure', 'Marketing and developing audiences', 'Design & content stipend, Vikki and Emma (£150 per month x 12 months)', 180000, 0, NULL, 150),
  ('expenditure', 'Marketing and developing audiences', 'Print & advertising (£100 per month x 12 months)', 120000, 0, NULL, 160),
  ('expenditure', 'Making your work accessible', 'BSL on request, relaxed/quiet provision, access fund, transport & care', 160000, 0, NULL, 170),
  ('expenditure', 'Developing your organisation and people', 'Audience profiling, survey and tech stack evaluation', 120000, 0, NULL, 180),
  ('expenditure', 'Developing your organisation and people', 'Ad hoc project coordination across ten events (£150 per day x 6 days)', 90000, 0, NULL, 190),
  ('expenditure', 'Developing your organisation and people', 'NED recruitment and organisational development', 250000, 0, NULL, 200),
  -- Expenditure: support in kind (mirrors the in-kind income)
  ('expenditure', 'Support in kind', 'Partner venue hire and community equipment', 120000, 1, NULL, 210),
  ('expenditure', 'Support in kind', 'Chris Baldwin project management (24 days)', 360000, 1, NULL, 220),
  ('expenditure', 'Support in kind', 'Volunteer artist liaison', 150000, 1, NULL, 230),
  ('expenditure', 'Support in kind', 'Volunteer technical & production support', 180000, 1, NULL, 240);
