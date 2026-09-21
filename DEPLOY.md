# Deploy — Cloudflare Pages

How to get `between.sonicboom.org.uk` live on Cloudflare Pages, including the KV binding for the venue poll, the custom domain, and a pre-launch checklist.

## 1. Astro config

`astro.config.mjs` should use the Cloudflare adapter and static output:

```js
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  output: 'static',
  adapter: cloudflare(),
  site: 'https://between.sonicboom.org.uk',
});
```

Build command: `npm run build` · Output directory: `dist`.

## 2. Local dev with API routes + KV

`wrangler.toml` (for local Functions + KV during development):

```toml
name = "between-sonicboom"
compatibility_date = "2024-11-01"
pages_build_output_dir = "dist"

[[kv_namespaces]]
binding = "VENUE_KV"
id = "PLACEHOLDER"            # real id added after you create the namespace (step 4)
preview_id = "PLACEHOLDER"
```

Run locally:

```bash
npm run build
npx wrangler pages dev ./dist          # runs the built worker + binds KV
```

**Important:** the `@astrojs/cloudflare` adapter builds `dist/_worker.js` ("advanced mode").
Cloudflare Pages treats a top-level `functions/` directory and an `_worker.js` as mutually
exclusive — if `_worker.js` exists, `functions/` is never invoked. So the dynamic routes
(`/api/vote`, `/api/results`, `/api/subscribe`) live as ordinary Astro pages under
`src/pages/api/*.js`, each with `export const prerender = false;`. They read bindings as
`context.locals.runtime.env.VENUE_KV`, not `context.env`. `astro.config.mjs` sets
`platformProxy: { enabled: true }` so `npm run dev` also gets KV emulation, not just
`wrangler pages dev`.

## 3. Connect the repo to Cloudflare Pages

1. Push the repo to GitHub/GitLab.
2. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**.
3. Pick the repo. Build settings:
   - **Framework preset:** Astro
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. Deploy. You get a `*.pages.dev` preview URL — test it before adding the custom domain.

## 4. Create & bind the KV namespace (venue poll)

Dashboard route:
1. **Workers & Pages → KV → Create namespace** → name it `VENUE_KV`. Copy the namespace ID.
2. Your Pages project → **Settings → Functions → KV namespace bindings → Add**:
   - Variable name: `VENUE_KV`
   - Namespace: the one you just made
   - Add for **both Production and Preview**.
3. Put the namespace ID into `wrangler.toml` for local dev.

Or via CLI:

```bash
npx wrangler kv namespace create VENUE_KV
npx wrangler kv namespace create VENUE_KV --preview
# paste the returned ids into wrangler.toml
```

### If you chose D1 instead of KV (per-response postcodes)

```bash
npx wrangler d1 create between-votes
# bind as DB in Pages → Settings → Functions → D1 bindings, and in wrangler.toml:
# [[d1_databases]]
# binding = "DB"
# database_name = "between-votes"
# database_id = "..."
```
Schema: `votes(id, choice, outward_code, created_at)`. `/api/results` aggregates with `COUNT`/`GROUP BY`. KV is simpler and recommended unless you specifically need per-response geography.

## 5. Values & env vars

Most integrations are **public client-side values**, not secrets:

| Value | How it's set |
|---|---|
| MailerLite form/account ID | In the embed in `SignupForm` (public) |
| WhatsApp invite link | In component/data (public) |
| Ticket Tailor URLs | In `events.json` / membership (public) |
| Cloudflare Web Analytics token | In the `BaseLayout` snippet (public) |
| `VENUE_KV` | KV binding (step 4) — not a secret |

Only add a Pages **secret** if you later build a Resend-backed email function: **Settings → Environment variables → Add → Encrypt** → `RESEND_API_KEY`.

## 5a. Pre-launch access gate

The whole site (including `/team`) sits behind **Cloudflare Access**, not application code. The
Access application "Between (Sonic Boom)" is created against `between.sonicboom.org.uk`, reusing
the account's existing **"Sonic Boom team"** policy (`email_domain = sonicboom.org.uk`, login via
Google Workspace SSO or a one-time PIN emailed to the address). Nothing in this repo needs to
change to keep it working — it's edge-level, configured in the Cloudflare dashboard under
**Zero Trust → Access → Applications**.

The `/team` section (people, schedule, to-dos, ops procedures — `src/pages/team/`) is internal
and marked `noindex`. It stays behind Access even after the public marketing pages go live, unless
you split the Access application to scope it to `/team/*` only.

## 6. Custom domain + DNS

1. Pages project → **Custom domains → Set up a custom domain** → `between.sonicboom.org.uk`.
2. If `sonicboom.org.uk` is already on Cloudflare DNS, Cloudflare adds the `CNAME` for the `between` subdomain automatically — accept it. If DNS is elsewhere, add a `CNAME` record: `between` → `<project>.pages.dev` (proxied).
3. Wait for the certificate to issue (usually minutes). Pages serves HTTPS automatically.

## 7. Pre-launch checklist

**Content**
- [ ] All ten event dates confirmed (indicative Saturdays replaced)
- [ ] Event blurbs, prices, access notes final
- [ ] Founding Membership price + benefits in
- [ ] Partner logos in + permission to display
- [ ] Hero aftermovie + poster + warm hero photo in
- [ ] OG image + favicon set in

**Integrations**
- [ ] MailerLite form live and tested (a real test sign-up arrives)
- [ ] WhatsApp Community invite link live
- [ ] Ticket Tailor links in for any on-sale events
- [ ] `VENUE_KV` bound in Production + Preview; `/api/vote` and `/api/results` work on the `pages.dev` URL
- [ ] Cloudflare Web Analytics token in; data registering

**Quality**
- [ ] Mobile (≈375px) checked end to end
- [ ] `prefers-reduced-motion` verified — no autoplay video, no animation
- [ ] WCAG AA: contrast, keyboard, focus states, one h1/page, alt text, real labels
- [ ] Lighthouse 90+ on mobile
- [ ] Every CTA carries UTM params
- [ ] No personal data in URLs; privacy notice live

**Integrity (the one that matters most)**
- [ ] Venue framed as ambition everywhere — no confirmed/dated/capacity language
- [ ] Founding Membership = community + campaign, not a building that exists

**Go live**
- [ ] Custom domain resolves on HTTPS
- [ ] Test the full journey on a real phone: land → understand → join → see the year → answer the poll
- [ ] When the public marketing pages are ready to go live, scope the "Between (Sonic Boom)" Access application to `/team/*` only (Zero Trust → Access → Applications), so `/team` stays private but the rest of the site opens up
