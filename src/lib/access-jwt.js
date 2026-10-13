// Verifies the Cloudflare Access login on /team requests. Access sets two headers when it lets a
// request through: a plain `Cf-Access-Authenticated-User-Email` and a signed
// `Cf-Access-Jwt-Assertion`. Only the signed token is proof: the plain header could be forged by
// any request that reached the Worker without going through Access (a path or hostname the Access
// app doesn't cover). So identity comes from the verified token, never the plain header alone.
// https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/validating-json/

const TEAM_DOMAIN = 'https://soft-mud-54f8.cloudflareaccess.com';
// The "Between (Sonic Boom)" Access application's audience (AUD) tag.
const AUD = 'd3e2fd90f29e3e72ca4911c6644db9786a1d17b12d19f4276264ae9b7aae9e09';

let keyCache = { at: 0, keys: new Map() };

async function signingKey(kid) {
  if (!keyCache.keys.has(kid) || Date.now() - keyCache.at > 3600_000) {
    const res = await fetch(`${TEAM_DOMAIN}/cdn-cgi/access/certs`);
    if (!res.ok) return null;
    const { keys = [] } = await res.json();
    const map = new Map();
    for (const jwk of keys) {
      map.set(jwk.kid, await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']));
    }
    keyCache = { at: Date.now(), keys: map };
  }
  return keyCache.keys.get(kid) ?? null;
}

const b64urlBytes = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), c => c.charCodeAt(0));
const b64urlJson = s => JSON.parse(new TextDecoder().decode(b64urlBytes(s)));

function tokenFrom(request) {
  const header = request.headers.get('Cf-Access-Jwt-Assertion');
  if (header) return header;
  const cookie = (request.headers.get('Cookie') || '').split(/;\s*/).find(c => c.startsWith('CF_Authorization='));
  return cookie ? cookie.slice('CF_Authorization='.length) : null;
}

/** The verified, lower-cased email of the Access login on this request, or null. */
export async function verifiedAccessEmail(request) {
  const token = tokenFrom(request);
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const header = b64urlJson(parts[0]);
    const payload = b64urlJson(parts[1]);
    if (header.alg !== 'RS256') return null;
    const key = await signingKey(header.kid);
    if (!key) return null;
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlBytes(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
    if (!ok) return null;
    const now = Math.floor(Date.now() / 1000);
    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!aud.includes(AUD) || payload.iss !== TEAM_DOMAIN || (payload.exp && payload.exp < now) || (payload.nbf && payload.nbf > now + 60)) return null;
    return typeof payload.email === 'string' ? payload.email.toLowerCase() : null;
  } catch {
    return null;
  }
}
