// PATCH  /api/team/schedule/:id — update { task?, owner?, start_date?, end_date?, status_override?, notes? }
// DELETE /api/team/schedule/:id — remove

import { getDb, getActor, logActivity, jsonOk, jsonErr } from '../../../../lib/ops-db.js';

export const prerender = false;

const ALLOWED_OVERRIDES = new Set([null, 'blocked', 'done']);
const dateRe = /^\d{4}-\d{2}-\d{2}$/;

export async function PATCH(context) {
  const db = getDb(context);
  if (!db) return jsonErr('Database unavailable', 503);

  const id = Number(context.params.id);
  if (!Number.isInteger(id)) return jsonErr('Invalid id', 400);

  const existing = await db.prepare('SELECT * FROM schedule_items WHERE id = ?').bind(id).first();
  if (!existing) return jsonErr('Not found', 404);

  let body;
  try { body = await context.request.json(); }
  catch { return jsonErr('Invalid request body', 400); }

  const task = typeof body?.task === 'string' && body.task.trim() ? body.task.trim() : existing.task;
  const owner = body?.owner === undefined ? existing.owner : (typeof body.owner === 'string' ? body.owner.trim() : null);
  const start = typeof body?.start_date === 'string' && dateRe.test(body.start_date) ? body.start_date : existing.start_date;
  const end = typeof body?.end_date === 'string' && dateRe.test(body.end_date) ? body.end_date : existing.end_date;
  const notes = body?.notes === undefined ? existing.notes : (typeof body.notes === 'string' ? body.notes.trim() || null : null);

  let statusOverride = existing.status_override;
  if (body?.status_override !== undefined) {
    const v = body.status_override === null ? null : String(body.status_override);
    if (!ALLOWED_OVERRIDES.has(v)) return jsonErr('status_override must be null, "blocked" or "done"', 400);
    statusOverride = v;
  }

  if (end < start) return jsonErr('end_date must not be before start_date', 400);

  const actor = getActor(context.request);

  await db
    .prepare(`UPDATE schedule_items SET task = ?, owner = ?, start_date = ?, end_date = ?,
              status_override = ?, notes = ?, updated_by = ?, updated_at = datetime('now') WHERE id = ?`)
    .bind(task, owner, start, end, statusOverride, notes, actor, id)
    .run();

  if (statusOverride !== existing.status_override) {
    await logActivity(db, actor, `marked a schedule item ${statusOverride ?? 'back to automatic'}`, task);
  } else {
    await logActivity(db, actor, 'updated a schedule item', task);
  }

  const row = await db.prepare('SELECT * FROM schedule_items WHERE id = ?').bind(id).first();
  return jsonOk({ item: row });
}

export async function DELETE(context) {
  const db = getDb(context);
  if (!db) return jsonErr('Database unavailable', 503);

  const id = Number(context.params.id);
  if (!Number.isInteger(id)) return jsonErr('Invalid id', 400);

  const existing = await db.prepare('SELECT * FROM schedule_items WHERE id = ?').bind(id).first();
  if (!existing) return jsonErr('Not found', 404);

  await db.prepare('DELETE FROM schedule_items WHERE id = ?').bind(id).run();
  await logActivity(db, getActor(context.request), 'removed a schedule item', existing.task);

  return jsonOk({ ok: true });
}
