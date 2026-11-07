// POST /api/team/social-video — upload one video to post as a Reel or Story (raw body, not multipart,
// so it streams straight into R2 instead of being held in memory). Content-Type video/mp4 or
// video/quicktime. Stored in R2 (EVIDENCE) under social/ and served from /social-media/<uuid>.mp4|.mov.
// Returns the public URL Meta fetches the video from. Community managers and leads only.
// Location and camera data is NOT stripped from video here: the page tells people to export from their
// editing app with location off.

import { getDb, getActor, logActivity, jsonOk, jsonErr } from '../../../lib/ops-db.js';

export const prerender = false;

const MAX_BYTES = 90 * 1024 * 1024; // Cloudflare caps a request body at 100 MB on most plans.

export async function POST(context) {
  const env = context.locals.runtime?.env ?? {};
  if (!env.EVIDENCE) return jsonErr('Uploads unavailable', 503);
  const type = (context.request.headers.get('content-type') || '').split(';')[0].trim();
  if (type !== 'video/mp4' && type !== 'video/quicktime') return jsonErr('Upload an MP4 or MOV video', 400);
  const len = Number(context.request.headers.get('content-length'));
  if (!len || !context.request.body) return jsonErr('Choose a video to upload', 400);
  if (len > MAX_BYTES) return jsonErr('That video is too large (90 MB max). Export it smaller and try again.', 413);

  const ext = type === 'video/quicktime' ? 'mov' : 'mp4';
  const id = `${crypto.randomUUID()}.${ext}`;
  const key = `social/${id}`;
  await env.EVIDENCE.put(key, context.request.body, { httpMetadata: { contentType: type } });
  // Check it really is an MP4/MOV (an "ftyp" box at byte 4) now it is stored; delete it if not.
  const head = await env.EVIDENCE.get(key, { range: { offset: 0, length: 12 } });
  const b = head ? new Uint8Array(await head.arrayBuffer()) : new Uint8Array();
  if (!(b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70)) {
    await env.EVIDENCE.delete(key);
    return jsonErr('That does not look like an MP4 or MOV video', 400);
  }
  const db = getDb(context);
  if (db) await logActivity(db, getActor(context.request), 'uploaded a video for social media', null).catch(() => {});
  return jsonOk({ url: `${new URL(context.request.url).origin}/social-media/${id}` }, 201);
}
