// Daily reminder digest for the project leads, sent by the Worker's cron trigger (worker/gate.js)
// through Resend, the same provider and verified sonicboom.org.uk domain as the shared mailer.
// It only sends when something is time-critical today; otherwise it stays quiet.

import events from '../data/events.json';
import { ukToday, addDays } from './dates.js';
import { surveyDue, longDate } from './feedback.js';
import { LEADS } from './team-access.js';

const SITE = 'https://between.sonicboom.org.uk';
const FROM = 'Between Ops <hello@sonicboom.org.uk>';

const monthName = m => new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/**
 * Work out today's reminders. Returns { urgent: [], outstanding: [] }; each item is
 * { text, link? }. "urgent" items are what make the email worth sending today.
 */
export async function buildReminders(db, today = ukToday()) {
  const urgent = [];
  const outstanding = [];

  const [evalRes, schedRes, communityRes, storiesRes] = await Promise.all([
    db.prepare('SELECT * FROM eval_events').all(),
    db.prepare('SELECT * FROM schedule_items ORDER BY start_date').all(),
    db.prepare('SELECT month FROM community_counts').all(),
    db.prepare(`SELECT created_at FROM stories WHERE status = 'new'`).all().catch(() => ({ results: [] })),
  ]);
  const evalBySlug = new Map(evalRes.results.map(r => [r.event_slug, r]));

  // ── Events ───────────────────────────────────────────────────────────────
  for (const e of events) {
    const row = evalBySlug.get(e.slug) ?? {};
    const qr = e.ticketing === 'free'
      ? `QR posters for the survey and check-in: ${SITE}/team/evaluation/qr?e=${e.slug}&t=checkin`
      : `Survey QR poster: ${SITE}/team/evaluation/qr?e=${e.slug}&t=survey`;

    if (e.date === addDays(today, 1)) {
      urgent.push({ text: `${e.name} is tomorrow at ${e.venue}. Print and pack the QR posters, and gather stories on the night (with permission).`, link: qr });
    }
    if (e.date === today) {
      urgent.push({
        text: `${e.name} is today. The survey${e.ticketing === 'free' ? ' and QR check-in are' : ' is'} now live.`,
        link: `${SITE}/feedback/${e.slug}`,
      });
    }

    if (e.date < today) {
      const due = surveyDue(e);
      if (!row.survey_sent_on) {
        const item = {
          text: today <= due
            ? `Send the ${e.name} survey to ticket holders and attendees by ${longDate(due)} (within 48 hours).`
            : `The ${e.name} survey is overdue (was due ${longDate(due)}). Send it and mark it sent.`,
          link: `${SITE}/team/evaluation`,
        };
        // Nag daily for the first week, then it sits in "still outstanding".
        (today <= addDays(due, 5) ? urgent : outstanding).push(item);
      }
      if (!row.debrief_on) {
        const item = { text: `Hold the ${e.name} delivery-team debrief and log it.`, link: `${SITE}/team/evaluation` };
        (today === addDays(e.date, 3) ? urgent : outstanding).push(item);
      }
      if (row.attendance == null) {
        outstanding.push({ text: `Add attendance for ${e.name} (${e.ticketing === 'free' ? 'headcount' : 'box-office export'}).`, link: `${SITE}/team/evaluation` });
      }
    }
  }

  // ── Schedule ─────────────────────────────────────────────────────────────
  for (const s of schedRes.results) {
    if (s.status_override === 'done') continue;
    const isReview = /review/i.test(s.task);
    if (isReview && s.start_date === addDays(today, 7)) {
      urgent.push({ text: `${s.task} starts in a week (${longDate(s.start_date)}).`, link: `${SITE}/team/schedule` });
    } else if (s.start_date === today) {
      urgent.push({ text: `Starting today: ${s.task}${s.owner ? ` (${s.owner})` : ''}.`, link: `${SITE}/team/schedule` });
    }
  }

  // ── Monthly community numbers (Sep 2026 to Sep 2027) ─────────────────────
  const lastMonth = addDays(`${today.slice(0, 7)}-01`, -1).slice(0, 7);
  const recorded = new Set(communityRes.results.map(r => r.month));
  if (lastMonth >= '2026-09' && lastMonth <= '2027-09' && !recorded.has(lastMonth)) {
    const day = Number(today.slice(8));
    const item = { text: `Record ${monthName(lastMonth)}'s community numbers (WhatsApp, email, Instagram, Facebook, TikTok).`, link: `${SITE}/team/evaluation` };
    (day === 1 || day === 7 ? urgent : outstanding).push(item);
  }

  // ── Stories waiting for review ───────────────────────────────────────────
  const waiting = storiesRes.results;
  if (waiting.length) {
    const fresh = waiting.some(s => s.created_at.slice(0, 10) >= addDays(today, -1));
    const item = { text: `${waiting.length} ${waiting.length === 1 ? 'story is' : 'stories are'} waiting for review.`, link: `${SITE}/team/stories` };
    (fresh ? urgent : outstanding).push(item);
  }

  return { urgent, outstanding };
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function renderDigest({ urgent, outstanding }, today = ukToday()) {
  const subject = `Between: ${urgent.length} thing${urgent.length === 1 ? '' : 's'} for ${longDate(today)}`;
  const li = i => `<li style="margin:0 0 10px">${esc(i.text)}${i.link ? `<br><a href="${esc(i.link)}" style="color:#C8102E">${esc(i.link.replace(SITE, 'between.sonicboom.org.uk'))}</a>` : ''}</li>`;
  const html = `<div style="font-family:-apple-system,Arial,sans-serif;font-size:15px;line-height:1.5;color:#1A1212;max-width:560px">
<p style="font-size:13px;color:#5a4848;margin:0 0 4px">The Space Between · Sonic Boom Music CIC</p>
<h1 style="font-family:Georgia,serif;font-size:22px;margin:0 0 16px">Today: ${esc(longDate(today))}</h1>
<ul style="padding-left:20px;margin:0 0 20px">${urgent.map(li).join('')}</ul>
${outstanding.length ? `<h2 style="font-size:15px;margin:0 0 8px">Still outstanding</h2><ul style="padding-left:20px;margin:0 0 20px;color:#5a4848">${outstanding.map(li).join('')}</ul>` : ''}
<p style="font-size:13px;color:#5a4848">Remember why: every event should leave people more connected, and every story is worth gathering.<br>Sent daily by between.sonicboom.org.uk when something needs doing. Believe in the Power of Music.</p>
</div>`;
  const text = [
    `Today: ${longDate(today)}`, '',
    ...urgent.map(i => `- ${i.text}${i.link ? `\n  ${i.link}` : ''}`),
    ...(outstanding.length ? ['', 'Still outstanding:', ...outstanding.map(i => `- ${i.text}`)] : []),
    '', 'Sent daily by between.sonicboom.org.uk when something needs doing.',
  ].join('\n');
  return { subject, html, text };
}

/**
 * Build and (if anything is urgent and Resend is configured) send today's digest. Records each
 * send in reminder_log so a repeated cron run on the same day doesn't email twice.
 */
export async function runReminders(env, { today = ukToday(), force = false } = {}) {
  const db = env.OPS_DB;
  if (!db) return { sent: false, reason: 'no database' };

  if (!force) {
    const already = await db.prepare('SELECT 1 FROM reminder_log WHERE sent_on = ?').bind(today).first();
    if (already) return { sent: false, reason: 'already checked today' };
  }

  const reminders = await buildReminders(db, today);
  // "Send it now" on a quiet day sends a clearly-labelled test, so the Resend setup can be checked.
  if (force && !reminders.urgent.length) {
    reminders.urgent.push({ text: 'This is a test from "Send it now". Nothing is time-critical today, so the daily reminder would stay quiet.' });
  }
  if (!reminders.urgent.length) {
    // Record the quiet day too, so later checks today stop early.
    if (!force) await db.prepare('INSERT OR IGNORE INTO reminder_log (sent_on, subject, items) VALUES (?, NULL, 0)').bind(today).run();
    return { sent: false, reason: 'nothing due today', ...reminders };
  }
  if (!env.RESEND_API_KEY) return { sent: false, reason: 'RESEND_API_KEY not set', ...reminders };

  const { subject, html, text } = renderDigest(reminders, today);
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: LEADS, subject, html, text }),
  });
  if (!res.ok) return { sent: false, reason: `Resend error ${res.status}: ${await res.text()}`, ...reminders };

  await db.prepare('INSERT OR REPLACE INTO reminder_log (sent_on, subject, items) VALUES (?, ?, ?)')
    .bind(today, subject, reminders.urgent.length).run();
  return { sent: true, subject, ...reminders };
}
