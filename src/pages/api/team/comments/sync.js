// POST /api/team/comments/sync — read the latest comments from Facebook and Instagram now (the daily cron
// does the same). Returns counts only.

import { getActor, jsonOk, jsonErr } from '../../../../lib/ops-db.js';
import { syncComments } from '../../../../lib/comments.js';

export const prerender = false;

export async function POST(context) {
  const env = context.locals.runtime?.env ?? {};
  const r = await syncComments(env, new Date(), getActor(context.request));
  if (!r.ok) return jsonErr(r.reason, 503);
  return jsonOk(r);
}
