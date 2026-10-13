// POST /api/team/evaluation/event — save an event's evaluation checklist
//   { event_slug, survey_sent_on?, attendance?, debrief_on?, notes? }
// or lock / unlock it once the numbers are final: { event_slug, lock: true | false }.
// Locked events can't be edited until unlocked. Returns the saved row. Leads only (src/middleware.js).

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
  const actor = getActor(context.request);
  const existing = await db.prepare('SELECT * FROM eval_events WHERE event_slug = ?').bind(event.slug).first();
  const saved = async () => jsonOk({ row: await db.prepare('SELECT * FROM eval_events WHERE event_slug = ?').bind(event.slug).first() });

  // Lock / unlock
  if (typeof body.lock === 'boolean') {
    if (!existing) return jsonErr('Save the checklist before locking it', 400);
    await db
      .prepare('UPDATE eval_events SET locked_at = ?, locked_by = ? WHERE event_slug = ?')
      .bind(body.lock ? new Date().toISOString().replace('T', ' ').slice(0, 19) : null, body.lock ? actor : null, event.slug)
      .run();
    await logActivity(db, actor, body.lock ? 'locked evaluation' : 'unlocked evaluation', event.name);
    return saved();
  }

  if (existing?.locked_at) return jsonErr('This event is locked. Unlock it to make changes.', 409);

  const attendance = body.attendance === '' || body.attendance == null ? null : Number(String(body.attendance).replace(/,/g, ''));
  if (attendance !== null && (!Number.isInteger(attendance) || attendance < 0)) return jsonErr('Attendance must be a whole number', 400);
  const notes = typeof body.notes === 'string' ? body.notes.trim() || null : null;

  await db
    .prepare(`INSERT INTO eval_events (event_slug, survey_sent_on, attendance, debrief_on, notes, updated_by)
              VALUES (?, ?, ?, ?, ?, ?)
              ON CONFLICT(event_slug) DO UPDATE SET survey_sent_on = excluded.survey_sent_on,
                attendance = excluded.attendance, debrief_on = excluded.debrief_on, notes = excluded.notes,
                updated_at = datetime('now'), updated_by = excluded.updated_by`)
    .bind(event.slug, dateOrNull(body.survey_sent_on), attendance, dateOrNull(body.debrief_on), notes, actor)
    .run();

  await logActivity(db, actor, 'updated evaluation', event.name);
  return saved();
}
