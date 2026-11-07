// PATCH /api/team/comments/:id — { themes?, event_slug?, status?: 'new'|'reviewed'|'excluded', ask_to_share?, quote_ok? }
//   'excluded' = don't use (blanks the text). quote_ok is lead-only. Leads and community managers.
// DELETE /api/team/comments/:id — remove our copy entirely (e.g. someone asks us to). Leads only.

import { getDb, getActor, logActivity, jsonOk, jsonErr } from '../../../../lib/ops-db.js';
import { updateComment } from '../../../../lib/comments.js';
import { getEmail, isLead } from '../../../../lib/team-access.js';

export const prerender = false;

export async function PATCH(context) {
  const db = getDb(context);
  if (!db) return jsonErr('Database unavailable', 503);
  const id = Number(context.params.id);
  if (!Number.isInteger(id)) return jsonErr('Invalid id', 400);
  let body;
  try { body = await context.request.json(); } catch { return jsonErr('Invalid request body', 400); }
  const r = await updateComment(db, getActor(context.request), id, body, isLead(getEmail(context.request)));
  return r.error ? jsonErr(r.error, r.status) : jsonOk(r.data);
}

export async function DELETE(context) {
  const db = getDb(context);
  if (!db) return jsonErr('Database unavailable', 503);
  const id = Number(context.params.id);
  if (!Number.isInteger(id)) return jsonErr('Invalid id', 400);
  await db.prepare('DELETE FROM social_comments WHERE id = ?').bind(id).run();
  await logActivity(db, getActor(context.request), 'deleted a social comment copy', null).catch(() => {});
  return jsonOk({ ok: true });
}
