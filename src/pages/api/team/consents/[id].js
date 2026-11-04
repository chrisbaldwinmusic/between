// PATCH /api/team/consents/:id — { withdrawn: boolean }. Leads only (src/middleware.js).
// Mark a photo/video/audio/words permission withdrawn when someone asks, or undo that by mistake.

import { getDb, getActor, logActivity, jsonOk, jsonErr } from '../../../../lib/ops-db.js';

export const prerender = false;

export async function PATCH(context) {
  const db = getDb(context);
  if (!db) return jsonErr('Database unavailable', 503);
  const id = Number(context.params.id);
  if (!Number.isInteger(id)) return jsonErr('Invalid id', 400);
  let body;
  try { body = await context.request.json(); } catch { return jsonErr('Invalid request body', 400); }
  const actor = getActor(context.request);
  const row = await db.prepare('SELECT name FROM media_consents WHERE id = ?').bind(id).first();
  if (!row) return jsonErr('Not found', 404);
  if (body.withdrawn === true) {
    await db.prepare(`UPDATE media_consents SET withdrawn_at = datetime('now'), withdrawn_by = ? WHERE id = ?`).bind(actor, id).run();
  } else {
    await db.prepare('UPDATE media_consents SET withdrawn_at = NULL, withdrawn_by = NULL WHERE id = ?').bind(id).run();
  }
  await logActivity(db, actor, body.withdrawn === true ? 'recorded a withdrawn media permission' : 'reinstated a media permission', row.name);
  return jsonOk({ ok: true });
}
