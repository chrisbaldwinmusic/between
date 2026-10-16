// Daily reminder emails, sent through Resend (same provider and verified sonicboom.org.uk domain
// as the shared mailer). Two audiences:
//
//  - leads (Chris, Dan): evaluation and delivery: events, surveys, debriefs, survey reports,
//    reviews, schedule starts, monthly numbers, stories to approve.
//  - community: the freelance community managers (roster roles starting "Community"): presales,
//    content capture, stories, sharing the survey, monthly numbers, their own to-dos.
//
// Each email only sends when something is time-critical that day (the community email also goes
// every Monday as a "this week" round-up). Run by the cron / first-request fallback in
// worker/gate.js; previewed and sent by hand from /team/evaluation.

import events from '../data/events.json';
import { ukToday, addDays, dateFixed, eventWhen } from './dates.js';
import { surveyDue, longDate, surveyShareLinks } from './feedback.js';
import { LEADS } from './team-access.js';
import { loadAll, eventReport, reviewPeriods } from './metrics.js';
import { nameMatcher } from './ownership.js';

const SITE = 'https://between.sonicboom.org.uk';
const FROM = 'Between Ops <hello@sonicboom.org.uk>';

const monthName = m => new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const isMonday = d => new Date(`${d}T00:00:00Z`).getUTCDay() === 1;
const shortDate = d => longDate(d).replace(/^\w+ /, '');

// ── Leads ────────────────────────────────────────────────────────────────────

