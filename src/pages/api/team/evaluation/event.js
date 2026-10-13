// POST /api/team/evaluation/event — save an event's evaluation checklist
// { event_slug, survey_sent_on?, attendance?, debrief_on?, notes? }. Leads only (src/middleware.js).

import { getDb, getActor, logActivity, jsonOk, jsonErr } from '../../../../lib/ops-db.js';
import { eventBySlug } from '../../../../lib/feedback.js';

export const prerender = false;

const dateOrNull = v => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

export async function POST(context) {
  const db = getDb(context);
  if (!db) return jsonErr('Database unavailable', 503);

  let body;
  try { body = await context.request.json(); }
  catch { return jsonErr('Invalid request body', 400); }

  const event = eventBySlug(body?.event_slug);
  if (!event) return jsonErr('Unknown event', 400);

  const attendance = body.attendance === '' || body.attendance == null ? null : Number(body.attendance);
  if (attendance !== null && (!Number.isInteger(attendance) || attendance < 0)) return jsonErr('Attendance must be a whole number', 400);
  const notes = typeof body.notes === 'string' ? body.notes.trim() || null : null;
  const actor = getActor(context.request);

  await db
    .prepare(`INSERT INTO eval_events (event_slug, survey_sent_on, attendance, debrief_on, notes, updated_by)
              VALUES (?, ?, ?, ?, ?, ?)
              ON CONFLICT(event_slug) DO UPDATE SET survey_sent_on = excluded.survey_sent_on,
                attendance = excluded.attendance, debrief_on = excluded.debrief_on, notes = excluded.notes,
                updated_at = datetime('now'), updated_by = excluded.updated_by`)
    .bind(event.slug, dateOrNull(body.survey_sent_on), attendance, dateOrNull(body.debrief_on), notes, actor)
    .run();

  await logActivity(db, actor, 'updated evaluation', event.name);
  return jsonOk({ ok: true });
}
