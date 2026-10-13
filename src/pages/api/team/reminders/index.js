// GET  /api/team/reminders[?date=YYYY-MM-DD] — preview the digest for today (or any date) as HTML;
//      nothing is sent.
// POST /api/team/reminders — send today's digest now (ignores the once-a-day guard).
// Leads only (src/middleware.js). The daily send is the cron in worker/gate.js.

import { getDb, jsonOk, jsonErr } from '../../../../lib/ops-db.js';
import { buildReminders, renderDigest, runReminders } from '../../../../lib/reminders.js';

export const prerender = false;

export async function GET(context) {
  const db = getDb(context);
  if (!db) return jsonErr('Database unavailable', 503);
  const q = new URL(context.request.url).searchParams.get('date');
  const date = q && /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : undefined;
  const reminders = await buildReminders(db, date);
  const { subject, html } = renderDigest(reminders, date);
  const note = reminders.urgent.length
    ? `<p style="font:14px -apple-system,Arial,sans-serif;background:#fff5d6;padding:8px 12px">Preview only. Subject: <strong>${subject}</strong>. To: the leads.</p>`
    : `<p style="font:14px -apple-system,Arial,sans-serif;background:#e9f6ea;padding:8px 12px">Nothing time-critical today, so no email would be sent.</p>`;
  return new Response(`<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><title>Reminder preview</title><body style="margin:24px">${note}${html}</body>`, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

export async function POST(context) {
  const env = context.locals.runtime?.env ?? {};
  const result = await runReminders(env, { force: true });
  console.log('reminders send-now', JSON.stringify({ sent: result.sent, reason: result.reason, subject: result.subject }));
  return result.sent ? jsonOk({ sent: true, subject: result.subject }) : jsonErr(result.reason, 400);
}
