# AdPipeline — A Guided Walkthrough

*Written for a business audience. No engineering background needed. Reads aloud
in about 5–8 minutes; skim the headers for a 90-second version.*

---

## 1. The one-sentence version

**AdPipeline is a team of three AI "employees" that watch a product's marketing
performance, decide what to change, and then design the actual ads — but a human
signs off at every handoff, so nothing goes out that the marketer didn't approve.**

Think of it like a small in-house agency that works in minutes instead of weeks,
where you stay the boss the whole way through.

---

## 2. Why we built it

Big consumer-goods companies (we modeled this on **Colgate-Palmolive** — think
**Hill's** pet food, **Palmolive** shower gels, **EltaMD** and **Filorga**
skincare) run hundreds of marketing campaigns at once. The work bounces between
teams: an analyst spots a problem, a strategist writes a plan, a creative team
makes the ads, a manager approves the spend. Every handoff is a meeting, an
email, a slide deck, a delay. A single campaign can take weeks to go from
"something's off in the numbers" to "the new ad is live."

Our case study asks a deceptively simple question: **can AI agents hand work off
to each other the way those human teams do — cleanly, in the right order, with
the right person approving at each step?** AdPipeline is the working answer. It
compresses that multi-week, multi-team relay into a single afternoon, without
removing the human judgment that keeps a brand safe.

The key word is *hand-off*. This isn't one big AI doing everything in a blur.
It's three narrow specialists that each do one job well and pass their work
forward — exactly like a real org chart, just faster.

---

## 3. Meet the three agents

Picture three specialists sitting in a row. Work moves left to right, and a human
approval gate sits between each of them.

### Agent 1 — the Researcher / Monitor

This is your early-warning analyst. It looks at how campaigns are actually
performing and tells you, in plain English: *what's going wrong, where sales are
lagging, and what's quietly working well.*

Here's the important part — it does **not** guess at the numbers. The math
(return on ad spend, cost per sale, click-through rates) is calculated in plain,
auditable code and *handed to* the AI. The AI never invents a statistic. Its job
is to **explain** the numbers like a sharp colleague would:

> *"The APAC awareness campaign returns 90 cents for every dollar spent — that's
> below the $1.50 break-even line the playbook requires and well under the
> portfolio's $2.90 average. Roughly $99K of that budget earned nothing. I'd cut
> it in half and move the money to quick-commerce, where we're seeing a 4.2x
> return."*

Every line is written so a non-marketer understands not just *that* something is
wrong, but *why*, *how much it costs*, and *what to do about it on Monday
morning.* Vague verbs like "optimize" or "review" are banned.

### Agent 2 — the Strategist / Planner

Once you approve the research, it's handed to Agent 2, which turns findings into a
**plan**. That plan has four parts:

- **The campaign angle** — one sharp creative idea, in under a dozen words,
  something a design team could shoot tomorrow ("Seven is the new two: breakfast
  that brings the zoomies back"), never a limp platitude ("Quality nutrition for
  happy pets").
- **The marketing changes** — each one tied to a specific number from the
  research, with the *mechanism* spelled out: "because India's cost-per-lead is
  $3.10 versus $8.40 in North America, shifting 20% of that budget should cut our
  blended cost ~15%."
- **The channels** — only the sales channels the data actually supports.
- **The next steps** — three to six sequenced actions, each with an owner and a
  timeframe, the first ones doable this week.

And it closes every plan with a measurable promise: *"in four weeks, cost-per-sale
should drop from $X to $Y."* If it can't state its own success metric, the plan
isn't ready.

### Agent 3 — the Creative

After you approve the plan, Agent 3 becomes your design studio. You point it at a
product, and it does four things:

1. **Reads the product page** — pulls the real product name, packaging look,
   claims, and images straight from the live website.
2. **Writes the ad copy** — headlines, bullets, hooks — always within the brand's
   approved, legally-safe claims.
3. **Designs the actual images** — Amazon listing photos, Instagram/Facebook
   posts, full campaign bundles.
4. **Recommends placement + forecasts results** — where to run each ad, the
   budget split, and an *honest* prediction of the outcome with a confidence
   percentage attached to each metric.

That confidence score matters: it's deliberately calibrated to be modest (capped
at 85% unless the data is a perfect match) so nobody walks away with a false sense
of certainty.

---

## 4. The golden rule: a human approves every handoff

This is the heart of the whole thing. Between each agent there's an **approval
gate**. Nothing moves forward until you click **Approve**.

