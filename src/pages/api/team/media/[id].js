// GET    /api/team/media/:id — the image itself (private; served only to the signed-in team)
// PATCH  /api/team/media/:id — edit { caption?, alt?, credit?, event?, platform? }
// DELETE /api/team/media/:id — remove (the uploader, or a lead)

import { getDb, getActor, logActivity, jsonOk, jsonErr } from '../../../../lib/ops-db.js';
import { eventBySlug } from '../../../../lib/feedback.js';
import { getEmail, isLead } from '../../../../lib/team-access.js';

export const prerender = false;

async function load(context) {
  const db = getDb(context);
  const id = Number(context.params.id);
  if (!db || !Number.isInteger(id)) return {};
  return { db, item: await db.prepare('SELECT * FROM media WHERE id = ?').bind(id).first() };
}

export async function GET(context) {
  const env = context.locals.runtime?.env ?? {};
  const { item } = await load(context);
  if (!item || !env.EVIDENCE) return new Response('Not found', { status: 404 });
  const obj = await env.EVIDENCE.get(item.r2_key);
  if (!obj) return new Response('Not found', { status: 404 });
  return new Response(obj.body, {
    headers: {
      'Content-Type': item.content_type,
      'Cache-Control': 'private, max-age=86400',
      'Content-Disposition': `inline; filename="between-${item.id}.${item.r2_key.split('.').pop()}"`,
    },
  });
}

const canEdit = (context, item) => {
  const email = getEmail(context.request);
  return isLead(email) || (email && item.uploaded_by?.toLowerCase() === email);
};

export async function PATCH(context) {
  const { db, item } = await load(context);
  if (!item) return jsonErr('Not found', 404);
  if (!canEdit(context, item)) return jsonErr('Only the person who uploaded this (or Chris or Dan) can change it', 403);
  let body;
  try { body = await context.request.json(); } catch { return jsonErr('Invalid request body', 400); }
  const pick = (k, max) => (typeof body[k] === 'string' ? body[k].trim().slice(0, max) || null : item[k]);
  const alt = pick('alt', 300);
  if (!alt) return jsonErr('Alt text is required', 400);
  const event = body.event === undefined ? { slug: item.event_slug } : eventBySlug(body.event) ?? { slug: null };
  await db
    .prepare('UPDATE media SET caption = ?, alt = ?, credit = ?, event_slug = ? WHERE id = ?')
    .bind(pick('caption', 1000), alt, pick('credit', 120), event.slug, item.id)
    .run();
  return jsonOk({ item: await db.prepare('SELECT * FROM media WHERE id = ?').bind(item.id).first() });
}

export async function DELETE(context) {
  const env = context.locals.runtime?.env ?? {};
  const { db, item } = await load(context);
  if (!item) return jsonErr('Not found', 404);
  if (!canEdit(context, item)) return jsonErr('Only the person who uploaded this (or Chris or Dan) can delete it', 403);
  await env.EVIDENCE?.delete(item.r2_key);
  await db.prepare('DELETE FROM media WHERE id = ?').bind(item.id).run();
  await logActivity(db, getActor(context.request), 'deleted an upload', item.caption ?? null);
  return jsonOk({ ok: true });
}
