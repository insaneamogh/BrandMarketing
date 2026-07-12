"""Slash-command skill registry for the creative agent.

Each skill = {command, description, image_specs, copy_blocks, platform_rules}.
image_specs[].prompt_template is merged with the ProductProfile + brand guidelines
at execution time. `kind` labels the asset for the UI and placement pass.
Prompt templates use {name} {category} {pack_description} {brand_colors} placeholders.
"""

_BASE_STYLE = (
    "Photorealistic commercial product photography of {name} ({category}). "
    "Pack: {pack_description}. Brand palette: {brand_colors}. "
    "Clean, premium, on-brand. No text, logos, or watermarks unless specified."
)

SKILLS = {
    "/product-shoot": {
        "command": "/product-shoot",
        "description": "4-image core product shoot: white-bg packshot, texture macro, lifestyle, flat-lay.",
        "image_specs": [
            {"kind": "packshot", "aspect": "1:1", "n": 1,
             "prompt_template": _BASE_STYLE + " Studio white seamless background, centered hero packshot, soft shadow."},
            {"kind": "texture_macro", "aspect": "1:1", "n": 1,
             "prompt_template": _BASE_STYLE + " Extreme macro of the product texture/ingredient, shallow depth of field."},
            {"kind": "lifestyle", "aspect": "1:1", "n": 1,
             "prompt_template": _BASE_STYLE + " Lifestyle in-context scene of the product in natural use, warm real setting."},
            {"kind": "flatlay", "aspect": "1:1", "n": 1,
             "prompt_template": _BASE_STYLE + " Overhead flat-lay with complementary props on a clean surface."},
        ],
        "copy_blocks": ["headline", "subhead", "three_benefit_bullets"],
        "platform_rules": ["No text baked into images.", "Hero the pack clearly."],
    },
    "/amazon": {
        "command": "/amazon",
        "description": "Amazon listing set: compliant main image + 2 lifestyle + benefits infographic-style + A+ copy.",
        "image_specs": [
            {"kind": "amazon_main", "aspect": "1:1", "n": 1,
             "prompt_template": (
                 "Amazon listing MAIN image of {name} ({category}). Pack: {pack_description}. "
                 "PURE WHITE (#FFFFFF) background, product fills ~85% of the frame, centered, "
                 "sharp studio lighting, ABSOLUTELY NO text, badges, or graphics overlaid "
                 "(Amazon main-image policy). Brand palette on pack only: {brand_colors}.")},
            {"kind": "lifestyle", "aspect": "1:1", "n": 1,
             "prompt_template": _BASE_STYLE + " Aspirational lifestyle scene showing the product in real use."},
            {"kind": "lifestyle", "aspect": "1:1", "n": 1,
             "prompt_template": _BASE_STYLE + " Second lifestyle scene, different context, human/pet warmth."},
            {"kind": "infographic", "aspect": "1:1", "n": 1,
             "prompt_template": (
                 "Benefits infographic-STYLE product image of {name} ({category}), clean layout "
                 "with the pack and simple icon zones for key benefits, brand palette {brand_colors}. "
                 "Minimal, uncluttered, e-commerce secondary-image aesthetic.")},
        ],
        "copy_blocks": ["title", "five_bullets", "a_plus_hero", "a_plus_comparison"],
        "platform_rules": [
            "Main image: pure white bg, product ~85% frame, NO text overlay (Amazon rule).",
            "Bullets <= 500 chars each, benefit-led.",
        ],
    },
    "/meta": {
        "command": "/meta",
        "description": "Meta paid-social set: 4:5 static + 9:16 frame, hook overlays, primary text + headline.",
        "image_specs": [
            {"kind": "meta_feed", "aspect": "4:5", "n": 1,
             "prompt_template": _BASE_STYLE + " Scroll-stopping 4:5 social feed composition, leave clean space for a text hook."},
            {"kind": "meta_story", "aspect": "9:16", "n": 1,
             "prompt_template": _BASE_STYLE + " Vertical 9:16 story/reel frame, dynamic, thumb-stopping, space for overlay at top."},
        ],
        "copy_blocks": ["primary_text", "headline", "hook_overlays"],
        "platform_rules": [
            "Keep any suggested overlay text short (< 5 words).",
            "Primary text + headline derive from the approved brief angle.",
        ],
    },
    "/bundle": {
        "command": "/bundle",
        "description": "Everything above + a 6-frame VIDEO STORYBOARD (stills + shot notes + Veo prompt). Storyboard only — no video API calls.",
        "image_specs": [
            {"kind": "packshot", "aspect": "1:1", "n": 1,
             "prompt_template": _BASE_STYLE + " Studio white background hero packshot."},
            {"kind": "lifestyle", "aspect": "4:5", "n": 1,
             "prompt_template": _BASE_STYLE + " Lifestyle hero for social, 4:5."},
            {"kind": "storyboard", "aspect": "16:9", "n": 1,
             "prompt_template": _BASE_STYLE + " Cinematic opening storyboard frame, 16:9, establishing shot."},
        ],
        "copy_blocks": ["primary_text", "headline", "storyboard_6_frames", "veo_prompt"],
        "platform_rules": [
            "Storyboard is 6 stills + shot descriptions + one ready-to-run Veo prompt.",
            "Do NOT call any video API — storyboard only (cost control).",
        ],
    },
}


def get_skill(command: str) -> dict:
    if command not in SKILLS:
        raise KeyError(f"unknown skill {command}; valid: {list(SKILLS)}")
    return SKILLS[command]


def list_skills() -> list:
    return [{"command": s["command"], "description": s["description"]} for s in SKILLS.values()]
