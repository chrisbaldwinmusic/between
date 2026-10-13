// GET  /api/team/reminders[?audience=leads|community][&date=YYYY-MM-DD] — preview an email as HTML
//      for today or any date; nothing is sent.
// POST /api/team/reminders[?audience=leads|community] — send that email now (ignores the
//      once-a-day guard; on a quiet day it sends a labelled test).
// Leads only (src/middleware.js). The daily send is the cron / first-request fallback in worker/gate.js.

import { getDb, jsonOk, jsonErr } from '../../../../lib/ops-db.js';
import { buildReminders, buildCommunityReminders, renderDigest, runAudience } from '../../../../lib/reminders.js';
import { LEADS } from '../../../../lib/team-access.js';

export const prerender = false;

const audienceOf = url => (new URL(url).searchParams.get('audience') === 'community' ? 'community' : 'leads');

export async function GET(context) {
  const db = getDb(context);
  if (!db) return jsonErr('Database unavailable', 503);
  const url = new URL(context.request.url);
  const audience = audienceOf(context.request.url);
  const q = url.searchParams.get('date');
  const date = q && /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : undefined;

  const built = audience === 'community' ? await buildCommunityReminders(db, date) : await buildReminders(db, date);
  const to = audience === 'community' ? built.recipients : LEADS;
  const { subject, html } = renderDigest(built, date, audience);
  const other = audience === 'community' ? 'leads' : 'community';
  const note = built.urgent.length
    ? `<p style="font:14px -apple-system,Arial,sans-serif;background:#fff5d6;padding:8px 12px">Preview only. Subject: <strong>${subject}</strong>. To: ${to.join(', ') || '(no recipients)'}.</p>`
    : `<p style="font:14px -apple-system,Arial,sans-serif;background:#e9f6ea;padding:8px 12px">Nothing time-critical${date ? ` on ${date}` : ' today'}, so no email would be sent to ${audience === 'community' ? 'the community managers' : 'the leads'}.</p>`;
  const nav = `<p style="font:13px -apple-system,Arial,sans-serif"><a href="?audience=${other}${date ? `&date=${date}` : ''}">Preview the ${other === 'community' ? 'community managers' : 'leads'}' email instead</a></p>`;
  return new Response(`<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><title>Reminder preview</title><body style="margin:24px">${note}${nav}${html}</body>`, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

export async function POST(context) {
  const env = context.locals.runtime?.env ?? {};
  const audience = audienceOf(context.request.url);
  const result = await runAudience(env, audience, { force: true });
  console.log('reminders send-now', JSON.stringify({ audience, sent: result.sent, reason: result.reason, subject: result.subject }));
  return result.sent ? jsonOk({ sent: true, subject: result.subject, to: result.to }) : jsonErr(result.reason, 400);
}
