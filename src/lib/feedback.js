// The post-event survey and QR check-in, as set out in the ACE application's evaluation plan:
// five questions within 48 hours of every event, giving channel attribution, repeat attendance,
// geographic spread and a running venue-demand score. Shared by the public pages, the submit
// endpoints and /team/evaluation so the options only live in one place.

import events from '../data/events.json';
import { ukToday, addDays } from './dates.js';

export const HEARD_FROM = [
  ['whatsapp', 'WhatsApp'],
  ['facebook_page', 'Our Facebook page'],
  ['facebook_group', 'A Facebook group (like a local community group)'],
  ['instagram', 'Our Instagram'],
  ['instagram_share', "Someone else's Instagram post or story"],
  ['tiktok', 'TikTok'],
  ['email', 'Email from us'],
  ['friend', 'A friend or family member'],
  ['poster', 'A poster or flyer'],
  ['partner', 'The venue or a partner (library, college, community group)'],
  ['press', 'Radio, press or BBC Introducing'],
  ['website', 'This website'],
  ['other', 'Somewhere else'],
];

// Monthly community numbers, tracked by the community managers and reported quarterly. Pages
// (followers) and groups (members) are counted separately: they're different relationships.
// TikTok has no groups, so it's one figure. Keys are community_counts columns.
export const COMMUNITY_CHANNELS = [
  ['whatsapp', 'WhatsApp community', 'members'],
  ['email', 'Email list', 'subscribers'],
  ['facebook_page', 'Facebook page', 'followers'],
  ['facebook_group', 'Facebook group', 'members'],
  ['instagram', 'Instagram account', 'followers'],
  ['instagram_channel', 'Instagram broadcast channel', 'members'],
  ['tiktok', 'TikTok', 'followers'],
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

// The survey opens on the day of the event (UK time) and stays open after it.
export function surveyOpen(event, today = ukToday()) {
  return event.date <= today;
}

// QR check-in only works on the day of the event (UK time).
export function checkinOpen(event, today = ukToday()) {
  return event.date === today;
}

// The survey should go out within 48 hours of the event.
export function surveyDue(event) {
  return addDays(event.date, 2);
}

// "Friday 23 October"
export function longDate(date) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
}
