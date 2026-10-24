// The team tool's write operations, in one place so the /api/team routes and the MCP server
// (mcp/tools.js) apply exactly the same rules. Each takes the D1 database, who is acting, and the
// request body, and returns { data, status? } or { error, status }. Who may call what is decided
// by the caller (middleware for the routes, role for the MCP tools); the to-do ownership check
// for non-leads lives here because it depends on the data.

import { logActivity } from './ops-db.js';
import { isLead } from './team-access.js';
import { nameMatcher, rosterName } from './ownership.js';

const dateRe = /^\d{4}-\d{2}-\d{2}$/;
const err = (error, status = 400) => ({ error, status });
const ok = (data, status = 200) => ({ data, status });
const trimmed = v => (typeof v === 'string' ? v.trim() : '');

// ── To-dos ─────────────────────────────────────────────────────────────────

export async function createTodo(db, actor, body) {
  const task = trimmed(body?.task);
  const owner = typeof body?.owner === 'string' ? body.owner.trim() : null;
  const area = trimmed(body?.area) || 'General';
  const dueOn = typeof body?.due_on === 'string' && dateRe.test(body.due_on) ? body.due_on : null;
  if (!task) return err('task is required');

  const { meta } = await db
    .prepare('INSERT INTO todos (task, owner, area, due_on, created_by) VALUES (?, ?, ?, ?, ?)')
    .bind(task, owner, area, dueOn, actor)
    .run();
  await logActivity(db, actor, 'created a to-do', task);
  return ok({ todo: await db.prepare('SELECT * FROM todos WHERE id = ?').bind(meta.last_row_id).first() }, 201);
}

/** Leads can change anything; anyone else can only tick their own to-dos on or off. */
export async function updateTodo(db, actor, email, id, body) {
  if (!Number.isInteger(id)) return err('Invalid id');
  const existing = await db.prepare('SELECT * FROM todos WHERE id = ?').bind(id).first();
  if (!existing) return err('Not found', 404);

  if (!isLead(email)) {
    const name = await rosterName(db, email);
    if (!name || !nameMatcher([name])(existing.owner)) return err('You can only tick off your own to-dos', 403);
    if (typeof body?.done !== 'boolean') return err('You can only tick to-dos on or off', 403);
    body = { done: body.done };
  }

  const task = typeof body?.task === 'string' ? body.task.trim() : existing.task;
  const owner = body?.owner === undefined ? existing.owner : (typeof body.owner === 'string' ? body.owner.trim() : null);
  const area = trimmed(body?.area) || existing.area;
  const done = typeof body?.done === 'boolean' ? (body.done ? 1 : 0) : existing.done;
  const dueOn = body?.due_on === undefined ? existing.due_on
    : (typeof body.due_on === 'string' && dateRe.test(body.due_on) ? body.due_on : null);
  const completedBy = done && !existing.done ? actor : (done ? existing.completed_by : null);

  await db
    .prepare(`UPDATE todos SET task = ?, owner = ?, area = ?, done = ?, completed_by = ?, due_on = ?,
              updated_at = datetime('now') WHERE id = ?`)
    .bind(task, owner, area, done, completedBy, dueOn, id)
    .run();

  if (done !== existing.done) {
    await logActivity(db, actor, done ? 'checked off a to-do' : 'reopened a to-do', task);
  } else if (task !== existing.task || owner !== existing.owner || area !== existing.area || dueOn !== existing.due_on) {
    await logActivity(db, actor, 'edited a to-do', task);
  }
  return ok({ todo: await db.prepare('SELECT * FROM todos WHERE id = ?').bind(id).first() });
}

// ── Schedule ───────────────────────────────────────────────────────────────

