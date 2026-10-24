// Tools the team MCP server offers: reads, and writes that go through src/lib/team-ops.js (the same
// rules and activity log as the site). No deletes. Which tools a person sees depends on their
// role, using the same roles as the /team area (src/lib/team-access.js):
//   leads      everything
//   community  the community managers: stories, survey, community numbers, tracked links
//   member     anyone else signed in: schedule, roster, events, their own to-dos
// Only anonymous aggregates and the same fields /team already shows are returned; contributor
// emails on stories and budget rates are never included except budget_summary (leads only).

import { z } from 'zod';
import events from '../src/data/events.json';
import { isLead, isCommunity } from '../src/lib/team-access.js';
import { loadAll, eventReport, surveySummary, communityReport, TARGETS, PROJECT_START } from '../src/lib/metrics.js';
import { ukToday } from '../src/lib/dates.js';
import { nameMatcher, rosterName } from '../src/lib/ownership.js';
import {
  createTodo, updateTodo, createScheduleItem, updateScheduleItem,
  createMember, updateMember, updateStory, createBudgetEntry,
} from '../src/lib/team-ops.js';

export const roleOf = email => (isLead(email) ? 'lead' : isCommunity(email) ? 'community' : 'member');

const text = data => ({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] });
const done = r => (r.error
  ? { isError: true, content: [{ type: 'text', text: r.error }] }
  : text(r.data));
const all = (db, sql, ...args) => db.prepare(sql).bind(...args).all().then(r => r.results);

