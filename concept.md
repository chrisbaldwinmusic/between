# The Space Between — Website Concept & Build Spec

**Project:** The Space Between — the year-round home between Sonic Boom Festivals
**Owner:** Sonic Boom Music CIC
**Domain:** between.sonicboom.org.uk
**Status:** Concept / build brief (v1, Cloudflare Pages edition).

---

## 1. What this site is for

The Space Between is the twelve-month audience-development programme that fills the gap between festivals. This site is its public home, with three jobs in priority order:

1. **Grow the audience community** — turn a visitor into an email subscriber and WhatsApp member who comes back. The single most important action on the site.
2. **Drive attendance** — register for the free events, buy tickets (Ticket Tailor) for the ticketed ones.
3. **Build the evidence** — capture the venue-demand signal the ACE bid promises, and make it visible.

If a section serves none of those, cut it.

> **Integrity guardrail (whole site):** the permanent venue is an **ambition**, never confirmed/dated/fixed-capacity. Founding Membership is membership of the audience community and the venue *campaign* — not a building that exists. (See `CLAUDE.md`.)

## 2. Core concept: the site is the evidence

The ACE narrative is *"every ticket sold, every survey completed, every community member added is evidence that this town will support what comes next."* The site makes that literal. Every action — joining, answering one tap of "would you use a venue?", turning up — adds to a **growing public picture of demand**. A recurring **demand meter / community counter** appears in the hero and resolves in the venue section. The site isn't a poster; it's a living count of a town deciding it wants something.

## 3. Audiences & jobs

| Audience | Thinking | Site must |
|---|---|---|
| Curious local (primary) | "What's on? Is this for me?" | Year at a glance, low-barrier entry, prices, welcome |
| Lapsed festival-goer | "I loved the festival, then nothing." | "Here's the bit between — stay with us" → join |
| Families / older / first-timers | "Belong? Afford? Accessible?" | Free daytime entry, plain access info, warmth |
| Funders / council / press | "Is this real and evidenced?" | Clean partners, the demand evidence, pro tone |
| Local artists | "Can I play?" | Honest "get in touch" route |

## 4. Success metrics (instrument from day one)

Feeds the exact ACE evaluation measures:
- Email subscribers (500+) — primary conversion
- WhatsApp joins (500+)
- Venue-demand responses + running "yes" share — the headline evidence number
- Postcode capture → local-demand % (DE13/DE14/DE15)
- Event registrations / Ticket Tailor click-throughs, by event
- Source attribution via UTM on every link

## 5. Sitemap & IA

Single long-scroll `/` is the spine; small set of sub-pages for depth/SEO.

```
/                  The Space Between — main scroll
/events/<slug>     One page per event (SEO + Ticket Tailor link + access info)   [phase 2]
/membership        Founding Membership detail + join                              [phase 2]
/accessibility     Full access statement + how to request support
/privacy           Privacy notice
```

Sticky anchored nav: `The idea · The year · How it works · Membership · The ambition · Get involved · Access`, with a persistent **Join the community** button.

## 6. Section-by-section (main scroll)

Order: hook → meaning → the year (substance) → how to step in → the bigger why → the ask → reassurance.

**6.1 Hero.** Ambient muted aftermovie loop (poster fallback; static under reduced-motion). Headline: *The space between festivals is where a town decides what it wants.* Sub: one free or low-cost event a month, all year, across Burton — come to one, then come back. Primary CTA **Join the community**; secondary **See the year ↓**. Live line: *"[N] people are already in."*

**6.2 The idea.** Short, human: the festival is one day; the year is where a scene is built or lost. Name the loop — come once → come back → shape what's next. Simple ladder graphic.

**6.3 The year (ten events) — centrepiece.** Horizontal timeline/ribbon (desktop) / vertical stack (mobile) of cards from `events.json`. Card: month, name, one-line format, free/ticketed tag, venue; expands/links for full blurb, date, access, action (Register / Get tickets / Notify me). Light filters: All · Free · Ticketed · Daytime · Evening. Per-event accent.

**6.4 How it works (ladder).** 1. Come to one (free or from £7.50) · 2. Join the community (hear about the next one first) · 3. Become a Founding Member. Micro-CTA each.

