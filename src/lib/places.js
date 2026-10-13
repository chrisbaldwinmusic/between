// Place names and distance for postcode districts (outward codes like DE14), from the free
// postcodes.io API (Office for National Statistics data), cached in KV for 30 days.

const BURTON = { lat: 52.8023, lon: -1.6309 }; // Burton upon Trent town centre

function miles(a, b) {
  const R = 3958.8;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** { code, districts: string[], miles: number|null } for one outward code. */
export async function lookupOutcode(env, code) {
  const key = `outcode:${code}`;
  const cached = await env.VENUE_KV?.get(key, 'json').catch(() => null);
  if (cached) return cached;
  let info = { code, districts: [], miles: null };
  try {
    const res = await fetch(`https://api.postcodes.io/outcodes/${encodeURIComponent(code)}`);
    if (res.ok) {
      const { result } = await res.json();
      info = {
        code,
        districts: result?.admin_district ?? [],
        miles: result?.latitude != null ? Math.round(miles(BURTON, { lat: result.latitude, lon: result.longitude }) * 10) / 10 : null,
      };
      await env.VENUE_KV?.put(key, JSON.stringify(info), { expirationTtl: 60 * 60 * 24 * 30 });
    }
  } catch { /* leave unlabelled */ }
  return info;
}

export function band(info) {
  if (['DE13', 'DE14', 'DE15'].includes(info.code)) return 'Burton';
  if (info.miles == null) return 'Unknown';
  if (info.miles <= 10) return 'Within 10 miles';
  if (info.miles <= 25) return '10 to 25 miles';
  return 'Further afield';
}
export const BANDS = ['Burton', 'Within 10 miles', '10 to 25 miles', 'Further afield', 'Unknown'];
