// GET /api/results — live venue-demand poll counts
// Response: { total: number, yes: number, maybe: number, yesPct: number }

export async function onRequestGet(context) {
  const kv = context.env.VENUE_KV;

  if (!kv) {
    // KV not bound (local dev without wrangler) — return zeroes
    return jsonOk({ total: 0, yes: 0, maybe: 0, yesPct: 0 });
  }

  try {
    const [yes, maybe, total] = await Promise.all([
      kv.get('yes'),
      kv.get('maybe'),
      kv.get('total'),
    ]);

    const yesN   = int(yes);
    const maybeN = int(maybe);
    const totalN = int(total);
    const yesPct = totalN > 0 ? Math.round((yesN / totalN) * 100) : 0;

    return jsonOk({ total: totalN, yes: yesN, maybe: maybeN, yesPct }, {
      // 30s CDN cache; stale-while-revalidate keeps it fresh without slowing the page
      'Cache-Control': 's-maxage=30, stale-while-revalidate=60',
    });
  } catch {
    return jsonOk({ total: 0, yes: 0, maybe: 0, yesPct: 0 });
  }
}

function int(s) { return parseInt(s ?? '0', 10); }

function jsonOk(data, extra = {}) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...extra },
  });
}
