# Campaign History — Last 12 Campaigns (MOCK)

Provenance: MOCK — illustrative internal demo data, kept in a realistic range
(campaign CTRs of 0.7%–3.4% bracket the real 2025 Meta median CTR of 2.19%; see
industry_ad_benchmarks.md). ROAS = revenue / spend. CPA = cost per acquisition.
These eight rows are the single source of truth for campaign math — Agent 1's
deterministic metrics are computed from exactly these numbers.

## 1. Hill's Science Diet — "Senior Vitality" (NA, Meta + Google)
Spend $120k · CTR 1.8% · CPA $22 · ROAS 3.1x
Learning: senior-pet + vet-endorsement messaging over-performed (no surprise —
over half of US dogs are 7+, see senior_pet_demographics.md); creative fatigue
after week 6 dropped CTR ~30%. Refresh creative every 4–6 weeks.

## 2. Hill's Prescription Diet — "Vet Recommended" (NA, Vet referral + Search)
Spend $80k · CTR 3.4% · CPA $16 · ROAS 4.6x
Learning: highest-ROAS campaign on record. Vet-referral path converts but caps out
on clinic capacity — cannot scale spend linearly.

## 3. Hill's Science Diet — "Amazon Always-On" (NA, Amazon Sponsored)
Spend $95k · CTR 0.9% · CPA $19 · ROAS 3.8x
Learning: strong efficiency; A+ content + subscribe-and-save lifted repeat purchase.
CTR 0.9% is actually ABOVE the public Amazon Sponsored Products norm of 0.35–0.70%.
Underfunded relative to its efficiency — candidate to scale.

## 4. Hill's — "APAC Awareness Push" (APAC, Meta + local social)
Spend $110k · CTR 0.7% · CPA $61 · ROAS 0.9x
Learning: below break-even. Awareness-only creative with no local retail path.
Distribution gaps meant clicks had nowhere to convert (see distributor_notes_apac.md).
Fix retail readiness first.

## 5. Palmolive Luminous Oils — "Indulgent Ritual" (India, Meta)
Spend $40k · CTR 2.1% · CPA $9 · ROAS 2.7x
Learning: efficient reach; conversion leaked to out-of-stock on quick-commerce.
Availability, not demand, was the ceiling.

## 6. Palmolive Luminous Oils — "Quick-Commerce Blitz" (India, Blinkit/Zepto ads)
Spend $28k · CTR 2.8% · CPA $6 · ROAS 4.2x
Learning: best Palmolive ROAS. Bundle offers + instant availability drove impulse
conversion. The channel itself is compounding ~40% a year (quick_commerce_india.md).
Clear scale candidate.

## 7. Palmolive — "Derm Glow" (EU, Meta + influencers)
Spend $55k · CTR 1.2% · CPA $34 · ROAS 1.4x
Learning: near break-even; some influencer copy drifted toward implied medical/derm
claims and had to be pulled — compliance risk plus wasted spend (see BANNED CLAIMS
in brand_guidelines_palmolive.md).

## 8. Hill's Youthful Vitality — "7+ Renewal" (NA/EU, Meta + Amazon)
Spend $70k · CTR 1.6% · CPA $24 · ROAS 3.0x
Learning: solid; Amazon leg out-converted Meta leg 2:1 on CPA. Shift budget mix
toward Amazon on the next flight.

## 9. EltaMD UV Clear — "Derm Counter Trust" (NA, Derm-office referral + Amazon)
Spend $60k · CTR 1.5% · CPA $18 · ROAS 4.4x
Learning: dermatologist recommendation converts like vet referral does for
Hill's — professional endorsement is the portfolio's repeatable engine. Amazon
subscribe-and-save lifted repeat purchase. Clear scale candidate.

## 10. EltaMD — "Skinfluencer UGC" (NA, TikTok + Meta)
Spend $35k · CTR 3.2% · CPA $21 · ROAS 3.4x
Learning: creator content fronted by real dermatologists out-performed polished
brand film ~2:1 on CTR. Watch claim drift in creator scripts — same compliance
risk as Derm Glow (#7).

## 11. Filorga NCEF-Reverse — "Prestige Counter Revival" (EU, travel retail + Meta)
Spend $90k · CTR 0.8% · CPA $70 · ROAS 0.8x
Learning: below break-even. Legacy prestige-counter placements generated no
discovery; the audience that buys at counters was already buying. Spend did not
create new demand.

## 12. Filorga — "Tmall Global Reboot" (China, cross-border e-commerce)
Spend $65k · CTR 1.0% · CPA $52 · ROAS 1.1x
Learning: below break-even. Near-zero digital brand equity vs insurgent labels;
no KOL/live-commerce motion behind the media. Do not refund until a
digital-native discovery engine exists (see skin_health_diagnostics.md).

## Portfolio takeaways
- Scale: #3 (Amazon Always-On), #6 (Quick-Commerce Blitz) and #9 (Derm Counter
  Trust) are underfunded winners.
- Fix/pause: #4 (APAC Awareness) until distribution exists; #7 (Derm Glow) for
  compliance drift; #11/#12 (both Filorga flights) until a digital discovery
  motion exists.
- Pattern: professional endorsement (vet #2, derm #9) is the highest-ROAS lever
  in the whole portfolio — but each is capacity-constrained.
- Guardrail: refresh creative every 4–6 weeks to counter fatigue.
