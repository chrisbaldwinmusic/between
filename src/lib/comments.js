// Public comments on our own Facebook and Instagram posts: read through the Meta connection
// (src/lib/meta.js), kept for counting themes and spotting story leads. Rules (see /privacy):
//
//  - We never request or store who wrote a comment: no username, profile name or commenter id.
//  - We keep the comment's platform id only to notice when it is deleted (then our copy goes too).
//  - Copies are deleted 12 months after they were posted.
//  - Tags are applied by people, never guessed. Nothing here quotes or publishes a comment.
//  - "Don't use" blanks the text, so a sync can't bring it back.

import events from '../data/events.json';
import { metaClient, metaOps, MetaError } from './meta.js';
import { logActivity } from './ops-db.js';

export const RETENTION_MONTHS = 12;
const POSTS = 25;          // most recent posts per platform to read comments from
const PAGE = 100;          // comments per request
const MAX_PAGES = 3;       // 300 comments a post is plenty; beyond that we don't treat the post as fully read
const RECHECK = 40;        // older comments re-checked per run, to notice deletions

export const THEMES = [
  ['first_time', 'First time at an event'],
  ['family', 'Families'],
  ['young_people', 'Young people'],
  ['not_a_fan', "Wouldn't call themselves a music fan"],
  ['venue_demand', 'Wants a venue'],
  ['community', 'Community, belonging'],
  ['praise', 'Praise'],
  ['concern', 'Concern or something to fix'],
];
const THEME_KEYS = THEMES.map(([k]) => k);
export const themeLabel = k => THEMES.find(([key]) => key === k)?.[1] ?? k;

// Meta sends "2026-10-23T19:32:01+0000"; store UTC as 'YYYY-MM-DD HH:MM:SS' like the rest of the database.
export function toDbTime(iso) {
  const d = new Date(String(iso).replace(/([+-]\d\d)(\d\d)$/, '$1:$2'));
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 19).replace('T', ' ');
}
export function cutoff(now = new Date(), months = RETENTION_MONTHS) {
  const d = new Date(now);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}
// Names inside the text: other people's @handles, emails, phone numbers and links are replaced before a
// comment is stored (the wording otherwise stays as written). The rest of the words can still identify
// someone, which is why quoting needs agreement.
export function redact(text = '') {
  return String(text)
    .replace(/https?:\/\/\S+/gi, '[link]')
    .replace(/[^\s@]+@[^\s@]+\.[^\s@.,;:!?)]+/g, '[email]')
    .replace(/(?<![\w@])@[\w.]*\w/g, '@[someone]')
    .replace(/(?<![\w.])\+?\d[\d\s().-]{8,}\d(?![\w])/g, '[number]');
}

// Which event a post is about: the first event whose name appears in the post text. Editable in the inbox.
export function guessEvent(text = '') {
  const t = text.toLowerCase();
  return events.find(e => e.name && t.includes(e.name.toLowerCase()))?.slug ?? null;
}
const gone = err => err instanceof MetaError && /code (100|803)\b|does not exist|unsupported get request/i.test(err.message);

// `own` says who we are ({ facebook: page id, instagram: our username }) so our own comments (like the
// prompt "Tell us what you want from a venue") aren't counted as audience. The author is compared in memory
// and thrown away: it is never stored.
async function allComments(m, platform, postId, own = {}) {
  const fields = platform === 'facebook'
    ? 'id,message,created_time,like_count,is_hidden,from{id}'
    : 'id,text,timestamp,like_count,hidden,username';
  const out = [];
  let after;
  for (let i = 0; i < MAX_PAGES; i++) {
    const r = await m.get(`${postId}/comments`, { limit: PAGE, fields, after });
    for (const c of r.data ?? []) {
      if (c.is_hidden || c.hidden) continue;              // hidden by us (e.g. abusive): not kept
      if (platform === 'facebook' ? (own.facebook && c.from?.id === own.facebook) : (own.instagram && c.username?.toLowerCase() === own.instagram)) continue;
      const text = redact((platform === 'facebook' ? c.message : c.text) ?? '').trim();
      const at = toDbTime(platform === 'facebook' ? c.created_time : c.timestamp);
      if (c.id && text && at) out.push({ id: String(c.id), text, at, likes: c.like_count ?? 0 });
    }
    if (!r.paging?.next || !r.paging?.cursors?.after) return { comments: out, complete: true };
    after = r.paging.cursors.after;
  }
  return { comments: out, complete: false };
}

