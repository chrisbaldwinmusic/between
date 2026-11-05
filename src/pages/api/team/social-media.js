// POST /api/team/social-media — upload one image to post to Facebook / Instagram (multipart: file).
// The browser has already resized it and re-encoded it as a JPEG (which strips location and camera
// data); this re-checks that it really is a JPEG and stores it in R2 (EVIDENCE) under social/.
// Returns the public URL Meta fetches the image from (src/pages/social-media/[id].js).
// Community managers and leads only (src/lib/team-access.js).

import { getDb, getActor, logActivity, jsonOk, jsonErr } from '../../../lib/ops-db.js';

export const prerender = false;

const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(context) {
  const env = context.locals.runtime?.env ?? {};
  if (!env.EVIDENCE) return jsonErr('Uploads unavailable', 503);
  let form;
  try { form = await context.request.formData(); } catch { return jsonErr('Invalid upload', 400); }
  const file = form.get('file');
  if (!file || typeof file === 'string') return jsonErr('Choose an image to upload', 400);
  if (file.size > MAX_BYTES) return jsonErr('That image is too large (8 MB max)', 400);
  const head = new Uint8Array(await file.slice(0, 3).arrayBuffer());
  if (!(head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff)) return jsonErr('Instagram needs a JPEG image', 400);

  const id = `${crypto.randomUUID()}.jpg`;
  await env.EVIDENCE.put(`social/${id}`, file.stream(), { httpMetadata: { contentType: 'image/jpeg' } });
  const db = getDb(context);
  if (db) await logActivity(db, getActor(context.request), 'uploaded an image for social media', null).catch(() => {});
  return jsonOk({ url: `${new URL(context.request.url).origin}/social-media/${id}` }, 201);
}