**6.5 Founding Membership.** Honest framing: back the year-round programme AND the venue campaign; not a building. Price (TBC), benefits, launches at Winter Sounds (Dec 2026). CTA Become a Founding Member (Ticket Tailor link). Tone: belonging.

**6.6 The ambition + demand meter (evidence peak).** Copy: Burton hasn't had a dedicated grassroots venue for a long time; ESBC is exploring the business case; our ambition is to run it; this is how we find out, together, if demand is real. One tap: *"Would you use a permanent grassroots music venue in Burton?"* Yes / Maybe → reveals live count + yes-share + optional postcode/email. Same question as survey Q4 — the site becomes a year-round data source.

**6.7 Get involved.** Three doors: audiences (join), artists ("want to play?"), partners/press (hello@sonicboom.org.uk).

**6.8 Accessibility (inline → full page).** Step-free venues, quiet spaces, BSL on request, access fund, Tickets for Good; name Safe Gigs for Women + Good Night Out; "tell us what you need" → accessibility@sonicboom.org.uk; link to `/accessibility`.

**6.9 Partners & footer.** Logo grid (confirm list). Footer: contact, socials, sonicboom.org.uk + festival.sonicboom.org.uk, privacy, *Believe in the Power of Music.*

## 7. Events data model

Drive everything from one file.

```jsonc
// src/data/events.json
[
  {
    "slug": "folk-stories-firelight",
    "name": "Folk, Stories & Firelight",
    "month": "Oct 2026",
    "date": "2026-10-23",
    "format": "Intergenerational folk & storytelling",
    "blurb": "An evening of folk, song and stories with Burton Folk Club...",
    "venue": "Burton Library",
    "ticketing": "ticketed",       // "free" | "ticketed"
    "priceFrom": "£7.50",           // omit if free
    "ticketUrl": null,              // Ticket Tailor; null until live
    "registerUrl": null,            // free events
    "accent": "#E8A23D",
    "access": "Step-free. BSL on request.",
    "status": "announced"           // "announced" | "onsale" | "soldout" | "past"
  }
]
```

Ten events in order: Folk, Stories & Firelight (Oct) · Winter Sounds (Dec) · New Year Community Sing (Jan) · Love Your Local (Feb) · Family Music Discovery Day (Mar) · Global Sounds (Apr) · Music in the Market (May) · Summer Park Sessions (Jun) · Youth Takeover (Jul) · Community Music Trail (Sep). Use indicative Saturdays until confirmed.

## 8. Data capture & integrations (Cloudflare edition)

One principle: every capture point writes to one record; don't fragment.

| Capture | Tool | Feeds |
|---|---|---|
| Email | MailerLite embed | Subscribers (500+) |
| WhatsApp | Community invite link | Members (500+) |
| Venue poll | **Cloudflare Pages Function → KV** | Demand score + responses |
| Postcode (optional) | KV aggregate (or D1 if storing per-response) | Local-demand % |
| Event reg / ticket clicks | Ticket Tailor + UTM | Attendance funnel |
| Source | UTM on every link | Channel attribution |

**Venue poll (the only dynamic feature):**
- `POST /api/vote` `{choice:"yes"|"maybe", postcode?}` → increments KV counters (`yes`, `maybe`, `total`), basic per-IP/day rate-limit; postcode stored only as an aggregate count by outward code.
- `GET /api/results` → `{total, yes, maybe, yesPct}` for the meter and the hero counter.
- Bind KV namespace `VENUE_KV` in `wrangler.toml` / Pages settings.
- If per-response postcodes are wanted for finer geographic analysis, use **D1** instead of KV (see `docs/DEPLOY.md`).

## 9. Design system

**Concept:** the festival site is the loud sibling (Frontage Condensed, cyan/pink, glitch). The Space Between is the **warm sibling** — dusk-lit, year-round, intimate. Firelight / dusk / the in-between hour.

```css
:root{
  --ink:#1A1212; --ink-soft:#241A1A; --red:#C8102E; --ember:#E8A23D;
  --paper:#F4EFEA; --body:#C9BFBA; --line:#3A2C2C;
}
```
Red = anchor + active/"yes". Ember = warmth, hover, the meter. Verify all pairs to **AA**.

