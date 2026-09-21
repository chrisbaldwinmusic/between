// PATCH  /api/team/roster/:id — update { role?, remit?, status? }
// DELETE /api/team/roster/:id — remove

import { getDb, getActor, logActivity, jsonOk, jsonErr } from '../../../../lib/ops-db.js';

export const prerender = false;

const ALLOWED_STATUS = new Set(['confirmed', 'expected', 'unconfirmed']);

export async function PATCH(context) {
  const db = getDb(context);
  if (!db) return jsonErr('Database unavailable', 503);

  const id = Number(context.params.id);
  if (!Number.isInteger(id)) return jsonErr('Invalid id', 400);

  const existing = await db.prepare('SELECT * FROM team_members WHERE id = ?').bind(id).first();
  if (!existing) return jsonErr('Not found', 404);

  let body;
  try { body = await context.request.json(); }
  catch { return jsonErr('Invalid request body', 400); }

  const role = typeof body?.role === 'string' && body.role.trim() ? body.role.trim() : existing.role;
  const remit = body?.remit === undefined ? existing.remit : (typeof body.remit === 'string' ? body.remit.trim() || null : null);

  let status = existing.status;
  if (body?.status !== undefined) {
    if (!ALLOWED_STATUS.has(body.status)) return jsonErr('status must be confirmed, expected or unconfirmed', 400);
    status = body.status;
  }

  const actor = getActor(context.request);

  await db
    .prepare(`UPDATE team_members SET role = ?, remit = ?, status = ?, updated_by = ?,
              updated_at = datetime('now') WHERE id = ?`)
    .bind(role, remit, status, actor, id)
    .run();

  if (status !== existing.status) {
    await logActivity(db, actor, `marked ${existing.name} as ${status}`, null);
  } else {
    await logActivity(db, actor, `updated ${existing.name}'s details`, null);
  }

  const row = await db.prepare('SELECT * FROM team_members WHERE id = ?').bind(id).first();
  return jsonOk({ member: row });
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
