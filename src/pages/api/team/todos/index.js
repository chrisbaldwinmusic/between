// GET  /api/team/todos — list all todos (open first, newest first within each)
// POST /api/team/todos — create a todo { task, owner?, area?, due_on? }

import { getDb, getActor, jsonOk, jsonErr } from '../../../../lib/ops-db.js';
import { createTodo } from '../../../../lib/team-ops.js';

const send = r => (r.error ? jsonErr(r.error, r.status) : jsonOk(r.data, r.status));

export const prerender = false;

export async function GET(context) {
  const db = getDb(context);
  if (!db) return jsonErr('Database unavailable', 503);

  const { results } = await db
    .prepare('SELECT * FROM todos ORDER BY done ASC, due_on IS NULL, due_on ASC, created_at DESC')
    .all();
  return jsonOk({ todos: results });
}

export async function POST(context) {
  const db = getDb(context);
  if (!db) return jsonErr('Database unavailable', 503);
  let body;
  try { body = await context.request.json(); }
  catch { return jsonErr('Invalid request body', 400); }
  return send(await createTodo(db, getActor(context.request), body));
}
