// GET  /api/team/todos — list all todos (open first, newest first within each)
// POST /api/team/todos — create a todo { task, owner?, area?, due_on? }

import { getDb, getActor, logActivity, jsonOk, jsonErr } from '../../../../lib/ops-db.js';

export const prerender = false;

export async function GET(context) {
  const db = getDb(context);
  if (!db) return jsonErr('Database unavailable', 503);

  const { results } = await db
    .prepare('SELECT * FROM todos ORDER BY done ASC, due_on IS NULL, due_on ASC, created_at DESC')
    .all();
  return jsonOk({ todos: results });
}

export async function POST(context) {
  const db = getDb(context);
  if (!db) return jsonErr('Database unavailable', 503);

  let body;
  try { body = await context.request.json(); }
  catch { return jsonErr('Invalid request body', 400); }

  const task = typeof body?.task === 'string' ? body.task.trim() : '';
  const owner = typeof body?.owner === 'string' ? body.owner.trim() : null;
  const area = typeof body?.area === 'string' && body.area.trim() ? body.area.trim() : 'General';
  const dueOn = typeof body?.due_on === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.due_on) ? body.due_on : null;

  if (!task) return jsonErr('task is required', 400);

  const actor = getActor(context.request);

  const { meta } = await db
    .prepare('INSERT INTO todos (task, owner, area, due_on, created_by) VALUES (?, ?, ?, ?, ?)')
    .bind(task, owner, area, dueOn, actor)
    .run();

  await logActivity(db, actor, 'created a to-do', task);

  const row = await db.prepare('SELECT * FROM todos WHERE id = ?').bind(meta.last_row_id).first();
  return jsonOk({ todo: row }, 201);
}
