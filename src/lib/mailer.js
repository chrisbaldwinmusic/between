// Active email subscribers, counted straight from Sonic Boom Music CIC's live mailer D1 (the sibling
// `mailer` Worker's `subscribers` table), bound here as MAILER_DB in wrangler.toml.
// D1 bindings can't be read-only, so this file runs ONE aggregate COUNT and never selects names or
// emails. Keep it that way. With no binding it says so rather than guess.

export async function mailerSubscribers(env = {}) {
  if (!env.MAILER_DB) return { error: 'The mailer database (MAILER_DB) is not bound.' };
  try {
    const row = await env.MAILER_DB.prepare('SELECT COALESCE(SUM(subscribed), 0) AS active FROM subscribers').first();
    if (!Number.isInteger(row?.active)) return { error: 'The mailer returned something unexpected.' };
    return { count: row.active, asOf: new Date().toISOString() };
  } catch (err) {
    return { error: `Could not read the mailer database: ${err.message}` };
  }
}
