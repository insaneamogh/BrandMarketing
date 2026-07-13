"""Slash-command skill registry for the creative agent.

Each skill = {command, description, image_specs, copy_blocks, platform_rules}.
image_specs[].prompt_template is merged with the ProductProfile + brand guidelines
at execution time. `kind` labels the asset for the UI and placement pass.
Prompt templates may use {name} {category} {pack_description} {brand_colors}
{key_claims} {price_tier} placeholders.

Prompt style guide (applies to every template below):
- One subject, one story per frame; say what the camera sees, not marketing talk.
- Name the light (softbox, golden hour, high-key daylight) and the lens feel
  (macro, 85mm product lens, wide editorial) - models compose better with both.
- The pack description is the ground truth for the product's appearance; never
  contradict it. Brand palette drives the scene accents, not random color.
- Default to NO baked-in text; overlay copy is added by the platform, and
  models misspell. The infographic spec asks for icon ZONES, not words.
"""

_BASE_STYLE = (
    "Photorealistic commercial product photography of {name} ({category}). "
    "The exact pack, ground truth - render it faithfully: {pack_description}. "
    "Scene accent palette drawn from the brand colors: {brand_colors}. "
    "Crisp focus on the pack, premium {price_tier}-tier art direction, true-to-life "
    "color, no film grain. ABSOLUTELY NO text, letters, logos, watermarks or UI "
    "elements anywhere except the label already on the pack."
)

