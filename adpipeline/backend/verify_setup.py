"""Repeatable verification suite - run after any corpus/product/agent change.

    cd backend && python verify_setup.py

Checks only wiring and data consistency; makes NO paid API calls. Safe to run
anywhere (set DATA_DIR to a scratch dir to avoid touching your real DB).
"""
import re
import sys
from pathlib import Path


def main() -> int:
    print("=== AdPipeline verification suite ===\n")

    # [1] App + routes import cleanly
    import main as app_main
    routes = {r.path for r in app_main.app.routes}
    assert {"/solo/research", "/solo/plan", "/solo/creative", "/creative/render",
            "/campaigns", "/creative", "/placement", "/publish"} <= routes
    print("[1] PASS  FastAPI app imports; chained + solo + render routes registered")

    # [2] Researcher: campaign families cover every UI product
    from agents import researcher
    fams = {c["product"] for c in researcher.CAMPAIGNS}
    assert fams == {"hills", "palmolive", "skin_health"}, fams
    for name, want in [
        ("Hill's Youthful Vitality", "hills"),
        ("Hill's Prescription Diet k/d", "hills"),
        ("Palmolive Luminous Oils", "palmolive"),
        ("EltaMD UV Clear SPF 46", "skin_health"),
        ("Filorga NCEF-Reverse", "skin_health"),
    ]:
        got = researcher._which(name)
        assert got == want, f"{name} -> {got}, want {want}"
    print(f"[2] PASS  {len(researcher.CAMPAIGNS)} campaigns across 3 families; "
          "all 5 UI products map to a family")

    # [3] campaign_history.md numbers match researcher.CAMPAIGNS exactly
    md = Path("rag/corpus/campaign_history.md").read_text(encoding="utf-8")
    for c in researcher.CAMPAIGNS:
        block = re.search(rf'"{re.escape(c["name"])}".*?\n(Spend[^\n]+)', md)
        assert block, f"campaign {c['name']} missing from campaign_history.md"
        line = block.group(1)
        for val in (f"${c['spend'] // 1000}k", f"{c['ctr']}%",
                    f"${c['cpa']}", f"{c['roas']}x"):
            assert val in line, f"{c['name']}: {val} not in '{line}'"
    print("[3] PASS  campaign_history.md <-> researcher.CAMPAIGNS numerically in sync")

    # [4] Ingest manifest: every doc registered AND present on disk
    from rag import ingest
    missing = [f for f in ingest.MANIFEST if not (Path("rag/corpus") / f).exists()]
    unregistered = [p.name for p in Path("rag/corpus").glob("*.md")
                    if p.name not in ingest.MANIFEST]
    assert not missing, f"in manifest but not on disk: {missing}"
    assert not unregistered, f"on disk but not in manifest: {unregistered}"
    fp = ingest.corpus_fingerprint()
    print(f"[4] PASS  {len(ingest.MANIFEST)} corpus docs registered+present; "
          f"fingerprint {fp[:12]}")

    # [5] Brand-key mapping: creative agent and orchestrator agree
    from agents import creative as creative_agent
    import orchestrator
    from schemas import ProductProfile

    def profile(name, category):
        return ProductProfile(name=name, category=category, key_claims=[],
                              pack_description="", brand_colors=[], price_tier="premium")

    for p, want in [
        (profile("EltaMD UV Clear Broad-Spectrum SPF 46", "facial sunscreen"), "skin_health"),
        (profile("Filorga NCEF-Reverse", "anti-aging face cream"), "skin_health"),
        (profile("Palmolive Luminous Oils", "shower gel"), "palmolive"),
        (profile("Hill's Prescription Diet k/d", "veterinary dog food"), "hills"),
        (profile("Hill's Youthful Vitality 7+", "senior dog food"), "hills"),
    ]:
        a, b = creative_agent._brand_key(p), orchestrator._brand_key(p)
        assert a == b == want, f"{p.name}: creative={a} orchestrator={b} want={want}"
    print("[5] PASS  _brand_key consistent across creative agent + orchestrator")

    # [6] URL-diagnosis fallbacks route every product family + generic 'Other'
    import url_diagnosis as ud
    assert set(ud._FALLBACKS) == {"hills", "hills_rx", "palmolive", "eltamd",
                                  "filorga", "generic"}
    for hint, want in [
        ("hillspet.com/pd-kd-canine", "hills_rx"),
        ("eltamd.com/uv-clear", "eltamd"),
        ("filorga ncef reverse", "filorga"),
        ("palmolive body wash", "palmolive"),
        ("youthful vitality", "hills"),
        ("https://example.com/some-unknown-gadget-2000", "generic"),
    ]:
        got = ud._guess_family(hint)
        assert got == want, f"{hint} -> {got}, want {want}"
    gen = ud._fallback("https://example.com/products/acme-wireless-charger")
    assert gen.name == "Acme Wireless Charger", gen.name
    print("[6] PASS  url_diagnosis fallbacks cover all 5 products + generic 'Other'")

    # [7] Every skill image template renders with a full profile (no KeyError,
    #     no unresolved placeholder)
    from skills.registry import SKILLS
    fields = profile("Test Product", "test category").model_dump()
    fields["brand_colors"] = "#ffffff"
    fields["key_claims"] = "claim one; claim two"
    n = 0
    for s in SKILLS.values():
        for spec in s["image_specs"]:
            out = spec["prompt_template"].format(**fields)
            assert "{" not in out, f"unresolved placeholder in {s['command']}/{spec['kind']}"
            n += 1
    print(f"[7] PASS  all {n} image prompt templates render cleanly")

    # [8] DB init (incl. mode micro-migration) + solo gate guard
    from models import init_db, SessionLocal, Campaign
    init_db()
    db = SessionLocal()
    c = Campaign(product="verify", objective="verify", status="solo_research", mode="solo")
    db.add(c)
    db.commit()
    db.refresh(c)
    try:
        orchestrator.decide(c.id, "research", "approve")
        raise AssertionError("gate accepted a solo campaign")
    except ValueError:
        pass
    db.query(Campaign).filter(Campaign.id == c.id).delete()
    db.commit()
    db.close()
    print("[8] PASS  DB init + solo-campaign gate guard")

    # [9] Two-step image flow, END TO END, fully offline: solo draft creates
    #     prompts (template fallback, $0), render only then produces assets
    #     (DEMO_MODE cache fallback, $0). The paid model is never required.
    import asyncio
    draft = asyncio.run(orchestrator.solo_creative(
        "manual:verify product for the two-step flow test", "/meta",
        product="Hill's Youthful Vitality", objective="verify"))
    assert draft["rendered"] is False and draft["assets"] == []
    assert len(draft["prompts"]) == 2, draft["prompts"]  # /meta = feed + story
    assert all(len(p["prompt"]) > 80 for p in draft["prompts"])
    edited = [{"kind": p["kind"], "prompt": p["prompt"] + " Edited by human."}
              for p in draft["prompts"]]
    out = asyncio.run(orchestrator.render_creative(draft["creative_id"], edited))
    assert out["rendered"] is True and len(out["assets"]) == 2
    assert all(p["prompt"].endswith("Edited by human.") for p in out["prompts"])
    print("[9] PASS  draft (no spend) -> human edit -> render: "
          f"{len(draft['prompts'])} prompts became {len(out['assets'])} assets")

    # [10] Deterministic scraper parsers (offline: JSON-LD, images, fallback profile)
    from url_diagnosis import _iter_ld_products, _ld_images, _profile_from_scrape
    ld_doc = {"@graph": [{"@type": "WebPage"}, {
        "@type": "Product", "name": "Science Diet Sensitive Stomach & Skin Variety Pack",
        "brand": {"@type": "Brand", "name": "Hill's"},
        "description": "Adult wet dog food. Highly digestible. Supports skin health.",
        "image": [{"@type": "ImageObject", "url": "https://cdn.example.com/pack.jpg"}],
        "offers": {"@type": "Offer", "price": "26.99", "priceCurrency": "USD"},
    }]}
    prods = list(_iter_ld_products(ld_doc))
    assert len(prods) == 1 and prods[0]["name"].startswith("Science Diet")
    assert _ld_images(prods[0]) == ["https://cdn.example.com/pack.jpg"]
    prof = _profile_from_scrape(
        "https://www.hillspet.com/dog-food/science-diet-adult-sensitive-stomach",
        {"title": prods[0]["name"], "desc": prods[0]["description"],
         "images": ["https://cdn.example.com/pack.jpg"], "h1": None})
    assert prof.name.startswith("Science Diet")
    assert prof.source_images == ["https://cdn.example.com/pack.jpg"]
    assert len(prof.key_claims) >= 1
    print("[10] PASS  scraper parsers: nested JSON-LD product, images, "
          "deterministic profile fallback")

    print("\n=== ALL CHECKS PASS ===")
    return 0


if __name__ == "__main__":
    sys.exit(main())