// Read recent comments, drop copies that were deleted on the platform or are past retention.
export async function syncComments(env, now = new Date(), actor = 'daily refresh') {
  const db = env.OPS_DB;
  const m = metaClient(env);
  if (!db) return { ok: false, reason: 'Database unavailable.' };
  if (!m.configured) return { ok: false, reason: 'Meta is not connected yet.' };
  const started = now.toISOString().slice(0, 19).replace('T', ' ');
  const min = cutoff(now);
  const stats = { ok: true, posts: 0, read: 0, removed: 0, purged: 0, rechecked: 0, errors: [] };

  const own = { facebook: m.ids.page, instagram: null };
  try { own.instagram = (await m.get(m.igId(), { fields: 'username' })).username?.toLowerCase() ?? null; }
  catch (err) { stats.errors.push(`Instagram username: ${err.message}`); }
  const posts = [];
  const [fb, ig] = await Promise.allSettled([
    m.get(`${m.pageId()}/posts`, { limit: POSTS, fields: 'id,message,permalink_url,comments.summary(true).limit(0)' }),
    m.get(`${m.igId()}/media`, { limit: POSTS, fields: 'id,caption,permalink,comments_count' }),
  ]);
  if (fb.status === 'fulfilled') for (const p of fb.value.data ?? []) posts.push({ platform: 'facebook', id: p.id, url: p.permalink_url, text: p.message, count: p.comments?.summary?.total_count ?? 0 });
  else stats.errors.push(`Facebook: ${fb.reason?.message}`);
  if (ig.status === 'fulfilled') for (const p of ig.value.data ?? []) posts.push({ platform: 'instagram', id: p.id, url: p.permalink, text: p.caption, count: p.comments_count ?? 0 });
  else stats.errors.push(`Instagram: ${ig.reason?.message}`);

  for (const post of posts) {
    try {
      // Instagram's count is reliable. Facebook reports 0 when the token lacks permission to see comments, so always ask it.
      const skip = post.platform === 'instagram' && post.count === 0;
      const { comments, complete } = skip ? { comments: [], complete: true } : await allComments(m, post.platform, post.id, own);
      stats.posts++;
      const slug = guessEvent(post.text);
      const writes = comments.filter(c => c.at >= min).map(c => db
        .prepare(`INSERT INTO social_comments (platform, platform_id, post_id, post_url, text, posted_at, likes, event_slug, synced_at, checked_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT(platform_id) DO UPDATE SET likes = excluded.likes, synced_at = excluded.synced_at, checked_at = excluded.checked_at`)
        .bind(post.platform, c.id, post.id, post.url ?? null, c.text, c.at, c.likes, slug, started, started));
      if (writes.length) await db.batch(writes);
      stats.read += writes.length;
      if (complete) {
        // Anything we hold for this post that Meta no longer returns has been deleted (or hidden): delete ours.
        const { results } = await db.prepare('SELECT platform_id FROM social_comments WHERE platform = ? AND post_id = ?').bind(post.platform, post.id).all();
        const live = new Set(comments.map(c => c.id));
        const dead = results.filter(r => !live.has(r.platform_id));
        if (dead.length) {
          await db.batch(dead.map(r => db.prepare('DELETE FROM social_comments WHERE platform_id = ?').bind(r.platform_id)));
          stats.removed += dead.length;
        }
      }
    } catch (err) { stats.errors.push(`${post.platform} post: ${err.message}`); }
  }

  // Comments on posts outside the window above: ask Meta whether each still exists.
  const { results: stale } = await db.prepare('SELECT platform_id FROM social_comments WHERE checked_at < ? ORDER BY checked_at LIMIT ?').bind(started, RECHECK).all();
  for (const r of stale) {
    try {
      await m.get(r.platform_id, { fields: 'id' });
      await db.prepare('UPDATE social_comments SET checked_at = ? WHERE platform_id = ?').bind(started, r.platform_id).run();
      stats.rechecked++;
    } catch (err) {
      if (gone(err)) { await db.prepare('DELETE FROM social_comments WHERE platform_id = ?').bind(r.platform_id).run(); stats.removed++; }
      else stats.errors.push(`recheck: ${err.message}`);
    }
  }

  const purged = await db.prepare('DELETE FROM social_comments WHERE posted_at < ?').bind(min).run();
  stats.purged = purged.meta?.changes ?? 0;
  stats.by = Object.fromEntries(['facebook', 'instagram'].map(p => [p, { posts: posts.filter(x => x.platform === p).length, comments: 0 }]));
  for (const r of (await db.prepare('SELECT platform, count(*) AS n FROM social_comments GROUP BY platform').all()).results) if (stats.by[r.platform]) stats.by[r.platform].comments = r.n;
  // Saved so the page can always show the latest result, including Meta's error text (no tokens: scrubbed in meta.js).
  const by = p => `${p === 'facebook' ? 'Facebook' : 'Instagram'} ${stats.by[p].posts} posts, ${stats.by[p].comments} comments kept`;
  const detail = `${by('facebook')}; ${by('instagram')}; ${stats.read} read, ${stats.removed} removed, ${stats.purged} past retention`
    + (stats.errors.length ? `. Problems: ${stats.errors.join(' | ')}` : '');
  await logActivity(db, actor, 'synced social comments', detail.slice(0, 900)).catch(() => {});
  return stats;
}

// ── Tagging and summaries ────────────────────────────────────────────────────

const flag = v => (v === true || v === 1 ? 1 : 0);

