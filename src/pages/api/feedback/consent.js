// POST /api/feedback/consent: someone gives (or a parent gives for a child) permission to be
// photographed, filmed, recorded or quoted, from /feedback/consent (the QR code at events).
// Public, plain HTML form post. Read in /team/consents.

import { eventBySlug } from '../../../lib/feedback.js';
import { recordAction } from '../../../lib/attribution.js';
import { readForm, rateLimited, redirect, errorPage } from '../../../lib/public-form.js';

export const prerender = false;

const clean = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) || null : null);
const flag = v => (v ? 1 : 0);

export async function POST(context) {
  const env = context.locals.runtime?.env ?? {};
  const db = env.OPS_DB;
  const body = await readForm(context.request);
  const back = '/feedback/consent';

  if (!body) return errorPage('Something went wrong sending that. Please try again.', back);
  if (body.website) return redirect('/feedback/consent/thanks');

  const name = clean(body.name, 120);
  if (!name) return errorPage('Please tell us your name, so we know who gave permission.', back);
  if (!(body.photo || body.video || body.audio || body.words)) return errorPage('Please tick at least one of photos, video, audio or words. If you would rather not be included, you do not need to fill this in: just tell the person with the camera.', back);
  if (!(body.use_web || body.use_social || body.use_print || body.use_funders)) return errorPage('Please tick at least one place we can use it.', back);
  if (!body.age_ok) return errorPage('Please confirm you are 16 or over, or that you are the parent or carer of anyone under 16 named here.', back);

  const childNames = body.for_child ? clean(body.child_names, 200) : null;
  if (body.for_child && !childNames) return errorPage("Please add the child's first name (or names), so we know who the permission is for.", back);

  const email = clean(body.email, 200);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return errorPage("That email address doesn't look right. It's optional, so you can leave it blank.", back);
  const event = eventBySlug(body.event);

  if (!db) return errorPage("Sorry, we couldn't save that just now. Please try again in a minute.", back);
  if (await rateLimited(env.VENUE_KV, context.request, 'consent', 40)) return redirect('/feedback/consent/thanks');

  await db
    .prepare(`INSERT INTO media_consents
      (name, email, child_names, event_slug, photo, video, audio, words, use_web, use_social, use_print, use_funders)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(name, email, childNames, event?.slug ?? null,
      flag(body.photo), flag(body.video), flag(body.audio), flag(body.words),
      flag(body.use_web), flag(body.use_social), flag(body.use_print), flag(body.use_funders))
    .run();

  recordAction(context, 'consent');
  return redirect('/feedback/consent/thanks');
}
