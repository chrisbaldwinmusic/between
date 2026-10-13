// Helpers for the public feedback and check-in endpoints: they take plain HTML form posts (no JS
// needed on a phone at an event), store nothing personal, and rate-limit without keeping IPs.

export async function readForm(request) {
  const type = request.headers.get('Content-Type') || '';
  if (type.includes('application/json')) {
    try { return await request.json(); } catch { return null; }
  }
  try { return Object.fromEntries(await request.formData()); } catch { return null; }
}

// Generous per-network limit: a whole audience can share one venue Wi-Fi IP. The IP is hashed
// and the key expires within a day.
export async function rateLimited(kv, request, scope, limit = 60) {
  if (!kv) return false;
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const day = new Date().toISOString().slice(0, 10);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${scope}:${ip}:${day}`));
  const key = `ratelimit:${scope}:${[...new Uint8Array(digest)].slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join('')}`;
  const n = parseInt((await kv.get(key)) ?? '0', 10);
  if (n >= limit) return true;
  await kv.put(key, String(n + 1), { expirationTtl: 86400 });
  return false;
}

export function redirect(location) {
  return new Response(null, { status: 303, headers: { Location: location } });
}

// A plain error page for form posts that fail validation (the form itself uses `required`, so
// this is rare).
export function errorPage(message, backHref) {
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Something's missing · The Space Between</title>
<style>body{margin:0;background:#1A1212;color:#F4EFEA;font:1.05rem/1.6 -apple-system,Arial,sans-serif;padding:2rem 1rem}
main{max-width:32rem;margin:0 auto}h1{font-family:Georgia,serif;font-size:1.6rem}a{color:#E8A23D}</style></head>
<body><main><h1>Something's missing</h1><p>${esc(message)}</p><p><a href="${esc(backHref)}">Go back and try again</a></p></main></body></html>`,
    { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}
