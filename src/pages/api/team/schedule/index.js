// GET  /api/team/schedule — list all schedule items, earliest start first
// POST /api/team/schedule — create { start_date, end_date, task, owner? }

import { getDb, getActor, jsonOk, jsonErr } from '../../../../lib/ops-db.js';
import { createScheduleItem } from '../../../../lib/team-ops.js';

const send = r => (r.error ? jsonErr(r.error, r.status) : jsonOk(r.data, r.status));

export const prerender = false;

export async function GET(context) {
  const db = getDb(context);
  if (!db) return jsonErr('Database unavailable', 503);

  const { results } = await db
    .prepare('SELECT * FROM schedule_items ORDER BY start_date ASC')
    .all();
  return jsonOk({ items: results });
}

export async function POST(context) {
  const db = getDb(context);
  if (!db) return jsonErr('Database unavailable', 503);
  let body;
  try { body = await context.request.json(); }
  catch { return jsonErr('Invalid request body', 400); }
  return send(await createScheduleItem(db, getActor(context.request), body));
}
