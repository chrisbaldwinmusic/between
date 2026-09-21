// GET  /api/team/schedule — list all schedule items, earliest start first
// POST /api/team/schedule — create { start_date, end_date, task, owner? }

import { getDb, getActor, logActivity, jsonOk, jsonErr } from '../../../../lib/ops-db.js';

export const prerender = false;

export async function GET(context) {
  const db = getDb(context);
  if (!db) return jsonErr('Database unavailable', 503);

  const { results } = await db
    .prepare('SELECT * FROM schedule_items ORDER BY start_date ASC')
    .all();
  return jsonOk({ items: results });
}

export async function POST(context) {
  const db = getDb(context);
  if (!db) return jsonErr('Database unavailable', 503);

  let body;
  try { body = await context.request.json(); }
  catch { return jsonErr('Invalid request body', 400); }

  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  const start = typeof body?.start_date === 'string' && dateRe.test(body.start_date) ? body.start_date : null;
  const end = typeof body?.end_date === 'string' && dateRe.test(body.end_date) ? body.end_date : null;
  const task = typeof body?.task === 'string' ? body.task.trim() : '';
  const owner = typeof body?.owner === 'string' ? body.owner.trim() : null;

  if (!start || !end) return jsonErr('start_date and end_date are required (YYYY-MM-DD)', 400);
  if (!task) return jsonErr('task is required', 400);
  if (end < start) return jsonErr('end_date must not be before start_date', 400);

  const actor = getActor(context.request);

  const { meta } = await db
    .prepare('INSERT INTO schedule_items (start_date, end_date, task, owner, updated_by) VALUES (?, ?, ?, ?, ?)')
    .bind(start, end, task, owner, actor)
    .run();

  await logActivity(db, actor, 'added a schedule item', task);

  const row = await db.prepare('SELECT * FROM schedule_items WHERE id = ?').bind(meta.last_row_id).first();
  return jsonOk({ item: row }, 201);
}
