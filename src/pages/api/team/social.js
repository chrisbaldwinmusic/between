// Facebook Page + Instagram for the team (src/lib/meta.js). Leads and the community managers
// (Chris, Dan, Vikki, Emma) only: see src/lib/team-access.js.
//
// GET  /api/team/social?view=status|overview|fb_posts|ig_media|fb_comments|ig_comments[&id=...]
// POST /api/team/social  { action: 'publish_facebook'|'publish_instagram'|'reply'|'hide', ..., confirm }
//      Without confirm: true a POST only returns a preview. Every real send goes in the activity log.

import { getDb, getActor, logActivity, jsonOk, jsonErr } from '../../../lib/ops-db.js';
import { metaClient, metaOps, MetaError } from '../../../lib/meta.js';

export const prerender = false;

const ops = context => metaOps(metaClient(context.locals.runtime?.env ?? {}));
const fail = err => (err instanceof MetaError ? jsonErr(err.message, err.status) : jsonErr('Unexpected error talking to Meta.', 500));

export async function GET(context) {
  const q = new URL(context.request.url).searchParams;
  const id = q.get('id');
  try {
    const o = ops(context);
    switch (q.get('view') || 'overview') {
      case 'status': return jsonOk(await o.status());
      case 'overview': {
        const [fb, ig] = await Promise.allSettled([o.fbPage(), o.igAccount()]);
        return jsonOk({
          status: await o.status(),
          facebook: fb.status === 'fulfilled' ? fb.value : { error: fb.reason?.message },
          instagram: ig.status === 'fulfilled' ? ig.value : { error: ig.reason?.message },
        });
      }
      case 'fb_posts': return jsonOk(await o.fbPosts({ limit: 15, scheduled: q.get('scheduled') === '1' }));
      case 'ig_media': return jsonOk(await o.igMedia({ limit: 15 }));
      case 'fb_comments': return jsonOk(await o.fbComments({ id }));
      case 'ig_comments': return jsonOk(await o.igComments({ id }));
      default: return jsonErr('Unknown view', 400);
    }
  } catch (err) { return fail(err); }
}

const LOG = {
  publish_facebook: b => (b.schedule_at ? 'scheduled a Facebook post' : 'published a Facebook post'),
  publish_instagram: () => 'published an Instagram post',
  reply: b => `replied to a comment on ${b.platform}`,
  hide: b => `${b.hidden ? 'hid' : 'unhid'} a comment on ${b.platform}`,
};

export async function POST(context) {
  let b;
  try { b = await context.request.json(); } catch { return jsonErr('Invalid request body', 400); }
  const o = ops(context);
  const run = { publish_facebook: o.publishFacebook, publish_instagram: o.publishInstagram, reply: o.reply, hide: o.hide }[b.action];
  if (!run) return jsonErr('Unknown action', 400);
  try {
    const r = await run({ ...b, confirm: b.confirm === true });
    const db = getDb(context);
    if (r.sent && db) await logActivity(db, getActor(context.request), LOG[b.action](b), null).catch(() => {});
    return jsonOk(r);
  } catch (err) { return fail(err); }
}
