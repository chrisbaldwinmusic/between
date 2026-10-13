// POST /api/team/evaluation/community — save a month's community counts
// { month: 'YYYY-MM', ...one whole number per COMMUNITY_CHANNELS key }. Leads only (src/middleware.js).

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

  if (typeof body?.month !== 'string' || !/^\d{4}-\d{2}$/.test(body.month)) return jsonErr('Invalid month', 400);

  const values = [];
  for (const c of CHANNELS) {
    const v = body[c] === '' || body[c] == null ? null : Number(body[c]);
    if (v !== null && (!Number.isInteger(v) || v < 0)) return jsonErr(`${c} must be a whole number`, 400);
    values.push(v);
  }
  const actor = getActor(context.request);

  await db
    .prepare(`INSERT INTO community_counts (month, ${CHANNELS.join(', ')}, updated_by) VALUES (?, ${CHANNELS.map(() => '?').join(', ')}, ?)
              ON CONFLICT(month) DO UPDATE SET ${CHANNELS.map(c => `${c} = excluded.${c}`).join(', ')},
                updated_at = datetime('now'), updated_by = excluded.updated_by`)
    .bind(body.month, ...values, actor)
    .run();

  await logActivity(db, actor, 'updated community numbers', body.month);
  return jsonOk({ ok: true });
}
