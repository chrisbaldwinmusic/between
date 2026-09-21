# Deploy — Cloudflare Workers

How to get `between.sonicboom.org.uk` live on the existing **`between`** Cloudflare Worker
(account: Sonic Boom, `between.sonic-boom.workers.dev`), including the KV binding for the venue
poll, the custom domain, and a pre-launch checklist.

This project deploys as a **Worker with static assets**, not Cloudflare Pages. It reuses the
`between` Worker that already existed on the account before this codebase — matching how the
account's other subdomains (`mailer.`, `platform.`, etc.) are deployed.

## 1. Astro config

`astro.config.mjs` uses the Cloudflare adapter and static output. No component in this project
uses `astro:assets` / `<Image>` (plain `<img>` tags throughout), so `imageService` is
`'passthrough'` — `'compile'` mode bundles an unused Sharp-dependent image endpoint that breaks
once real dynamic routes exist.

```js
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  output: 'static',
  adapter: cloudflare({
    imageService: 'passthrough',
    sessionKVBindingName: undefined,
    platformProxy: { enabled: true }, // KV emulation for `npm run dev`
  }),
  site: 'https://between.sonicboom.org.uk',
});
```

Build command: `npm run build` · Output directory: `dist`.

## 2. wrangler.toml — Worker, not Pages

```toml
name = "between"
main = "./dist/_worker.js/index.js"
compatibility_date = "2026-09-21"

[assets]
directory = "./dist"
binding = "ASSETS"

[[kv_namespaces]]
binding = "VENUE_KV"
id = "2202b52bbf514acebf0fa67f5bf4713e"
preview_id = "78f18b42723a401b8a3444298e9cbd7f"
```

**Important — two things that are easy to get wrong:**

1. The `@astrojs/cloudflare` adapter builds `dist/_worker.js` ("advanced mode"). Cloudflare
   treats a top-level `functions/` directory and an `_worker.js` as mutually exclusive — if
   `_worker.js` exists, `functions/` is never invoked. So the dynamic routes (`/api/vote`,
   `/api/results`, `/api/subscribe`) live as ordinary Astro pages under `src/pages/api/*.js`,
   each with `export const prerender = false;`. They read bindings as
   `context.locals.runtime.env.VENUE_KV`, not `context.env`.
2. `[assets] directory = "./dist"` uploads everything in `dist/`, including the `_worker.js`
   folder itself, as downloadable static files unless excluded. `public/.assetsignore` (copied
   to `dist/.assetsignore` on every build) contains `_worker.js` to prevent that.

Run locally:

```bash
npm run build
npx wrangler dev            # real Worker mode — binds KV, serves ASSETS, runs the API routes
```

