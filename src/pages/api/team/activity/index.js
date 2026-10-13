// GET /api/team/activity — recent activity log, newest first. Leads only (src/middleware.js).
// Not shown in the UI; every write is still logged as an audit trail.

import { getDb, jsonOk, jsonErr } from '../../../../lib/ops-db.js';

export const prerender = false;

export async function GET(context) {
  const db = getDb(context);
  if (!db) return jsonErr('Database unavailable', 503);

  const limit = Math.min(Number(new URL(context.request.url).searchParams.get('limit')) || 20, 100);

  const { results } = await db
    .prepare('SELECT * FROM activity_log ORDER BY created_at DESC LIMIT ?')
    .bind(limit)
    .all();

  return jsonOk({ activity: results });
}
