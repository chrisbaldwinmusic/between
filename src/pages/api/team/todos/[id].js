// PATCH  /api/team/todos/:id — update { done?, task?, owner?, area?, due_on? }
//        Leads can change anything; other team members can only tick their own to-dos on or off.
// DELETE /api/team/todos/:id — remove (leads only, via src/middleware.js)

import { getDb, getActor, logActivity, jsonOk, jsonErr } from '../../../../lib/ops-db.js';
import { getEmail, isLead } from '../../../../lib/team-access.js';
import { nameMatcher, rosterName } from '../../../../lib/ownership.js';

export const prerender = false;

export async function PATCH(context) {
  const db = getDb(context);
  if (!db) return jsonErr('Database unavailable', 503);

  const id = Number(context.params.id);
  if (!Number.isInteger(id)) return jsonErr('Invalid id', 400);

  const existing = await db.prepare('SELECT * FROM todos WHERE id = ?').bind(id).first();
  if (!existing) return jsonErr('Not found', 404);

  let body;
  try { body = await context.request.json(); }
  catch { return jsonErr('Invalid request body', 400); }

  const actor = getActor(context.request);
  const email = getEmail(context.request);
  if (!isLead(email)) {
    const name = await rosterName(db, email);
    if (!name || !nameMatcher([name])(existing.owner)) return jsonErr('You can only tick off your own to-dos', 403);
    if (typeof body?.done !== 'boolean') return jsonErr('You can only tick to-dos on or off', 403);
    body = { done: body.done };
  }

  const task = typeof body?.task === 'string' ? body.task.trim() : existing.task;
  const owner = body?.owner === undefined ? existing.owner : (typeof body.owner === 'string' ? body.owner.trim() : null);
  const area = typeof body?.area === 'string' && body.area.trim() ? body.area.trim() : existing.area;
  const done = typeof body?.done === 'boolean' ? (body.done ? 1 : 0) : existing.done;
  const dueOn = body?.due_on === undefined ? existing.due_on
    : (typeof body.due_on === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.due_on) ? body.due_on : null);
  const completedBy = done && !existing.done ? actor : (done ? existing.completed_by : null);

  await db
    .prepare(`UPDATE todos SET task = ?, owner = ?, area = ?, done = ?, completed_by = ?, due_on = ?,
              updated_at = datetime('now') WHERE id = ?`)
    .bind(task, owner, area, done, completedBy, dueOn, id)
    .run();

  if (done !== existing.done) {
    await logActivity(db, actor, done ? 'checked off a to-do' : 'reopened a to-do', task);
  } else if (task !== existing.task || owner !== existing.owner || area !== existing.area || dueOn !== existing.due_on) {
    await logActivity(db, actor, 'edited a to-do', task);
  }

  const row = await db.prepare('SELECT * FROM todos WHERE id = ?').bind(id).first();
  return jsonOk({ todo: row });
}

export async function DELETE(context) {
  const db = getDb(context);
  if (!db) return jsonErr('Database unavailable', 503);

  const id = Number(context.params.id);
  if (!Number.isInteger(id)) return jsonErr('Invalid id', 400);

  const existing = await db.prepare('SELECT * FROM todos WHERE id = ?').bind(id).first();
  if (!existing) return jsonErr('Not found', 404);

  await db.prepare('DELETE FROM todos WHERE id = ?').bind(id).run();
  await logActivity(db, getActor(context.request), 'deleted a to-do', existing.task);

  return jsonOk({ ok: true });
}
