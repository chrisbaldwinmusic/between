// GET /api/team/activity — recent activity log, newest first

import { getDb, jsonOk, jsonErr } from '../../../../lib/ops-db.js';
import { getEmail, activityWhere } from '../../../../lib/team-access.js';

export const prerender = false;

export async function GET(context) {
  const db = getDb(context);
  if (!db) return jsonErr('Database unavailable', 503);

  const limit = Math.min(Number(new URL(context.request.url).searchParams.get('limit')) || 20, 100);

  const { results } = await db
    .prepare(`SELECT * FROM activity_log ${activityWhere(getEmail(context.request))} ORDER BY created_at DESC LIMIT ?`)
    .bind(limit)
    .all();

  return jsonOk({ activity: results });
}
