# CLAUDE.md — rules for building this site

You are building **between.sonicboom.org.uk** for Sonic Boom Music CIC. Read `docs/concept.md` for the full brief. These rules apply to everything you generate; treat them as constraints, not suggestions.

## Stack (don't substitute without asking)

- **Astro**, static output, `@astrojs/cloudflare` adapter.
- **Cloudflare Pages** for hosting; **Pages Functions + KV** for the venue poll (the only dynamic feature).
- **MailerLite** embed for email; **Ticket Tailor** links for tickets; **Cloudflare Web Analytics**.
- Self-hosted fonts. No client-side framework beyond what Astro needs. Keep JS minimal.

## Hard rules — never break these

1. **The permanent venue is an AMBITION.** Never write or imply it is confirmed, scheduled, dated, or has a fixed capacity. Always frame as "our ambition", "building the case", "if the demand is there", "exploring the business case". The Founding Membership is membership of the **audience community and the venue campaign** — NOT membership of a building that exists.
2. **Mobile-first.** Design and test at ~375px first. This audience is on a phone.
3. **Accessibility is structural, WCAG 2.2 AA minimum.** One `h1` per page, semantic landmarks, logical heading order, skip-to-content link, visible focus states, full keyboard operability, real `<label>`s (never placeholder-as-label), alt text on all images.
4. **Honour `prefers-reduced-motion` everywhere.** No autoplay video, no grain/glow/meter animation when it's set — show static equivalents.
5. **Every section earns its place by doing one of two things:** welcome someone in, or count them in. If it does neither, don't build it.
6. **Every outbound / share / CTA link carries UTM params** so channel attribution works.
7. **No personal data in URLs.** Poll writes are POSTs. Email/postcode are always optional and explained at the point of capture.
8. **No cookie wall.** Use Cloudflare Web Analytics (cookieless). Don't add Google Analytics.

## Tone

Warm, community-first, local and proud by default. Punchy and declarative only on ticketing and partner-facing moments. Never corporate, never apologetic, never cheesy. "More Burton, less cheesy." Sign-off: *Believe in the Power of Music.*

## Brand tokens (see `docs/concept.md` §9 for full system)

```
--ink #1A1212  --ink-soft #241A1A  --red #C8102E  --ember #E8A23D
--paper #F4EFEA  --body #C9BFBA  --line #3A2C2C
Display: Fraunces (fallback Georgia, serif). Body/UI: Hanken Grotesk (fallback -apple-system, Arial, sans-serif).
```
Red = brand anchor + active/"yes". Ember = warmth, hover, the demand meter. Verify all text/background pairs pass AA at final sizes.

## Conventions

- All event content comes from `src/data/events.json` (schema in `docs/concept.md` §7). Never hard-code event details in components.
- Placeholders for values I'll supply (MailerLite form ID, WhatsApp invite link, Ticket Tailor URLs, Web Analytics token) must be clearly marked `// TODO:` and listed so I can find them. See `docs/CONTENT.md`.
- Self-host fonts with `font-display: swap`.
- Target Lighthouse 90+ on mobile; lazy-load video and below-fold images.

## Workflow

Build in the order set out in `docs/PROMPTS.md`. Do one step at a time and stop for review/commit between steps. Before building anything new, confirm it doesn't break a hard rule above.
