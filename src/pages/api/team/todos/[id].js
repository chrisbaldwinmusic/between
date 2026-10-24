// PATCH  /api/team/todos/:id — update { done?, task?, owner?, area?, due_on? }
//        Leads can change anything; other team members can only tick their own to-dos on or off.
// DELETE /api/team/todos/:id — remove (leads only, via src/middleware.js)

import { getDb, getActor, logActivity, jsonOk, jsonErr } from '../../../../lib/ops-db.js';
import { getEmail } from '../../../../lib/team-access.js';
import { updateTodo } from '../../../../lib/team-ops.js';

export const prerender = false;

const send = r => (r.error ? jsonErr(r.error, r.status) : jsonOk(r.data, r.status));

export async function PATCH(context) {
  const db = getDb(context);
  if (!db) return jsonErr('Database unavailable', 503);
  let body;
  try { body = await context.request.json(); }
  catch { return jsonErr('Invalid request body', 400); }
  return send(await updateTodo(db, getActor(context.request), getEmail(context.request), Number(context.params.id), body));
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
