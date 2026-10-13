// GET  /api/team/budget — budget lines with their logged entries
// POST /api/team/budget — log an entry { line_id, entry_date, description, amount_pence }
// Leads only (enforced in src/middleware.js).

import { getDb, getActor, logActivity, jsonOk, jsonErr } from '../../../../lib/ops-db.js';

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

  const lineId = Number(body?.line_id);
  const date = typeof body?.entry_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.entry_date) ? body.entry_date : null;
  const description = typeof body?.description === 'string' ? body.description.trim() : '';
  const amount = Number(body?.amount_pence);

  if (!Number.isInteger(lineId)) return jsonErr('Choose a budget line', 400);
  if (!date) return jsonErr('A date is required', 400);
  if (!description) return jsonErr('A description is required', 400);
  if (!Number.isInteger(amount) || amount === 0) return jsonErr('Enter an amount', 400);

  const line = await db.prepare('SELECT * FROM budget_lines WHERE id = ?').bind(lineId).first();
  if (!line) return jsonErr('Budget line not found', 404);

  const actor = getActor(context.request);

  const { meta } = await db
    .prepare('INSERT INTO budget_entries (line_id, entry_date, description, amount_pence, created_by) VALUES (?, ?, ?, ?, ?)')
    .bind(lineId, date, description, amount, actor)
    .run();

  const pounds = (amount / 100).toLocaleString('en-GB', { style: 'currency', currency: 'GBP' });
  await logActivity(db, actor, 'logged a budget entry', `${pounds} against ${line.description}: ${description}`);

  const row = await db.prepare('SELECT * FROM budget_entries WHERE id = ?').bind(meta.last_row_id).first();
  return jsonOk({ entry: row }, 201);
}
