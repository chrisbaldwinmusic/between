// GET  /api/team/roster — list all team members
// POST /api/team/roster — add a member { name, email, role?, remit?, status? }

import { getDb, getActor, jsonOk, jsonErr } from '../../../../lib/ops-db.js';
import { createMember } from '../../../../lib/team-ops.js';

export const prerender = false;

const send = r => (r.error ? jsonErr(r.error, r.status) : jsonOk(r.data, r.status));

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
  return send(await createMember(db, getActor(context.request), body));
}
