# The Space Between — between.sonicboom.org.uk

The year-round home of Sonic Boom Music CIC's audience-development programme, *The Space Between* — the music that fills the gap between festivals, and the campaign to give Burton a permanent grassroots venue.

**Live domain:** between.sonicboom.org.uk
**Owner:** Sonic Boom Music CIC · hello@sonicboom.org.uk

---

## What this is

A mobile-first, mostly-static site whose job is simple: **welcome someone in, or count them in.** It shows the year of events, converts visitors into community members (email + WhatsApp), and gathers a visible, growing signal of demand for a permanent venue.

## Stack

- **[Astro](https://astro.build)** — static output, content-led, near-zero client JS
- **Cloudflare Pages** — hosting + CI from Git
- **Cloudflare Pages Functions + KV** — the one dynamic feature (the venue-demand poll)
- **MailerLite** — embedded email capture
- **Ticket Tailor** — ticketing (per-event links)
- **Cloudflare Web Analytics** — privacy-first, no cookie wall
- Self-hosted fonts (Fraunces + Hanken Grotesk)

## Documentation (read in this order)

| File | What it's for |
|---|---|
| [`CLAUDE.md`](./CLAUDE.md) | Persistent rules for the coding agent — read automatically by Claude Code |
| [`docs/concept.md`](./docs/concept.md) | The full concept & build spec — the why and the what |
| [`docs/PROMPTS.md`](./docs/PROMPTS.md) | Ordered build prompts — paste into Claude Code one at a time |
| [`docs/CONTENT.md`](./docs/CONTENT.md) | Content & asset checklist — the values/files you must supply |
| [`docs/DEPLOY.md`](./docs/DEPLOY.md) | Cloudflare Pages deploy, KV binding, env vars, DNS, pre-launch checklist |

## Quickstart

```bash
npm install
npm run dev        # local dev (Astro)
npm run build      # static build → /dist
npx wrangler pages dev ./dist   # test Pages Functions + KV locally
```

## Build approach

Work through `docs/PROMPTS.md` in order, committing between each step. Start by pasting the kickoff prompt so the agent has the rules and stack in context. The MVP (steps 1–7) is launch-ready on its own; steps 8–10 add the live demand meter, polish and deploy.

## The one rule that governs everything

The permanent venue is an **ambition**, never a confirmed or dated opening. See `CLAUDE.md`.

*Believe in the Power of Music.*
