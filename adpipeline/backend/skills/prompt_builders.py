"""Asset-specific prompt builders - the creative brief -> prompt compiler.

Product-agnostic by design: Hill's pet food and a Palmolive shower gel need
completely different visual logic, so there is NO single 'generate marketing
image' prompt. Instead:

    PRODUCT KNOWLEDGE -> CREATIVE CONTEXT -> ASSET-SPECIFIC BUILDER
        -> PRODUCT REFERENCE IMAGE(S) -> IMAGE GENERATION

Each asset type has a different JOB:
    product shoot   -> make the product desirable
    amazon main     -> marketplace compliance (LOCKED, never LLM-rewritten)
    amazon listing  -> explain + reduce purchase uncertainty
    meta 4:5        -> stop the scroll, communicate ONE idea
    meta 9:16       -> mobile-first hook with vertical momentum
    bundle          -> sell the system/routine, not individual SKUs
    storyboard      -> a connected campaign sequence

The prompt-writer model (Gemini, free tier) receives: the PRODUCT CREATIVE
CONTEXT + ONE asset builder + the base template, and compiles a single
production-ready prompt. The PRODUCT FIDELITY BLOCK is appended to every
final prompt deterministically in code - never left to the model.
"""

# ---------------------------------------------------------------------------
# Universal product fidelity block - appended to EVERY image prompt in code.
# Condensed for prompt budget; the non-negotiables survive verbatim.
# ---------------------------------------------------------------------------
FIDELITY_BLOCK = (
    "PRODUCT FIDELITY REQUIREMENTS: The supplied product reference is the "
    "single source of truth for the physical product. Preserve the exact "
    "package shape, proportions, container geometry (cap/pump/pouch/carton/"
    "bottle/bag), brand logo, product name, variant name, label hierarchy, "
    "packaging colors and recognizable graphics. Do not redesign, reinterpret, "
    "simplify or beautify the packaging. Do not invent new text, badges, "
    "certifications, awards, ingredients, benefits, logos, medical or "
    "nutritional claims, or product variants. If label text cannot be "
    "reproduced accurately, keep it faithful to the reference rather than "
    "inventing substitute text. Maintain realistic physical scale against "
    "people, animals, hands and furniture. No warped packaging, no duplicate "
    "products unless explicitly requested, no incorrect reflections, no "
    "malformed logos, no fictional label copy. The product must remain "
    "commercially recognizable as the exact supplied SKU."
)


# ---------------------------------------------------------------------------
# The mandatory context object - built once per creative run from everything
# the pipeline knows (profile, approved plan, brand guidelines). Unknown
# fields say so honestly instead of tempting the model to invent.
# ---------------------------------------------------------------------------
def build_creative_context(profile, plan_summary: str = "",
                           campaign_angle: str = "", target_segment: str = "",
                           channels=None, guidelines_ctx: str = "",
                           objective: str = "") -> str:
    ns = "not specified"
    claims = "; ".join(profile.key_claims) if profile.key_claims else ns
    colors = ", ".join(profile.brand_colors) if profile.brand_colors else ns
    return f"""PRODUCT CREATIVE CONTEXT
PRODUCT: {profile.name}
CATEGORY: {profile.category}
PRICE TIER: {profile.price_tier or ns}
PACKAGING DESCRIPTION (ground truth for the pack's appearance):
{profile.pack_description or ns}
PACKAGING ELEMENTS THAT MUST NEVER CHANGE:
logo, product name, variant, label hierarchy, colors, proportions, claims printed on pack
BRAND COLORS: {colors}
APPROVED CLAIMS ONLY (never go beyond these):
{claims}
PROHIBITED CLAIMS: anything not listed above; all BANNED CLAIMS in the brand guidelines below
CAMPAIGN OBJECTIVE: {objective or ns}
CAMPAIGN ANGLE (the one idea every asset ladders up to): {campaign_angle or ns}
PLAN SUMMARY: {plan_summary or ns}
PRIMARY AUDIENCE: {target_segment or ns}
PRIORITY CHANNELS: {", ".join(channels) if channels else ns}
BRAND GUIDELINES (tone, personality, banned claims):
{guidelines_ctx or ns}"""


