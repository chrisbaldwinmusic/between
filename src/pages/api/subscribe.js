// POST /api/subscribe — proxies to Sonic Boom's shared mailer
//
// The upstream endpoint (mailer.sonicboom.org.uk/api/public/subscribe) has no
// CORS headers, so a same-origin client can't call it directly from the
// browser. This route relays the request server-to-server instead.
//
// Body: { name?: string, email: string, turnstileToken: string }

export const prerender = false;

export async function POST(context) {
  const { request } = context;

  let body;
  try { body = await request.json(); }
  catch { return err('Invalid request body', 400); }

  const { name, email, turnstileToken } = body ?? {};

  if (typeof email !== 'string' || !email.includes('@')) {
    return err('A valid email is required', 400);
  }
  if (typeof turnstileToken !== 'string' || !turnstileToken) {
    return err('Verification required', 400);
  }

  const upstream = await fetch('https://mailer.sonicboom.org.uk/api/public/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: typeof name === 'string' ? name : '', email, turnstileToken }),
  });

  const data = await upstream.json().catch(() => ({}));

  return new Response(JSON.stringify(data), {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function err(message, status) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
