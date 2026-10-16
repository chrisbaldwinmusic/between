// Everything time-bound on the site (event status, survey and check-in windows, schedule status,
// evaluation due dates) runs off the date in Burton, not UTC, so "the day of the event" starts at
// midnight UK time.

const UK = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' });

/** Today's date in the UK as YYYY-MM-DD. */
export function ukToday(now = new Date()) {
  return UK.format(now);
}

/** YYYY-MM-DD plus n days. */
export function addDays(date, n) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * An event's status today. 'soldout' and 'past' set in events.json win; otherwise an event
 * becomes 'past' the day after it happens, and is 'today' on the day.
 */
export function liveStatus(event, today = ukToday()) {
  if (event.status === 'past' || event.date < today) return 'past';
  if (event.status === 'soldout') return 'soldout';
  if (event.date === today) return 'today';
  return event.status;
}

/**
 * Whether an event's exact date is fixed. Dates aren't locked down until tickets go on sale (or,
 * for a free event, until events.json has `"date_confirmed": true`), so until then the site and
 * the team area show only the month (events.json `month`).
 */
export function dateFixed(event, today = ukToday()) {
  return event.status === 'onsale' || event.status === 'soldout' || event.date_confirmed === true || event.date <= today;
}

/**
 * An event's date for the team: the exact date once it's fixed (see dateFixed), otherwise its
 * month with "date TBC". Team pages and emails use this too, so nobody plans around a date that
 * may still move. `exact` formats the fixed date.
 */
export function eventWhen(event, exact, today = ukToday()) {
  return dateFixed(event, today) ? exact(event.date) : `${event.month}, date TBC`;
}

/**
 * The survey preview and the QR posters are ready from the 1st of the event's month: early enough
 * to plan posts and print posters, without pinning anyone to a day that may still change.
 */
export function materialsReady(event, today = ukToday()) {
  return today >= `${event.date.slice(0, 7)}-01`;
}
