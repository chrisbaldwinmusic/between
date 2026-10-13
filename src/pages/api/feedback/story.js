// POST /api/feedback/story — someone shares their story from /feedback/story. Public (no PIN).
// Stories wait in /team/stories until a lead approves them for the home page.

import { eventBySlug } from '../../../lib/feedback.js';
import { readForm, rateLimited, redirect, errorPage } from '../../../lib/public-form.js';

export const prerender = false;

const clean = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) || null : null);

export async function POST(context) {
  const env = context.locals.runtime?.env ?? {};
  const db = env.OPS_DB;
  const body = await readForm(context.request);
  const back = '/feedback/story';

  if (!body) return errorPage('Something went wrong sending that. Please try again.', back);
  if (body.website) return redirect('/feedback/story/thanks');

  const story = clean(body.story, 3000);
  if (!story || story.length < 10) return errorPage('Please tell us your story (a sentence or two is plenty).', back);
  if (!body.consent_web) return errorPage("Please tick the box to say we can share your story on the website. If you'd rather we didn't, that's fine: email hello@sonicboom.org.uk instead.", back);
  if (!body.age_ok) return errorPage("Please confirm you're 16 or over, or that a parent or carer has said it's OK.", back);

  const email = clean(body.email, 200);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return errorPage("That email address doesn't look right. It's optional, so you can leave it blank.", back);
  const event = eventBySlug(body.event);

  if (!db) return errorPage("Sorry, we couldn't save that just now. Please try again in a minute.", back);
  if (await rateLimited(env.VENUE_KV, context.request, 'story', 20)) return redirect('/feedback/story/thanks');

  await db
    .prepare(`INSERT INTO stories (story, credit, about, event_slug, email, consent_web, consent_social)
              VALUES (?, ?, ?, ?, ?, 1, ?)`)
    .bind(story, clean(body.credit, 80), clean(body.about, 160), event?.slug ?? null, email, body.consent_social ? 1 : 0)
    .run();

  return redirect('/feedback/story/thanks');
}
