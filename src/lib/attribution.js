// Campaign attribution without cookies or device storage. Every outbound and share link carries
// UTM tags (hard rule 6); this counts what those links lead to:
//  - visits: a page opened with utm_source (counted in worker/gate.js);
//  - actions: sign-up, venue vote, survey, check-in, story, WhatsApp click, credited to the UTM tags
//    on the page the action happened on (read from the request's Referer, or the page URL).
// Only daily totals per source/medium/campaign are stored (D1 `attribution`). Limitation: an
// action is only credited if it happens on the page the tracked link opened.

import { ukToday } from './dates.js';

export const KINDS = ['visit', 'signup', 'vote', 'survey', 'checkin', 'story', 'whatsapp'];

const clean = v => (typeof v === 'string' ? v.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) : '');

/** UTM tags from a URL string, or null if it has no utm_source. */
export function utmFrom(urlString) {
  try {
    const p = new URL(urlString).searchParams;
    const source = clean(p.get('utm_source'));
    if (!source) return null;
    return { source, medium: clean(p.get('utm_medium')), campaign: clean(p.get('utm_campaign')) };
  } catch {
    return null;
  }
}

/** UTM tags of the page an action came from: same-site Referer first, then the request URL. */
export function utmFromRequest(request) {
  const ref = request.headers.get('Referer');
  if (ref) {
    try {
      if (new URL(ref).host === new URL(request.url).host) return utmFrom(ref);
    } catch { /* ignore */ }
  }
  return utmFrom(request.url);
}

export const isBot = request => /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp\/|curl|wget|python|headless/i.test(request.headers.get('User-Agent') || '');

/** Add one to today's count. Actions without tags are counted as '(direct)'; visits need tags. */
export async function record(db, kind, utm) {
  if (!db || !KINDS.includes(kind)) return;
  if (kind === 'visit' && !utm) return;
  const u = utm ?? { source: '(direct)', medium: '', campaign: '' };
  await db
    .prepare(`INSERT INTO attribution (day, kind, source, medium, campaign, n) VALUES (?, ?, ?, ?, ?, 1)
              ON CONFLICT(day, kind, source, medium, campaign) DO UPDATE SET n = n + 1`)
    .bind(ukToday(), kind, u.source, u.medium, u.campaign)
    .run()
    .catch(() => {});
}

/** Record an action from inside an Astro API route without slowing the response. */
export function recordAction(context, kind) {
  const env = context.locals.runtime?.env ?? {};
  if (isBot(context.request)) return;
  const p = record(env.OPS_DB, kind, utmFromRequest(context.request));
  const wait = context.locals.runtime?.ctx?.waitUntil;
  if (wait) wait(p); else return p;
}
