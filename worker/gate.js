// Pre-launch PIN gate in front of the Astro worker (wrangler `main`). With
// `assets.run_worker_first`, every request comes through here before Astro serves a page or file.
//
//  - /team and /api/team: Cloudflare Access (sonicboom.org.uk accounts), not the PIN. See DEPLOY.md §5a.
//  - /feedback, its endpoints, /privacy, /accessibility and static files: open to everyone, so
//    audiences can do the post-event survey from a QR code.
//  - Everything else: needs the preview PIN (secret PREVIEW_PIN). Once entered, a strictly
//    necessary cookie remembers it for 30 days. Remove the secret to switch the gate off at launch.

import astro from '../dist/_worker.js/index.js';
import { runReminders } from '../src/lib/reminders.js';
import { utmFrom, record, isBot } from '../src/lib/attribution.js';

const OPEN = [
  /^\/feedback(\/|$)/,
  /^\/api\/feedback\//,
  /^\/privacy\/?$/,
  /^\/accessibility\/?$/,
  /^\/_astro\//,
  /^\/fonts\//,
  /^\/img\//,
  /^\/favicon/,
  /^\/robots\.txt$/,
  /^\/api\/attribution$/,
];
const BEHIND_ACCESS = [/^\/team(\/|$)/, /^\/api\/team\//];
const COOKIE = 'between_preview';
const PIN_PATH = '/__preview';

export default {
  // Daily cron (wrangler.toml, 07:00 UTC): the leads' and community managers' reminder emails.
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runReminders(env).then(r => console.log('reminders', r.sent, r.reason ?? r.subject)));
  },

  async fetch(request, env, ctx) {
    countTrackedVisit(request, env, ctx);
    const url = new URL(request.url);
    const path = url.pathname;
    const pin = env.PREVIEW_PIN;

    if (!pin || OPEN.some(r => r.test(path)) || BEHIND_ACCESS.some(r => r.test(path))) {
      return astro.fetch(request, env, ctx);
    }

    const expected = await tokenFor(pin);

    if (path === PIN_PATH && request.method === 'POST') {
      const form = await request.formData().catch(() => null);
      const next = safeNext(form?.get('next'));
      if (String(form?.get('pin') ?? '').trim() === pin) {
        return new Response(null, {
          status: 303,
          headers: {
            Location: next,
            'Set-Cookie': `${COOKIE}=${expected}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax`,
          },
        });
      }
      return pinPage(next, true);
    }

    if (readCookie(request, COOKIE) === expected) return astro.fetch(request, env, ctx);

    if (path.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'Preview PIN required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return pinPage(path + url.search, false);
  },
};

async function tokenFor(pin) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`between-preview:${pin}`));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function readCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  const match = header.split(/;\s*/).find(c => c.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : null;
}

// Only ever redirect back to a path on this site. Browsers treat "/\\host" like "//host", so reject
// backslashes, control characters and protocol-relative paths outright.
function safeNext(value) {
  const s = typeof value === 'string' ? value : '/';
  return /^\/(?![\/\\])[^\\\s\u0000-\u001f]*$/.test(s) && s !== PIN_PATH ? s : '/';
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function pinPage(next, wrong) {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Preview · The Space Between</title>
<style>
  @font-face { font-family: 'Fraunces'; src: url('/fonts/fraunces/fraunces-normal-latin.woff2') format('woff2'); font-weight: 100 900; font-display: swap; }
  @font-face { font-family: 'Hanken Grotesk'; src: url('/fonts/hanken/hanken-400-latin.woff2') format('woff2'); font-weight: 400; font-display: swap; }
  @font-face { font-family: 'Hanken Grotesk'; src: url('/fonts/hanken/hanken-600-latin.woff2') format('woff2'); font-weight: 600; font-display: swap; }
  :root { --ink: #1A1212; --ink-soft: #241A1A; --red: #C8102E; --ember: #E8A23D; --paper: #F4EFEA; --body: #C9BFBA; --line: #3A2C2C; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100svh; display: grid; place-items: center; padding: 1.5rem 1rem;
    background: var(--ink); color: var(--paper);
    font-family: 'Hanken Grotesk', -apple-system, Arial, sans-serif;
  }
  main { width: 100%; max-width: 24rem; }
  .by { margin: 0 0 0.5rem; font-size: 0.75rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ember); }
  h1 { font-family: 'Fraunces', Georgia, serif; font-size: clamp(2.2rem, 10vw, 3rem); line-height: 1; letter-spacing: -0.03em; margin: 0 0 1rem; }
  p { color: var(--body); line-height: 1.6; margin: 0 0 1.5rem; }
  label { display: block; font-weight: 600; margin-bottom: 0.4rem; }
  .row { display: flex; gap: 0.5rem; }
  input {
    flex: 1; min-width: 0; font: inherit; font-size: 1.25rem; letter-spacing: 0.3em;
    padding: 0.75rem 0.9rem; border-radius: 6px; border: 2px solid var(--line);
    background: var(--ink-soft); color: var(--paper);
  }
  input:focus-visible, button:focus-visible { outline: 3px solid var(--ember); outline-offset: 2px; }
  input[aria-invalid="true"] { border-color: #ff8080; }
  button {
    font: inherit; font-weight: 600; padding: 0.75rem 1.25rem; border: 0; border-radius: 6px;
    background: var(--red); color: #fff; cursor: pointer;
  }
  button:hover { background: #a50d26; }
  .err { color: #ff9a9a; margin: 0.6rem 0 0; font-size: 0.95rem; }
  .alt { margin-top: 2rem; font-size: 0.95rem; }
  .alt a { color: var(--ember); }
</style>
</head>
<body>
<main>
  <p class="by">Sonic Boom Music CIC · Preview</p>
  <h1>The Space Between</h1>
  <p>We're putting the finishing touches to this site. Enter the preview PIN to take a look.</p>
  <form method="post" action="${PIN_PATH}">
    <input type="hidden" name="next" value="${esc(next)}">
    <label for="pin">Preview PIN</label>
    <div class="row">
      <input id="pin" name="pin" type="password" inputmode="numeric" autocomplete="off" required autofocus${wrong ? ' aria-invalid="true" aria-describedby="pin-err"' : ''}>
      <button type="submit">Enter</button>
    </div>
    ${wrong ? '<p class="err" id="pin-err" role="alert">That PIN isn\'t right. Try again.</p>' : ''}
  </form>
  <p class="alt">Been to one of our events? <a href="/feedback">Tell us how it went</a>.</p>
</main>
<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "691a25c25a2b4921a3554bee800e01ef"}'></script>
</body>
</html>`;
  return new Response(html, {
    status: 401,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  });
}
