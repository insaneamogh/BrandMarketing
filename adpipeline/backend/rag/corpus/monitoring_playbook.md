# Marketing Monitoring & Planning Playbook (internal methodology)

Provenance: internal methodology for this pipeline. The thresholds here are the
SAME constants the monitoring code uses (researcher.py: BREAKEVEN_ROAS = 1.5,
SCALE_ROAS = 3.5), so agents can cite the rulebook their numbers come from.
Benchmark anchors reference the REAL public data in industry_ad_benchmarks.md.

## Why breakeven ROAS is 1.5x, not 1.0x

A campaign returning exactly $1.00 per $1.00 of ad spend still loses money once
cost of goods, fulfillment, retailer margin and creative production are paid.
For this CPG portfolio (blended contribution margin ~35-45%), a flight needs
roughly 1.5x ROAS just to cover its fully loaded costs. Below 1.5x, every
additional impression destroys value; the correct default action is to cut or
restructure, not to "give it time."

## Why the scale bar is 3.5x

Scaling a campaign raises its marginal costs: auction prices climb as budgets
grow, audiences saturate, and creative fatigues. Historically, flights in this
portfolio lose roughly 20-30% of their ROAS when spend doubles. A campaign
therefore needs comfortable headroom above breakeven - 3.5x or better - before
extra budget is likely to still clear 1.5x AFTER scaling decay. Campaigns
between 1.5x and 3.5x should be optimized in place, not scaled.

## Severity rubric (used in every monitoring report)

- HIGH: ROAS below the 1.5x breakeven (actively losing money), OR the issue
  directly blocks the campaign's stated objective, OR a stock-out/compliance
  problem is turning paid demand away at the shelf.
- MEDIUM: ROAS between 1.5x and 2.5x (profitable but thin), a metric visibly
  deteriorating across flights, or heavy dependence on one capacity-constrained
  channel.
- LOW: watch items - early signals, single-flight anomalies, or risks that need
  one more data point before action.

## Benchmark calibration (how to read internal numbers)

- Always position an internal number against a reference before judging it:
  the portfolio's spend-weighted ROAS, the 1.5x/3.5x bars above, or the public
  benchmarks in industry_ad_benchmarks.md (e.g. Meta median CTR 2.19%; Amazon
  Sponsored Products CTR 0.35-0.70%).
- A 0.9% CTR is BAD on Meta (below the 2.19% median) but GOOD on Amazon (above
  the 0.70% ceiling of the normal range). Never judge a number without naming
  the channel it belongs to.
- Internal CPL definitions are lighter than public lead-ads CPLs (add-to-cart /
  signup vs qualified lead) - compare ratios and directions across internal
  channels, not absolute levels against public CPL medians.

## Budget reallocation discipline (planning)

- Reallocate before requesting new money: a plan's budget moves should roughly
  net to zero unless the objective explicitly authorizes incremental spend.
- Fund scale candidates from the below-breakeven flights first - that trade
  improves both ends simultaneously and is the easiest approval in the room.
- Cap any single reallocation step at ~50% of the source campaign's budget;
  bigger cuts destroy learnings and platform optimization history. Re-check
  after two weeks, then take the second half if the read holds.
- Respect capacity constraints: a high-CVR channel that is throughput-limited
  (vet referral at 12.0% CVR, clinic-capped) absorbs incremental budget badly -
  scale AWARENESS that feeds it instead of buying more of the bottleneck.

## Success criteria conventions

Every plan should end with a measurable 4-week checkpoint in the form
"metric X moves from A to B": use the verbatim baseline number from the
research or context as A, and a target justified by a cited comparison as B.
If a plan cannot state its checkpoint this way, the plan is not ready.
