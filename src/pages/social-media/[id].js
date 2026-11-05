// GET /social-media/:uuid.jpg — public, read-only. Serves images the team uploaded from /team/social so
// that Meta's servers can fetch them when publishing. Outside /team and /api/team, so not behind
// Cloudflare Access. Only keys under social/ with an unguessable uuid name; nothing is listed.

export const prerender = false;

export async function GET(context) {
  const env = context.locals.runtime?.env ?? {};
  const id = context.params.id ?? '';
  if (!/^[0-9a-f-]{36}\.jpg$/.test(id) || !env.EVIDENCE) return new Response('Not found', { status: 404 });
  const obj = await env.EVIDENCE.get(`social/${id}`);
  if (!obj) return new Response('Not found', { status: 404 });
  return new Response(obj.body, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Robots-Tag': 'noindex',
    },
  });
}
