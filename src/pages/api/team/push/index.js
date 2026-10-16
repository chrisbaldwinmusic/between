// POST   /api/team/push — turn notifications on for this device: { subscription, device? }
//        (subscription is the browser's PushSubscription JSON). Re-subscribing updates the row.
// DELETE /api/team/push — turn them off for this device: { endpoint }.
// Anyone signed in to /team, for their own devices only (src/middleware.js).

import { getDb, getActor, jsonOk, jsonErr } from '../../../../lib/ops-db.js';

export const prerender = false;

const isPushEndpoint = s => typeof s === 'string' && s.length < 1000 && /^https:\/\//.test(s);
const isKey = s => typeof s === 'string' && /^[A-Za-z0-9_-]{16,200}$/.test(s);

async function body(context) {
  try { return await context.request.json(); } catch { return null; }
}

export async function POST(context) {
  const db = getDb(context);
  if (!db) return jsonErr('Database unavailable', 503);
  const b = await body(context);
  const sub = b?.subscription;
  if (!isPushEndpoint(sub?.endpoint) || !isKey(sub?.keys?.p256dh) || !isKey(sub?.keys?.auth)) return jsonErr('Invalid subscription', 400);
  const email = getActor(context.request).toLowerCase();
  const device = typeof b.device === 'string' ? b.device.slice(0, 80) : null;

  await db
    .prepare(`INSERT INTO push_subscriptions (email, endpoint, p256dh, auth, device) VALUES (?, ?, ?, ?, ?)
              ON CONFLICT(endpoint) DO UPDATE SET email = excluded.email, p256dh = excluded.p256dh,
                auth = excluded.auth, device = excluded.device`)
    .bind(email, sub.endpoint, sub.keys.p256dh, sub.keys.auth, device)
    .run();
  return jsonOk({ ok: true });
}

export async function DELETE(context) {
  const db = getDb(context);
  if (!db) return jsonErr('Database unavailable', 503);
  const b = await body(context);
  if (!isPushEndpoint(b?.endpoint)) return jsonErr('Invalid endpoint', 400);
  await db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND email = ?')
    .bind(b.endpoint, getActor(context.request).toLowerCase()).run();
  return jsonOk({ ok: true });
}
