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
 * Whether an event's exact date is public. Dates aren't locked down until tickets go on sale, so
 * until then the public site shows only the month (events.json `month`).
 */
export function dateFixed(event, today = ukToday()) {
  return event.status === 'onsale' || event.status === 'soldout' || event.date <= today;
}
