// GET  /api/team/roster — list all team members
// POST /api/team/roster — add a member { name, email, role?, remit?, status? }

import { getDb, getActor, logActivity, jsonOk, jsonErr } from '../../../../lib/ops-db.js';

export const prerender = false;

const ALLOWED_STATUS = new Set(['confirmed', 'expected', 'unconfirmed']);

export async function GET(context) {
  const db = getDb(context);
  if (!db) return jsonErr('Database unavailable', 503);

  const { results } = await db.prepare('SELECT * FROM team_members ORDER BY id ASC').all();
  return jsonOk({ members: results });
}

export async function POST(context) {
  const db = getDb(context);
  if (!db) return jsonErr('Database unavailable', 503);

  let body;
  try { body = await context.request.json(); }
  catch { return jsonErr('Invalid request body', 400); }

  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const email = typeof body?.email === 'string' ? body.email.trim() : '';
  const role = typeof body?.role === 'string' ? body.role.trim() : 'TBC';
  const remit = typeof body?.remit === 'string' ? body.remit.trim() : null;
  const status = ALLOWED_STATUS.has(body?.status) ? body.status : 'unconfirmed';

  if (!name) return jsonErr('name is required', 400);
  if (!email || !email.includes('@')) return jsonErr('a valid email is required', 400);

  const actor = getActor(context.request);

  const { meta } = await db
    .prepare('INSERT INTO team_members (name, email, role, remit, status, updated_by) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(name, email, role, remit, status, actor)
    .run();

  await logActivity(db, actor, 'added a team member', name);

  const row = await db.prepare('SELECT * FROM team_members WHERE id = ?').bind(meta.last_row_id).first();
  return jsonOk({ member: row }, 201);
}
