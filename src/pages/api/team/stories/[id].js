// PATCH  /api/team/stories/:id — { status?: 'approved'|'declined'|'new', story?, credit?, about? }
//        Approving or declining clears the contributor's email (we promised to delete it).
// DELETE /api/team/stories/:id — remove a story entirely (e.g. consent withdrawn).
// Leads only (src/middleware.js).

import { getDb, getActor, logActivity, jsonOk, jsonErr } from '../../../../lib/ops-db.js';
import { updateStory } from '../../../../lib/team-ops.js';

export const prerender = false;

const send = r => (r.error ? jsonErr(r.error, r.status) : jsonOk(r.data, r.status));

export async function PATCH(context) {
  const db = getDb(context);
  if (!db) return jsonErr('Database unavailable', 503);
  let body;
  try { body = await context.request.json(); }
  catch { return jsonErr('Invalid request body', 400); }
  return send(await updateStory(db, getActor(context.request), Number(context.params.id), body));
}

export async function DELETE(context) {
  const db = getDb(context);
  if (!db) return jsonErr('Database unavailable', 503);
  const id = Number(context.params.id);
  if (!Number.isInteger(id)) return jsonErr('Invalid id', 400);
  await db.prepare('DELETE FROM stories WHERE id = ?').bind(id).run();
  await logActivity(db, getActor(context.request), 'deleted a story', null);
  return jsonOk({ ok: true });
}
