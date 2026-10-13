// GET  /api/team/media[?event=slug&kind=event|social] — list uploads (newest first)
// POST /api/team/media — upload one image (multipart: file, kind, event?, platform?, caption?,
//      alt, credit?). Images arrive already resized and re-encoded in the browser, which strips
//      location and camera data. Stored privately in R2 (EVIDENCE). All signed-in team members.

import { getDb, getActor, logActivity, jsonOk, jsonErr } from '../../../../lib/ops-db.js';
import { eventBySlug } from '../../../../lib/feedback.js';

export const prerender = false;

const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const PLATFORMS = ['whatsapp', 'facebook', 'instagram', 'tiktok', 'other'];
const MAX_BYTES = 8 * 1024 * 1024;
const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) || null : null);

export async function GET(context) {
  const db = getDb(context);
  if (!db) return jsonErr('Database unavailable', 503);
  const q = new URL(context.request.url).searchParams;
  const where = [];
  const binds = [];
  if (q.get('event')) { where.push('event_slug = ?'); binds.push(q.get('event')); }
  if (q.get('kind')) { where.push('kind = ?'); binds.push(q.get('kind')); }
  const { results } = await db
    .prepare(`SELECT * FROM media ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC LIMIT 500`)
    .bind(...binds)
    .all();
  return jsonOk({ media: results });
}

export async function POST(context) {
  const env = context.locals.runtime?.env ?? {};
  const db = getDb(context);
  if (!db || !env.EVIDENCE) return jsonErr('Uploads unavailable', 503);

  let form;
  try { form = await context.request.formData(); } catch { return jsonErr('Invalid upload', 400); }
  const file = form.get('file');
  if (!file || typeof file === 'string') return jsonErr('Choose an image to upload', 400);
  const ext = TYPES[file.type];
  if (!ext) return jsonErr('Images only (JPEG, PNG or WebP)', 400);
  if (file.size > MAX_BYTES) return jsonErr('That image is too large (8 MB max)', 400);

  const kind = form.get('kind') === 'social' ? 'social' : 'event';
  const event = eventBySlug(form.get('event'));
  const platform = kind === 'social' && PLATFORMS.includes(form.get('platform')) ? form.get('platform') : null;
  const alt = text(form.get('alt'), 300);
  if (!alt) return jsonErr('Add a short description of the image (alt text) so everyone can understand it', 400);
  const width = Number(form.get('width')) || null;
  const height = Number(form.get('height')) || null;

  const actor = getActor(context.request);
  const key = `media/${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${ext}`;
  await env.EVIDENCE.put(key, file.stream(), { httpMetadata: { contentType: file.type } });

  const { meta } = await db
    .prepare(`INSERT INTO media (r2_key, kind, event_slug, platform, caption, alt, credit, content_type, bytes, width, height, uploaded_by)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(key, kind, event?.slug ?? null, platform, text(form.get('caption'), 1000), alt, text(form.get('credit'), 120),
      file.type, file.size, width, height, actor)
    .run();

  await logActivity(db, actor, kind === 'social' ? 'added a social media reaction' : 'added a photo', event?.name ?? null);
  return jsonOk({ item: await db.prepare('SELECT * FROM media WHERE id = ?').bind(meta.last_row_id).first() }, 201);
}
