// Entry worker in front of the Astro worker (wrangler `main`). With `assets.run_worker_first`,
// every request comes through here before Astro serves a page or file.
//
//  - The site is public: there is no preview PIN any more.
//  - /team and /api/team are protected by Cloudflare Access (sonicboom.org.uk accounts), not by
//    this worker. See DEPLOY.md §5a.
//  - Tracked (UTM) page visits are counted here, and the daily reminder cron runs from here.

import astro from '../dist/_worker.js/index.js';
import { runReminders } from '../src/lib/reminders.js';
import { utmFrom, record, isBot } from '../src/lib/attribution.js';

export default {
  // Daily cron (wrangler.toml, 07:00 UTC): the leads' and community managers' reminder emails.
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runReminders(env).then(r => console.log('reminders', r.sent, r.reason ?? r.subject)));
  },

  async fetch(request, env, ctx) {
    countTrackedVisit(request, env, ctx);
    return astro.fetch(request, env, ctx);
  },
};

// A page opened through a tracked (UTM) link counts as a visit for that source/campaign. Counts
// only (src/lib/attribution.js): no cookies, nothing stored on the device.
function countTrackedVisit(request, env, ctx) {
  if (request.method !== 'GET' || !(request.headers.get('Accept') || '').includes('text/html') || isBot(request)) return;
  const utm = utmFrom(request.url);
  if (utm) ctx.waitUntil(record(env.OPS_DB, 'visit', utm));
}
