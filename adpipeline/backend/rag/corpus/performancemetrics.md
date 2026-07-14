# Performance Metrics: What This Pipeline Measures, Targets & Forecasts

Provenance: definitions are standard industry usage (REAL); the "live
indications" quote the real public benchmarks already ingested in
industry_ad_benchmarks.md and the internal MOCK flight data in
campaign_history.md / channel_metrics.md. This file is the single glossary +
targeting guide the agents cite when a user's objective names a metric.

## How each metric flows through the pipeline

- COMPUTED IN CODE (Agent 1 - Research & Monitor): spend, ROAS per campaign,
  spend-weighted portfolio ROAS, CPA, CTR. These are calculated
  deterministically in Python from campaign_history.md's flight table - the
  model never does the math, it only explains it.
- CITED FROM THE KNOWLEDGE BASE (Agents 1 + 2): CPL and CVR by channel and
  region (channel_metrics.md), OOS rates (distributor_notes_apac.md), GMV and
  platform shares (quick_commerce_india.md), ACOS/CPM/CPC public anchors
  (industry_ad_benchmarks.md).
- TARGETED IN PLANS (Agent 2 - Strategy Planner): every plan must end with a
  measurable 4-week checkpoint of the form "metric X moves from A to B"
  (monitoring_playbook.md), so CPL, CPA, ROAS, CVR and blended CPL are the
  usual planning targets.
- FORECAST WITH PROBABILITIES (Agent 3 - Creative/placement): the placement
  pass returns expected_metrics rows (typically CTR, CPL, CVR, ROAS), each with
  a calibrated 0.00-1.00 probability of being met in the first 4 weeks.

## Glossary: abbreviations, full forms, plain meaning

### Return & profitability metrics
- ROAS - Return On Ad Spend. Revenue attributed to ads divided by ad spend;
  3.1x means $3.10 back per $1.00 spent. The pipeline's primary health metric:
  breakeven is 1.5x, the scale bar is 3.5x (monitoring_playbook.md).
- iROAS - Incremental Return On Ad Spend. ROAS counting only the revenue the
  ads truly CAUSED (measured against a holdout group that saw no ads), not
  sales that would have happened anyway. The gold standard for proving ads
  work; requires incrementality testing, so this POC reports plain ROAS and
  flags iROAS as the production upgrade.
- MER - Marketing Efficiency Ratio (a.k.a. blended ROAS). TOTAL revenue
  divided by TOTAL marketing spend, across all channels at once. Useful when
  per-channel attribution is murky.
- ACOS - Advertising Cost Of Sales. Amazon's inverse of ROAS: ad spend divided
  by ad revenue, as a percent. 25% ACOS = 4.0x ROAS. Platform-wide average is
  roughly 29%; pet supplies typically run 20-32%, beauty 18-28%
  (industry_ad_benchmarks.md).
- TACOS - Total Advertising Cost Of Sales. Ad spend divided by TOTAL revenue
  (organic + paid) on the marketplace; shows whether ads are lifting the whole
  listing or just buying the same sales.
- ROI - Return On Investment. Profit (not revenue) relative to cost; the CFO's
  version of ROAS once margins are included.

### Cost metrics
- CPA - Cost Per Acquisition (or Action). Ad spend divided by purchases/
  signups won. Internal flights range from $6 (Quick-Commerce Blitz) to $70
  (Prestige Counter Revival) - campaign_history.md.
- CPL - Cost Per Lead. Spend divided by leads captured. NOTE: this pipeline's
  internal "lead" is light (add-to-cart / signup), so internal CPLs
  ($2.40-$14.00, channel_metrics.md) sit far below the public lead-ads median
  of $27.66 - compare ratios across channels, never absolute levels against
  public medians (industry_ad_benchmarks.md).
- CAC - Customer Acquisition Cost. All sales+marketing cost to win one NEW
  customer; broader than CPA (includes people, tools, agencies).
- CPC - Cost Per Click. Meta average ~$0.70 on traffic campaigns; beauty &
  personal care is among the most expensive verticals at ~$3.06
  (industry_ad_benchmarks.md).
- CPM - Cost Per Mille. Price of 1,000 ad impressions; Meta median ~$13.48.
  The awareness-buying unit.

### Engagement & conversion metrics
- CTR - Click-Through Rate. Clicks divided by impressions. ALWAYS judge it
  per-channel: 0.9% is weak on Meta (median 2.19%) but strong on Amazon
  Sponsored Products (normal range 0.35-0.70%) - monitoring_playbook.md.
