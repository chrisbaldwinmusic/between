// Facebook Page + Instagram tools for the team MCP server. The Graph client and the rules for
// writes live in src/lib/meta.js (shared with the /team/social page); see its header for setup.
//
//   Reads   community managers and leads: page/IG info, posts, comments, insights, mentions
//   Writes  community managers and leads (Vikki, Emma, Chris, Dan): publish, reply, hide/unhide.
//           Each needs confirm: true (otherwise a preview is returned and nothing is sent), and
//           each real send is recorded in the activity log. No deletes.
//   meta_graph_get  leads only: read-only escape hatch for any other Graph edge/field.

import { z } from 'zod';
import { metaClient, metaOps, MetaError } from '../src/lib/meta.js';
import { logActivity } from '../src/lib/ops-db.js';

const text = data => ({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] });
const fail = msg => ({ isError: true, content: [{ type: 'text', text: msg }] });
const run = fn => async args => {
  try { return text(await fn(args)); }
  catch (err) { return fail(err instanceof MetaError ? err.message : 'Unexpected error talking to Meta.'); }
};

export function registerMetaTools(server, { env, db, email, lead, community, fetchImpl }) {
  if (!community) return; // plain team members get no Meta tools
  const m = metaClient(env, fetchImpl);
  const ops = metaOps(m);
  const read = { readOnlyHint: true, openWorldHint: true };
  const limit = z.number().int().min(1).max(50).default(10);
  const id = z.string().regex(/^[0-9_]+$/);
  const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
  const metricList = z.array(z.string().regex(/^[a-z_]+$/)).max(10).optional();

  server.registerTool('meta_status', {
    description: 'Is Meta (Facebook + Instagram) connected, which Page / Instagram account, and what the token belongs to. Start here.',
    annotations: read,
  }, run(() => ops.status()));

  // ── Facebook Page ────────────────────────────────────────────────────────
  server.registerTool('fb_page_info', { description: 'Facebook Page basics: name, about, followers, likes, website, linked Instagram account.', annotations: read }, run(() => ops.fbPage()));
  server.registerTool('fb_posts', {
    description: 'Recent Facebook Page posts with reaction, comment and share counts. scheduled: true lists scheduled/unpublished posts.',
    inputSchema: { limit, scheduled: z.boolean().default(false) }, annotations: read,
  }, run(args => ops.fbPosts(args)));
  server.registerTool('fb_page_insights', {
    description: 'Facebook Page insights over a period (defaults: unique reach, engagements, follows, unfollows).',
    inputSchema: { metrics: metricList, period: z.enum(['day', 'week', 'days_28']).default('days_28') }, annotations: read,
  }, run(({ metrics, period }) => m.get(`${m.pageId()}/insights`, {
    metric: (metrics?.length ? metrics : ['page_impressions_unique', 'page_post_engagements', 'page_daily_follows', 'page_daily_unfollows_unique']).join(','), period,
  })));
  server.registerTool('fb_post_insights', {
    description: 'Insights for one Facebook post: reach, clicks, reactions.', inputSchema: { post_id: id }, annotations: read,
  }, run(({ post_id }) => m.get(`${post_id}/insights`, { metric: 'post_impressions_unique,post_clicks,post_reactions_by_type_total' })));
  server.registerTool('fb_comments', {
    description: 'Comments on a Facebook post, newest first.', inputSchema: { post_id: id, limit }, annotations: read,
  }, run(({ post_id, limit: n }) => ops.fbComments({ id: post_id, limit: n })));
  server.registerTool('fb_page_mentions', {
    description: 'Posts where other people have tagged the Facebook Page.', inputSchema: { limit }, annotations: read,
  }, run(({ limit: n }) => m.get(`${m.pageId()}/tagged`, { limit: n, fields: 'id,message,created_time,from,permalink_url' })));

  // ── Instagram ────────────────────────────────────────────────────────────
  server.registerTool('ig_account', { description: 'Instagram account basics: username, bio, followers, following, media count.', annotations: read }, run(() => ops.igAccount()));
  server.registerTool('ig_media', {
    description: 'Recent Instagram posts, reels and carousels with likes, comments and links.', inputSchema: { limit }, annotations: read,
  }, run(args => ops.igMedia(args)));
  server.registerTool('ig_stories', { description: 'Instagram Stories live right now (last 24 hours).', annotations: read },
    run(() => m.get(`${m.igId()}/stories`, { fields: 'id,media_type,permalink,timestamp' })));
  server.registerTool('ig_media_insights', {
    description: 'Insights for one Instagram post or reel: reach, saves, shares, interactions, views.', inputSchema: { media_id: id }, annotations: read,
  }, run(({ media_id }) => m.get(`${media_id}/insights`, { metric: 'reach,saved,shares,total_interactions,views' })));
  server.registerTool('ig_account_insights', {
    description: 'Instagram account insights (reach, views, profile visits, accounts engaged, follower change).',
    inputSchema: { metrics: metricList, period: z.enum(['day', 'week', 'days_28']).default('day'), since: day.optional(), until: day.optional() }, annotations: read,
  }, run(({ metrics, period, since, until }) => m.get(`${m.igId()}/insights`, {
    metric: (metrics?.length ? metrics : ['reach', 'views', 'profile_views', 'accounts_engaged', 'follower_count']).join(','),
    period, metric_type: 'total_value', since, until,
  })));
  server.registerTool('ig_audience', {
    description: 'Instagram follower demographics as aggregates (age, gender, city, country). Needs 100+ followers.',
    inputSchema: { breakdown: z.enum(['age', 'gender', 'city', 'country']).default('city') }, annotations: read,
  }, run(({ breakdown }) => m.get(`${m.igId()}/insights`, { metric: 'follower_demographics', period: 'lifetime', metric_type: 'total_value', timeframe: 'last_30_days', breakdown })));
  server.registerTool('ig_comments', {
    description: 'Comments on an Instagram post, with replies.', inputSchema: { media_id: id, limit }, annotations: read,
  }, run(({ media_id, limit: n }) => ops.igComments({ id: media_id, limit: n })));
  server.registerTool('ig_mentions', {
    description: 'Instagram posts that tag the account: useful for finding stories to share, with permission.', inputSchema: { limit }, annotations: read,
  }, run(({ limit: n }) => m.get(`${m.igId()}/tags`, { limit: n, fields: 'id,caption,media_type,permalink,timestamp,username' })));
  server.registerTool('ig_publishing_limit', {
    description: 'How many Instagram posts can still be published in the rolling 24 hours.', annotations: read,
  }, run(() => m.get(`${m.igId()}/content_publishing_limit`, { fields: 'quota_usage,config' })));

  if (lead) {
    server.registerTool('meta_graph_get', {
      description: 'Read-only escape hatch: GET any Graph API edge or node the token can see, e.g. path "me/accounts". Cannot write.',
      inputSchema: { path: z.string().regex(/^[A-Za-z0-9_./-]+$/), fields: z.string().regex(/^[A-Za-z0-9_,.(){}:]+$/).optional(), params: z.record(z.string(), z.string()).optional() },
      annotations: read,
    }, run(({ path, fields, params }) => m.get(path, { ...params, fields })));
  }

  // ── Writes (community managers and leads) ────────────────────────────────
  const write = { readOnlyHint: false, destructiveHint: false, openWorldHint: true };
  const confirm = z.boolean().default(false).describe('Must be true to actually send. Leave false to preview.');
  const logged = (what, fn) => run(async args => {
    const r = await fn(args);
    if (r.sent && db) await logActivity(db, email, what(args), null).catch(() => {});
    return r;
  });

  server.registerTool('fb_publish_post', {
    description: 'Publish, or schedule, a post on the Facebook Page. Tone: warm, local, Burton; write Sonic Boom Music CIC in full; never imply the permanent venue is confirmed; only share a story marked OK for social media. Links must carry UTMs. Preview unless confirm: true.',
    inputSchema: { message: z.string().min(1).max(5000), link: z.string().url().optional(), schedule_at: z.string().datetime().optional().describe('ISO time at least 10 minutes ahead; omit to publish now'), confirm },
    annotations: write,
  }, logged(a => (a.schedule_at ? 'scheduled a Facebook post' : 'published a Facebook post'), a => ops.publishFacebook({ ...a, confirm: a.confirm })));

  server.registerTool('ig_publish_image', {
    description: 'Publish a single image to Instagram from a public https JPEG URL. alt_text is required. Caption links are not clickable, but any URL must still carry UTMs. Preview unless confirm: true.',
    inputSchema: { image_url: z.string().url(), caption: z.string().max(2200).default(''), alt_text: z.string().max(1000), confirm },
    annotations: write,
  }, logged(() => 'published an Instagram post', a => ops.publishInstagram(a)));

  for (const [name, platform] of [['fb_reply_comment', 'facebook'], ['ig_reply_comment', 'instagram']]) {
    server.registerTool(name, {
      description: `Reply publicly to a comment on ${platform === 'facebook' ? 'the Facebook Page' : 'Instagram'}. Preview unless confirm: true.`,
      inputSchema: { comment_id: id, message: z.string().min(1).max(2200), confirm }, annotations: write,
    }, logged(() => `replied to a comment on ${platform}`, a => ops.reply({ ...a, platform })));
  }
  for (const [name, platform] of [['fb_hide_comment', 'facebook'], ['ig_hide_comment', 'instagram']]) {
    server.registerTool(name, {
      description: 'Hide or unhide a comment (reversible; not a delete). Preview unless confirm: true.',
      inputSchema: { comment_id: id, hidden: z.boolean(), confirm }, annotations: { ...write, idempotentHint: true },
    }, logged(a => `${a.hidden ? 'hid' : 'unhid'} a comment on ${platform}`, a => ops.hide({ ...a, platform })));
  }
}
