// POST /api/feedback/survey — the five-question post-event survey from /feedback/[slug].
// Public (no PIN, no Access). Accepts a plain form post and redirects to /feedback/thanks.

import { HEARD_FROM, PRIOR_EVENTS, VENUE_USE, eventBySlug, outwardCode, surveyOpen, longDate } from '../../../lib/feedback.js';
import { readForm, rateLimited, redirect, errorPage } from '../../../lib/public-form.js';

export const prerender = false;

const valid = (options, v) => options.some(([value]) => value === v);

export async function POST(context) {
  const env = context.locals.runtime?.env ?? {};
  const db = env.OPS_DB;
  const body = await readForm(context.request);
  const slug = typeof body?.event === 'string' ? body.event : '';
  const event = eventBySlug(slug);
  const back = event ? `/feedback/${event.slug}` : '/feedback';

  if (!event) return errorPage("We couldn't tell which event this was for.", '/feedback');
  if (!surveyOpen(event)) return errorPage(`This survey opens on ${longDate(event.date)}, the day of the event.`, back);
  // Honeypot: real people never see or fill this field.
  if (body.website) return redirect('/feedback/thanks');
  if (!valid(HEARD_FROM, body.heard_from)) return errorPage('Please tell us how you heard about the event.', back);
  if (!valid(PRIOR_EVENTS, body.prior_events)) return errorPage("Please tell us how many of our events you've been to.", back);
  if (!valid(VENUE_USE, body.venue_use)) return errorPage('Please answer the question about a venue.', back);
  if (!db) return errorPage("Sorry, we couldn't save that just now. Please try again in a minute.", back);

  if (await rateLimited(env.VENUE_KV, context.request, `survey:${slug}`)) return redirect('/feedback/thanks');

  const wants = typeof body.venue_wants === 'string' ? body.venue_wants.trim().slice(0, 1000) || null : null;

  await db
    .prepare(`INSERT INTO feedback_responses (event_slug, heard_from, prior_events, outward_postcode, venue_use, venue_wants)
              VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(slug, body.heard_from, body.prior_events, outwardCode(body.postcode), body.venue_use, wants)
    .run();

  return redirect('/feedback/thanks');
}
