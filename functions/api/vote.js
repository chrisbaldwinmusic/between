// POST /api/vote — record a venue-demand response
//
// Body (application/json):
//   { choice: "yes" | "maybe", postcode?: string }
//   OR { postcodeOnly: true, postcode: string }
//
// KV keys:
//   yes, maybe, total                    — aggregate vote counters
//   postcode:{OUTWARD}                   — e.g. postcode:DE13
//   ratelimit:vote:{ip}:{YYYY-MM-DD}     — 1 vote per IP per day (TTL 24 h)
//   ratelimit:pc:{ip}:{YYYY-MM-DD}       — 1 postcode per IP per day (TTL 24 h)

export async function onRequestPost(context) {
  const { request, env } = context;
  const kv = env.VENUE_KV;

  if (!kv) return err('Poll unavailable', 503);

  // ── Parse body ──────────────────────────────────────────────────────────
  let body;
  try { body = await request.json(); }
  catch { return err('Invalid request body', 400); }

  const { choice, postcode, postcodeOnly } = body ?? {};

  // ── Validate ────────────────────────────────────────────────────────────
  if (!postcodeOnly && choice !== 'yes' && choice !== 'maybe') {
    return err('choice must be "yes" or "maybe"', 400);
  }

  const ip    = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)

  // ── Postcode-only path ──────────────────────────────────────────────────
  if (postcodeOnly) {
    const outward = extractOutward(postcode);
    if (!outward) return err('Invalid postcode', 400);

    const rlKey = `ratelimit:pc:${ip}:${today}`;
    if (await kv.get(rlKey)) return err('Already submitted postcode today', 429);

    await Promise.all([
      increment(kv, `postcode:${outward}`),
      kv.put(rlKey, '1', { expirationTtl: 86400 }),
    ]);
    return ok({ ok: true });
  }

  // ── Vote path ────────────────────────────────────────────────────────────
  const voteRlKey = `ratelimit:vote:${ip}:${today}`;
  if (await kv.get(voteRlKey)) {
    // Already voted today — return current counts so the client can show the meter
    return ok({ ok: false, alreadyVoted: true, ...(await counts(kv)) });
  }

  // Read current counters
  const [yesN, maybeN, totalN] = await Promise.all([
    getInt(kv, 'yes'),
    getInt(kv, 'maybe'),
    getInt(kv, 'total'),
  ]);

  const newYes   = choice === 'yes'   ? yesN   + 1 : yesN;
  const newMaybe = choice === 'maybe' ? maybeN + 1 : maybeN;
  const newTotal = totalN + 1;
  const yesPct   = Math.round((newYes / newTotal) * 100);

  // Write back
  const writes = [
    kv.put('total', String(newTotal)),
    kv.put(voteRlKey, '1', { expirationTtl: 86400 }),
    choice === 'yes'
      ? kv.put('yes',   String(newYes))
      : kv.put('maybe', String(newMaybe)),
  ];

  // Optional postcode aggregate (no personal data — outward code only)
  const outward = extractOutward(postcode);
  if (outward) writes.push(increment(kv, `postcode:${outward}`));

  await Promise.all(writes);

  return ok({ ok: true, total: newTotal, yes: newYes, maybe: newMaybe, yesPct });
}

// ── Helpers ─────────────────────────────────────────────────────────────────

async function getInt(kv, key) {
  return parseInt((await kv.get(key)) ?? '0', 10);
}

async function increment(kv, key) {
  const n = await getInt(kv, key);
  await kv.put(key, String(n + 1));
}

async function counts(kv) {
  const [yes, maybe, total] = await Promise.all([
    getInt(kv, 'yes'),
    getInt(kv, 'maybe'),
    getInt(kv, 'total'),
  ]);
  const yesPct = total > 0 ? Math.round((yes / total) * 100) : 0;
  return { total, yes, maybe, yesPct };
}

function extractOutward(postcode) {
  if (typeof postcode !== 'string') return null;
  const m = postcode.trim().toUpperCase().match(/^([A-Z]{1,2}\d{1,2}[A-Z]?)/);
  return m ? m[1] : null;
}

function ok(data) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function err(message, status = 400) {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
