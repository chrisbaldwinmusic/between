// Web Push for the team app (installed /team on phones): VAPID-signed, aes128gcm-encrypted
// messages to each browser's push service, using only WebCrypto so it runs in the Worker.
// RFC 8291 (message encryption), RFC 8188 (aes128gcm), RFC 8292 (VAPID).
//
// The VAPID public key is public (browsers need it to subscribe). The private key is the Worker
// secret VAPID_PRIVATE_KEY: the base64url "d" of the P-256 key (DEPLOY.md §5d).

export const VAPID_PUBLIC_KEY = 'BCFe2u2OuCzmtdmNNuN1xcWxD7Y-yi-N6dZh-8u-7o_rPNu0e5aKryJtC-MBrQPaaGdIpbF7jTrYLWM2yYjPP1Y';
const VAPID_SUBJECT = 'mailto:hello@sonicboom.org.uk';

const enc = new TextEncoder();

export const b64url = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const unb64url = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), c => c.charCodeAt(0));

const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of parts) { out.set(p, i); i += p.length; }
  return out;
};

async function hmac(key, data) {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data));
}

/** The VAPID signing key, from the public key and the secret "d". */
async function vapidKey(publicKey, privateD) {
  const pub = unb64url(publicKey);
  return crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', x: b64url(pub.slice(1, 33)), y: b64url(pub.slice(33, 65)), d: privateD, ext: true },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
}

/** "vapid t=…, k=…" for one push service origin, valid for 12 hours. */
export async function vapidAuth(endpoint, publicKey, privateD, now = Date.now()) {
  const header = b64url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64url(enc.encode(JSON.stringify({
    aud: new URL(endpoint).origin,
    exp: Math.floor(now / 1000) + 12 * 3600,
    sub: VAPID_SUBJECT,
  })));
  const key = await vapidKey(publicKey, privateD);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${header}.${claims}`));
  return `vapid t=${header}.${claims}.${b64url(sig)}, k=${publicKey}`;
}

/** Encrypt one message for a subscription ({ p256dh, auth }, base64url). Returns the request body. */
export async function encryptPayload(payload, { p256dh, auth }) {
  const uaPublic = unb64url(p256dh);
  const authSecret = unb64url(auth);
  const local = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', local.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, local.privateKey, 256));

  // RFC 8291 §3.4: combine the shared secret with the subscription's auth secret.
  const prkKey = await hmac(authSecret, ecdhSecret);
  const ikm = await hmac(prkKey, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic, new Uint8Array([1])));
  // RFC 8188 §2.2: content key and nonce from a random salt.
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, concat(enc.encode('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, concat(enc.encode('Content-Encoding: nonce\0'), new Uint8Array([1])))).slice(0, 12);

  // One record: the message plus the 0x02 "last record" delimiter.
  const plain = concat(enc.encode(payload), new Uint8Array([2]));
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, plain));

  const rs = 4096;
  const header = concat(salt, new Uint8Array([rs >>> 24, (rs >>> 16) & 255, (rs >>> 8) & 255, rs & 255, asPublic.length]), asPublic);
  return concat(header, cipher);
}

/**
 * Send one notification. message: { title, body, url, tag }. Returns 'ok', 'gone' (the
 * subscription has expired or been revoked: delete it) or an error string.
 */
export async function sendPush(env, sub, message) {
  if (!env.VAPID_PRIVATE_KEY) return 'VAPID_PRIVATE_KEY not set';
  try {
    const body = await encryptPayload(JSON.stringify(message), sub);
    const res = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        Authorization: await vapidAuth(sub.endpoint, VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY),
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: '86400',
        Urgency: 'normal',
      },
      body,
    });
    if (res.ok) return 'ok';
    if (res.status === 404 || res.status === 410) return 'gone';
    return `push service ${res.status}: ${(await res.text()).slice(0, 200)}`;
  } catch (err) {
    return `push failed: ${err?.message ?? err}`;
  }
}

/**
 * Notify everyone in `emails` on every device they've turned notifications on for. Expired
 * subscriptions are removed. Returns { sent, failed }.
 */
export async function notify(env, emails, message) {
  const db = env.OPS_DB;
  if (!db || !emails?.length) return { sent: 0, failed: 0 };
  const list = emails.map(e => e.toLowerCase());
  const { results } = await db
    .prepare(`SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE email IN (${list.map(() => '?').join(', ')})`)
    .bind(...list)
    .all();
  let sent = 0, failed = 0;
  await Promise.all(results.map(async sub => {
    const r = await sendPush(env, sub, message);
    if (r === 'ok') {
      sent++;
      await db.prepare("UPDATE push_subscriptions SET last_ok_at = datetime('now') WHERE id = ?").bind(sub.id).run();
    } else {
      failed++;
      if (r === 'gone') await db.prepare('DELETE FROM push_subscriptions WHERE id = ?').bind(sub.id).run();
      else console.log('push error', r);
    }
  }));
  return { sent, failed };
}
