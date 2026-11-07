// POST /api/team/comments/:id/reply — { message, cta: 'story'|'poll'|'join'|'thanks', adult_ok? } sends a reply to a
// comment. Public and hard to undo, so a person sends each one. Leads and community managers.

import { getActor, jsonOk, jsonErr } from '../../../../../lib/ops-db.js';
import { replyToComment } from '../../../../../lib/comments.js';

export const prerender = false;

export async function POST(context) {
  const env = context.locals.runtime?.env ?? {};
  if (!env.OPS_DB) return jsonErr('Database unavailable', 503);
  const id = Number(context.params.id);
  if (!Number.isInteger(id)) return jsonErr('Invalid id', 400);
  let body;
  try { body = await context.request.json(); } catch { return jsonErr('Invalid request body', 400); }
  const r = await replyToComment(env, getActor(context.request), id, body);
  return r.error ? jsonErr(r.error, r.status) : jsonOk(r.data);
}
