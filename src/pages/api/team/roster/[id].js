// PATCH  /api/team/roster/:id — update { role?, remit?, status? }
// DELETE /api/team/roster/:id — remove

import { getDb, getActor, logActivity, jsonOk, jsonErr } from '../../../../lib/ops-db.js';
import { updateMember } from '../../../../lib/team-ops.js';

export const prerender = false;

const send = r => (r.error ? jsonErr(r.error, r.status) : jsonOk(r.data, r.status));

export async function PATCH(context) {
  const db = getDb(context);
  if (!db) return jsonErr('Database unavailable', 503);
  let body;
  try { body = await context.request.json(); }
  catch { return jsonErr('Invalid request body', 400); }
  return send(await updateMember(db, getActor(context.request), Number(context.params.id), body));
}

export async function DELETE(context) {
  const db = getDb(context);
  if (!db) return jsonErr('Database unavailable', 503);

  const id = Number(context.params.id);
  if (!Number.isInteger(id)) return jsonErr('Invalid id', 400);

  const existing = await db.prepare('SELECT * FROM team_members WHERE id = ?').bind(id).first();
  if (!existing) return jsonErr('Not found', 404);

  await db.prepare('DELETE FROM team_members WHERE id = ?').bind(id).run();
  await logActivity(db, getActor(context.request), 'removed a team member', existing.name);

  return jsonOk({ ok: true });
}