// body: { themes?, event_slug?, status?: 'new'|'reviewed'|'excluded', ask_to_share?, quote_ok? }
// quote_ok (we may use the words, after the person has agreed) can only be set by a lead.
export async function updateComment(db, actor, id, body, lead) {
  const row = await db.prepare('SELECT * FROM social_comments WHERE id = ?').bind(id).first();
  if (!row) return { error: 'Not found', status: 404 };
  const b = body ?? {};

  if (b.status === 'excluded') {
    await db.prepare(`UPDATE social_comments SET status = 'excluded', text = '', themes = '', suggested_themes = '', ask_to_share = 0, quote_ok = 0,
                      reviewed_at = datetime('now'), reviewed_by = ? WHERE id = ?`).bind(actor, id).run();
    await logActivity(db, actor, `marked a ${row.platform} comment as not to be used`, null).catch(() => {});
    return { data: { ok: true } };
  }
  if (row.status === 'excluded') return { error: 'This comment is marked not to be used.', status: 409 };
  if (b.status !== undefined && !['new', 'reviewed'].includes(b.status)) return { error: 'Invalid status', status: 400 };

  const themes = Array.isArray(b.themes) ? THEME_KEYS.filter(k => b.themes.includes(k)).join(',') : row.themes;
  // Suggestions are guesses until a person saves tags: saving clears them, and only `themes` is ever counted.
  const slug = b.event_slug === undefined ? row.event_slug : (b.event_slug === null || b.event_slug === '' ? null : String(b.event_slug));
  if (slug && !events.some(e => e.slug === slug)) return { error: 'Unknown event', status: 400 };
  const ask = b.ask_to_share === undefined ? row.ask_to_share : flag(b.ask_to_share);
  let quote = row.quote_ok;
  if (b.quote_ok !== undefined) {
    if (!lead) return { error: 'Only a lead can mark a comment as OK to quote.', status: 403 };
    quote = flag(b.quote_ok);
  }
  await db.prepare(`UPDATE social_comments SET themes = ?, suggested_themes = '', event_slug = ?, status = ?, ask_to_share = ?, quote_ok = ?,
                    reviewed_at = datetime('now'), reviewed_by = ? WHERE id = ?`)
    .bind(themes, slug, b.status ?? 'reviewed', ask, quote, actor, id).run();
  return { data: { ok: true } };
}

// A person sends the story-invite reply to a comment they have tagged "worth inviting". One reply per
// comment, and the sender must confirm the commenter sounds like an adult (we never invite anyone who may
// be under 16). Goes through metaOps.reply, so the message must carry UTM links.
export async function replyToComment(env, actor, id, body) {
  const db = env.OPS_DB;
  const b = body ?? {};
  if (b.adult_ok !== true) return { error: 'Confirm the commenter sounds like an adult before replying.', status: 400 };
  const message = typeof b.message === 'string' ? b.message.trim() : '';
  if (!message) return { error: 'Write a reply.', status: 400 };
  const row = await db.prepare('SELECT * FROM social_comments WHERE id = ?').bind(id).first();
  if (!row) return { error: 'Not found', status: 404 };
  if (row.status !== 'reviewed' || !row.ask_to_share || !row.text) return { error: 'Only comments tagged "worth inviting to share their story" can be replied to.', status: 409 };
  // Claim it first so a double click can't send twice; hand it back if Meta refuses.
  const claim = await db.prepare(`UPDATE social_comments SET replied_at = datetime('now') WHERE id = ? AND replied_at IS NULL`).bind(id).run();
  if (!claim.meta?.changes) return { error: 'This comment has already had a reply.', status: 409 };
  try {
    const r = await metaOps(metaClient(env)).reply({ platform: row.platform, comment_id: row.platform_id, message, confirm: true });
    if (!r.sent) throw new MetaError('Meta did not send the reply.', 502);
  } catch (err) {
    await db.prepare('UPDATE social_comments SET replied_at = NULL WHERE id = ?').bind(id).run();
    return { error: err instanceof MetaError ? err.message : 'Could not send the reply.', status: err.status ?? 500 };
  }
  await logActivity(db, actor, `replied to a ${row.platform} comment with a story invitation`, null).catch(() => {});
  return { data: { ok: true } };
}

// Counts only: how many comments carry each theme, overall and per event. No text, nothing personal.
export async function commentSummary(db) {
  const { results } = await db.prepare(`SELECT platform, event_slug, themes, status, ask_to_share FROM social_comments WHERE status != 'excluded'`).all();
  const byTheme = Object.fromEntries(THEME_KEYS.map(k => [k, 0]));
  const byEvent = {};
  for (const r of results) {
    const e = (byEvent[r.event_slug ?? ''] ??= { total: 0, themes: Object.fromEntries(THEME_KEYS.map(k => [k, 0])) });
    e.total++;
    for (const k of r.themes ? r.themes.split(',') : []) if (k in byTheme) { byTheme[k]++; e.themes[k]++; }
  }
  const last = await db.prepare('SELECT max(synced_at) AS t FROM social_comments').first();
  return {
    total: results.length,
    waiting: results.filter(r => r.status === 'new').length,
    story_leads: results.filter(r => r.ask_to_share).length,
    byTheme, byEvent, lastSync: last?.t ?? null,
  };
}
