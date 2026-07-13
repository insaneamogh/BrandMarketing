# AdPipeline — A 5-Minute Walkthrough

*Read this out loud in about 5–8 minutes. No engineering background needed.*

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
makes the ads. Every handoff is a meeting, an email, a delay.

Our case study asks a simple question: **can AI agents hand work off to each
other the way those human teams do — cleanly, with the right person approving at
each step?** AdPipeline is the working answer.

---

## 3. Meet the three agents

Picture three specialists sitting in a row. Work moves left to right, and a human
gate sits between each of them.

**Agent 1 — the Researcher / Monitor.**
This is your early-warning analyst. It looks at how campaigns are actually
performing and tells you, in plain English: *what's going wrong, where sales are
lagging, and what's quietly working well.* Crucially, it doesn't guess at the
numbers — the math (return on ad spend, cost per sale, etc.) is calculated in
plain code and handed to the AI, so the figures are always correct. The AI's job
is to *explain* them like a smart colleague would: "This campaign returns 80
cents for every dollar spent — below the break-even line — so roughly $63K is
being wasted. Here's what I'd do Monday morning."

**Agent 2 — the Strategist / Planner.**
Once you approve the research, it's handed to Agent 2, which turns findings into a
**plan**: a single campaign idea ("the angle"), the specific marketing changes to
make, which sales channels to use, and the concrete next steps. Every
recommendation is tied to a real number from the research — no vague "let's
improve engagement." It even ends each plan with a measurable target: *"in four
weeks, cost-per-sale should drop from $X to $Y."*

**Agent 3 — the Creative.**
After you approve the plan, Agent 3 becomes your design studio. You point it at a
product, and it: reads the product page, writes the ad copy, and designs the
actual images — Amazon listing photos, Instagram/Facebook posts, a full campaign
bundle. Then it recommends where to run each ad and gives you an honest forecast
of expected results, with a confidence percentage on each.

---

## 4. The golden rule: a human approves every handoff

This is the heart of the whole thing. Between each agent there's an **approval
gate**. Nothing moves forward until you click **Approve**.

And if you don't like what you see, you **Reject with feedback** — you type *why*,
in your own words ("too focused on North America, push India quick-commerce
instead") — and that agent **re-runs with your feedback baked into its
instructions.** The next version visibly reflects what you asked for. It's a
conversation, not a black box.

So the full journey is:

> **Research → *you approve* → Plan → *you approve* → Creative → *you approve &
> publish.***

Three specialists, three sign-offs, one campaign.

---

## 5. The part everyone cares about: the images

This is where most AI ad tools fall flat — they produce generic "product floating
in a beige studio" pictures. We solved that with a two-step trick:

**Step 1 — Draft the instructions (free).** Before spending a cent, the system
writes a detailed, professional "brief" for each image. An Amazon main photo has
totally different rules (pure white background, no text — Amazon's actual policy)
than an Instagram story (vertical, thumb-stopping, hook at the top). Each image
type gets its own expert recipe. It also locks in the real product details — the
exact pack, the brand colors, the approved claims — so the final picture actually
looks like *your* product, not a lookalike.

**Step 2 — You approve, then it paints (paid).** You see every image instruction
first and can edit any of them, or add your own art direction ("golden-hour light,
older golden retriever, warm kitchen"). You can even **upload a reference photo**
of the real product so the AI stays faithful to it, and choose **how many
variations** (1 to 4) of each image you want. Only when you hit approve does the
premium image engine (OpenAI's image model) actually generate them — so you never
pay for images you didn't want.

You watch them appear one by one, live, as they're created.

---

## 6. Built-in cost discipline (the CFO-friendly bit)

The whole thing is engineered to be almost free to run:

- **All the thinking and writing** — research, planning, copy, image instructions
  — runs on **Google Gemini's free tier**. Zero cost.
- **Only the final images** cost money (roughly a few cents each), and only after
  you've approved them.
- **It never pays twice.** If the exact same image is requested again, it's served
  instantly from memory at **$0.00** — you can see a green "CACHE HIT" badge on it.
- A **live cost meter** in the corner shows exactly what's been spent, down to the
  fraction of a cent, logged per call.
- If the free AI ever hits its daily limit, the system **automatically falls back**
  to a cheap paid model (about a tenth of a cent per call) so a live demo never
  dies mid-sentence.

A full campaign — research, plan, and a set of Amazon-ready images — costs roughly
**30 cents.** A $10 budget covers about 30 complete campaigns.

---

## 7. Where the AI gets its facts (no hallucinations)

The agents don't make things up. They can only answer from a curated **knowledge
base** — a set of documents covering real sales figures, channel economics,
competitor moves, and brand guidelines (including the legally *banned* claims each
brand can't make). Every single statement an agent makes carries a little
citation chip showing which document it came from. **No source, no claim.**

Technically this is called **RAG** (retrieval-augmented generation) — the AI
"looks things up" before it speaks, like an analyst checking the file before a
meeting.

---

## 8. Two ways to drive it

- **Chained mode** — the full assembly line described above, with all three
  approval gates. This is the showcase: it demonstrates the clean handoffs.
- **Solo mode** — skip the ceremony. Just want an ad? Paste *any* product URL
  (there's an **"Other"** option, so it works beyond our five sample products),
  pick a style, and go straight to the creative studio. The system scrapes the
  page, figures out the product, and designs the ads.

Everything you make is saved to a persistent **Asset Library** and a **History**
shelf, so you can revisit, reuse, or resume any past campaign — and even upload
finished videos into the library.

---

## 9. The one big idea to remember

Most "AI marketing" tools try to replace the marketer. **AdPipeline does the
opposite** — it does the heavy lifting (the analysis, the writing, the design
drafts) but hands the steering wheel back to a human at every meaningful decision.

The AI is fast and tireless; the human stays accountable and in control. That's
the model for how agents and people work together in a real marketing operation —
and that's exactly what this case study set out to prove.

---

*Want the technical version? See `README.md` and `PROJECT_SPEC.md`.*
