// POST /api/team/evaluation/community — save a month's community numbers
//   { month: 'YYYY-MM', ...one whole number per COMMUNITY_CHANNELS key }
// or lock / unlock the month once the numbers are final: { month, lock: true | false }.
// Locked months can't be edited until unlocked. Returns the saved row. Leads only (src/middleware.js).

import { getDb, getActor, logActivity, jsonOk, jsonErr } from '../../../../lib/ops-db.js';
import { COMMUNITY_CHANNELS } from '../../../../lib/feedback.js';

export const prerender = false;

const CHANNELS = COMMUNITY_CHANNELS.map(([key]) => key);

export async function POST(context) {
  const db = getDb(context);
  if (!db) return jsonErr('Database unavailable', 503);

  let body;
  try { body = await context.request.json(); }
  catch { return jsonErr('Invalid request body', 400); }

  const month = body?.month;
  if (typeof month !== 'string' || !/^\d{4}-\d{2}$/.test(month)) return jsonErr('Invalid month', 400);
  const actor = getActor(context.request);
  const existing = await db.prepare('SELECT * FROM community_counts WHERE month = ?').bind(month).first();

  // Lock / unlock
  if (typeof body.lock === 'boolean') {
    if (!existing) return jsonErr('Save some numbers before locking the month', 400);
    await db
      .prepare('UPDATE community_counts SET locked_at = ?, locked_by = ? WHERE month = ?')
      .bind(body.lock ? new Date().toISOString().replace('T', ' ').slice(0, 19) : null, body.lock ? actor : null, month)
      .run();
    await logActivity(db, actor, body.lock ? 'locked community numbers' : 'unlocked community numbers', month);
    return jsonOk({ row: await db.prepare('SELECT * FROM community_counts WHERE month = ?').bind(month).first() });
  }

  if (existing?.locked_at) return jsonErr('This month is locked. Unlock it to make changes.', 409);

  const values = [];
  for (const c of CHANNELS) {
    const v = body[c] === '' || body[c] == null ? null : Number(String(body[c]).replace(/,/g, ''));
    if (v !== null && (!Number.isInteger(v) || v < 0)) return jsonErr(`${c.replace('_', ' ')} must be a whole number`, 400);
    values.push(v);
  }

  await db
    .prepare(`INSERT INTO community_counts (month, ${CHANNELS.join(', ')}, updated_by) VALUES (?, ${CHANNELS.map(() => '?').join(', ')}, ?)
              ON CONFLICT(month) DO UPDATE SET ${CHANNELS.map(c => `${c} = excluded.${c}`).join(', ')},
                updated_at = datetime('now'), updated_by = excluded.updated_by`)
    .bind(month, ...values, actor)
    .run();

  await logActivity(db, actor, 'updated community numbers', month);
  return jsonOk({ row: await db.prepare('SELECT * FROM community_counts WHERE month = ?').bind(month).first() });
}
