// Active email subscribers from the one Sonic Boom Mailer (its own Worker, mailer.sonicboom.org.uk).
// We ask it, over a service binding (wrangler.toml [[services]] MAILER), for a count; we never touch its
// database. Authorised by the shared secret STATS_TOKEN, the same value on both Workers:
//   npx wrangler secret put STATS_TOKEN        (here, and again in the sibling Mailer repo)
// Counts only; no subscriber details cross. With nothing configured it says so rather than guess.

export const MAILER_URL = 'https://mailer.sonicboom.org.uk';

export async function mailerSubscribers(env = {}) {
  const token = env.STATS_TOKEN;
  if (!token) return { error: 'The mailer is not connected yet: STATS_TOKEN is not set.' };
  if (!env.MAILER?.fetch) return { error: 'The mailer service binding (MAILER) is not configured.' };
  try {
    const res = await env.MAILER.fetch(`${MAILER_URL}/api/public/stats`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return { error: `The mailer said ${res.status}${res.status === 401 ? ' (check STATS_TOKEN matches on both Workers)' : ''}.` };
    const d = await res.json();
    if (!Number.isInteger(d.active)) return { error: 'The mailer returned something unexpected.' };
    return { count: d.active, asOf: d.asOf };
  } catch (err) {
    return { error: `Could not reach the mailer: ${err.message}` };
  }
}