export async function buildReminders(db, today = ukToday(), data = null) {
  const urgent = [];
  const outstanding = [];
  data ??= await loadAll(db);
  const evalBySlug = new Map(data.evalRows.map(r => [r.event_slug, r]));

  for (const e of events) {
    const row = evalBySlug.get(e.slug) ?? {};
    const qr = e.ticketing === 'free'
      ? `${SITE}/team/evaluation/qr?e=${e.slug}&t=checkin`
      : `${SITE}/team/evaluation/qr?e=${e.slug}&t=survey`;

    if (e.date === addDays(today, 1)) {
      urgent.push({ text: `${e.name} is tomorrow at ${e.venue}. Print and pack the QR posters, and gather stories on the night (with permission).`, link: qr });
    }
    if (e.date === today) {
      urgent.push({ text: `${e.name} is today. The survey${e.ticketing === 'free' ? ' and QR check-in are' : ' is'} now live.`, link: `${SITE}/feedback/${e.slug}` });
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

    // Survey report, a week after the event once responses have come in.
    if (today === addDays(e.date, 7)) {
      const r = eventReport(data, e);
      const s = r.survey;
      urgent.push({
        text: s.n
          ? `${e.name} survey report: ${s.n} responses${r.responseRate != null ? ` (${r.responseRate}% of attendees)` : ''}, ${s.venueYesPct}% would use a permanent venue, ${Math.round((s.firstTimers / s.n) * 100)}% first-timers${s.topChannel ? `, most heard via ${s.topChannel.text.toLowerCase()}` : ''}.`
          : `${e.name} survey report: no responses yet a week on. Worth another push from the community team.`,
        link: `${SITE}/team/evaluation/survey-report?e=${e.slug}`,
      });
    }
  }

  // Reviews: a week out and on the first day of review week.
  for (const p of reviewPeriods(data.schedule)) {
    const r = p.review;
    if (r.status_override === 'done') continue;
    if (r.start_date === addDays(today, 7)) {
      urgent.push({ text: `${r.task} starts in a week (${longDate(r.start_date)}). The review page has the period's numbers ready: add your reflections.`, link: `${SITE}/team/reviews/${r.id}` });
    } else if (r.start_date === today) {
      urgent.push({ text: `${r.task} starts today. Write it up and sign it off by ${longDate(r.end_date)}.`, link: `${SITE}/team/reviews/${r.id}` });
    }
  }

  // Other schedule items starting today.
  for (const s of data.schedule) {
    if (s.status_override === 'done' || /review/i.test(s.task)) continue;
    if (s.start_date === today) urgent.push({ text: `Starting today: ${s.task}${s.owner ? ` (${s.owner})` : ''}.`, link: `${SITE}/team/schedule` });
  }

  // Monthly community numbers (Sep 2026 to Sep 2027).
  const lastMonth = addDays(`${today.slice(0, 7)}-01`, -1).slice(0, 7);
  const recorded = new Set(data.community.map(r => r.month));
  if (lastMonth >= '2026-09' && lastMonth <= '2027-09' && !recorded.has(lastMonth)) {
    const day = Number(today.slice(8));
    const item = { text: `Record ${monthName(lastMonth)}'s community numbers (WhatsApp, email, Facebook page and group, Instagram account and channel, TikTok).`, link: `${SITE}/team/evaluation` };
    (day === 1 || day === 7 ? urgent : outstanding).push(item);
  }

  // Dated to-dos owned by the leads: on the day, then overdue until ticked off.
  const [leadPeople, todos] = await Promise.all([
    db.prepare(`SELECT name FROM team_members WHERE lower(email) IN (${LEADS.map(() => '?').join(', ')})`).bind(...LEADS).all().then(r => r.results),
    db.prepare('SELECT task, owner, due_on FROM todos WHERE done = 0 AND due_on IS NOT NULL').all().then(r => r.results),
  ]);
  const ours = nameMatcher(leadPeople.map(p => p.name));
  for (const t of todos.filter(t => ours(t.owner) && t.due_on <= today)) {
    if (t.due_on === today) urgent.push({ text: `Today: ${t.task} (${t.owner}).`, link: `${SITE}/team/todos` });
    else (t.due_on >= addDays(today, -2) ? urgent : outstanding).push({ text: `Overdue since ${shortDate(t.due_on)}: ${t.task} (${t.owner}).`, link: `${SITE}/team/todos` });
  }

  // Stories waiting for review.
  const waiting = data.stories.filter(s => s.status === 'new');
  if (waiting.length) {
    const fresh = waiting.some(s => s.created_at.slice(0, 10) >= addDays(today, -1));
    const item = { text: `${waiting.length} ${waiting.length === 1 ? 'story is' : 'stories are'} waiting for review.`, link: `${SITE}/team/stories` };
    (fresh ? urgent : outstanding).push(item);
  }

  return { urgent, outstanding };
}

// ── Community managers ───────────────────────────────────────────────────────

export async function buildCommunityReminders(db, today = ukToday(), data = null) {
  const urgent = [];
  const outstanding = [];
  data ??= await loadAll(db);
  const [people, todos] = await Promise.all([
    db.prepare(`SELECT name, email FROM team_members WHERE role LIKE 'Community%'`).all().then(r => r.results),
    db.prepare('SELECT task, owner, due_on FROM todos WHERE done = 0').all().then(r => r.results),
  ]);
  const mine = nameMatcher(people.map(p => p.name));

  for (const e of events) {
    const where = `${e.name} (${longDate(e.date)}, ${e.venue})`;
    // Dates aren't fixed until tickets go on sale (or a free event is confirmed): until then, a
    // heads-up on the 1st of the month instead of countdowns to a day that may still move.
    if (!dateFixed(e, today)) {
      if (today === `${e.date.slice(0, 7)}-01`) {
        urgent.push({
          text: `${e.name} is this month (${e.month}, date TBC, ${e.venue}). The survey preview and QR posters are ready; check with Chris and Dan before putting a date in any post. The countdown reminders start once it's fixed.`,
          link: `${SITE}/team`,
        });
      }
      continue;
    }
    if (e.ticketing === 'ticketed' && e.date === addDays(today, 8)) {
      urgent.push({
        text: e.status === 'onsale'
          ? `Start the 8-day countdown for ${where} today: tickets are already on sale, so one post a day through to the night, leading with the people it's for.`
          : `Start the 8-day presale sequence for ${where} today: one post a day through to the night, leading with the people it's for.`,
        link: `${SITE}/events/${e.slug}`,
      });
    }
    if (e.date === addDays(today, 7)) {
      urgent.push({ text: `${where} is a week away. Share it into local Facebook groups and the WhatsApp community, and agree who's capturing content on the night.` });
    }
    if (e.date === addDays(today, 1)) {
      urgent.push({
        text: `${e.name} is tomorrow. Vikki: plan who's capturing photos, video, voice notes and people's stories (ask permission first; people can also share at the link). Emma: line up the night's posts and stories.`,
        link: `${SITE}/feedback/story`,
      });
    }
    if (e.date === today) {
      urgent.push({
        text: `${e.name} is today. Capture the room, not just the stage: who came, who with, why. ${e.ticketing === 'free' ? 'Point people to the check-in QR. ' : ''}Gather stories with permission.`,
        link: e.ticketing === 'free' ? `${SITE}/feedback/${e.slug}/checkin` : undefined,
      });
    }
    if (e.date === addDays(today, -1)) {
      urgent.push({
        text: `Share the ${e.name} survey today, using the link for each channel so we can see what works. Emma: post the highlights. Vikki: thank everyone in the WhatsApp community.`,
        links: surveyShareLinks(e.slug),
      });
    }
    if (e.date === addDays(today, -3)) {
      urgent.push({ text: `Last push for ${e.name} survey responses, and pass on any stories people shared on the night.`, link: `${SITE}/feedback/story` });
    }
  }

  // Monthly numbers: on the 1st (and a nudge on the 5th) for last month.
  const lastMonth = addDays(`${today.slice(0, 7)}-01`, -1).slice(0, 7);
  const recorded = new Set(data.community.map(r => r.month));
  const day = Number(today.slice(8));
  if (lastMonth >= '2026-09' && lastMonth <= '2027-09' && !recorded.has(lastMonth) && (day === 1 || day === 5)) {
    urgent.push({ text: `Send ${monthName(lastMonth)}'s community numbers to Chris and Dan: WhatsApp members, email subscribers, Facebook page followers, Facebook group members, Instagram followers, Instagram channel members, TikTok followers.` });
  }

  // Their schedule items starting today, and their open to-dos.
  for (const s of data.schedule) {
    if (s.status_override === 'done' || !mine(s.owner)) continue;
    if (s.start_date === today) urgent.push({ text: `Starting today: ${s.task} (${s.owner}).`, link: `${SITE}/team/schedule` });
  }
  // Their to-dos: dated ones arrive on the day and stay as overdue until ticked off (on their
  // dashboard); undated ones are listed as open.
  for (const t of todos.filter(t => mine(t.owner))) {
    if (t.due_on && t.due_on > today) continue;
    if (t.due_on === today) urgent.push({ text: `Today: ${t.task} (${t.owner}). Tick it off on your dashboard when it's done.`, link: `${SITE}/team` });
    // Overdue: nudge for two days after the due date, then keep it on the list.
    else if (t.due_on) (t.due_on >= addDays(today, -2) ? urgent : outstanding).push({ text: `Overdue since ${shortDate(t.due_on)}: ${t.task} (${t.owner})`, link: `${SITE}/team` });
    else outstanding.push({ text: `${t.task} (${t.owner})` });
  }

  // Monday round-up: always goes, with the next fortnight's events.
  if (isMonday(today)) {
    const soon = events.filter(e => e.date >= today && e.date <= addDays(today, 14));
    urgent.unshift({
      text: soon.length
        ? `This week and next: ${soon.map(e => `${e.name} ${eventWhen(e, d => `on ${shortDate(d)}`, today)}`).join(', ')}. Every post should be about people: who it's for, who came, what it meant.`
        : 'No events in the next fortnight: a good week for stories, community posts and growing the WhatsApp community.',
    });
  }

  return { urgent, outstanding, recipients: people.map(p => p.email) };
}

// ── Rendering and sending ────────────────────────────────────────────────────

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const shown = url => url.replace(SITE, 'between.sonicboom.org.uk').replace(/\?.*$/, '');

export function renderDigest({ urgent, outstanding }, today = ukToday(), audience = 'leads') {
  const community = audience === 'community';
  const subject = community
    ? `The Space Between: community to-dos for ${longDate(today)}`
    : `Between: ${urgent.length} thing${urgent.length === 1 ? '' : 's'} for ${longDate(today)}`;
  const linkHtml = i => [
    i.link ? `<br><a href="${esc(i.link)}" style="color:#C8102E">${esc(shown(i.link))}</a>` : '',
    i.links ? `<br>${i.links.map(([label, url]) => `<a href="${esc(url)}" style="color:#C8102E">${esc(label)}</a>`).join(' · ')}` : '',
  ].join('');
  const li = i => `<li style="margin:0 0 10px">${esc(i.text)}${linkHtml(i)}</li>`;
  const why = community
    ? 'Remember why: this is about people. Every post, every story, every survey shared helps Burton see itself.'
    : 'Remember why: every event should leave people more connected, and every story is worth gathering.';
  const html = `<div style="font-family:-apple-system,Arial,sans-serif;font-size:15px;line-height:1.5;color:#1A1212;max-width:560px">
<p style="font-size:13px;color:#5a4848;margin:0 0 4px">The Space Between · Sonic Boom Music CIC</p>
<h1 style="font-family:Georgia,serif;font-size:22px;margin:0 0 16px">${community ? 'Community' : 'Today'}: ${esc(longDate(today))}</h1>
<ul style="padding-left:20px;margin:0 0 20px">${urgent.map(li).join('')}</ul>
${outstanding.length ? `<h2 style="font-size:15px;margin:0 0 8px">${community ? 'Your open to-dos' : 'Still outstanding'}</h2><ul style="padding-left:20px;margin:0 0 20px;color:#5a4848">${outstanding.map(li).join('')}</ul>` : ''}
<p style="font-size:13px;color:#5a4848">${why}<br>Sent by between.sonicboom.org.uk when something needs doing. Believe in the Power of Music.</p>
</div>`;
  const text = [
    `${community ? 'Community' : 'Today'}: ${longDate(today)}`, '',
    ...urgent.map(i => `- ${i.text}${i.link ? `\n  ${i.link}` : ''}${i.links ? `\n  ${i.links.map(([l, u]) => `${l}: ${u}`).join('\n  ')}` : ''}`),
    ...(outstanding.length ? ['', community ? 'Your open to-dos:' : 'Still outstanding:', ...outstanding.map(i => `- ${i.text}`)] : []),
    '', why,
  ].join('\n');
  return { subject, html, text };
}

async function sendEmail(env, to, { subject, html, text }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to, subject, html, text }),
  });
  return res.ok ? null : `Resend error ${res.status}: ${await res.text()}`;
}