export async function createScheduleItem(db, actor, body) {
  const start = typeof body?.start_date === 'string' && dateRe.test(body.start_date) ? body.start_date : null;
  const end = typeof body?.end_date === 'string' && dateRe.test(body.end_date) ? body.end_date : null;
  const task = trimmed(body?.task);
  const owner = typeof body?.owner === 'string' ? body.owner.trim() : null;
  if (!start || !end) return err('start_date and end_date are required (YYYY-MM-DD)');
  if (!task) return err('task is required');
  if (end < start) return err('end_date must not be before start_date');

  const { meta } = await db
    .prepare('INSERT INTO schedule_items (start_date, end_date, task, owner, updated_by) VALUES (?, ?, ?, ?, ?)')
    .bind(start, end, task, owner, actor)
    .run();
  await logActivity(db, actor, 'added a schedule item', task);
  return ok({ item: await db.prepare('SELECT * FROM schedule_items WHERE id = ?').bind(meta.last_row_id).first() }, 201);
}

const OVERRIDES = new Set([null, 'blocked', 'done']);

export async function updateScheduleItem(db, actor, id, body) {
  if (!Number.isInteger(id)) return err('Invalid id');
  const existing = await db.prepare('SELECT * FROM schedule_items WHERE id = ?').bind(id).first();
  if (!existing) return err('Not found', 404);

  const task = trimmed(body?.task) || existing.task;
  const owner = body?.owner === undefined ? existing.owner : (typeof body.owner === 'string' ? body.owner.trim() : null);
  const start = typeof body?.start_date === 'string' && dateRe.test(body.start_date) ? body.start_date : existing.start_date;
  const end = typeof body?.end_date === 'string' && dateRe.test(body.end_date) ? body.end_date : existing.end_date;
  const notes = body?.notes === undefined ? existing.notes : (typeof body.notes === 'string' ? body.notes.trim() || null : null);

  let statusOverride = existing.status_override;
  if (body?.status_override !== undefined) {
    const v = body.status_override === null ? null : String(body.status_override);
    if (!OVERRIDES.has(v)) return err('status_override must be null, "blocked" or "done"');
    statusOverride = v;
  }
  if (end < start) return err('end_date must not be before start_date');

  await db
    .prepare(`UPDATE schedule_items SET task = ?, owner = ?, start_date = ?, end_date = ?,
              status_override = ?, notes = ?, updated_by = ?, updated_at = datetime('now') WHERE id = ?`)
    .bind(task, owner, start, end, statusOverride, notes, actor, id)
    .run();

  await logActivity(db, actor,
    statusOverride !== existing.status_override ? `marked a schedule item ${statusOverride ?? 'back to automatic'}` : 'updated a schedule item', task);
  return ok({ item: await db.prepare('SELECT * FROM schedule_items WHERE id = ?').bind(id).first() });
}

// ── Roster ─────────────────────────────────────────────────────────────────

const MEMBER_STATUS = new Set(['confirmed', 'expected', 'unconfirmed']);

export async function createMember(db, actor, body) {
  const name = trimmed(body?.name);
  const email = trimmed(body?.email);
  const role = typeof body?.role === 'string' ? body.role.trim() : 'TBC';
  const remit = typeof body?.remit === 'string' ? body.remit.trim() : null;
  const status = MEMBER_STATUS.has(body?.status) ? body.status : 'unconfirmed';
  if (!name) return err('name is required');
  if (!email || !email.includes('@')) return err('a valid email is required');

  const { meta } = await db
    .prepare('INSERT INTO team_members (name, email, role, remit, status, updated_by) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(name, email, role, remit, status, actor)
    .run();
  await logActivity(db, actor, 'added a team member', name);
  return ok({ member: await db.prepare('SELECT * FROM team_members WHERE id = ?').bind(meta.last_row_id).first() }, 201);
}

export async function updateMember(db, actor, id, body) {
  if (!Number.isInteger(id)) return err('Invalid id');
  const existing = await db.prepare('SELECT * FROM team_members WHERE id = ?').bind(id).first();
  if (!existing) return err('Not found', 404);

  const role = trimmed(body?.role) || existing.role;
  const remit = body?.remit === undefined ? existing.remit : (typeof body.remit === 'string' ? body.remit.trim() || null : null);
  let status = existing.status;
  if (body?.status !== undefined) {
    if (!MEMBER_STATUS.has(body.status)) return err('status must be confirmed, expected or unconfirmed');
    status = body.status;
  }

  await db
    .prepare(`UPDATE team_members SET role = ?, remit = ?, status = ?, updated_by = ?,
              updated_at = datetime('now') WHERE id = ?`)
    .bind(role, remit, status, actor, id)
    .run();
  await logActivity(db, actor, status !== existing.status ? `marked ${existing.name} as ${status}` : `updated ${existing.name}'s details`, null);
  return ok({ member: await db.prepare('SELECT * FROM team_members WHERE id = ?').bind(id).first() });
}

// ── Stories ────────────────────────────────────────────────────────────────

const STORY_STATUSES = ['new', 'approved', 'declined'];
const clip = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) || null : undefined);

