# Evidence base: East Staffordshire

Internal reference for funding bids, the venue case and event planning. **Not public site copy.**

**Source:** *Culture and Place Data Explorer Detailed Report: East Staffordshire*, Oxford Consultants for Social Inclusion (OCSI) for Arts Council England, produced 3 November 2026. The report is licensed "for public benefit use only": cite figures with attribution, don't republish tables. The original .docx is kept out of git (see `.gitignore`).

Citations below use the report's section names, then the underlying source in brackets.

## Read this first

- **Area:** the report covers **East Staffordshire** (population 124,019), not Burton alone. Say "East Staffordshire" or "the Burton area" when quoting. Never present these as Burton-only figures.
- **Survey figures** (participation, civic engagement, belonging) are local-authority level estimates.
- **Wellbeing, anxiety and loneliness** data is suppressed or missing for this area. Don't cite it.
- **Hard rule 1:** this evidence supports "our ambition", "building the case" and "if the demand is there". It never shows the venue is confirmed, dated or sized.
- **Not an audience baseline:** there's no data here on who attends live music in Burton now. Our own signup, poll and event data has to fill that gap.

## The argument in one line

People here already take part in the arts, but investment, creative businesses and places to gather are well below the national picture. The programme builds an audience community, and the venue case is about meeting demand that is already there.

## Findings, and how to use them

### 1. Appetite is there; supply is thin (welcome someone in)

| Figure | East Staffordshire | England | Section (source) |
|---|---|---|---|
| Engaged with the arts in person, last 12 months | 90.86% | 90.41% | Cultural Participation (DCMS/ACE Participation Survey 2023/24) |
| Visited a museum or gallery in person | 31.65% | 43.13% | Cultural Participation (same) |

- The "arts in person" measure is broad: it includes live music, theatre, cinema, comedy, and reading or performing music. It is **not** a live-music attendance figure.
- **Use:** "People here already turn out for live culture; there isn't enough for them to turn out to." Don't claim "nobody goes out".

### 2. Investment and the creative sector are well below average (count them in)

| Figure | East Staffordshire | England | Section (source) |
|---|---|---|---|
| Arts Council England funding, 2025/26 | £95,195 (£0.73 per head) | n/a | ACE Funding by Year / per Head (Arts Council England) |
| ACE funding, 2022/23 and 2021/22 | £0 each year | n/a | ACE Funding by Year (same) |
| Creative and cultural businesses, share of all | 1.86% | 5.11% | Creative and Cultural Economy (ONS) |
| Same, in 2019 | 5.17% | n/a | Creative and Cultural Economy (ONS) |
| Creative and cultural employees, share of all | 1.37% | 5.08% | Creative and Cultural Economy (BRES) |
| Creative companies per 1,000 people | 3.97 | 9.06 | Creative and Cultural Economy (Companies House) |

- BRES employment **excludes freelancers**. Nationally about 32% of creative workers are self-employed, so local creative work is likely undercounted.
- **Use:** funding bids (low public investment, a falling creative base) and the case for Sonic Boom Music CIC's wider community-building role.

### 3. Community infrastructure is a real need, but belonging is average

| Figure | East Staffordshire | England | Section (source) |
|---|---|---|---|
| Community Needs Index overall rank (lower = higher need) | 16,557 | 17,040 | Community (OCSI / Local Trust, 2023) |
| Civic participation in last 12 months | 33.43% | 33.59% | Community (Community Life Survey 2024/25) |
| Feel they belong very strongly to their neighbourhood | 62.33% | 62.15% | Community (Community Life Survey 2024/25) |

- The index covers civic assets, connectedness and active community.
- **Use:** "There's a community that already cares, with few places and events that bring it together." Don't present it as a broken or disconnected community.

### 4. Barriers shape how we reach people

| Figure | East Staffordshire | England | Section (source) |
|---|---|---|---|
| Adults who haven't used the internet in 3 months | 12.1% | 7.32% | Cultural Participation (ONS) |
| Children in relative low-income families, after housing costs | 28.11% | 26.43% | Child Poverty (DWP/HMRC, 2024/25) |
| Same, before housing costs | 23.61% | 19.48% | Child Poverty (same) |
| Households with no car or van | 18.49% | 23.54% | Access and Transport (Census 2021) |

- **Offline audience:** don't rely on online-only promotion. Use print, partners and word of mouth, and give a postal or in-person route to the poll and signup. Email and postcode remain optional.
- **Families and children:** support free or low-cost under-16 and family events.
- **Transport:** about 1 in 5 households has no car. Every event listing should give public transport and walking information.

### 5. The audience is varied

| Figure | East Staffordshire | Section (source) |
|---|---|---|
| Non-White ethnic groups | 13.68% (Asian: 9.31%) | Population and Demographics (Census 2021) |
| Under 16 | 18.96% | Population and Demographics (Census 2021) |
| Aged 65 and over | 18.62% | Population and Demographics (Census 2021) |
| Day-to-day activities limited a lot | 6.66% | Disability and Long-Term Illness (Census 2021) |

- **Use:** supports "widening who comes". Possible `people` values: families and under-16s, people who aren't online, Burton's Asian communities, people who need access support.
- The report doesn't say who we currently reach, so check this against our own signup and attendance data before making claims.
- Access information belongs on every event.

### 6. Visitor economy (venue case only)

- 2.43 million day trips a year, worth £129.37 million in spend (Visitor Economy, Great Britain Tourism Survey, April 2021 to March 2023).
- **Use:** the economic benefit of a place to go, framed as "if the demand is there". Not a forecast.

## Suggested uses

1. **Funding bids:** sections 2 and 3. Cite section and source, and state the area as East Staffordshire.
2. **Event planning:** sections 4 and 5, to choose and justify the `people` value in `src/data/events.json`.
3. **Venue case:** sections 1, 2 and 6, always framed as ambition.
4. **Public site:** none yet. If a figure ever goes on a public page, check it against hard rule 1, attribute it, and say which area it covers.

## Open questions

- Who attends our events now, compared with these demographics? Use signup and poll data.
- Is there Burton-only data (wards or LSOAs) to add? The Local Insight platform can segment below local-authority level.
