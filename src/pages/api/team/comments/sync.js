// POST /api/team/comments/sync — read the latest comments from Facebook and Instagram now (the daily cron
// does the same). Returns counts only.

import { getDb, getActor, logActivity, jsonOk, jsonErr } from '../../../../lib/ops-db.js';
import { syncComments } from '../../../../lib/comments.js';

export const prerender = false;

export async function POST(context) {
  const env = context.locals.runtime?.env ?? {};
  const r = await syncComments(env);
  if (!r.ok) return jsonErr(r.reason, 503);
  const db = getDb(context);
  if (db) await logActivity(db, getActor(context.request), 'synced social comments', `${r.read} read, ${r.removed} removed, ${r.purged} past retention`).catch(() => {});
  return jsonOk(r);
}