- CVR - Conversion Rate. Visitors who buy (or complete the goal action).
  Internal: vet referral 12.0% (highest, capacity-capped), India
  quick-commerce 4.6%, Amazon 1.9-2.1% on cold paid traffic
  (channel_metrics.md). Public Amazon platform-wide (incl. branded search)
  runs 10-12%.
- AOV - Average Order Value. Revenue divided by orders; raising AOV (bundles,
  larger packs) improves ROAS without touching traffic.

### Customer value & growth metrics
- LTV / CLV - (Customer) Lifetime Value. Total profit expected from a customer
  over the whole relationship. Pet food and skincare are repeat-purchase
  categories, so a higher initial ACOS/CAC is acceptable when LTV is strong
  (industry_ad_benchmarks.md, pet section).
- NTB - New-To-Brand. Share of orders from customers who haven't bought the
  brand (on Amazon: in the trailing 12 months). The growth-vs-cannibalization
  lens: high ROAS with low NTB% is mostly re-selling to existing buyers.
- GMV - Gross Merchandise Value. Total value of goods sold through a platform
  (before returns/discounts) - how quick-commerce scale is quoted: India
  q-comm cleared roughly Rs 11,000 crore in a single month by early 2026
  (quick_commerce_india.md).

### Operations & share metrics
- OOS - Out Of Stock. Share of demand hitting an empty shelf. The "Indulgent
  Ritual" flight leaked conversions to out-of-stock quick-commerce listings
  (campaign_history.md), and recurrent OOS on premium senior SKUs in Southeast
  Asian metros is a known hotspot (distributor_notes_apac.md). Fix
  availability before buying more traffic.
- SOV - Share Of Voice. Your slice of the category's total advertising
  presence; over time SOV above market share tends to grow market share.
- KPI - Key Performance Indicator. Whichever of the above a plan commits to
  moving; every AdPipeline plan names its KPI checkpoint explicitly.

## Live indications (current anchor values to calibrate against)

- Meta (2025 cross-industry): median CTR 2.19%, median CPM $13.48, median CPA
  $38.17, average CPC $0.70 (traffic) / $1.92 (leads); lead ads convert ~7.72%
  at ~$27.66 per lead [industry_ad_benchmarks.md].
- Amazon Ads: ACOS ~29% platform-wide; Sponsored Products CTR 0.35-0.70%;
  platform CVR 10-12%; pet CVR ~15.3%, beauty CVR ~14.6% at category level
  [industry_ad_benchmarks.md].
- Internal portfolio bars: breakeven ROAS 1.5x, scale bar 3.5x; flights range
  0.8x-4.6x ROAS, $6-$70 CPA, 0.7%-3.4% CTR [campaign_history.md,
  monitoring_playbook.md].
- Channel economics: India quick-commerce $2.40 CPL / 4.6% CVR (best
  efficiency), vet referral $14.00 CPL / 12.0% CVR (best conversion,
  capacity-capped), NA Meta $8.40 CPL vs India Meta $3.10 CPL
  [channel_metrics.md].

## Which metric to target for which objective

- AWARENESS ("get seen"): CPM down, CTR up, SOV up. Creative lever: /meta
  scroll-stoppers. Watch: cheap reach with weak CVR is empty calories.
- EFFICIENCY ("same results, less money"): CPL / CPA / ACOS down. Lever:
  budget reallocation toward the cheapest proven channel
  (monitoring_playbook.md reallocation rules).
- PROFITABILITY ("make ads pay"): ROAS / MER up past 1.5x breakeven; kill or
  restructure anything below it; scale only above 3.5x.
- CONVERSION ("traffic isn't buying"): CVR up, AOV up. Lever: /amazon listing
  set (better main image, benefit infographics), bundle offers.
- GROWTH ("new customers, not the same ones"): NTB% up while CAC stays under
  LTV; expect ROAS to dip short-term - say so in the plan.
- AVAILABILITY ("demand is fine, shelves aren't"): OOS down before any new
  spend - traffic into an empty shelf is money burned
  [distributor_notes_apac.md].

## Reading rules (so numbers are never judged naked)

1. Name the channel before judging a rate - every benchmark above is
   channel-specific (monitoring_playbook.md).
2. Compare internal numbers to internal references (portfolio weighted ROAS,
   the 1.5x/3.5x bars) and public numbers to public ones; cross only to sanity-
   check direction, never level.
3. A target must be written "from A to B in 4 weeks" with A quoted verbatim
   from this knowledge base - a plan that can't state that isn't ready.
