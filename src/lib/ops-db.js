// Shared helpers for the /team API routes — all backed by the OPS_DB D1 database.

export function getDb(context) {
  return context.locals.runtime?.env?.OPS_DB ?? null;
}

export function getActor(request) {
  return request.headers.get('Cf-Access-Authenticated-User-Email') || 'unknown';
}

export async function logActivity(db, actor, action, detail) {
  await db
    .prepare('INSERT INTO activity_log (actor, action, detail) VALUES (?, ?, ?)')
    .bind(actor, action, detail ?? null)
    .run();
}

export function jsonOk(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function jsonErr(message, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
