# Build prompts — between.sonicboom.org.uk

Paste these into Claude Code **one at a time**, in order. Commit between each step. Keep `docs/concept.md` and `CLAUDE.md` in the repo so the agent can reference them. The MVP (steps 1–7) is launch-ready on its own; 8–10 add the live meter, polish and deploy.

---

## 0 · Kickoff (paste first, once)

```
We're building the website for "The Space Between" — Sonic Boom Music CIC's year-round
music programme — at between.sonicboom.org.uk. The full concept is in docs/concept.md and
the rules are in CLAUDE.md; read both.

Stack: Astro (static, @astrojs/cloudflare), deployed to Cloudflare Pages. Cloudflare Pages
Functions + KV for the one dynamic feature (a venue-demand poll). MailerLite embedded form
for email. Ticket Tailor links for tickets. Cloudflare Web Analytics. Self-hosted fonts.

Apply the hard rules in CLAUDE.md to everything (venue = ambition only; mobile-first;
WCAG 2.2 AA; honour prefers-reduced-motion; every section welcomes someone in or counts
them in; UTMs on every CTA; no cookie wall).

Don't build yet — confirm you've read both docs and outline the file/folder structure
you'll create. I'll then give you build steps one at a time.
```

## 1 · Scaffold

```
Scaffold an Astro project for Cloudflare Pages (@astrojs/cloudflare adapter, output:
'static'). Create the structure from concept.md §11: src/data/events.json, src/components/,
src/layouts/BaseLayout.astro, src/pages/ (index + accessibility + privacy + events/[slug]),
src/styles/tokens.css, src/lib/poll.js, public/fonts, public/img, functions/api/ (empty for
now), wrangler.toml. Add package.json scripts (dev, build) and confirm `npm run dev` works.
No content yet — just the skeleton.
```

## 2 · Design tokens + base layout

```
Implement the design system (concept.md §9) in src/styles/tokens.css as CSS custom
properties: --ink #1A1212, --ink-soft #241A1A, --red #C8102E, --ember #E8A23D,
--paper #F4EFEA, --body #C9BFBA, --line #3A2C2C. Self-host Fraunces (display) and Hanken
Grotesk (body) into public/fonts with font-display: swap; fallbacks 'Georgia, serif' and
'-apple-system, Arial, sans-serif'. Build BaseLayout.astro: warm-dark theme, sticky SiteNav
(anchor links + persistent "Join the community" button), Footer (contact, socials,
sonicboom.org.uk + festival.sonicboom.org.uk, privacy link, "Believe in the Power of
Music."). Add a global prefers-reduced-motion block and a skip-to-content link. Verify body
text and red/ember on --ink pass AA.
```

## 3 · Hero

```
Build the Hero (concept.md §6.1). Background: muted autoplay looping aftermovie
(youtube-nocookie or self-hosted webm — leave the source as a TODO placeholder) with a dark
gradient overlay for contrast and a poster-image fallback; under prefers-reduced-motion show
only the poster, no video. Headline (display): "The space between festivals is where a town
decides what it wants." Sub: one free or low-cost event a month, all year, across Burton —
come to one, then come back. Primary CTA "Join the community" (scroll to signup, UTM-tagged),
secondary "See the year". Small live line "[N] people are already in" wired to a placeholder
I'll connect to /api/results in step 8.
```

## 4 · The year (events)

```
Populate src/data/events.json with all ten events (concept.md §7 schema): Folk Stories &
Firelight (Oct) → Winter Sounds (Dec) → New Year Community Sing (Jan) → Love Your Local
(Feb) → Family Music Discovery Day (Mar) → Global Sounds (Apr) → Music in the Market (May)
→ Summer Park Sessions (Jun) → Youth Takeover (Jul) → Community Music Trail (Sep). Use the
indicative Saturday dates as placeholders; ticketUrl/registerUrl null for now. Build
EventRibbon (horizontal calendar desktop, vertical stack mobile) of EventCards from that
data: month, name, one-line format, free/ticketed tag, venue, action (Register / Get
tickets / Notify me). Light filters: All · Free · Ticketed · Daytime · Evening. Per-event
accent. Generate events/[slug] pages from the same data (full blurb + access + action).
```

