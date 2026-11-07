// GET /api/team/comments[?status=new|reviewed|all&event=slug] — the comment inbox and its counts.
// Leads and the community managers (src/lib/team-access.js). Comments carry no names (src/lib/comments.js).

import { getDb, jsonOk, jsonErr } from '../../../lib/ops-db.js';
import { commentSummary } from '../../../lib/comments.js';

export const prerender = false;

export async function GET(context) {
  const db = getDb(context);
  if (!db) return jsonErr('Database unavailable', 503);
  const q = new URL(context.request.url).searchParams;
  const status = ['new', 'reviewed'].includes(q.get('status')) ? q.get('status') : null;
  const event = q.get('event');
  const where = [`status != 'excluded'`];
  const args = [];
  if (status) { where.push('status = ?'); args.push(status); }
  if (event) { where.push(event === 'none' ? 'event_slug IS NULL' : 'event_slug = ?'); if (event !== 'none') args.push(event); }
  const { results } = await db
    .prepare(`SELECT id, platform, post_url, text, posted_at, likes, event_slug, themes, suggested_themes, status, ask_to_share, quote_ok, replied_at, replied_cta
              FROM social_comments WHERE ${where.join(' AND ')} ORDER BY posted_at DESC LIMIT 200`)
    .bind(...args).all();
  return jsonOk({ comments: results, summary: await commentSummary(db) });
}