SKILLS = {
    "/product-shoot": {
        "command": "/product-shoot",
        "description": "4-image core product shoot: white-bg packshot, texture macro, lifestyle, flat-lay.",
        "image_specs": [
            {"kind": "packshot", "aspect": "1:1", "n": 1,
             "prompt_template": _BASE_STYLE + (
                 " Studio hero packshot: seamless white cyclorama background, product "
                 "perfectly centered and upright, twin softbox lighting with a gentle "
                 "top-left key, soft natural contact shadow beneath the pack, subtle "
                 "front reflection. 85mm product lens look, f/8 sharpness edge to edge.")},
            {"kind": "texture_macro", "aspect": "1:1", "n": 1,
             "prompt_template": _BASE_STYLE + (
                 " Extreme macro detail shot of the product's texture or key ingredient "
                 "(the substance itself - kibble, cream swirl, gel, oil droplets - "
                 "whichever matches the category), 100mm macro lens, razor-thin depth of "
                 "field, glistening specular highlights, backlit rim light, the pack "
                 "softly blurred in the background for context.")},
            {"kind": "lifestyle", "aspect": "1:1", "n": 1,
             "prompt_template": _BASE_STYLE + (
                 " Authentic lifestyle scene of the product genuinely in use in its "
                 "natural setting, warm golden-hour window light, candid documentary "
                 "feel, 35mm editorial lens, shallow depth of field with the pack "
                 "clearly legible in the frame. Real skin/fur texture, no plastic "
                 "retouching, believable home environment.")},
            {"kind": "flatlay", "aspect": "1:1", "n": 1,
             "prompt_template": _BASE_STYLE + (
                 " Overhead 90-degree flat-lay on a clean textured surface (linen, "
                 "stone or light wood), the pack as the anchor with 3-4 complementary "
                 "real props that tell the product's daily-ritual story, generous "
                 "negative space, soft even daylight, styled but not cluttered.")},
        ],
        "copy_blocks": ["headline", "subhead", "three_benefit_bullets"],
        "platform_rules": [
            "No text baked into images.",
            "Hero the pack clearly in every frame.",
            "Every benefit in copy must trace to a key_claim or cited guideline angle.",
        ],
    },
    "/amazon": {
        "command": "/amazon",
        "description": "Amazon listing set: compliant main image + 2 lifestyle + benefits infographic-style + A+ copy.",
        "image_specs": [
            {"kind": "amazon_main", "aspect": "1:1", "n": 1,
             "prompt_template": (
                 "Amazon listing MAIN image of {name} ({category}), strict marketplace "
                 "compliance: PURE WHITE #FFFFFF seamless background with zero shadows on "
                 "the backdrop, the physical product only - render the pack faithfully: "
                 "{pack_description} - filling 85% of the frame, perfectly centered and "
                 "front-facing, bright even studio lighting, tack-sharp label. "
                 "ABSOLUTELY NO added text, badges, borders, props, reflections, "
                 "graphics or watermarks (Amazon main-image policy). Brand colors appear "
                 "on the pack label only: {brand_colors}.")},
            {"kind": "lifestyle", "aspect": "1:1", "n": 1,
             "prompt_template": _BASE_STYLE + (
                 " Amazon secondary image: aspirational in-use scene showing the product "
                 "solving its job for a real person or pet, bright optimistic daylight, "
                 "clean modern setting, pack label readable, composition leaves the "
                 "product unmistakably the subject.")},
            {"kind": "lifestyle", "aspect": "1:1", "n": 1,
             "prompt_template": _BASE_STYLE + (
                 " Amazon secondary image, second context: a different moment of the "
                 "routine (morning vs evening, indoors vs outdoors) with human or pet "
                 "warmth and genuine emotion, distinct from the first lifestyle frame - "
                 "different setting, palette temperature and camera angle.")},
            {"kind": "infographic", "aspect": "1:1", "n": 1,
             "prompt_template": (
                 "Amazon benefits-infographic STYLE image for {name} ({category}): the "
                 "pack rendered faithfully ({pack_description}) on one side, and 3 clean "
                 "EMPTY rounded icon zones with simple pictogram-style illustrations "
                 "hinting at these benefits: {key_claims}. Brand palette {brand_colors}, "
                 "flat modern e-commerce design, generous whitespace. NO words, letters "
                 "or numbers anywhere - icon shapes only (text is overlaid later).")},
        ],
        "copy_blocks": ["title", "five_bullets", "a_plus_hero", "a_plus_comparison"],
        "platform_rules": [
            "Main image: pure white bg, product ~85% frame, NO text/props/badges (Amazon rule).",
            "Title <= 200 chars: Brand + Line + Key Benefit + Size/Count; no promo language ('#1', 'sale').",
            "Bullets <= 500 chars each, benefit-led, front-load the first 3 words.",
            "A+ copy stays within substantiated claims from the brand guidelines.",
        ],
    },
    "/meta": {
        "command": "/meta",
        "description": "Meta paid-social set: 4:5 feed + 9:16 story frame, hook overlays, primary text + headline.",
        "image_specs": [
            {"kind": "meta_feed", "aspect": "4:5", "n": 1,
             "prompt_template": _BASE_STYLE + (
                 " Scroll-stopping 4:5 Meta feed composition: bold single-subject "
                 "framing, high color contrast against the feed's white UI, product "
                 "hero at the visual center of gravity, one strong diagonal or leading "
                 "line, and clean uncluttered space in the TOP THIRD reserved for a "
                 "text hook overlay added later. Thumb-stopping in the first 100ms.")},
            {"kind": "meta_story", "aspect": "9:16", "n": 1,
             "prompt_template": _BASE_STYLE + (
                 " Vertical 9:16 story/reel key frame: immersive full-bleed scene with "
                 "motion energy (pour, splash, mid-action moment frozen), product "
                 "clearly identifiable in the lower two-thirds, top 20% and bottom 15% "
                 "kept visually quiet for platform UI and overlay text. Shot feels "
                 "native to stories - candid, vivid, slightly wide lens.")},
        ],
        "copy_blocks": ["primary_text", "headline", "hook_overlays"],
        "platform_rules": [
            "Keep any suggested overlay text short (< 5 words), thumb-stopping, claim-safe.",
            "Primary text <= 125 chars before the fold; headline <= 40 chars.",
            "Primary text + headline derive from the approved brief angle.",
        ],
    },
    "/bundle": {
        "command": "/bundle",
        "description": "Everything above + a 6-frame VIDEO STORYBOARD (stills + shot notes + video prompt). Video renders only on an explicit Seedance call - never inside this skill.",
        "image_specs": [
            {"kind": "packshot", "aspect": "1:1", "n": 1,
             "prompt_template": _BASE_STYLE + (
                 " Studio hero packshot: seamless white background, centered product, "
                 "twin softbox lighting, soft contact shadow, 85mm product lens look.")},
            {"kind": "lifestyle", "aspect": "4:5", "n": 1,
             "prompt_template": _BASE_STYLE + (
                 " Social-first 4:5 lifestyle hero: product in authentic use, warm "
                 "directional light, editorial 35mm feel, top third kept clean for a "
                 "hook overlay.")},
            {"kind": "storyboard", "aspect": "16:9", "n": 1,
             "prompt_template": _BASE_STYLE + (
                 " Cinematic 16:9 OPENING FRAME of a product commercial: establishing "
                 "shot that sets mood and place before the product appears, anamorphic "
                 "widescreen feel, atmospheric depth (light rays, steam, dust motes), "
                 "graded like a premium TV spot in the brand palette.")},
        ],
        "copy_blocks": ["primary_text", "headline", "storyboard_6_frames", "veo_prompt"],
        "platform_rules": [
            "Storyboard is 6 stills + shot descriptions + one ready-to-run text-to-video prompt (veo_prompt).",
            "veo_prompt must describe ONE continuous 5-second shot in this order: "
            "subject -> action -> setting -> lighting -> camera move (e.g. slow push-in, "
            "orbit, tilt-up). Name the mood and color grade. No cuts, no scene changes.",
            "veo_prompt: NO on-screen text, captions or logos beyond the pack label; "
            "the product must be clearly visible by second 3.",
            "Do NOT call any video API from this skill - storyboard + prompt only (cost control).",
        ],
    },
}


def get_skill(command: str) -> dict:
    if command not in SKILLS:
        raise KeyError(f"unknown skill {command}; valid: {list(SKILLS)}")
    return SKILLS[command]


def list_skills() -> list:
    return [{"command": s["command"], "description": s["description"]} for s in SKILLS.values()]