## 5 · The idea + the ladder

```
Build two sections (concept.md §6.2, §6.4). "The idea": short warm prose — the festival is
one day; the year is where a scene is built or lost — and name the loop come once → come
back → shape what's next, with a simple non-jargon ladder graphic. "How it works": three
steps — 1. Come to one (free or from £7.50) · 2. Join the community (hear about the next
one first) · 3. Become a Founding Member — each with a micro-CTA.
```

## 6 · Membership, Get involved, Accessibility, Partners + sub-pages

```
Build four sections plus two pages (concept.md §6.5–6.9). Founding Membership: honest
framing — backs the year-round programme AND the venue campaign, NOT a building that
exists; price TBC placeholder; launches at Winter Sounds (Dec 2026); CTA "Become a Founding
Member" (Ticket Tailor link placeholder). Get involved: audiences (join), artists ("want to
play?" link), partners/press (hello@sonicboom.org.uk). Accessibility summary: step-free,
quiet spaces, BSL on request, access fund, Tickets for Good; name Safe Gigs for Women +
Good Night Out; "tell us what you need" → accessibility@sonicboom.org.uk; link to
/accessibility. Partners: logo grid (placeholders) — ESBC, Burton Library, the Brewhouse,
BCA, Burton Folk Club, BSDC, Burton Albion FC, Circularity.org, BBC Introducing East
Midlands, Staffs Wildlife Trust. Also build the full /accessibility and /privacy pages.
```

## 7 · Email capture (MailerLite) + WhatsApp

```
Add the email signup as the primary conversion (concept.md §8). Embed a MailerLite form
(account/form ID as a clearly-marked TODO placeholder) styled to the theme: real <label>s,
1–2 fields, clear success/error states, no placeholder-as-label. Place it above the fold
(hero CTA target) and again before the footer. Add a WhatsApp Community "Join" button beside
it (invite-link TODO). UTM-tag both. This completes the launch-ready MVP.
```

## 8 · Venue poll (Pages Function + KV)

```
Build the venue-demand feature (concept.md §6.6, §8). Cloudflare Pages Functions:
- functions/api/vote.js → POST {choice:"yes"|"maybe", postcode?} → increment KV counters
  (yes, maybe, total) with simple per-IP/day rate-limiting; store postcode only as an
  aggregate count by outward code; never in a URL.
- functions/api/results.js → GET → {total, yes, maybe, yesPct}.
Bind KV namespace VENUE_KV in wrangler.toml for local dev. Build DemandMeter: one-tap
question "Would you use a permanent grassroots music venue in Burton?" (Yes / Maybe); on
submit reveal live count + yes-share and invite optional postcode + email. Animate the
meter filling; show a static value under prefers-reduced-motion. Wire the hero "[N] people
are already in" line to /api/results.
```

## 9 · Polish: SEO, structured data, performance, a11y pass

```
Final pass (concept.md §10, §11). Per-page <title>/description, Open Graph + Twitter cards
with a warm hero image, favicon set. schema.org EventSeries/Event from events.json. Lazy-
load video and below-fold images; confirm fonts swap; target Lighthouse 90+ mobile. Add the
Cloudflare Web Analytics snippet (token as TODO). Accessibility sweep: one h1/page, logical
headings, skip link, visible focus, full keyboard, alt text, captions available on the
aftermovie. Fix anything below AA.
```

## 10 · Ship to Cloudflare Pages

```
Prepare for deploy per docs/DEPLOY.md. Confirm astro.config uses @astrojs/cloudflare and
builds to /dist. Give me: the Cloudflare Pages connect-to-Git settings (build command
`npm run build`, output dir `dist`), how to create and bind the VENUE_KV namespace to the
Pages project (dashboard + wrangler), where MailerLite / Ticket Tailor / WhatsApp / Web
Analytics values live, and the steps to add the custom domain between.sonicboom.org.uk with
DNS. Then output the final pre-launch checklist from docs/DEPLOY.md and tell me which items
are still open.
```

---

**Have ready before step 7–8:** MailerLite form ID, WhatsApp Community invite link, and a decision on KV vs D1 for the poll (KV = simple counts; D1 = per-response postcodes). See `docs/CONTENT.md`.
