// PATCH  /api/team/stories/:id — { status?: 'approved'|'declined'|'new', story?, credit?, about? }
//        Approving or declining clears the contributor's email (we promised to delete it).
// DELETE /api/team/stories/:id — remove a story entirely (e.g. consent withdrawn).
// Leads only (src/middleware.js).

import { getDb, getActor, logActivity, jsonOk, jsonErr } from '../../../../lib/ops-db.js';

export const prerender = false;

const STATUSES = ['new', 'approved', 'declined'];
const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) || null : undefined);

export async function PATCH(context) {
  const db = getDb(context);
  if (!db) return jsonErr('Database unavailable', 503);
  const id = Number(context.params.id);
  const existing = Number.isInteger(id) ? await db.prepare('SELECT * FROM stories WHERE id = ?').bind(id).first() : null;
  if (!existing) return jsonErr('Not found', 404);

  let body;
  try { body = await context.request.json(); } catch { return jsonErr('Invalid request body', 400); }

  const status = STATUSES.includes(body?.status) ? body.status : existing.status;
  const story = text(body?.story, 3000) ?? existing.story;
  const credit = body?.credit === undefined ? existing.credit : text(body.credit, 80);
  const about = body?.about === undefined ? existing.about : text(body.about, 160);
  // Only a change of status counts as a review (a later copy edit mustn't re-date it).
  const reviewed = status !== existing.status && status !== 'new';
  const actor = getActor(context.request);

  await db
    .prepare(`UPDATE stories SET status = ?, story = ?, credit = ?, about = ?,
              email = CASE WHEN ? THEN NULL ELSE email END,
              reviewed_at = CASE WHEN ? THEN datetime('now') ELSE reviewed_at END,
              reviewed_by = CASE WHEN ? THEN ? ELSE reviewed_by END
              WHERE id = ?`)
    .bind(status, story, credit ?? null, about ?? null, reviewed ? 1 : 0, reviewed ? 1 : 0, reviewed ? 1 : 0, actor, id)
    .run();

  if (status !== existing.status) await logActivity(db, actor, `${status === 'approved' ? 'approved' : status === 'declined' ? 'declined' : 'reopened'} a story`, credit || 'anonymous');
  return jsonOk({ ok: true });
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