# ---------------------------------------------------------------------------
# Asset-specific builders. Each is the creative-direction half of the final
# compiler prompt; the writer model merges it with the context + base template.
# ---------------------------------------------------------------------------
ASSET_BUILDERS = {
    # ---- 1. Product shoot: the job is DESIRABILITY, not ten benefits -------
    "product_shoot": """ASSET JOB: Campaign-quality hero product photography that establishes the product's visual world and makes the physical product immediately desirable.
CREATIVE DIRECTION: First pick the visual world from the CATEGORY - do NOT force a generic luxury aesthetic:
- skincare/beauty: texture, ingredients, ritual, sensorial luxury, skin-adjacent environments
- pet nutrition: nourishment, trust, ingredient quality, pet-owner emotion, scientifically credible premium care
- food/beverage: appetite appeal, freshness, flavor, consumption occasion
- household care: transformation, cleanliness, efficacy, satisfying visual proof
- wellness: routine, clarity, trust, lifestyle integration
SCENE: One coherent physical environment that expresses the primary benefit - conceptually connected to the product, never merely decorative. Key ingredients/features may appear as supporting elements only where physically and commercially plausible. The product is the unmistakable hero.
COMPOSITION: Clear foreground / product plane / background depth. Product occupies roughly 30-45% of the frame. Intentional negative space for optional campaign copy. One dominant focal point. No clutter.
CAMERA: Professional high-end commercial photography; lens and perspective chosen for the product's geometry; physically realistic perspective; packaging tack-sharp; background may soften.
LIGHTING BY MATERIAL: glass = controlled edge reflections; glossy plastic = soft large-source reflections; matte = sculpted directional light; metallic = controlled speculars; food = appetizing dimensional light; skincare = soft luminous beauty light.
TEXTURE: Physically believable materials - liquid behaves like liquid, foam has microstructure, food has natural moisture, fur has individual strands, glass refracts correctly.
OUTPUT: One premium campaign photograph. No headline, no CTA, no graphic overlays, no clutter. It should feel photographed for THIS product, not generated from a generic ad template.""",

    # ---- 2. Amazon secondary lifestyle --------------------------------------
    "amazon_lifestyle": """ASSET JOB: Amazon secondary image - reduce purchase uncertainty by showing the product genuinely doing its job for the exact person/pet it is for.
CREATIVE DIRECTION: One believable in-use moment answering "will this work for me?". Real setting, real emotion, bright trustworthy daylight. The pack stays clearly identifiable and label-readable - shoppers zoom. No fantasy scenarios; the moment must be repeatable in the customer's own home. Composition survives a mobile thumbnail: single subject, high contrast, product unmistakable.""",

    # ---- 3. Amazon infographic: clarity beats cinematic beauty -------------
    "amazon_infographic": """ASSET JOB: Conversion-focused ecommerce infographic - answer ONE important customer question within two seconds (what does it do / who is it for / what's inside / how is it used / why this variant).
INFORMATION HIERARCHY: 1) space for a short benefit-led headline, 2) product, 3) visual proof or mechanism, 4) at most 2-4 supporting zones. Never overload.
VISUAL EXPLANATION: Translate the benefit into a visually understandable mechanism: ingredient->function, problem->solution, step 1->2->3, product->benefit zones, what's included, or routine sequence.
LAYOUT: Clean ecommerce composition, strong mobile readability, product prominent, high contrast, simple scan path headline-zone -> product -> proof. Icon ZONES only where they aid comprehension.
HARD RULES: NO baked-in words, letters, numbers or fake statistics - text is overlaid programmatically later. No decorative pseudo-science, no fabricated clinical diagrams, no invented percentages or certifications. Communicate ONE message exceptionally clearly rather than several poorly.""",

    # ---- 4. Meta 4:5: stop the scroll with ONE conversion idea -------------
    "meta_45": """ASSET JOB: 4:5 Meta feed performance creative - the viewer must grasp the central idea before reading any copy. Build the ENTIRE visual around ONE conversion concept.
CHOOSE THE FRAMEWORK that best fits the angle (never default to a centered product floating on a colored background): problem->solution, before->after, ingredient->benefit, routine/system, comparison, objection handling, demonstration, checklist, myth vs reality, three reasons, product anatomy, use-case moment, or emotional transformation.
LAYOUT ZONES: top 20-25% kept clean for a scroll-stopping hook overlay; middle 50-60% carries the visual explanation of the idea; bottom carries product + proof. The product must be identifiable on a phone at arm's length.
PRIORITIZE: clarity, contrast, curiosity, specificity, product recognition. It should feel like a high-performing native social ad, not a magazine cover. NO baked-in text - overlay zones only.""",

    # ---- 5. Meta 9:16: vertical momentum, not a stretched 4:5 --------------
    "meta_916": """ASSET JOB: 9:16 full-screen mobile story/reel frame - immediate pattern interrupt with vertical storytelling momentum.
STRUCTURE: upper zone = visual hook / pattern interrupt; center = dominant visual story; lower zone = product payoff. Keep essential content away from the extreme top and bottom platform-UI zones (top ~20%, bottom ~15%).
VERTICAL MOMENTUM: use stacked progression, top-to-bottom transformation, a vertical ingredient journey, routine steps, or problem-above -> solution-below. The eye must naturally travel downward through the story. Never place a small product in the middle of a tall empty canvas.
Mobile readability at a glance; native story energy (candid, vivid, slightly wide lens). NO baked-in text - overlay zones only.""",

    # ---- 6. Bundle: sell the system, not a row of SKUs ---------------------
    "bundle": """ASSET JOB: Bundle/routine creative - sell the complete outcome or system, never several unrelated products in a row.
PICK THE FRAMEWORK: sequential routine (step 1 -> 2 -> 3 -> result), time-based (AM -> PM), need-based (problem A -> product A...), life-stage progression, variety selection, or complete system (each product one complementary role).
VISUAL RELATIONSHIPS: connect the products with directional flow, numbering zones, ingredient continuity, environmental progression or color coding - the customer must instantly understand 1) why these belong together, 2) what order/context they are used in, 3) why the bundle beats a single item.
Products arranged with intention, each clearly recognizable; leave zones for step labels (added later, never baked in).""",

    # ---- 7. Storyboard frame: part of a connected sequence -----------------
    "storyboard": """ASSET JOB: One cinematic frame of a connected commercial sequence - it must feel like a still lifted from a premium TV spot, not an isolated image.
CREATIVE DIRECTION: Establish mood, place and anticipation BEFORE the product hero moment; atmospheric depth (light rays, steam, dust motes, weather); anamorphic widescreen feel; a color grade drawn from the brand palette. Compose with clear narrative implication - something is about to happen. The frame must share visual DNA (lighting philosophy, palette, motif) with the campaign's other assets.""",
}

# amazon_main deliberately has NO builder: marketplace compliance beats
# creativity, so its deterministic template is rendered verbatim (locked).


def get_builder(key: str) -> str:
    return ASSET_BUILDERS.get(key, ASSET_BUILDERS["product_shoot"])
