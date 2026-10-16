// POST /api/team/push/test — send a test notification to all of your own devices.
// Anyone signed in to /team (src/middleware.js).

import { getActor, jsonOk, jsonErr } from '../../../../lib/ops-db.js';
import { notify } from '../../../../lib/webpush.js';

export const prerender = false;

export async function POST(context) {
  const env = context.locals.runtime?.env ?? {};
  if (!env.OPS_DB) return jsonErr('Database unavailable', 503);
  if (!env.VAPID_PRIVATE_KEY) return jsonErr('Notifications aren\'t set up on the server yet (VAPID_PRIVATE_KEY).', 503);
  const r = await notify(env, [getActor(context.request)], {
    title: 'Between Ops',
    body: 'Notifications are working. Your daily reminders will arrive like this.',
    url: '/team',
    tag: 'test',
  });
  if (!r.sent) return jsonErr(r.failed ? 'Could not reach this device. Try turning notifications off and on again.' : 'No devices with notifications on.', 400);
  return jsonOk(r);
}
