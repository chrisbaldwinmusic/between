// POST /api/team/reviews/:id — save a review write-up { worked?, didnt?, learned?, actions? }
// or sign it off / reopen it { signoff: true | false }. Signed-off reviews can't be edited until
// reopened. :id is the review's schedule_items id. Leads only (src/middleware.js).

import { getDb, getActor, logActivity, jsonOk, jsonErr } from '../../../../lib/ops-db.js';

export const prerender = false;

const FIELDS = ['worked', 'didnt', 'learned', 'actions'];
const now = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

export async function POST(context) {
  const db = getDb(context);
  if (!db) return jsonErr('Database unavailable', 503);

  const id = Number(context.params.id);
  const review = Number.isInteger(id) ? await db.prepare('SELECT * FROM schedule_items WHERE id = ?').bind(id).first() : null;
  if (!review || !/review/i.test(review.task)) return jsonErr('Review not found', 404);

  let body;
  try { body = await context.request.json(); } catch { return jsonErr('Invalid request body', 400); }

  const actor = getActor(context.request);
  const existing = await db.prepare('SELECT * FROM reviews WHERE schedule_id = ?').bind(id).first();
  const saved = async () => jsonOk({ row: await db.prepare('SELECT * FROM reviews WHERE schedule_id = ?').bind(id).first() });

  if (typeof body.signoff === 'boolean') {
    if (!existing) return jsonErr('Write the review before signing it off', 400);
    await db.prepare('UPDATE reviews SET signed_off_at = ?, signed_off_by = ? WHERE schedule_id = ?')
      .bind(body.signoff ? now() : null, body.signoff ? actor : null, id).run();
    await logActivity(db, actor, body.signoff ? 'signed off a review' : 'reopened a review', review.task);
    return saved();
  }

  if (existing?.signed_off_at) return jsonErr('This review is signed off. Reopen it to make changes.', 409);

  const values = FIELDS.map(f => (typeof body[f] === 'string' ? body[f].trim().slice(0, 6000) || null : null));
  await db
    .prepare(`INSERT INTO reviews (schedule_id, ${FIELDS.join(', ')}, updated_at, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(schedule_id) DO UPDATE SET ${FIELDS.map(f => `${f} = excluded.${f}`).join(', ')},
                updated_at = excluded.updated_at, updated_by = excluded.updated_by`)
    .bind(id, ...values, now(), actor)
    .run();
  await logActivity(db, actor, 'updated a review', review.task);
  return saved();
}
