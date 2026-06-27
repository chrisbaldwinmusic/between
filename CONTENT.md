# Content & asset checklist

Everything you need to supply for the build, where it goes, and whether it blocks launch. Fill the **Value / status** column as you go. Items marked **MVP** are needed before the site can go live; the rest can land after.

## Copy & framing decisions

| Item | Where it lives | MVP? | Value / status |
|---|---|---|---|
| Font direction — Fraunces serif vs strict Arial/Hanken | `tokens.css` / decision | MVP | |
| Founding Membership price | `MembershipBlock`, `/membership` | MVP | |
| Founding Membership benefits (3–4 bullets) | `MembershipBlock` | MVP | |
| Poll storage — KV (counts) or D1 (per-response postcodes) | `functions/api/`, `DEPLOY.md` | step 8 | |
| Which partners to display + logo permissions | `PartnerGrid` | MVP | |

## Media & imagery

| Item | Where it lives | MVP? | Value / status |
|---|---|---|---|
| Aftermovie file or YouTube-nocookie ID (hero loop) | `Hero` `// TODO` | MVP | |
| Hero poster still (shown under reduced-motion / as fallback) | `public/img` | MVP | |
| Captioned full aftermovie (accessibility) | linked | post-launch | |
| Warm hero photo (real Burton crowd, not stock) | `public/img` | MVP | |
| Per-event artwork or representative photo (×10) | `events.json` / `public/img` | nice-to-have | |
| OG / social share image | `public/img`, meta | MVP | |
| Favicon set | `public/` | MVP | |
| Partner logos (×up to 10) | `public/img/partners` | MVP | |
| "Featured listen" artist/track (e.g. Spotify embed) | event card or strip | post-launch | |

## Events (`src/data/events.json`)

| Item | MVP? | Value / status |
|---|---|---|
| Confirmed dates for all ten (replace indicative Saturdays) | MVP | |
| Final blurb per event | MVP | |
| Free/ticketed + priceFrom per event | MVP | |
| Ticket Tailor URL per ticketed event (as they go live) | rolling | |
| Register URL per free event | rolling | |
| Access note per event | MVP | |

Ten events, in order: Folk Stories & Firelight (Oct) · Winter Sounds (Dec) · New Year Community Sing (Jan) · Love Your Local (Feb) · Family Music Discovery Day (Mar) · Global Sounds (Apr) · Music in the Market (May) · Summer Park Sessions (Jun) · Youth Takeover (Jul) · Community Music Trail (Sep).

## Integrations & keys (the `// TODO` placeholders)

| Item | Where it lives | Public or secret | MVP? | Value / status |
|---|---|---|---|---|
| MailerLite account + form ID | `SignupSection` embed | Public (client embed) | MVP | Account 1114181 · Form 147122363674134026 ✓ |
| WhatsApp Community invite link | `SignupSection` / `SignupStrip` | Public | MVP | https://chat.whatsapp.com/DTBdI2ur34oKah3pOn2zpm ✓ |
| Ticket Tailor links | `events.json`, membership | Public | rolling | |
| Cloudflare Web Analytics token | `BaseLayout` snippet | Public | MVP | |
| KV namespace `VENUE_KV` | `wrangler.toml` + Pages binding | Binding (not a secret) | step 8 | |
| Custom domain `between.sonicboom.org.uk` | Cloudflare Pages + DNS | — | launch | |

> None of the integration values above are secrets — MailerLite/Ticket Tailor/WhatsApp/Analytics are all client-side public values, and `VENUE_KV` is a binding. There are no API secrets to manage unless you later add a Resend-backed email function (then `RESEND_API_KEY` becomes a Pages secret).

## Standing copy (already known — for reference)

- Contact: hello@sonicboom.org.uk · Accessibility: accessibility@sonicboom.org.uk
- Sister sites: sonicboom.org.uk, festival.sonicboom.org.uk
- Frameworks to name: Safe Gigs for Women, Good Night Out Campaign; Tickets for Good partner
- Sign-off: *Believe in the Power of Music.*
- Venue line (ambition only): "East Staffordshire Borough Council is exploring the business case… our ambition is to run it."