**Type:** Display **Fraunces** (warm editorial; fallback `Georgia, serif`). Body **Hanken Grotesk** (fallback `-apple-system, Arial, sans-serif`). Self-host, `font-display: swap`. (If staying strictly on the org Arial spec, use Hanken/Arial throughout — flag for sign-off.)

**Motion:** warm, slow, breathing. Subtle grain + drifting ember glow; meter fills gently. No glitch/scanlines (that's the festival). Full `prefers-reduced-motion` support.

**Components:** `SiteNav` · `Hero` · `IdeaBlock` · `LadderSteps` · `EventRibbon`/`EventCard`/`EventModal` · `MembershipBlock` · `DemandMeter` (+poll) · `GetInvolved` · `AccessibilitySummary` · `PartnerGrid` · `SignupForm` · `Footer`.

## 10. Accessibility

WCAG 2.2 AA. Semantic landmarks, one `h1`, logical headings, skip link, visible focus, full keyboard, AA contrast (verify warm greys/ember), `prefers-reduced-motion` honoured, captions available on the aftermovie, real labels, alt text, plain-English access info per event, prominent accessibility@ route. The site should be able to stand as evidence of the bid's "inclusion is structural" claim.

## 11. Technical architecture (Cloudflare Pages)

Static-first, progressively enhanced.
- **Astro**, `output: 'static'`, `@astrojs/cloudflare` adapter. Per-event pages generated from `events.json`.
- **Cloudflare Pages** from Git; build `npm run build`, output `dist`.
- **Pages Functions** (`/functions/api/*`) + **KV** (`VENUE_KV`) for the poll — the only server-side code.
- **MailerLite** embed (email), **Ticket Tailor** links (tickets), **Cloudflare Web Analytics** (cookieless).
- Self-hosted fonts; lazy media; Lighthouse 90+ mobile.

**Repo structure:**
```
between/
  CLAUDE.md            # agent rules (auto-read)
  README.md
  docs/                # this spec + prompts + content + deploy
  public/              # fonts, images, og image, favicon
  functions/api/       # vote.js, results.js (Pages Functions)
  src/
    data/events.json
    components/
    layouts/BaseLayout.astro
    pages/             # index.astro, accessibility.astro, privacy.astro, events/[slug].astro
    styles/tokens.css
    lib/poll.js
  astro.config.mjs
  wrangler.toml        # KV binding for local dev
```

**SEO/perf:** per-page title/description, OG + Twitter cards, favicon set, schema.org `EventSeries`/`Event` from `events.json`, sitemap/robots, canonical URLs.
**Privacy/analytics:** Cloudflare Web Analytics (no cookie wall); privacy notice; optional postcode/email explained at capture; no personal data in URLs.

## 12. Build roadmap

- **Phase 1 — MVP (launch-ready, static):** nav, hero (counter placeholder), idea, the year, how-it-works, membership, accessibility summary, get-involved, partners, footer, email + WhatsApp signup, UTMs, analytics, privacy page.
- **Phase 2 — evidence engine:** live demand meter + poll (Functions + KV), `/events/<slug>` pages with Ticket Tailor links, `/accessibility` + `/membership` detail, structured data.
- **Phase 3 — living year:** milestone "proof" moments, post-event recaps, the meter as a year-long story, seasonal hero refreshes.

## 13. Open decisions (see also `docs/CONTENT.md`)

1. Font direction: Fraunces serif vs strict org Arial/Hanken.
2. Poll storage: KV (simple counts) vs D1 (per-response postcodes).
3. Email: MailerLite vs a Resend-backed custom form.
4. Founding Membership price + benefits.
5. Which partners to display + logo permissions.
6. Confirm event dates (currently indicative Saturdays).

*This site's job: turn a year of small, warm, local moments into a visible case that Burton wants more. Every pixel either welcomes someone in, or counts them in.*

**Sonic Boom Music CIC · sonicboom.org.uk · hello@sonicboom.org.uk · Believe in the Power of Music.**
