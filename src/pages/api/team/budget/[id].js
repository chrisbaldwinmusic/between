// DELETE /api/team/budget/:id — remove a logged entry. Leads only (enforced in src/middleware.js).

import { getDb, getActor, logActivity, jsonOk, jsonErr } from '../../../../lib/ops-db.js';

export const prerender = false;

export async function DELETE(context) {
  const db = getDb(context);
  if (!db) return jsonErr('Database unavailable', 503);

  const id = Number(context.params.id);
  if (!Number.isInteger(id)) return jsonErr('Invalid id', 400);

  const existing = await db.prepare('SELECT * FROM budget_entries WHERE id = ?').bind(id).first();
  if (!existing) return jsonErr('Not found', 404);

  await db.prepare('DELETE FROM budget_entries WHERE id = ?').bind(id).run();
  await logActivity(db, getActor(context.request), 'removed a budget entry', existing.description);

  return jsonOk({ ok: true });
}
