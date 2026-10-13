// Shared evaluation numbers for the survey reports, the community growth report and the quarterly
// reviews, so every report counts the same way. Everything is anonymous aggregate data.

import events from '../data/events.json';
import { HEARD_FROM, PRIOR_EVENTS, VENUE_USE, LOCAL_OUTWARD, COMMUNITY_CHANNELS } from './feedback.js';
import { addDays } from './dates.js';

export const PROJECT_START = '2026-09-01';

// ACE application targets (by Sept 2027).
export const TARGETS = {
  attenders: 1500,
  social: 500,
  email: 500,
};

export const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

export function monthsBetween(fromMonth, toMonth) {
  const out = [];
  for (let d = new Date(`${fromMonth}-01T00:00:00Z`); d.toISOString().slice(0, 7) <= toMonth; d.setUTCMonth(d.getUTCMonth() + 1)) {
    out.push(d.toISOString().slice(0, 7));
  }
  return out;
}

export const monthLabel = m =>
  new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });

export function fmtDate(d, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString('en-GB', { ...opts, timeZone: 'UTC' });
}

/** Breakdown of an answer across options: [{ value, text, n, pct }], sorted as the options are. */
export function breakdown(rows, key, options) {
  return options.map(([value, text]) => {
    const n = rows.filter(r => r[key] === value).length;
    return { value, text, n, pct: pct(n, rows.length) };
  });
}

/** Survey summary for a set of responses (one event, a period, or everything). */
export function surveySummary(responses, checkins = []) {
  const withPostcode = [...responses, ...checkins].filter(r => r.outward_postcode);
  const local = withPostcode.filter(r => LOCAL_OUTWARD.includes(r.outward_postcode)).length;
  const heard = breakdown(responses, 'heard_from', HEARD_FROM);
  const top = [...heard].sort((a, b) => b.n - a.n)[0];
  return {
    n: responses.length,
    heard,
    topChannel: top && top.n ? top : null,
    prior: breakdown(responses, 'prior_events', PRIOR_EVENTS),
    firstTimers: responses.filter(r => r.prior_events === 'first').length,
    venue: breakdown(responses, 'venue_use', VENUE_USE),
    venueYesPct: pct(responses.filter(r => r.venue_use === 'yes').length, responses.length),
    venueYesMaybePct: pct(responses.filter(r => r.venue_use !== 'no').length, responses.length),
    postcodes: withPostcode.length,
    localPct: pct(local, withPostcode.length),
    wants: responses.filter(r => r.venue_wants).map(r => r.venue_wants),
  };
}

/** Load the raw tables once; reports filter in memory (volumes are small). */
export async function loadAll(db) {
  const q = sql => db.prepare(sql).all().then(r => r.results).catch(() => []);
  const [responses, checkins, evalRows, community, stories, budgetLines, budgetEntries, schedule, media] = await Promise.all([
    q('SELECT * FROM feedback_responses ORDER BY created_at'),
    q('SELECT * FROM checkins ORDER BY created_at'),
    q('SELECT * FROM eval_events'),
    q('SELECT * FROM community_counts ORDER BY month'),
    q('SELECT * FROM stories'),
    q('SELECT * FROM budget_lines'),
    q('SELECT * FROM budget_entries'),
    q('SELECT * FROM schedule_items ORDER BY start_date'),
    q('SELECT id, kind, event_slug, platform, caption, alt, credit, width, height, created_at FROM media ORDER BY created_at'),
  ]);
  return { responses, checkins, evalRows, community, stories, budgetLines, budgetEntries, schedule, media };
}

/** Per-event numbers. */
export function eventReport(data, event) {
  const responses = data.responses.filter(r => r.event_slug === event.slug);
  const checkins = data.checkins.filter(c => c.event_slug === event.slug);
  const row = data.evalRows.find(r => r.event_slug === event.slug) ?? {};
  const checkedIn = checkins.reduce((s, c) => s + c.party_size, 0);
  const attendance = row.attendance ?? (checkedIn || null);
  return {
    event,
    row,
    attendance,
    checkedIn,
    responseRate: attendance ? pct(responses.length, attendance) : null,
    survey: surveySummary(responses, checkins),
    media: (data.media ?? []).filter(m => m.event_slug === event.slug),
  };
}