(`npx wrangler pages dev ./dist` also still works for a quick static-only smoke test, but it
doesn't reflect the real deploy target — use `wrangler dev` / `wrangler deploy`.)

## 3. Deploy

```bash
npm run build
npx wrangler deploy
```

This **updates the existing `between` Worker in place** (script name `between` matches
`wrangler.toml`'s `name`) — it does not create a new project. Deploys to:
`https://between.sonic-boom.workers.dev`.

### Connect Git for automatic deploys (optional, one-time dashboard step)

The `between` Worker isn't currently connected to GitHub — deploys are manual (`wrangler deploy`)
unless you wire up **Workers Builds**:

1. Cloudflare dashboard → **Workers & Pages → `between` → Settings → Build → Connect to Git**.
2. Authorize the Cloudflare GitHub App for `chrisbaldwinmusic/between` (one-time OAuth/App
   install — this step can't be done via API, only the dashboard).
3. Build command: `npm run build` · Deploy command: `npx wrangler deploy` · Root directory: `/`.

## 4. KV namespace (venue poll)

Already created and bound: `VENUE_KV` (see `wrangler.toml`). To recreate elsewhere:

```bash
npx wrangler kv namespace create VENUE_KV
npx wrangler kv namespace create VENUE_KV --preview
# paste the returned ids into wrangler.toml
```

### If you chose D1 instead of KV (per-response postcodes)

```bash
npx wrangler d1 create between-votes
# bind as DB in wrangler.toml:
# [[d1_databases]]
# binding = "DB"
# database_name = "between-votes"
# database_id = "..."
```
Schema: `votes(id, choice, outward_code, created_at)`. `/api/results` aggregates with `COUNT`/`GROUP BY`. KV is simpler and recommended unless you specifically need per-response geography.

## 4a. D1 database (the /team ops tool)

`/team` is a **live, editable project/productivity tool**, not static content — to-dos, the
schedule and the roster are all read and written from a D1 database (`OPS_DB` binding, database
`between-ops`), with every write logged to an `activity_log` table shown on the dashboard.

Schema lives at `d1/schema.sql`. Already created and bound (see `wrangler.toml`). To recreate
elsewhere:

```bash
npx wrangler d1 create between-ops
# paste the returned database_id into wrangler.toml under [[d1_databases]]
npx wrangler d1 execute between-ops --remote --file=d1/schema.sql
```

For local dev, seed the **local** D1 emulation separately (it's a different SQLite file, not the
production database) so `npm run dev` / `wrangler dev` has data to show:

```bash
npx wrangler d1 execute between-ops --local --file=d1/schema.sql
```

The API routes are under `src/pages/api/team/*` (`todos`, `schedule`, `roster`, `activity`),
each `prerender = false`, reading/writing via `context.locals.runtime.env.OPS_DB`. Every write
stamps the actor from `Cf-Access-Authenticated-User-Email` (the header Cloudflare Access injects)
so changes are attributable — see §5a.

## 5. Values & env vars

Most integrations are **public client-side values**, not secrets:

| Value | How it's set |
|---|---|
| Email signup (Turnstile + `mailer.sonicboom.org.uk`) | `SignupSection`/`SignupStrip` + `src/pages/api/subscribe.js` (public) |
| WhatsApp invite link | In component/data (public) |
| Ticket Tailor URLs | In `events.json` / membership (public) |
| Cloudflare Web Analytics token | In the `BaseLayout` snippet (public) |
| `VENUE_KV` | KV binding (step 4) — not a secret |
| `OPS_DB` | D1 binding (step 4a) — not a secret |

Only add a Worker **secret** if you later build a Resend-backed email function:
`npx wrangler secret put RESEND_API_KEY`.

## 5a. Pre-launch access gate

The whole site (including `/team`) sits behind **Cloudflare Access**, not application code. The
Access application "Between (Sonic Boom)" covers both `between.sonicboom.org.uk` and
`between.sonic-boom.workers.dev`, reusing the account's existing **"Sonic Boom team"** policy
(`email_domain = sonicboom.org.uk`, login via Google Workspace SSO or a one-time PIN emailed to
the address). Nothing in this repo needs to change to keep it working — it's edge-level,
configured in the Cloudflare dashboard under **Zero Trust → Access → Applications**.

**Whenever you add or change a hostname this Worker serves from (a new custom domain, a renamed
workers.dev subdomain), add it to the Access app's domain list immediately** — a hostname the
Access app doesn't know about is served unauthenticated. This bit us twice while setting this up.

The `/team` section (people, schedule, to-dos, ops procedures — `src/pages/team/`) is internal
and marked `noindex`. It stays behind Access even after the public marketing pages go live, unless
you split the Access application to scope it to `/team/*` only.

## 6. Custom domain + DNS

Already attached: `between.sonicboom.org.uk` → the `between` Worker, via a **Workers Custom
Domain** (`PUT /accounts/{account_id}/workers/domains/records`), not a Pages custom domain. This
creates a managed `AAAA` placeholder record and issues its own certificate automatically — no
manual DNS record needed.

To reattach elsewhere or recreate from scratch:

```bash
# via dashboard: Workers & Pages → between → Settings → Domains & Routes → Add → Custom domain
# or via API:
curl -X PUT "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/workers/domains/records" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"zone_id":"<sonicboom.org.uk zone id>","hostname":"between.sonicboom.org.uk","service":"between","environment":"production"}'
```

Certificate issuance (Google Trust Services, TXT validation) typically takes 1–3 minutes.

**Note:** a Cloudflare Pages project (`between-sonicboom`) was created earlier in this project's
history and is now unused — the deploy target is the `between` Worker. Delete the Pages project
from the dashboard if you want to tidy up (**Workers & Pages → between-sonicboom → Settings →
Delete project**); it isn't wired to anything and costs nothing left as-is.

## 7. Pre-launch checklist

**Content**
- [ ] All ten event dates confirmed (indicative Saturdays replaced)
- [ ] Event blurbs, prices, access notes final
- [ ] Founding Membership price + benefits in
- [ ] Partner logos in + permission to display
- [ ] Hero aftermovie + poster + warm hero photo in
- [ ] OG image + favicon set in

**Integrations**
- [ ] Email signup tested end-to-end (a real test sign-up arrives via mailer.sonicboom.org.uk)
- [ ] WhatsApp Community invite link live
- [ ] Ticket Tailor links in for any on-sale events (currently a general redirect to events.sonicboom.org.uk)
- [ ] `VENUE_KV` bound; `/api/vote` and `/api/results` work on the live domain
- [ ] `OPS_DB` bound; `/team` to-dos, schedule and roster read/write correctly on the live domain
- [ ] Cloudflare Web Analytics token in; data registering
- [ ] Workers Builds connected to GitHub for automatic deploys (step 3), if wanted

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