/** Approving or declining clears the contributor's email (we promised to delete it). */
export async function updateStory(db, actor, id, body) {
  const existing = Number.isInteger(id) ? await db.prepare('SELECT * FROM stories WHERE id = ?').bind(id).first() : null;
  if (!existing) return err('Not found', 404);

  const status = STORY_STATUSES.includes(body?.status) ? body.status : existing.status;
  const story = clip(body?.story, 3000) ?? existing.story;
  const credit = body?.credit === undefined ? existing.credit : clip(body.credit, 80);
  const about = body?.about === undefined ? existing.about : clip(body.about, 160);
  // Only a change of status counts as a review (a later copy edit mustn't re-date it).
  const reviewed = status !== existing.status && status !== 'new' ? 1 : 0;

  await db
    .prepare(`UPDATE stories SET status = ?, story = ?, credit = ?, about = ?,
              email = CASE WHEN ? THEN NULL ELSE email END,
              reviewed_at = CASE WHEN ? THEN datetime('now') ELSE reviewed_at END,
              reviewed_by = CASE WHEN ? THEN ? ELSE reviewed_by END
              WHERE id = ?`)
    .bind(status, story, credit ?? null, about ?? null, reviewed, reviewed, reviewed, actor, id)
    .run();

  if (status !== existing.status) {
    await logActivity(db, actor, `${status === 'approved' ? 'approved' : status === 'declined' ? 'declined' : 'reopened'} a story`, credit || 'anonymous');
  }
  return ok({ ok: true });
}

// ── Budget ─────────────────────────────────────────────────────────────────

export async function createBudgetEntry(db, actor, body) {
  const lineId = Number(body?.line_id);
  const date = typeof body?.entry_date === 'string' && dateRe.test(body.entry_date) ? body.entry_date : null;
  const description = trimmed(body?.description);
  const amount = Number(body?.amount_pence);
  if (!Number.isInteger(lineId)) return err('Choose a budget line');
  if (!date) return err('A date is required');
  if (!description) return err('A description is required');
  if (!Number.isInteger(amount) || amount === 0) return err('Enter an amount');

  const line = await db.prepare('SELECT * FROM budget_lines WHERE id = ?').bind(lineId).first();
  if (!line) return err('Budget line not found', 404);

  const { meta } = await db
    .prepare('INSERT INTO budget_entries (line_id, entry_date, description, amount_pence, created_by) VALUES (?, ?, ?, ?, ?)')
    .bind(lineId, date, description, amount, actor)
    .run();
  const pounds = (amount / 100).toLocaleString('en-GB', { style: 'currency', currency: 'GBP' });
  await logActivity(db, actor, 'logged a budget entry', `${pounds} against ${line.description}: ${description}`);
  return ok({ entry: await db.prepare('SELECT * FROM budget_entries WHERE id = ?').bind(meta.last_row_id).first() }, 201);
}