/** Community numbers: month rows plus change from the previous recorded month. */
export function communityReport(data, fromMonth, toMonth) {
  const byMonth = new Map(data.community.map(r => [r.month, r]));
  const months = monthsBetween(fromMonth, toMonth);
  let prev = null;
  const rows = months.map(m => {
    const r = byMonth.get(m) ?? null;
    const change = {};
    for (const [key] of COMMUNITY_CHANNELS) {
      change[key] = r && prev && r[key] != null && prev[key] != null ? r[key] - prev[key] : null;
    }
    const out = { month: m, row: r, change };
    if (r) prev = r;
    return out;
  });
  const recorded = rows.filter(r => r.row);
  const first = recorded[0]?.row ?? null;
  const last = recorded[recorded.length - 1]?.row ?? null;
  const growth = {};
  for (const [key] of COMMUNITY_CHANNELS) {
    growth[key] = first && last && first[key] != null && last[key] != null ? last[key] - first[key] : null;
  }
  return { rows, first, last, growth };
}

/** Social total (everything except email) for a community row. */
export function socialTotal(row) {
  if (!row) return null;
  return COMMUNITY_CHANNELS.filter(([k]) => k !== 'email').reduce((s, [k]) => s + (row[k] ?? 0), 0);
}

/** Everything for a review period [from, to] (inclusive dates). */
export function periodReport(data, from, to) {
  const inRange = d => d >= from && d <= to;
  const evs = events.filter(e => inRange(e.date));
  const evReports = evs.map(e => eventReport(data, e));
  const responses = data.responses.filter(r => inRange(r.created_at.slice(0, 10)));
  const checkins = data.checkins.filter(r => inRange(r.created_at.slice(0, 10)));
  const attendance = evReports.reduce((s, r) => s + (r.attendance ?? 0), 0);

  // Cumulative attendance to date (towards the 1,500 target).
  const allToDate = events.filter(e => e.date <= to).map(e => eventReport(data, e));
  const attendanceToDate = allToDate.reduce((s, r) => s + (r.attendance ?? 0), 0);

  const community = communityReport(data, from.slice(0, 7) < PROJECT_START.slice(0, 7) ? PROJECT_START.slice(0, 7) : from.slice(0, 7), to.slice(0, 7));
  const latestToDate = [...data.community].filter(r => r.month <= to.slice(0, 7)).pop() ?? null;

  const spendLineIds = new Set(data.budgetLines.filter(l => l.kind === 'expenditure' && !l.in_kind).map(l => l.id));
  const spendBudget = data.budgetLines.filter(l => spendLineIds.has(l.id)).reduce((s, l) => s + l.budget_pence, 0);
  const spentInPeriod = data.budgetEntries.filter(e => spendLineIds.has(e.line_id) && inRange(e.entry_date)).reduce((s, e) => s + e.amount_pence, 0);
  const spentToDate = data.budgetEntries.filter(e => spendLineIds.has(e.line_id) && e.entry_date <= to).reduce((s, e) => s + e.amount_pence, 0);

  const scheduleInPeriod = data.schedule.filter(s => !/review/i.test(s.task) && s.start_date <= to && s.end_date >= from);
  const blocked = scheduleInPeriod.filter(s => s.status_override === 'blocked');

  return {
    from, to,
    events: evReports,
    attendance,
    attendanceToDate,
    survey: surveySummary(responses, checkins),
    community,
    latestCommunity: latestToDate,
    media: (data.media ?? []).filter(m => (m.event_slug && evs.some(e => e.slug === m.event_slug)) || (!m.event_slug && inRange(m.created_at.slice(0, 10)))),
    stories: {
      received: data.stories.filter(s => inRange(s.created_at.slice(0, 10))).length,
      published: data.stories.filter(s => s.status === 'approved' && s.reviewed_at && inRange(s.reviewed_at.slice(0, 10))).length,
    },
    budget: { spendBudget, spentInPeriod, spentToDate },
    schedule: { items: scheduleInPeriod, blocked },
  };
}

/**
 * Review checkpoints from the schedule. Periods are contiguous: each runs from the day after the
 * previous review week ends to the end of its own review week, so nothing falls between reviews.
 */
export function reviewPeriods(schedule) {
  const reviews = schedule.filter(s => /review/i.test(s.task)).sort((a, b) => a.start_date.localeCompare(b.start_date));
  return reviews.map((r, i) => ({
    review: r,
    from: i === 0 ? PROJECT_START : addDays(reviews[i - 1].end_date, 1),
    to: r.end_date,
  }));
}