And if you don't like what you see, you **Reject with feedback** — you type *why*,
in your own words ("too focused on North America, push India quick-commerce
instead") — and that agent **re-runs with your feedback written into its
instructions.** The next version visibly reflects what you asked for. You'll
literally see a banner noting that your feedback was consumed. It's a
conversation, not a black box you have to accept or discard whole.

So the full journey is:

> **Research → *you approve* → Plan → *you approve* → Creative → *you approve &
> publish.***

Three specialists, three sign-offs, one campaign. Each approval is recorded, so
there's a clean audit trail of who decided what — the kind of accountability a
real brand needs before money goes out the door.

---

## 5. A day in the life — a concrete example

Let's walk through a real scenario, start to finish, the way you'd demo it.

**You open the app and start a campaign.** You pick *Hill's Youthful Vitality*
(the senior-dog food) and type an objective: *"Sales are soft in APAC — find the
problem and fix it efficiently."*

**Agent 1 goes to work.** In a few seconds you get a research card: the APAC
awareness campaign is bleeding money at 0.9x return, North America and Europe are
healthy, and the standout performer is the vet-referral channel. Every claim has
a little citation chip — you can see it's reading from real sales data, not
inventing. You read it, nod, and click **Approve**.

**Agent 2 receives the baton.** It proposes an angle built around the senior-pet
demographic (more than half of US dogs are now 7+), recommends pulling spend out
of the failing APAC awareness push and into quick-commerce and vet-referral
programs, and lays out next steps with owners. You think it leans too broad, so
you **reject** with: *"focus the creative on the emotional senior-dog moment, not
the science."* It re-plans, and the angle sharpens. Now you **Approve**.

**Agent 3 opens the studio.** You choose the **/amazon** style, keep the
pre-filled Hill's URL, and — because you want the pack to look exactly right — you
**upload a photo** of the real bag. You add a note: *"warm morning kitchen,
grey-muzzled golden retriever."* You click **Draft**.

**You review the image instructions (still $0 spent).** The system shows you four
detailed image briefs — a compliant white-background Amazon main shot, two
lifestyle scenes, a benefits layout. You tweak one, set the main shot to generate
**2 variations**, and hit **Approve & Render.**

**The images appear one by one, live.** Total spend: about 30 cents, shown in the
corner meter. You run the placement pass — it maps each image to Amazon vs Meta
with a budget split and expected click and conversion rates. Satisfied, you click
**Approve & Publish.** The campaign is stamped, saved to your history, and its
projected results loop back to feed Agent 1's next monitoring cycle.

Start to finish: a few minutes, one person, under a dollar.

---

## 6. The part everyone cares about: the images

This is where most AI ad tools fall flat — they produce generic "product floating
in a beige studio with some leaves nearby" pictures. We solved that with a
two-step approach and a library of expert recipes.

### Every ad type gets its own recipe

There is no single "make a marketing image" button, because a Hill's dog-food bag
and a Palmolive shower gel need completely different visual logic. Instead, each
*type* of ad has its own built-in creative brief:

- **Product shoot** — make the product look desirable and premium.
- **Amazon main image** — strict marketplace compliance: pure white background,
  no text, product fills the frame. (This one is *locked* — the AI can't
  creatively "improve" it, because Amazon would reject it.)
- **Amazon lifestyle** — reduce a shopper's doubt by showing the product in real
  use by exactly the person it's for.
- **Instagram/Facebook 4:5 feed** — stop the scroll and land one single idea.
- **Instagram/Facebook 9:16 story** — vertical, mobile-first, hook at the top.
- **Bundle** — sell the whole routine, not one product.

### Step 1 — Draft the instructions (free)

Before spending a cent, the system writes a detailed, production-ready brief for
each image using the right recipe. It locks in the real product facts — the exact
pack, the brand colors, the approved claims — so the final picture looks like
*your* product, not a lookalike. This "draft" step runs entirely on the free AI
tier.

### Step 2 — You approve, then it paints (paid)

You see every image instruction first. You can:

- **Edit any of them** in plain text.
- **Add art direction** for the whole set ("golden-hour light, warm kitchen").
- **Upload a reference photo** of the real product so the AI stays faithful to it.
- **Choose how many variations** (1 to 4) of each image you want.

Only when you hit **Approve & Render** does the premium image engine (OpenAI's
image model) actually generate them. So you never pay for images you didn't
explicitly ask for — and you watch them appear one at a time, live, as they're
created.

Every rendered image is still editable afterward: change its prompt and
regenerate just that one.

---

## 7. Built-in cost discipline (the CFO-friendly bit)

The whole thing is engineered to be almost free to run:

- **All the thinking and writing** — research, planning, copy, image instructions
  — runs on **Google Gemini's free tier.** Zero cost.
- **Only the final images** cost money (roughly a few cents each), and only after
  you've approved them.
- **It never pays twice.** If the exact same image is requested again, it's served
  instantly from memory at **$0.00** — you'll see a green "CACHE HIT" badge on it.
- A **live cost meter** in the corner shows exactly what's been spent, down to the
  fraction of a cent, logged for every single AI call.
- **If the free AI hits its daily limit, the system automatically switches** to a
  cheap paid backup model (about a tenth of a cent per call) so a live demo never
  dies mid-sentence. The audience never notices the handoff.

A full campaign — research, plan, and a set of Amazon-ready images — costs roughly
**30 cents.** A $10 budget covers about **30 complete campaigns.**

This is a deliberate design choice, not an accident: the expensive step (image
generation) is the *only* one that costs money, it's the *last* step, and it's
gated behind an explicit human approval. Spend can't run away.

---

## 8. Where the AI gets its facts (no hallucinations)

The agents don't make things up. They can only answer from a curated **knowledge
base** — a set of documents covering real sales figures, channel economics,
competitor moves, senior-pet demographics, quick-commerce trends, and brand
guidelines (including the legally *banned* claims each brand is not allowed to
make). We keep this grounded in genuine public data — for example, Hill's actual
reported results and India's real quick-commerce market shares.

Every single statement an agent makes carries a little citation chip showing which
document it came from. The rule is absolute: **no source, no claim.** If the
knowledge base doesn't support something, the agent stays silent rather than
inventing.

Technically this is called **RAG** — retrieval-augmented generation. The AI
"looks things up" before it speaks, like an analyst pulling the file before a
meeting. And because the banned-claims rules live right in that knowledge base, an
agent physically can't write copy that makes an unapproved medical or
"anti-aging" claim.

---

## 9. The five sample products (and "bring your own")

Out of the box, the demo ships with five real products across three very different
categories, chosen to prove the system adapts its visual and messaging logic:

| Product | Category | Why it's interesting |
|---|---|---|
| Hill's Youthful Vitality | Senior dog food | Emotional, demographic-driven |
| Hill's Prescription Diet k/d | Therapeutic pet food | Vet-channel, compliance-heavy |
| Palmolive Luminous Oils | Shower gel | Mass-market, quick-commerce |
| EltaMD UV Clear SPF 46 | Dermatologist sunscreen | Premium, science-led |
| Filorga NCEF-Reverse | Anti-aging skincare | Prestige, claim-sensitive |

But you're not limited to those. There's an **"Other — paste any product URL"**
option. Drop in a link to *any* product on the web, and the system will scrape the
page, work out what the product is, and design ads for it. That's the real proof
the approach is product-agnostic, not hard-wired to five demos.

---

## 10. Two ways to drive it

- **Chained mode** — the full assembly line described above, with all three
  approval gates. This is the showcase: it demonstrates the clean, accountable
  handoffs from analyst to strategist to creative.
- **Solo mode** — skip the ceremony. Just want an ad? Go straight to any single
  agent. Paste a product URL, pick a style, and jump directly to the creative
  studio. Great for a quick one-off when you don't need the full strategic
  workflow.

Both modes save everything to a persistent **Asset Library** (every image, priced,
filterable by brand and channel) and a **History** shelf (every past campaign,
resumable exactly where you left off). You can even upload finished videos into
the library if you produced them elsewhere.

---

## 11. Behind the "Publish" button — and what's real vs. simulated

Let's be honest about what this proof-of-concept does and doesn't do, because that
transparency matters for a case study:

- The **analysis, strategy, copy, and images are all genuinely AI-generated** and
  real. You can use the images.
- **"Approve & Publish"** currently *records* the decision and packages everything
  up — it's the exact point where, in a production system, the app would call
  Amazon's or Meta's advertising API to actually launch the campaign. We built the
  gate and the hand-off; wiring the live ad-platform APIs is the clearly-marked
  next step.
- The **performance numbers** the monitor reasons about are realistic sample data
  modeled on real public figures — enough to make the decisions meaningful,
  without needing a live ad account.

This honesty is intentional: the POC proves the *workflow and the hand-offs*, and
shows exactly where real-world integrations plug in.

---

## 12. Where it lives and how your data is kept

The app runs as a single web service (deployable on **Railway**, a cloud host).
Everything you create — the campaign records, the knowledge base, the generated
images and videos — is saved to one persistent storage location that survives
restarts and redeploys, so your work is never lost between sessions. Nothing
sensitive is hard-coded; the API keys that power the AI live in secure
environment settings, never in the code.

For a bigger production footprint, the same design scales up cleanly: the records
move to a managed database and the images to cloud storage, with no change to how
the app behaves.

---

## 13. Common questions

**"Is this replacing the marketing team?"**
No — and that's the point. It does the heavy lifting (analysis, first-draft
strategy, image design) but hands the wheel back to a human at every real
decision. The AI is fast and tireless; the person stays accountable and in
control.

**"How do we know the AI isn't making things up?"**
Every claim is cited to a source document, the performance math is computed in
code (not by the AI), and the AI is forbidden from stating anything the knowledge
base doesn't support.

**"What stops it from spending a fortune on images?"**
Images are the only paid step, they're last, they're capped per run, they're
cached so repeats are free, and nothing generates until a human clicks approve.

**"Can it handle our products, not just the samples?"**
Yes — paste any product URL and it adapts. The image recipes and brand-safety
rules are general, not tied to the five demo products.

**"What if the free AI runs out for the day?"**
It automatically falls back to a low-cost paid model so the experience never
breaks.

---

## 14. The one big idea to remember

Most "AI marketing" tools try to replace the marketer. **AdPipeline does the
opposite** — it does the heavy lifting but hands the steering wheel back to a
human at every meaningful decision.

The AI is fast and tireless; the human stays accountable and in control. That's
the model for how agents and people work together in a real marketing operation —
and that's exactly what this case study set out to prove.

---

*Want the technical version? See `README.md` (setup, architecture, cost routing)
and `PROJECT_SPEC.md` (the full engineering hand-off spec).*
