// POST /api/feedback/checkin — QR check-in at free events, from /feedback/[slug]/checkin.
// Public (no PIN, no Access). Accepts a plain form post and redirects to /feedback/checked-in.

import { eventBySlug, outwardCode, checkinOpen, onTheDay } from '../../../lib/feedback.js';
import { recordAction } from '../../../lib/attribution.js';
import { readForm, rateLimited, redirect, errorPage } from '../../../lib/public-form.js';

export const prerender = false;

export async function POST(context) {
  const env = context.locals.runtime?.env ?? {};
  const db = env.OPS_DB;
  const body = await readForm(context.request);
  const slug = typeof body?.event === 'string' ? body.event : '';
  const event = eventBySlug(slug);

  if (!event || event.ticketing !== 'free') return errorPage("We couldn't tell which event this was for.", '/feedback');
  const back = `/feedback/${event.slug}/checkin`;
  if (!checkinOpen(event)) return errorPage(`Check-in for ${event.name} opens ${onTheDay(event)} of the event.`, `/feedback/${event.slug}`);
  if (body.website) return redirect('/feedback/checked-in');

  const party = Number(body.party_size);
  if (!Number.isInteger(party) || party < 1 || party > 20) return errorPage('Please tell us how many of you there are.', back);
  const firstTime = body.first_time === 'yes' ? 1 : body.first_time === 'no' ? 0 : null;
  if (!db) return errorPage("Sorry, we couldn't save that just now. Please try again in a minute.", back);

  if (await rateLimited(env.VENUE_KV, context.request, `checkin:${slug}`, 1000)) {
    return errorPage("We've had an unusual number of check-ins from this network today. Please try again on mobile data.", back);
  }

  await db
    .prepare('INSERT INTO checkins (event_slug, party_size, first_time, outward_postcode) VALUES (?, ?, ?, ?)')
    .bind(slug, party, firstTime, outwardCode(body.postcode))
    .run();

  recordAction(context, 'checkin');
  return redirect(`/feedback/checked-in`);
}
