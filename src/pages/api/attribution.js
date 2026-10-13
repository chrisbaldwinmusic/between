// POST /api/attribution — { kind: 'signup' | 'whatsapp' } from the browser, for actions that don't
// pass through our own server (the mailer sign-up, the WhatsApp invite link). Credited to the UTM
// tags of the page it was sent from. Counts only; nothing about the person is stored.

import { recordAction } from '../../lib/attribution.js';
import { rateLimited } from '../../lib/public-form.js';

export const prerender = false;

const CLIENT_KINDS = ['signup', 'whatsapp'];

export async function POST(context) {
  let body = null;
  try { body = JSON.parse(await context.request.text()); } catch { /* ignore */ }
  const kind = body?.kind;
  if (!CLIENT_KINDS.includes(kind)) return new Response(null, { status: 204 });
  const env = context.locals.runtime?.env ?? {};
  if (!(await rateLimited(env.VENUE_KV, context.request, 'attr', 300))) recordAction(context, kind);
  return new Response(null, { status: 204 });
}
