// GET  /api/team/budget — budget lines with their logged entries
// POST /api/team/budget — log an entry { line_id, entry_date, description, amount_pence }
// Leads only (enforced in src/middleware.js).

import { getDb, getActor, jsonOk, jsonErr } from '../../../../lib/ops-db.js';
import { createBudgetEntry } from '../../../../lib/team-ops.js';

const send = r => (r.error ? jsonErr(r.error, r.status) : jsonOk(r.data, r.status));

export const prerender = false;

export async function GET(context) {
  const db = getDb(context);
  if (!db) return jsonErr('Database unavailable', 503);

  const [lines, entries] = await Promise.all([
    db.prepare('SELECT * FROM budget_lines ORDER BY sort ASC, id ASC').all(),
    db.prepare('SELECT * FROM budget_entries ORDER BY entry_date DESC, id DESC').all(),
  ]);
  return jsonOk({ lines: lines.results, entries: entries.results });
}

export async function POST(context) {
  const db = getDb(context);
  if (!db) return jsonErr('Database unavailable', 503);
  let body;
  try { body = await context.request.json(); }
  catch { return jsonErr('Invalid request body', 400); }
  return send(await createBudgetEntry(db, getActor(context.request), body));
}
