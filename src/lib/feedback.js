// The post-event survey and QR check-in, as set out in the ACE application's evaluation plan:
// five questions within 48 hours of every event, giving channel attribution, repeat attendance,
// geographic spread and a running venue-demand score. Shared by the public pages, the submit
// endpoints and /team/evaluation so the options only live in one place.

import events from '../data/events.json';

export const HEARD_FROM = [
  ['whatsapp', 'WhatsApp'],
  ['instagram', 'Instagram'],
  ['facebook', 'Facebook'],
  ['tiktok', 'TikTok'],
  ['email', 'Email from us'],
  ['friend', 'A friend or family member'],
  ['poster', 'A poster or flyer'],
  ['partner', 'The venue or a partner (library, college, community group)'],
  ['press', 'Radio, press or BBC Introducing'],
  ['website', 'This website'],
  ['other', 'Somewhere else'],
];

export const PRIOR_EVENTS = [
  ['first', 'This was my first'],
  ['2-3', '2 or 3'],
  ['4-9', '4 to 9'],
  ['10+', '10 or more'],
];

// Same question as the venue poll on the home page (DemandMeter), plus an honest "no".
export const VENUE_QUESTION = 'Would you use a permanent grassroots music venue in Burton?';
export const VENUE_USE = [
  ['yes', 'Yes'],
  ['maybe', 'Maybe'],
  ['no', 'Probably not'],
];

// Burton's own postcode districts, for the "local share" measure.
export const LOCAL_OUTWARD = ['DE13', 'DE14', 'DE15'];

export const label = (options, value) => options.find(([v]) => v === value)?.[1] ?? value;

export function eventBySlug(slug) {
  return events.find(e => e.slug === slug) ?? null;
}

export function outwardCode(postcode) {
  if (typeof postcode !== 'string') return null;
  const m = postcode.trim().toUpperCase().match(/^([A-Z]{1,2}\d{1,2}[A-Z]?)/);
  return m ? m[1] : null;
}

// Survey opens on the day of the event.
export function surveyOpen(event, today = new Date().toISOString().slice(0, 10)) {
  return event.date <= today;
}

// Survey should go out within 48 hours of the event.
export function surveyDue(event) {
  const d = new Date(`${event.date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 2);
  return d.toISOString().slice(0, 10);
}
