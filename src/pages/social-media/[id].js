// GET /social-media/:uuid.jpg|mp4|mov — public, read-only. Serves images and videos the team uploaded from
// /team/social so that Meta's servers can fetch them when publishing. Outside /team and /api/team, so not
// behind Cloudflare Access. Only keys under social/ with an unguessable uuid name; nothing is listed.
// Honours Range requests: Meta fetches video in pieces.

export const prerender = false;

const TYPES = { jpg: 'image/jpeg', mp4: 'video/mp4', mov: 'video/quicktime' };

export async function GET(context) {
  const env = context.locals.runtime?.env ?? {};
  const id = context.params.id ?? '';
  const m = /^[0-9a-f-]{36}\.(jpg|mp4|mov)$/.exec(id);
  if (!m || !env.EVIDENCE) return new Response('Not found', { status: 404 });
  const range = context.request.headers.get('range');
  const obj = await env.EVIDENCE.get(`social/${id}`, range ? { range: context.request.headers } : undefined);
  if (!obj) return new Response('Not found', { status: 404 });
  const headers = {
    'Content-Type': TYPES[m[1]],
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=31536000, immutable',
    'X-Robots-Tag': 'noindex',
  };
  if (range && obj.range && obj.size) {
    const start = obj.range.offset ?? (obj.size - obj.range.suffix);
    const end = obj.range.length != null ? start + obj.range.length - 1 : obj.size - 1;
    headers['Content-Range'] = `bytes ${start}-${end}/${obj.size}`;
    headers['Content-Length'] = String(end - start + 1);
    return new Response(obj.body, { status: 206, headers });
  }
  headers['Content-Length'] = String(obj.size);
  return new Response(obj.body, { headers });
}