export function registerTools(server, { db, email }) {
  const role = roleOf(email);
  const lead = role === 'lead';
  const community = lead || role === 'community';
  const read = { readOnlyHint: true, openWorldHint: false };

  server.registerTool('whoami', {
    description: 'Who you are signed in as and which tools your role gives you.',
    annotations: read,
  }, async () => text({ email, role }));

  server.registerTool('list_events', {
    description: 'The events in The Space Between: name, month, date (if fixed), venue, ticketing, who it is for.',
    annotations: read,
  }, async () => text(events.map(e => ({
    slug: e.slug, name: e.name, month: e.month, date: e.date, venue: e.venue,
    ticketing: e.ticketing, people: e.people,
  }))));

  server.registerTool('schedule', {
    description: 'The delivery schedule: tasks with dates, owners and status. Optionally only items active on or after a date.',
    inputSchema: { from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('YYYY-MM-DD; defaults to everything') },
    annotations: read,
  }, async ({ from }) => text(await all(db,
    'SELECT id, start_date, end_date, task, owner, status_override, notes FROM schedule_items WHERE end_date >= ? ORDER BY start_date', from ?? '0000-00-00')));

  server.registerTool('roster', {
    description: 'The delivery team: name, role, remit and confirmation status.',
    annotations: read,
  }, async () => text(await all(db, 'SELECT id, name, email, role, remit, status FROM team_members ORDER BY name')));

  server.registerTool('list_todos', {
    description: lead
      ? 'To-dos for the whole team. Filter by owner, area or open/done.'
      : 'Your own to-dos.',
    inputSchema: {
      status: z.enum(['open', 'done', 'all']).default('open'),
      ...(lead ? { owner: z.string().optional().describe('Owner name or email contains this text') } : {}),
    },
    annotations: read,
  }, async ({ status, owner }) => {
    const rows = await all(db, 'SELECT id, task, owner, area, done, due_on, created_at, completed_by FROM todos ORDER BY done, due_on IS NULL, due_on');
    const mineName = lead ? null : await rosterName(db, email);
    const isMine = nameMatcher([mineName]);
    const filtered = rows
      .filter(t => status === 'all' || (status === 'done') === !!t.done)
      .filter(t => (lead ? !owner || (t.owner ?? '').toLowerCase().includes(owner.toLowerCase()) : isMine(t.owner)));
    return text(filtered);
  });

  if (community) {
    server.registerTool('survey_summary', {
      description: 'Post-event survey numbers: how many people submitted the survey, how they heard, first-timers, venue interest, and how many arrived via each tracked link or QR poster. Anonymous aggregates only.',
      inputSchema: { event: z.string().optional().describe('Event slug (e.g. "firelight"); omit for all events') },
      annotations: read,
    }, async ({ event }) => {
      const data = await loadAll(db);
      const responses = event ? data.responses.filter(r => r.event_slug === event) : data.responses;
      const by = await all(db, `SELECT medium, campaign, kind, SUM(n) AS n FROM attribution
        WHERE kind IN ('visit','survey') AND (? = '' OR campaign = ? OR campaign = ? || '-survey')
        GROUP BY medium, campaign, kind ORDER BY n DESC`, event ?? '', event ?? '', event ?? '');
      return text({
        surveysSubmitted: responses.length,
        perEvent: events.map(e => ({ slug: e.slug, name: e.name, surveys: data.responses.filter(r => r.event_slug === e.slug).length })),
        summary: surveySummary(responses),
        trackedLinks: by,
        note: 'Surveys are credited to a tracked link only if submitted on the page that link opened, so the tracked total can be lower than surveysSubmitted.',
      });
    });

    server.registerTool('attribution_report', {
      description: 'Visits and actions (survey, sign-up, vote, story, WhatsApp click) credited to each tracked link (source / medium / campaign) in the last N days.',
      inputSchema: { days: z.number().int().min(1).max(365).default(30) },
      annotations: read,
    }, async ({ days }) => {
      const since = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
      return text({ since, rows: await all(db,
        'SELECT kind, source, medium, campaign, SUM(n) AS n FROM attribution WHERE day >= ? GROUP BY kind, source, medium, campaign ORDER BY n DESC', since) });
    });

    server.registerTool('community_numbers', {
      description: 'Monthly community growth (email list and social followers) against the ACE targets.',
      annotations: read,
    }, async () => {
      const data = await loadAll(db);
      const now = ukToday().slice(0, 7);
      const r = communityReport(data, PROJECT_START.slice(0, 7), now);
      return text({ targets: TARGETS, months: r.rows.filter(m => m.row).map(m => ({ month: m.month, ...m.row })), growth: r.growth });
    });

    server.registerTool('stories', {
      description: 'Approved community stories you can share (no contributor emails). Leads can also list new, unreviewed ones.',
      inputSchema: { status: z.enum(lead ? ['approved', 'new', 'declined'] : ['approved']).default('approved') },
      annotations: read,
    }, async ({ status }) => text(await all(db,
      `SELECT id, story, credit, about, event_slug, consent_web, consent_social, status, created_at, reviewed_at
       FROM stories WHERE status = ? ORDER BY created_at DESC`, status)));
  }

  if (lead) {
    server.registerTool('activity_log', {
      description: 'Recent changes made in the team tool: who did what, when.',
      inputSchema: { limit: z.number().int().min(1).max(200).default(30) },
      annotations: read,
    }, async ({ limit }) => text(await all(db, 'SELECT actor, action, detail, created_at FROM activity_log ORDER BY id DESC LIMIT ?', limit)));

    server.registerTool('budget_summary', {
      description: 'Budget by line: budgeted vs spent (in pounds). Leads only.',
      annotations: read,
    }, async () => {
      const lines = await all(db, `SELECT l.id, l.kind, l.heading, l.description, l.budget_pence, l.in_kind, l.status,
        COALESCE(SUM(e.amount_pence), 0) AS spent_pence
        FROM budget_lines l LEFT JOIN budget_entries e ON e.line_id = l.id GROUP BY l.id ORDER BY l.sort`);
      const gbp = p => Math.round(p) / 100;
      return text(lines.map(l => ({ ...l, budget: gbp(l.budget_pence), spent: gbp(l.spent_pence), remaining: gbp(l.budget_pence - l.spent_pence) })));
    });
  }

  // ── Writes ───────────────────────────────────────────────────────────────
  const write = { readOnlyHint: false, destructiveHint: false, openWorldHint: false };
  const idem = { ...write, idempotentHint: true };
  const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');

  server.registerTool('set_todo_done', {
    description: lead ? 'Tick a to-do on or off.' : 'Tick one of your own to-dos on or off.',
    inputSchema: { id: z.number().int(), done: z.boolean() },
    annotations: idem,
  }, async ({ id, done: d }) => done(await updateTodo(db, email, email, id, { done: d })));

  if (!lead) return;

  server.registerTool('add_todo', {
    description: 'Add a to-do. Owner should be a full roster name.',
    inputSchema: { task: z.string().min(1), owner: z.string().optional(), area: z.string().optional(), due_on: date.optional() },
    annotations: write,
  }, async body => done(await createTodo(db, email, body)));

  server.registerTool('update_todo', {
    description: 'Edit a to-do (task, owner, area, due date). Use set_todo_done to tick it. Pass due_on null to clear the date.',
    inputSchema: { id: z.number().int(), task: z.string().optional(), owner: z.string().nullable().optional(), area: z.string().optional(), due_on: date.nullable().optional() },
    annotations: idem,
  }, async ({ id, ...body }) => done(await updateTodo(db, email, email, id, body)));

  server.registerTool('add_schedule_item', {
    description: 'Add a task to the delivery schedule.',
    inputSchema: { start_date: date, end_date: date, task: z.string().min(1), owner: z.string().optional() },
    annotations: write,
  }, async body => done(await createScheduleItem(db, email, body)));

  server.registerTool('update_schedule_item', {
    description: 'Change a schedule item: task, owner, dates, notes, or status_override ("blocked", "done", or null for automatic).',
    inputSchema: {
      id: z.number().int(), task: z.string().optional(), owner: z.string().nullable().optional(),
      start_date: date.optional(), end_date: date.optional(), notes: z.string().nullable().optional(),
      status_override: z.enum(['blocked', 'done']).nullable().optional(),
    },
    annotations: idem,
  }, async ({ id, ...body }) => done(await updateScheduleItem(db, email, id, body)));

  server.registerTool('add_team_member', {
    description: 'Add someone to the roster. This does not give them access: access comes from Cloudflare Access and src/lib/team-access.js.',
    inputSchema: { name: z.string().min(1), email: z.string().email(), role: z.string().optional(), remit: z.string().optional(), status: z.enum(['confirmed', 'expected', 'unconfirmed']).optional() },
    annotations: write,
  }, async body => done(await createMember(db, email, body)));

  server.registerTool('update_team_member', {
    description: "Change a team member's role, remit or confirmation status.",
    inputSchema: { id: z.number().int(), role: z.string().optional(), remit: z.string().nullable().optional(), status: z.enum(['confirmed', 'expected', 'unconfirmed']).optional() },
    annotations: idem,
  }, async ({ id, ...body }) => done(await updateMember(db, email, id, body)));

  server.registerTool('review_story', {
    description: "Approve or decline a community story, or tidy its wording or credit. Approving or declining deletes the contributor's email, as promised on the form. Refuses to approve a story with no web or social consent.",
    inputSchema: { id: z.number().int(), status: z.enum(['approved', 'declined', 'new']).optional(), story: z.string().optional(), credit: z.string().nullable().optional(), about: z.string().nullable().optional() },
    annotations: idem,
  }, async ({ id, ...body }) => {
    if (body.status === 'approved') {
      const s = await db.prepare('SELECT consent_web, consent_social FROM stories WHERE id = ?').bind(id).first();
      if (s && !s.consent_web && !s.consent_social) {
        return done({ error: 'This story has no web or social consent, so it cannot be approved. Decline it, or ask the contributor.', status: 409 });
      }
    }
    return done(await updateStory(db, email, id, body));
  });

  server.registerTool('log_budget_entry', {
    description: 'Log spend (positive pence) or a correction (negative pence) against a budget line from budget_summary.',
    inputSchema: { line_id: z.number().int(), entry_date: date, description: z.string().min(1), amount_pence: z.number().int().refine(n => n !== 0, 'not zero') },
    annotations: write,
  }, async body => done(await createBudgetEntry(db, email, body)));
}