/**
 * Build and send today's email for one audience ('leads' | 'community'). Each day is logged per
 * audience in reminder_log (sent_on = 'YYYY-MM-DD:audience') so repeated runs don't email twice.
 * force: ignore the once-a-day guard, and on a quiet day send a labelled test instead.
 */
export async function runAudience(env, audience, { today = ukToday(), force = false, data = null } = {}) {
  const db = env.OPS_DB;
  if (!db) return { sent: false, reason: 'no database' };
  const key = `${today}:${audience}`;

  // Claim today's slot before doing anything, so two runs at once (several isolates, or cron plus
  // the first-request fallback) can't both send. Released again if the send fails.
  if (!force) {
    const claim = await db.prepare('INSERT OR IGNORE INTO reminder_log (sent_on, subject, items) VALUES (?, NULL, 0)').bind(key).run();
    if (!claim.meta?.changes) return { sent: false, reason: 'already checked today' };
  }
  const release = () => (force ? null : db.prepare('DELETE FROM reminder_log WHERE sent_on = ?').bind(key).run());

  const built = audience === 'community' ? await buildCommunityReminders(db, today, data) : await buildReminders(db, today, data);
  const to = audience === 'community' ? built.recipients : LEADS;
  if (force && !built.urgent.length) {
    built.urgent.push({ text: 'This is a test from "Send it now". Nothing is time-critical today, so the daily email would stay quiet.' });
  }
  if (!built.urgent.length || !to?.length) {
    return { sent: false, reason: !to?.length ? 'no recipients' : 'nothing due today', ...built };
  }
  if (!env.RESEND_API_KEY) {
    await release();
    return { sent: false, reason: 'RESEND_API_KEY not set', ...built };
  }

  const email = renderDigest(built, today, audience);
  const error = await sendEmail(env, to, email);
  if (error) {
    await release();
    return { sent: false, reason: error, ...built };
  }

  await db.prepare('INSERT OR REPLACE INTO reminder_log (sent_on, subject, items) VALUES (?, ?, ?)')
    .bind(key, email.subject, built.urgent.length).run();
  return { sent: true, subject: email.subject, to, ...built };
}

/** Both audiences: the daily run. Loads the data once and builds both emails in parallel. */
export async function runReminders(env, opts = {}) {
  const data = env.OPS_DB ? await loadAll(env.OPS_DB) : null;
  const [leads, community] = await Promise.all([
    runAudience(env, 'leads', { ...opts, data }),
    runAudience(env, 'community', { ...opts, data }),
  ]);
  return {
    sent: leads.sent || community.sent,
    reason: `leads: ${leads.reason ?? 'sent'}; community: ${community.reason ?? 'sent'}`,
    subject: leads.subject ?? community.subject,
    leads,
    community,
  };
}
