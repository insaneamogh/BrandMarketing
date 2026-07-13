import { useEffect, useRef, useState } from "react";
// Untitled UI icons (https://www.untitledui.com/free-icons) via the official
// @untitled-ui/icons-react package - 24px line icons, stroke inherits currentColor.
import {
  BarChart10, Brush01, Check, CheckCircle, ClockRewind, Compass03, Diamond01,
  Edit02, HelpCircle, LayersTwo01, Link01, Menu01, RefreshCcw01, Rocket02,
  SearchLg, Stars01, Target04, Trash01, Upload01, XClose,
} from "@untitled-ui/icons-react";

// ============================================================
// AdPipeline - staged 3-agent handoff edition.
// Agent 1 Research → human gate → Agent 2 Plan → human gate →
// Agent 3 Creative (reference image, prompt tweaks, expected
// metrics with probability, Approve & Publish).
// White-first translucent glass on a soft light field.
// ============================================================

const T = {
  ink: "#0B1D33",
  body: "#3C4C63",
  soft: "#5A6B82",
  faint: "#8B99AC",
  blue: "#1F75FE",
  blueSoft: "rgba(31,117,254,0.10)",
  blueBorder: "rgba(31,117,254,0.35)",
  green: "#178A50",
  greenSoft: "rgba(23,138,80,0.10)",
  red: "#D93636",
  redSoft: "rgba(217,54,54,0.08)",
  amber: "#C08A1E",
  amberSoft: "rgba(192,138,30,0.10)",
  line: "rgba(11,29,51,0.10)",
  serif: "'Instrument Serif', serif",
  sans: "'Instrument Sans', sans-serif",
  mono: "'Geist Mono', monospace",
};

const glass = {
  background: "rgba(255,255,255,0.62)",
  backdropFilter: "blur(20px) saturate(1.5)",
  WebkitBackdropFilter: "blur(20px) saturate(1.5)",
  border: "1px solid rgba(255,255,255,0.75)",
  boxShadow: "0 10px 34px rgba(11,29,51,0.07)",
  borderRadius: 18,
};

const FLOW = [
  { key: "overview", step: "01", label: "Pipeline", sub: "Start a campaign" },
  { key: "research", step: "02", label: "Research & Monitor", sub: "Agent 1 · what's wrong" },
  { key: "plan", step: "03", label: "Strategy Plan", sub: "Agent 2 · what to change" },
  { key: "creative", step: "04", label: "Creative Studio", sub: "Agent 3 · make & publish" },
];

// sidebar sublabels when the toggle is on Solo agents (standalone runs, no gates)
const SOLO_SUBS = {
  overview: "Pick an agent",
  research: "Agent 1 · standalone",
  plan: "Agent 2 · standalone",
  creative: "Agent 3 · standalone",
};

// 5 products across the 3 portfolios: high-margin winners (Prescription Diet,
// EltaMD), steady lines (Youthful Vitality, Luminous Oils), one struggler (Filorga).
const PRODUCTS = [
  "Hill's Youthful Vitality",
  "Hill's Prescription Diet k/d",
  "Palmolive Luminous Oils",
  "EltaMD UV Clear SPF 46",
  "Filorga NCEF-Reverse",
];
const SKILLS = [
  { cmd: "/product-shoot", d: "4 hero images: packshot, macro, lifestyle, flat-lay" },
  { cmd: "/amazon", d: "Listing-compliant set + A+ content blocks" },
  { cmd: "/meta", d: "4:5 feed + 9:16 story with hook overlays" },
  { cmd: "/bundle", d: "All sets + storyboard + Seedance video prompt" },
];
// LIVE product pages, verified July 2026 (exact facts: rag/corpus/product_catalog.md)
const OTHER = "Other (paste any product URL)";
const DEFAULT_URL = {
  "Hill's Youthful Vitality":
    "https://www.hillspet.com/dog-food/science-diet-adult-7-senior-vitality-chicken-rice-dry",
  "Hill's Prescription Diet k/d": "https://www.hillspet.com/dog-food/pd-kd-canine-dry",
  "Palmolive Luminous Oils":
    "https://www.palmolive.com.au/products-range/body-wash/coconut-oil-frangipani-enriching-shower-gel",
  "EltaMD UV Clear SPF 46": "https://eltamd.com/products/uv-clear-broad-spectrum-spf-46",
  "Filorga NCEF-Reverse": "https://us.filorga.com/products/ncef-reverse",
};

// which brand-guidelines doc + guardrail summary applies to a product name
function guardrailsFor(name) {
  if (/EltaMD|Filorga|NCEF/i.test(name || ""))
    return {
      cite: "brand_guidelines_skinhealth.md",
      text: 'No medical cure claims · sunscreen monograph language only · "#1 derm-recommended" is substantiated for EltaMD only.',
    };
  if (/Palmolive|Luminous/i.test(name || ""))
    return {
      cite: "brand_guidelines_palmolive.md",
      text: 'No derm cure claims · no "100% natural" absolutes · no implied medical endorsement without substantiation.',
    };
  return {
    cite: "brand_guidelines_hills.md",
    text: 'No disease-cure claims · no "reverses aging" · no implied vet endorsement without substantiation.',
  };
}

/* responsive: one breakpoint, tracked live so rotate/resize just works */
function useIsMobile(bp = 880) {
  const [m, setM] = useState(
    () => typeof window !== "undefined" && window.innerWidth <= bp
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${bp}px)`);
    const fn = (e) => setM(e.matches);
    mq.addEventListener("change", fn);
    setM(mq.matches);
    return () => mq.removeEventListener("change", fn);
  }, [bp]);
  return m;
}

async function api(path, opts) {
  const r = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!r.ok) throw new Error((await r.text()) || r.statusText);
  return r.json();
}

async function uploadFile(path, file) {
  const fd = new FormData();
  fd.append("file", file);
  const r = await fetch(path, { method: "POST", body: fd });
  if (!r.ok) throw new Error((await r.text()) || r.statusText);
  return r.json();
}

/* POST + consume an SSE stream: onEvent fires per event, resolves with the
   done payload. Keeps the user watching progress instead of a frozen spinner. */
async function apiStream(path, body, onEvent, signal) {
  const r = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!r.ok || !r.body) throw new Error((await r.text()) || r.statusText);
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let done = null;
  for (;;) {
    const { value, done: eof } = await reader.read();
    if (eof) break;
    buf += dec.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const line = chunk.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue;
      let ev;
      try {
        ev = JSON.parse(line.slice(6));
      } catch {
        continue;
      }
      if (ev.type === "error") throw new Error(ev.message || "stream error");
      if (ev.type === "done") done = ev.data;
      onEvent?.(ev);
    }
  }
  if (!done) throw new Error("stream ended unexpectedly");
  return done;
}

export default function App() {
  const [view, setView] = useState("overview");
  // "chain" = gated handoffs 1→2→3 · "solo" = run any agent standalone
  const [mode, setMode] = useState(() => {
    try { return localStorage.getItem("adp_mode") || "chain"; } catch { return "chain"; }
  });
  const [product, setProduct] = useState(PRODUCTS[0]);
  const [objective, setObjective] = useState(
    "Grow senior-pet demand efficiently in NA/EU and test scalable channels"
  );
  const [campaign, setCampaign] = useState(null);
  const [creative, setCreative] = useState(null);
  const [placement, setPlacement] = useState(null);
  const [published, setPublished] = useState(null);
  const [cost, setCost] = useState({ total_usd: 0, by_model: [] });
  // per-agent activity: {scope: {msg, ctrl}} - one agent running never blocks
  // another, and every request can be cancelled from its own banner
  const [busy, setBusy] = useState({});
  const [error, setError] = useState("");
  const isMobile = useIsMobile();
  const [navOpen, setNavOpen] = useState(false);   // mobile: pipeline drawer
  const [helpOpen, setHelpOpen] = useState(false); // "how it works" drawer

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Instrument+Sans:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap";
    document.head.appendChild(link);
    refreshCost();
    const onKey = (e) => {
      if (e.key === "Escape") {
        setNavOpen(false);
        setHelpOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const refreshCost = async () => {
    try {
      setCost(await api("/cost"));
    } catch {}
  };

  /* run one agent task under its own scope: independent spinner + cancel */
  const runTask = async (scope, msg, fn) => {
    const ctrl = new AbortController();
    setBusy((b) => ({ ...b, [scope]: { msg, ctrl } }));
    setError("");
    try {
      await fn(ctrl.signal);
    } catch (e) {
      if (e?.name !== "AbortError") setError(String(e.message || e));
    } finally {
      setBusy((b) => {
        const next = { ...b };
        delete next[scope];
        return next;
      });
    }
  };
  const isBusy = (scope) => (busy[scope] ? busy[scope].msg : "");

  /* live-update a running task's banner message from SSE status events */
  const updateBusy = (scope, msg) =>
    setBusy((b) => (b[scope] ? { ...b, [scope]: { ...b[scope], msg } } : b));

  /* progressive draft: profile -> copy -> prompts land one by one in the UI */
  const onDraftEvent = (scope, skill) => (ev) => {
    if (ev.type === "status") updateBusy(scope, `Agent 3: ${ev.message}…`);
    else if (ev.type === "profile")
      setCreative({
        profile: ev.data, copy_blocks: {}, prompts: [], assets: [],
        rendered: false, drafting: true, skill_used: skill,
      });
    else if (ev.type === "copy")
      setCreative((c) => (c ? { ...c, copy_blocks: ev.data } : c));
    else if (ev.type === "prompt")
      setCreative((c) => (c ? { ...c, prompts: [...(c.prompts || []), ev.data] } : c));
  };

  const switchMode = (m) => {
    if (m === mode) return;
    setMode(m);
    try { localStorage.setItem("adp_mode", m); } catch {}
    // don't mix a chained campaign's state with solo runs (and vice versa)
    setCampaign(null);
    setCreative(null);
    setPlacement(null);
    setPublished(null);
    setError("");
    setView("overview");
  };

  // reuse the in-flight solo campaign only while product/objective are unchanged;
  // editing either starts a fresh standalone run
  const soloReuseId = () =>
    campaign?.mode === "solo" && campaign.product === product && campaign.objective === objective
      ? campaign.id
      : null;

  const soloResearch = () =>
    runTask("research", "Agent 1 (solo): researching standalone…", async (signal) => {
      const res = await api("/solo/research", {
        method: "POST",
        body: JSON.stringify({ product, objective }),
        signal,
      });
      setCampaign(res);
      setCreative(null);
      setPlacement(null);
      setPublished(null);
      setView("research");
      refreshCost();
    });

  const soloPlan = () =>
    runTask("plan", "Agent 2 (solo): planning straight from the knowledge base…", async (signal) => {
      const reuse = soloReuseId();
      const res = await api("/solo/plan", {
        method: "POST",
        body: JSON.stringify(reuse ? { campaign_id: reuse } : { product, objective }),
        signal,
      });
      setCampaign(res);
      setView("plan");
      refreshCost();
    });

  const soloCreative = (url, skill, referenceId, promptTweak) =>
    runTask("creative", "Agent 3 (solo): starting the draft stage…", async (signal) => {
      const res = await apiStream("/solo/creative/stream", {
        url,
        skill,
        product,
        objective,
        campaign_id: soloReuseId(),
        reference_id: referenceId || null,
        prompt_tweak: promptTweak || null,
      }, onDraftEvent("creative", skill), signal);
      if (!campaign || campaign.id !== res.campaign_id) {
        setCampaign({
          id: res.campaign_id, product, objective, status: "solo_creative",
          mode: "solo", research: null, plan: null, cost_usd: 0,
        });
      }
      setCreative({ ...res, skill_used: skill });
      setPlacement(null);
      setPublished(null);
      refreshCost();
    });

  const startCampaign = () =>
    runTask("research", "Agent 1: researching what's wrong…", async (signal) => {
      const res = await api("/campaigns", {
        method: "POST",
        body: JSON.stringify({ product, objective }),
        signal,
      });
      setCampaign(res);
      setCreative(null);
      setPlacement(null);
      setPublished(null);
      setView("research");
      refreshCost();
    });

  const rerunResearch = () =>
    runTask("research", "Agent 1: re-running with your feedback…", async (signal) => {
      const res = await api(`/campaigns/${campaign.id}/research`, { method: "POST", signal });
      setCampaign(res);
      refreshCost();
    });

  const runPlan = () =>
    runTask("plan", "Agent 2: building the plan from approved research…", async (signal) => {
      const res = await api(`/campaigns/${campaign.id}/plan`, { method: "POST", signal });
      setCampaign(res);
      setView("plan");
      refreshCost();
    });

  const decide = async (stage, action, feedback) => {
    setError("");
    try {
      const res = await api(`/campaigns/${campaign.id}/decision`, {
        method: "POST",
        body: JSON.stringify({ stage, action, feedback }),
      });
      setCampaign((c) => ({ ...c, status: res.status }));
      if (stage === "research" && action === "approve") await runPlan(); // HANDOFF 1→2
      if (stage === "plan" && action === "approve") setView("creative"); // HANDOFF 2→3
    } catch (e) {
      setError(String(e.message || e));
    }
  };

  const genCreative = (url, skill, referenceId, promptTweak) =>
    runTask("creative", "Agent 3: starting the draft stage…", async (signal) => {
      const res = await apiStream("/creative/stream", {
        campaign_id: campaign.id,
        url,
        skill,
        reference_id: referenceId || null,
        prompt_tweak: promptTweak || null,
      }, onDraftEvent("creative", skill), signal);
      setCreative({ ...res, skill_used: skill });
      setPlacement(null);
      setPublished(null);
      refreshCost();
    });

  /* the ONLY call that spends image budget - fires after the human approves
     (and optionally edits) the drafted prompts. Streams: each finished image
     appears in the grid the moment it lands. */
  const renderImages = (prompts) =>
    runTask("render", "Sending approved prompts to the image model…", async (signal) => {
      const skillUsed = creative?.skill_used;
      setCreative((c) => (c ? { ...c, assets: [], rendered: false } : c));
      const res = await apiStream("/creative/render/stream", {
        creative_id: creative.creative_id,
        prompts: prompts.map((p) => ({ kind: p.kind, prompt: p.prompt, n: p.n || 1 })),
      }, (ev) => {
        if (ev.type === "status") updateBusy("render", `Agent 3: ${ev.message}…`);
        else if (ev.type === "asset")
          setCreative((c) => (c ? {
            ...c, rendered: true, assets: [...(c.assets || []), ev.data],
          } : c));
      }, signal);
      setCreative({ ...res, skill_used: skillUsed });
      refreshCost();
    });

  const plan = () =>
    runTask("placement", "Agent 3: placement + expected metrics…", async (signal) => {
      const res = await api("/placement", {
        method: "POST",
        body: JSON.stringify({ creative_id: creative.creative_id }),
        signal,
      });
      setPlacement(res);
      refreshCost();
    });

  const doPublish = () =>
    runTask("publish", "Publishing…", async (signal) => {
      const res = await api("/publish", {
        method: "POST",
        body: JSON.stringify({ creative_id: creative.creative_id }),
        signal,
      });
      setPublished(res);
      setCampaign((c) => ({ ...c, status: "published" }));
      refreshCost();
    });

  const openCampaign = (id) =>
    runTask("history", "Loading campaign…", async (signal) => {
      const d = await api(`/campaigns/${id}`, { signal });
      setCampaign(d);
      setPublished(null);
      const last = d.creatives?.[d.creatives.length - 1];
      if (last) {
        setCreative({
          creative_id: last.creative_id,
          campaign_id: d.id,
          profile: last.profile,
          assets: last.assets,
          copy_blocks: last.copy_blocks,
          prompts: last.prompts || [],
          rendered: last.rendered ?? (last.assets || []).length > 0,
          skill_used: last.skill,
          prompt_tweak: last.prompt_tweak,
          reference_used: last.reference_used,
        });
        setPlacement(last.placement);
        if (last.published)
          setPublished({ status: "published", published_at: last.published_at, channels: [] });
      } else {
        setCreative(null);
        setPlacement(null);
      }
      const m = d.mode === "solo" ? "solo" : "chain";
      if (m !== mode) {
        setMode(m);
        try { localStorage.setItem("adp_mode", m); } catch {}
      }
      const s = d.status;
      setView(
        s === "solo_research" ? "research"
        : s === "solo_plan" ? "plan"
        : s === "solo_creative" ? "creative"
        : s.startsWith("research") ? "research"
        : s.startsWith("plan") && s !== "plan_approved" ? "plan"
        : "creative"
      );
    });

  const idx = FLOW.findIndex((f) => f.key === view);
  const calls = cost.by_model.reduce((a, m) => a + m.calls, 0);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F3F5F9",
        color: T.ink,
        fontFamily: T.sans,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        <div style={blob(-180, "right", -120, null, 640, "rgba(31,117,254,0.16)")} />
        <div style={blob(null, "left", 180, -220, 720, "rgba(11,29,51,0.10)", true)} />
        <div style={blob(260, "left", -160, null, 420, "rgba(31,117,254,0.08)")} />
      </div>

      <div style={{ display: "flex", position: "relative", zIndex: 1, minHeight: "100vh" }}>
        {!isMobile && (
          <Sidebar view={view} setView={setView} idx={idx} cost={cost} calls={calls} campaign={campaign} mode={mode} />
        )}
        {isMobile && navOpen && (
          <div style={{ position: "fixed", inset: 0, zIndex: 60 }}>
            <div
              onClick={() => setNavOpen(false)}
              style={{ position: "absolute", inset: 0, background: "rgba(11,29,51,0.45)", backdropFilter: "blur(2px)" }}
            />
            <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, overflowY: "auto" }}>
              <Sidebar
                view={view} setView={setView} idx={idx} cost={cost} calls={calls}
                campaign={campaign} mode={mode} mobile
                onNavigate={() => setNavOpen(false)}
              />
            </div>
          </div>
        )}
        <main style={{ flex: 1, overflowY: "auto", minWidth: 0 }}>
          <div style={{ maxWidth: 1140, margin: "0 auto", padding: isMobile ? "16px 16px 60px" : "28px 44px 72px" }}>
            {isMobile && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                <button
                  onClick={() => setNavOpen(true)}
                  aria-label="Open pipeline menu"
                  style={{
                    ...glass, borderRadius: 12, width: 42, height: 42, fontSize: 19,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", color: T.ink, border: `1px solid ${T.line}`,
                  }}
                >
                  <Menu01 width={20} height={20} />
                </button>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 26, height: 26, borderRadius: 8, background: T.blue, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: T.serif, fontSize: 16 }}>A</span>
                  <span style={{ fontFamily: T.serif, fontSize: 19 }}>AdPipeline</span>
                </span>
              </div>
            )}
            <ModeToggle mode={mode} onSwitch={switchMode} onHelp={() => setHelpOpen(true)} />
            <TopBar view={view} go={setView} campaign={campaign} product={product} mode={mode} />
            {error && <Banner tone="err">{error}</Banner>}
            {Object.entries(busy).map(([scope, b]) => (
              <Banner key={scope} tone="load" onCancel={() => b.ctrl.abort()}>
                {b.msg}
              </Banner>
            ))}

            {view === "overview" && (
              <Overview
                {...{ product, setProduct, objective, setObjective, campaign, startCampaign, mode, soloResearch, soloPlan, setView }}
                loading={isBusy("research") || isBusy("plan")}
              />
            )}
            {view === "research" && (
              <Research
                {...{ campaign, decide, rerunResearch, mode, soloResearch, product, setProduct, objective, setObjective }}
                loading={isBusy("research")}
              />
            )}
            {view === "plan" && (
              <Plan
                {...{ campaign, decide, runPlan, mode, soloPlan, product, setProduct, objective, setObjective }}
                loading={isBusy("plan")}
              />
            )}
            {view === "creative" && (
              <CreativeStudio
                {...{ product, setProduct, objective, setObjective, campaign, creative, placement, published, plan, doPublish, refreshCost, mode, renderImages }}
                genCreative={mode === "solo" ? soloCreative : genCreative}
                loading={isBusy("creative")}
                rendering={isBusy("render")}
                placing={isBusy("placement")}
                publishing={isBusy("publish")}
              />
            )}
            {view === "history" && <History onOpen={openCampaign} />}
            {view === "library" && <Library onCost={refreshCost} />}
          </div>
        </main>
      </div>

      <HelpDrawer open={helpOpen} onClose={() => setHelpOpen(false)} mode={mode} />
    </div>
  );
}

function blob(top, side, sx, bottom, size, color, isBottom) {
  const s = {
    position: "absolute",
    width: size,
    height: size,
    borderRadius: "50%",
    background: `radial-gradient(circle, ${color}, transparent 65%)`,
  };
  if (top != null) s.top = top;
  if (bottom != null) s.bottom = bottom;
  if (isBottom) s.bottom = bottom;
  s[side] = sx;
  return s;
}

/* ---------- shell ---------- */
/* the chained/solo switch - the one control that changes how the agents run */
function ModeToggle({ mode, onSwitch, onHelp }) {
  const isMobile = useIsMobile();
  const opts = [
    { k: "chain", icon: Link01, label: "Chained pipeline" },
    { k: "solo", icon: Diamond01, label: "Solo agents" },
  ];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
      <div style={{ ...glass, display: "flex", gap: 4, padding: 5, borderRadius: 13 }}>
        {opts.map((o) => {
          const active = mode === o.k;
          return (
            <button
              key={o.k}
              onClick={() => onSwitch(o.k)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                border: "none",
                cursor: "pointer",
                padding: isMobile ? "9px 13px" : "9px 18px",
                borderRadius: 9,
                fontFamily: T.sans,
                fontWeight: 700,
                fontSize: 13.5,
                background: active ? T.blue : "transparent",
                color: active ? "#fff" : T.soft,
                boxShadow: active ? "0 4px 14px rgba(31,117,254,0.30)" : "none",
              }}
            >
              <o.icon width={15} height={15} />
              {o.label}
            </button>
          );
        })}
      </div>
      {!isMobile && (
        <span style={{ fontSize: 12.5, color: T.faint, fontWeight: 500, maxWidth: 440, lineHeight: 1.45 }}>
          {mode === "chain"
            ? "Agents hand off 1 → 2 → 3 through human approval gates."
            : "Each agent runs standalone with no gates and no handoffs. Jump straight to any step (e.g. just generate an ad)."}
        </span>
      )}
      <button
        onClick={onHelp}
        style={{
          ...glass,
          marginLeft: "auto",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "9px 16px",
          borderRadius: 99,
          border: `1px solid ${T.blueBorder}`,
          cursor: "pointer",
          fontFamily: T.sans,
          fontWeight: 700,
          fontSize: 13,
          color: T.blue,
          background: "rgba(255,255,255,0.75)",
        }}
      >
        <HelpCircle width={17} height={17} />
        How it works
      </button>
    </div>
  );
}

/* ---------- help drawer: the non-technical "what do I do here" guide ---------- */
function HelpStep({ n, icon: StepIcon, title, children, you, last }) {
  return (
    <div style={{ display: "flex", gap: 14 }}>
      {/* rail: numbered node + connector */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
        <div
          style={{
            width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: you ? T.green : T.blue, color: "#fff", fontSize: 17,
            boxShadow: `0 5px 14px ${you ? "rgba(23,138,80,0.35)" : "rgba(31,117,254,0.35)"}`,
          }}
        >
          <StepIcon width={17} height={17} />
        </div>
        {!last && (
          <div style={{ width: 2, flex: 1, minHeight: 22, background: "linear-gradient(rgba(31,117,254,0.45), rgba(31,117,254,0.12))", margin: "4px 0" }} />
        )}
      </div>
      <div style={{ paddingBottom: last ? 0 : 20, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontFamily: T.mono, fontSize: 10.5, color: T.faint, letterSpacing: 1 }}>{n}</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: T.ink }}>{title}</span>
          {you && <Pill color="#fff" bg={T.green}>YOU</Pill>}
        </div>
        <p style={{ fontSize: 13, color: T.body, lineHeight: 1.6, margin: "5px 0 0", fontWeight: 500 }}>{children}</p>
      </div>
    </div>
  );
}

function HelpDrawer({ open, onClose, mode }) {
  const isMobile = useIsMobile();
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 80 }}>
      <div
        onClick={onClose}
        style={{ position: "absolute", inset: 0, background: "rgba(11,29,51,0.45)", backdropFilter: "blur(2px)" }}
      />
      <div
        style={{
          position: "absolute", top: 0, right: 0, bottom: 0,
          width: isMobile ? "100%" : 470,
          background: "rgba(250,251,254,0.97)",
          backdropFilter: "blur(24px)",
          boxShadow: "-18px 0 50px rgba(11,29,51,0.25)",
          overflowY: "auto",
          padding: isMobile ? "22px 20px 48px" : "30px 30px 48px",
          borderRadius: isMobile ? 0 : "22px 0 0 22px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontFamily: T.mono, fontSize: 11, color: T.blue, letterSpacing: 1.5, fontWeight: 600 }}>
            GUIDE · 2 MIN READ
          </span>
          <button
            onClick={onClose}
            aria-label="Close guide"
            style={{
              width: 34, height: 34, borderRadius: "50%", border: `1px solid ${T.line}`,
              background: "rgba(255,255,255,0.9)", cursor: "pointer", fontSize: 16, color: T.soft,
            }}
          >
            <XClose width={16} height={16} style={{ display: "block", margin: "0 auto" }} />
          </button>
        </div>
        <h2 style={{ fontFamily: T.serif, fontSize: 30, fontWeight: 400, margin: "4px 0 8px", letterSpacing: "-0.5px" }}>
          How AdPipeline works
        </h2>
        <p style={{ fontSize: 13.5, color: T.soft, lineHeight: 1.6, margin: "0 0 22px", fontWeight: 500 }}>
          Three AI teammates build a marketing campaign for you, and nothing ships without
          your say-so. Here's the whole journey:
        </p>

        <Card style={{ padding: "22px 20px", marginBottom: 18 }}>
          <Label color={T.blue}>THE CHAINED PIPELINE · START TO PUBLISHED AD</Label>
          <div style={{ marginTop: 18 }}>
            <HelpStep n="STEP 1" icon={Target04} title="Pick a product & a goal" you>
              Choose one of the 5 products and type what you want to achieve
              (e.g. "grow sales in the US"). Hit <b>Start campaign</b>.
            </HelpStep>
            <HelpStep n="STEP 2" icon={SearchLg} title="Agent 1 researches">
              It reads the company knowledge base and reports what's going wrong, what's
              working, and where to focus. Every claim shows the document it came from.
            </HelpStep>
            <HelpStep n="STEP 3" icon={CheckCircle} title="You approve, or reject with a note" you>
              Happy? Approve, and the research is handed to the planner. Not happy?
              Reject with a comment and the agent redoes it your way.
            </HelpStep>
            <HelpStep n="STEP 4" icon={Compass03} title="Agent 2 builds the plan">
              The approved research becomes a campaign plan: one big creative idea, the
              budget moves that the numbers justify, and this week's next steps.
            </HelpStep>
            <HelpStep n="STEP 5" icon={CheckCircle} title="You approve the plan" you>
              Same deal: approve to continue, or reject with feedback.
            </HelpStep>
            <HelpStep n="STEP 6" icon={Brush01} title="Agent 3 drafts the ads (free)">
              Paste the product URL: the system reads the page itself (name, claims,
              price, photos), then writes the ad copy and a detailed description of every
              image it plans to create. No image budget is spent at this step.
            </HelpStep>
            <HelpStep n="STEP 7" icon={CheckCircle} title="You approve the image prompts" you>
              Read the drafted image descriptions, edit any of them, then approve. Only
              that click calls the paid image model and renders the actual ad images.
              You can also upload a real product photo and add art direction.
            </HelpStep>
            <HelpStep n="STEP 8" icon={BarChart10} title="See where the ads go & what to expect">
              A placement plan maps each ad to a channel with a budget split, plus honest
              predicted results with confidence bars.
            </HelpStep>
            <HelpStep n="STEP 9" icon={Rocket02} title="Approve & publish" you last>
              The final green button. The campaign is stamped PUBLISHED and lands in your
              History.
            </HelpStep>
          </div>
        </Card>

        <Card style={{ padding: "22px 20px", marginBottom: 18 }}>
          <Label color={T.blue}>SOLO AGENTS · WHEN YOU DON'T NEED THE WHOLE CHAIN</Label>
          <p style={{ fontSize: 13, color: T.body, lineHeight: 1.65, margin: "12px 0 0", fontWeight: 500 }}>
            Flip the toggle at the top to <b>Solo agents</b> and every step becomes a
            standalone tool with no approval gates. Just need an ad? Go straight to the
            <b> Creative Studio</b>, pick a product and a format, and generate. Your
            objective becomes the brief. Need only a market read or only a plan? Run
            Agent 1 or Agent 2 alone the same way.
          </p>
        </Card>

        <Card style={{ padding: "22px 20px" }}>
          <Label>GOOD TO KNOW</Label>
          <ul style={{ margin: "10px 0 0", paddingLeft: 18 }}>
            {[
              "Every running agent shows its own banner with a Cancel button; agents run independently, so one working never blocks another.",
              "The little blue tags (like campaign_history.md) show which document a claim came from. No source, no claim.",
              "The dark card in the menu shows the live cost of every AI call. Repeat image prompts are served from cache at $0.00.",
              "History keeps every past campaign; open one to resume exactly where it left off.",
              "The Asset Library stores every image ever generated, with its exact cost.",
              "On any generated image, tap 'edit prompt' to tweak and regenerate just that one.",
            ].map((t, i) => (
              <li key={i} style={{ fontSize: 12.5, color: T.body, lineHeight: 1.65, marginBottom: 7, fontWeight: 500 }}>{t}</li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Sidebar({ view, setView, idx, cost, calls, campaign, mode, mobile, onNavigate }) {
  const solo = mode === "solo";
  const nav = (k) => {
    setView(k);
    onNavigate?.(); // mobile drawer closes after choosing a step
  };
  const shelf = [
    { key: "library", icon: LayersTwo01, label: "Asset Library", sub: "Persistent shelf" },
    { key: "history", icon: ClockRewind, label: "History", sub: "Past campaigns" },
  ];
  return (
    <aside
      style={{
        ...glass,
        width: 258,
        flexShrink: 0,
        margin: mobile ? 0 : 16,
        marginRight: 0,
        padding: "30px 16px 24px",
        display: "flex",
        flexDirection: "column",
        borderRadius: mobile ? "0 22px 22px 0" : 22,
        ...(mobile ? { minHeight: "100vh", background: "rgba(255,255,255,0.94)" } : {}),
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 8px" }}>
        <span
          style={{
            width: 30,
            height: 30,
            borderRadius: 9,
            background: T.blue,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontFamily: T.serif,
            fontSize: 19,
          }}
        >
          A
        </span>
        <div>
          <div style={{ fontFamily: T.serif, fontSize: 22, letterSpacing: "-0.3px", lineHeight: 1 }}>
            AdPipeline
          </div>
          <div style={{ fontFamily: T.mono, fontSize: 9.5, color: T.faint, marginTop: 3, letterSpacing: 0.5 }}>
            COLGATE-PALMOLIVE · POC
          </div>
        </div>
      </div>

      <nav style={{ marginTop: 32 }}>
        {FLOW.map((n, i) => {
          const active = view === n.key;
          const done = !solo && i < idx; // "completed step" only means something in the chain
          const sub = solo ? (SOLO_SUBS[n.key] || n.sub) : n.sub;
          return (
            <button
              key={n.key}
              onClick={() => nav(n.key)}
              style={{
                display: "flex",
                gap: 12,
                width: "100%",
                textAlign: "left",
                alignItems: "center",
                padding: "11px 12px",
                marginBottom: 3,
                borderRadius: 12,
                border: "none",
                cursor: "pointer",
                fontFamily: T.sans,
                background: active ? "rgba(255,255,255,0.9)" : "transparent",
                boxShadow: active ? "0 4px 14px rgba(11,29,51,0.08)" : "none",
              }}
            >
              <span
                style={{
                  fontFamily: T.mono,
                  fontSize: 11,
                  width: 25,
                  height: 25,
                  borderRadius: 8,
                  flexShrink: 0,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: active ? T.blue : "transparent",
                  border: active ? "none" : `1.5px solid ${done ? T.faint : T.line}`,
                  color: active ? "#fff" : done ? T.soft : T.faint,
                }}
              >
                {done ? <Check width={13} height={13} /> : n.step}
              </span>
              <span>
                <div style={{ fontSize: 14.5, fontWeight: active ? 700 : 500, color: active ? T.blue : T.ink }}>
                  {n.label}
                </div>
                <div style={{ fontSize: 11.5, color: T.faint, marginTop: 1 }}>{sub}</div>
              </span>
            </button>
          );
        })}
      </nav>

      {/* below the divider: shelves that outlive every campaign */}
      <div style={{ height: 1, background: T.line, margin: "16px 8px" }} />
      {shelf.map((n) => {
        const active = view === n.key;
        return (
          <button
            key={n.key}
            onClick={() => nav(n.key)}
            style={{
              display: "flex",
              gap: 12,
              width: "100%",
              textAlign: "left",
              alignItems: "center",
              padding: "11px 12px",
              marginBottom: 3,
              borderRadius: 12,
              border: "none",
              cursor: "pointer",
              fontFamily: T.sans,
              background: active ? "rgba(255,255,255,0.9)" : "transparent",
              boxShadow: active ? "0 4px 14px rgba(11,29,51,0.08)" : "none",
            }}
          >
            <span
              style={{
                fontSize: 15,
                width: 25,
                height: 25,
                borderRadius: 8,
                flexShrink: 0,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: active ? T.blue : "transparent",
                border: active ? "none" : `1.5px solid ${T.line}`,
                color: active ? "#fff" : T.faint,
              }}
            >
              <n.icon width={14} height={14} />
            </span>
            <span>
              <div style={{ fontSize: 14.5, fontWeight: active ? 700 : 500, color: active ? T.blue : T.ink }}>
                {n.label}
              </div>
              <div style={{ fontSize: 11.5, color: T.faint, marginTop: 1 }}>{n.sub}</div>
            </span>
          </button>
        );
      })}

      <div style={{ marginTop: "auto", background: T.ink, borderRadius: 16, padding: "18px 18px", color: "#fff" }}>
        <div style={{ fontFamily: T.mono, fontSize: 10, opacity: 0.65, letterSpacing: 1 }}>
          {campaign ? `CAMP-${String(campaign.id).padStart(3, "0")}` : "NO CAMPAIGN"} · LIVE COST
        </div>
        <div style={{ fontFamily: T.serif, fontSize: 32, marginTop: 6 }}>
          ${cost.total_usd.toFixed(2)}
        </div>
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>
          {calls} model calls · logged in SQLite
        </div>
      </div>
    </aside>
  );
}

function statusChip(status) {
  const map = {
    research_pending: { l: "RESEARCH PENDING", c: T.amber, bg: T.amberSoft },
    research_rejected: { l: "RESEARCH REJECTED", c: T.red, bg: T.redSoft },
    research_approved: { l: "RESEARCH APPROVED", c: T.green, bg: T.greenSoft },
    plan_pending: { l: "PLAN PENDING", c: T.amber, bg: T.amberSoft },
    plan_rejected: { l: "PLAN REJECTED", c: T.red, bg: T.redSoft },
    plan_approved: { l: "PLAN APPROVED", c: T.green, bg: T.greenSoft },
    published: { l: "PUBLISHED", c: "#fff", bg: T.green },
    solo_research: { l: "SOLO · RESEARCH", c: T.blue, bg: T.blueSoft },
    solo_plan: { l: "SOLO · PLAN", c: T.blue, bg: T.blueSoft },
    solo_creative: { l: "SOLO · CREATIVE", c: T.blue, bg: T.blueSoft },
  };
  const m = map[status] || { l: status?.toUpperCase() || "-", c: T.soft, bg: "rgba(11,29,51,0.05)" };
  return <Pill color={m.c} bg={m.bg}>{m.l}</Pill>;
}

function TopBar({ view, go, campaign, product, mode }) {
  const idx = FLOW.findIndex((f) => f.key === view);
  const sep = mode === "solo" ? "·" : "→"; // no arrows when nothing hands off
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: 32, flexWrap: "wrap", gap: 6 }}>
      {FLOW.map((s, i) => (
        <div key={s.key} style={{ display: "flex", alignItems: "center" }}>
          <button
            onClick={() => go(s.key)}
            style={{
              border: "none",
              background: "none",
              cursor: "pointer",
              fontFamily: T.mono,
              fontSize: 11.5,
              color: i === idx ? T.blue : i < idx ? T.body : T.faint,
              fontWeight: i === idx ? 600 : 400,
              padding: "2px 4px",
            }}
          >
            {s.label}
          </button>
          {i < FLOW.length - 1 && <span style={{ color: T.faint, margin: "0 7px", opacity: 0.5 }}>{sep}</span>}
        </div>
      ))}
      <span style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
        {campaign && statusChip(campaign.status)}
        <span style={{ fontFamily: T.mono, fontSize: 11.5, color: T.soft }}>
          {campaign ? campaign.product : product}
        </span>
      </span>
    </div>
  );
}

function PageTitle({ eyebrow, title, sub, right }) {
  const isMobile = useIsMobile();
  return (
    <header style={{ marginBottom: isMobile ? 22 : 32, display: "flex", alignItems: "flex-end", gap: 30, flexWrap: "wrap" }}>
      <div style={{ flex: 1, minWidth: 240 }}>
        <span
          style={{
            fontFamily: T.mono,
            fontSize: 11.5,
            color: T.blue,
            letterSpacing: 1.5,
            fontWeight: 600,
            textTransform: "uppercase",
          }}
        >
          {eyebrow}
        </span>
        <h1
          style={{
            fontFamily: T.serif,
            fontSize: isMobile ? 34 : 54,
            fontWeight: 400,
            letterSpacing: "-1px",
            margin: "10px 0 0",
            lineHeight: 1.04,
          }}
        >
          {title}
        </h1>
        {sub && (
          <p style={{ fontSize: 16, color: T.soft, marginTop: 12, maxWidth: 660, lineHeight: 1.6, fontWeight: 500 }}>
            {sub}
          </p>
        )}
      </div>
      {right}
    </header>
  );
}

function Card({ children, style }) {
  return <div style={{ ...glass, padding: 24, ...style }}>{children}</div>;
}
function Cite({ src }) {
  return (
    <span
      style={{
        fontFamily: T.mono,
        fontSize: 10.5,
        color: T.blue,
        background: T.blueSoft,
        padding: "3px 9px",
        borderRadius: 7,
      }}
    >
      {src}
    </span>
  );
}
function Label({ children, color }) {
  return (
    <div style={{ fontFamily: T.mono, fontSize: 10.5, color: color || T.faint, letterSpacing: 1, fontWeight: 500 }}>
      {children}
    </div>
  );
}
function Pill({ children, color, bg }) {
  return (
    <span
      style={{ fontFamily: T.mono, fontSize: 11.5, fontWeight: 600, color, background: bg, padding: "4px 10px", borderRadius: 99 }}
    >
      {children}
    </span>
  );
}
function Btn({ children, kind = "primary", small, onClick, disabled }) {
  const s = {
    primary: { background: T.blue, color: "#fff", border: "none", boxShadow: "0 6px 18px rgba(31,117,254,0.28)" },
    approve: { background: T.green, color: "#fff", border: "none", boxShadow: "0 6px 18px rgba(23,138,80,0.25)" },
    ghost: { background: "rgba(255,255,255,0.7)", color: T.ink, border: `1px solid ${T.line}` },
    danger: { background: "rgba(255,255,255,0.6)", color: T.red, border: `1.5px solid rgba(217,54,54,0.5)` },
  }[kind];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...s,
        padding: small ? "10px 18px" : "13px 26px",
        borderRadius: 12,
        fontFamily: T.sans,
        fontWeight: 700,
        fontSize: small ? 13 : 14.5,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  );
}
const inputStyle = {
  width: "100%",
  fontFamily: T.sans,
  fontSize: 14,
  color: T.ink,
  background: "rgba(255,255,255,0.8)",
  border: `1px solid ${T.line}`,
  borderRadius: 12,
  padding: "12px 15px",
  boxSizing: "border-box",
};

function Banner({ tone, children, onCancel }) {
  const map = {
    err: { bg: T.redSoft, fg: T.red },
    load: { bg: T.blueSoft, fg: T.blue },
  }[tone];
  return (
    <div
      style={{
        ...glass,
        background: map.bg,
        color: map.fg,
        padding: "10px 12px 10px 18px",
        borderRadius: 12,
        marginBottom: 10,
        fontSize: 13.5,
        fontWeight: 600,
        fontFamily: T.mono,
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <span style={{ flex: 1, minWidth: 0 }}>{children}</span>
      {onCancel && (
        <button
          onClick={onCancel}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            flexShrink: 0,
            border: `1.5px solid rgba(217,54,54,0.5)`,
            background: "rgba(255,255,255,0.85)",
            color: T.red,
            fontFamily: T.sans,
            fontWeight: 700,
            fontSize: 12.5,
            padding: "6px 13px",
            borderRadius: 9,
            cursor: "pointer",
          }}
        >
          <XClose width={13} height={13} />
          Cancel
        </button>
      )}
    </div>
  );
}

function Empty({ label }) {
  return (
    <Card style={{ textAlign: "center", padding: 48, color: T.soft }}>
      <div style={{ fontFamily: T.serif, fontSize: 24 }}>{label}</div>
    </Card>
  );
}

function Stamp({ label, good }) {
  return (
    <div
      style={{
        transform: "rotate(-6deg)",
        display: "inline-block",
        border: `3px solid ${good ? T.green : T.red}`,
        color: good ? T.green : T.red,
        padding: "4px 18px",
        fontFamily: T.mono,
        fontWeight: 700,
        letterSpacing: 3,
        borderRadius: 8,
        fontSize: 22,
        opacity: 0.9,
        marginBottom: 12,
      }}
    >
      {label}
    </div>
  );
}

/* ---------- reusable stage gate ---------- */
function Gate({ stage, campaign, decide, rerun, loading, approveLabel }) {
  const [fb, setFb] = useState("");
  const status = campaign.status;
  const rejected = status === `${stage}_rejected`;
  const pending = status === `${stage}_pending`;
  if (!pending && !rejected) return null;
  return (
    <Card style={{ marginTop: 16, background: "rgba(255,255,255,0.75)" }}>
      <Label>HUMAN GATE · YOUR DECISION HANDS THIS OFF</Label>
      {rejected ? (
        <div style={{ marginTop: 14 }}>
          <p style={{ fontSize: 13.5, color: T.soft, marginBottom: 14 }}>
            Feedback stored. Re-run the agent to see it adapt; your feedback is injected into its prompt.
          </p>
          <Btn onClick={rerun} disabled={!!loading}>
            {loading ? "Re-running…" : (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                <RefreshCcw01 width={14} height={14} /> Re-run {stage} with feedback
              </span>
            )}
          </Btn>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 14, marginTop: 14, alignItems: "center", flexWrap: "wrap" }}>
            <Btn kind="approve" onClick={() => decide(stage, "approve")} disabled={!!loading}>
              {approveLabel}
            </Btn>
            <Btn
              kind="danger"
              disabled={!!loading}
              onClick={() => {
                if (!fb.trim()) {
                  alert("Reject requires feedback.");
                  return;
                }
                decide(stage, "reject", fb);
              }}
            >
              Reject with feedback
            </Btn>
          </div>
          <textarea
            value={fb}
            onChange={(e) => setFb(e.target.value)}
            placeholder={`Rejection feedback (required to reject). The ${stage} agent re-runs with it.`}
            style={{ ...inputStyle, marginTop: 14, height: 76, resize: "vertical", fontFamily: T.sans }}
          />
        </>
      )}
    </Card>
  );
}

/* ---------- solo run form (product + objective + one run button) ---------- */
/* Gemini-flash objective sharpener: turns "sales are down in apac" into a
   crisp campaign objective before any agent runs. */
function RefineBtn({ product, objective, setObjective }) {
  const [busy, setBusy] = useState(false);
  const go = async () => {
    if (!String(objective || "").trim() || busy) return;
    setBusy(true);
    try {
      const r = await api("/refine", {
        method: "POST",
        body: JSON.stringify({ product, objective }),
      });
      setObjective(r.objective);
    } catch (e) {
      alert(String(e.message || e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      onClick={go}
      disabled={busy}
      title="Refine this brief with Gemini flash"
      style={{
        border: `1px solid ${T.blueBorder}`,
        background: busy ? T.blueSoft : "rgba(255,255,255,0.85)",
        color: T.blue, borderRadius: 11, padding: "0 12px",
        cursor: busy ? "wait" : "pointer", flexShrink: 0,
        display: "inline-flex", alignItems: "center", gap: 6,
        fontFamily: T.mono, fontSize: 11, fontWeight: 700, height: 43,
      }}
    >
      <Stars01 width={14} height={14} /> {busy ? "…" : "AI"}
    </button>
  );
}

function ObjectiveInput({ product, objective, setObjective, label = "OBJECTIVE / BRIEF" }) {
  return (
    <div>
      <Label>{label}</Label>
      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <input
          style={{ ...inputStyle, marginTop: 0, flex: 1 }}
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
          placeholder='Rough notes work - e.g. "sales are down in APAC" - then hit AI'
        />
        <RefineBtn product={product} objective={objective} setObjective={setObjective} />
      </div>
    </div>
  );
}

function SoloRunCard({ product, setProduct, objective, setObjective, loading, onRun, label, hint }) {
  const isMobile = useIsMobile();
  return (
    <Card style={{ marginBottom: 16 }}>
      <Label>SOLO RUN · NO GATES, NO HANDOFF</Label>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 2fr auto", gap: 14, marginTop: 12, alignItems: "end" }}>
        <div>
          <Label>PRODUCT</Label>
          <select style={{ ...inputStyle, marginTop: 6 }} value={product} onChange={(e) => setProduct(e.target.value)}>
            {PRODUCTS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </div>
        <ObjectiveInput {...{ product, objective, setObjective }} />
        <Btn onClick={onRun} disabled={!!loading}>
          {loading ? "Running…" : label}
        </Btn>
      </div>
      {hint && <p style={{ fontSize: 12.5, color: T.faint, marginTop: 10, marginBottom: 0 }}>{hint}</p>}
    </Card>
  );
}

/* ================= 01 OVERVIEW ================= */
function Overview({ product, setProduct, objective, setObjective, campaign, startCampaign, loading, mode, soloResearch, soloPlan, setView }) {
  const [prompts, setPrompts] = useState(null);
  const [showPrompts, setShowPrompts] = useState(false);
  const solo = mode === "solo";
  const isMobile = useIsMobile();
  const agents = [
    { n: "AGT-1", name: "Research & Monitor", model: "gemini-3.5-flash", does: "Watches campaigns and diagnoses what's going wrong, what lags, what works. Math runs in code, never the model." },
    { n: "AGT-2", name: "Strategy Planner", model: "gemini-3.5-flash + 2.5 search", does: "Turns approved research into a plan: campaign angle, marketing changes grounded in metrics, next steps." },
    { n: "AGT-3", name: "Creative", model: "gemini-3.5 + gpt-image-2", does: "Executes the approved plan: images (reference-aware), copy, placement, expected metrics. Then you publish." },
  ];
  const soloActions = [
    { run: soloResearch, label: "Run research" },
    { run: soloPlan, label: "Build a plan" },
    { run: () => setView("creative"), label: "Generate an ad →" },
  ];
  const togglePrompts = async () => {
    if (!prompts) {
      try { setPrompts(await api("/prompts")); } catch {}
    }
    setShowPrompts((s) => !s);
  };
  return (
    <div>
      <PageTitle
        eyebrow={solo ? "Step 01 · Solo agents" : "Step 01 · The handoff chain"}
        title={
          solo
            ? <>Three agents. <em style={{ color: T.blue }}>Use any one,</em> on demand.</>
            : <>Three agents. <em style={{ color: T.blue }}>Two gates.</em> One publish.</>
        }
        sub={
          solo
            ? "Standalone mode: no gates, no handoffs. Run Agent 1 for a grounded diagnosis, Agent 2 for a plan straight from the knowledge base, or jump directly to Agent 3 and just generate an ad. Flip the toggle above to go back to the full chained pipeline."
            : "Agent 1 researches what's going wrong. You approve, and the research hands off to Agent 2, which plans the marketing changes. You approve again, and the plan hands off to Agent 3, which generates the creative and gives you an Approve & Publish button with expected metrics."
        }
      />

      <Card style={{ marginBottom: 16 }}>
        <Label>{solo ? "SOLO RUN · PICK AN AGENT BELOW" : "NEW CAMPAIGN"}</Label>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : solo ? "1fr 2fr" : "1fr 2fr auto", gap: 14, marginTop: 12, alignItems: "end" }}>
          <div>
            <Label>PRODUCT</Label>
            <select style={{ ...inputStyle, marginTop: 6 }} value={product} onChange={(e) => setProduct(e.target.value)}>
              {PRODUCTS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
          <ObjectiveInput
            {...{ product, objective, setObjective }}
            label={solo ? "OBJECTIVE / BRIEF" : "OBJECTIVE"}
          />
          {!solo && (
            <Btn onClick={startCampaign} disabled={!!loading}>
              {loading ? "Running…" : "Start campaign →"}
            </Btn>
          )}
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 16 }}>
        {agents.map((a, i) => (
          <Card key={a.n}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Label>{a.n}</Label>
              <span style={{ fontFamily: T.mono, fontSize: 10.5, color: T.soft }}>{a.model}</span>
            </div>
            <h3 style={{ fontFamily: T.serif, fontSize: 25, fontWeight: 400, margin: "12px 0 0" }}>{a.name}</h3>
            <p style={{ fontSize: 13, color: T.soft, lineHeight: 1.6, marginTop: 8 }}>{a.does}</p>
            {solo ? (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.line}` }}>
                <Btn small onClick={soloActions[i].run} disabled={!!loading}>
                  {loading ? "Running…" : soloActions[i].label}
                </Btn>
              </div>
            ) : (
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${T.line}`, fontFamily: T.mono, fontSize: 11, color: T.blue, fontWeight: 600 }}>
                {i < 2 ? `→ human gate → AGT-${i + 2}` : "→ Approve & Publish"}
              </div>
            )}
          </Card>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.5fr 1fr", gap: 16, marginTop: 16 }}>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Label>AGENT SYSTEM PROMPTS</Label>
            <Btn kind="ghost" small onClick={togglePrompts}>{showPrompts ? "Hide" : "Inspect"}</Btn>
          </div>
          {showPrompts && prompts ? (
            <div style={{ marginTop: 12, maxHeight: 380, overflowY: "auto" }}>
              {Object.entries(prompts).map(([k, v]) => (
                <div key={k} style={{ marginBottom: 14 }}>
                  <Label color={T.blue}>{k.toUpperCase()}</Label>
                  <pre style={{ fontFamily: T.mono, fontSize: 10.5, color: T.body, whiteSpace: "pre-wrap", lineHeight: 1.55, background: "rgba(11,29,51,0.04)", padding: "10px 12px", borderRadius: 10, marginTop: 6 }}>
                    {v}
                  </pre>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 14, color: T.body, lineHeight: 1.65, marginTop: 10, fontWeight: 500 }}>
              Full transparency: inspect the exact system prompt each agent runs with. In the Creative
              Studio you can also tweak every image prompt: add art direction before generating, or
              edit any asset's prompt and regenerate just that image.
            </p>
          )}
        </Card>
        <Card>
          <Label>KNOWLEDGE BASE</Label>
          <div style={{ fontFamily: T.serif, fontSize: 34, marginTop: 8 }}>
            15 <span style={{ fontSize: 18, color: T.soft }}>docs</span>
          </div>
          <p style={{ fontSize: 13, color: T.soft, lineHeight: 1.65, marginTop: 8 }}>
            Real public data (FY2024 Hill's financials, 2025 Meta/Amazon ad benchmarks, India
            quick-commerce, therapeutic pet-diet market, EltaMD/Filorga performance) layered on
            internal demo data; each doc states its provenance.
            Agents answer only from here. <strong style={{ color: T.ink }}>no citation, no claim.</strong>
          </p>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 12 }}>
            <Cite src="hills_regional_sales.md" />
            <Cite src="industry_ad_benchmarks.md" />
            <Cite src="skin_health_brand_performance.md" />
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ================= 02 RESEARCH (Agent 1) ================= */
function Research({ campaign, decide, rerunResearch, loading, mode, soloResearch, product, setProduct, objective, setObjective }) {
  if (mode === "solo") {
    return (
      <div>
        <PageTitle
          eyebrow="Solo · Agent 1 · Research & Monitor"
          title="What's going wrong"
          sub="Standalone run with no gates and no handoff. Same deterministic campaign math and grounded, cited diagnosis; use it whenever you just need a portfolio read."
        />
        <SoloRunCard
          {...{ product, setProduct, objective, setObjective, loading }}
          onRun={soloResearch}
          label="Run Agent 1 →"
        />
        {campaign?.research
          ? <ResearchBody r={campaign.research} />
          : <Empty label="Run Agent 1 above to generate a standalone research report." />}
      </div>
    );
  }
  if (!campaign?.research) return <Empty label="Start a campaign first (step 01)." />;
  const approved = ["research_approved", "plan_pending", "plan_rejected", "plan_approved", "published"].includes(campaign.status);
  return (
    <div>
      <PageTitle
        eyebrow="Step 02 · Agent 1 · Research & Monitor"
        title="What's going wrong"
        sub="Deterministic campaign math + grounded diagnosis. Approve to hand this research to Agent 2, or reject with feedback and Agent 1 re-runs with it."
        right={!approved && <Btn kind="ghost" small onClick={rerunResearch} disabled={!!loading}>Re-run</Btn>}
      />

      {approved && <Stamp label="APPROVED → AGT-2" good />}
      {campaign.used_feedback && (
        <Banner tone="load">This run consumed prior feedback: "{campaign.used_feedback}"</Banner>
      )}

      <ResearchBody r={campaign.research} />

      <Gate
        stage="research"
        campaign={campaign}
        decide={decide}
        rerun={rerunResearch}
        loading={loading}
        approveLabel="Approve and hand research to Agent 2 →"
      />
    </div>
  );
}

/* the report itself - shared by the chained view and the solo view */
function ResearchBody({ r }) {
  const isMobile = useIsMobile();
  const sev = { high: T.red, medium: T.amber, low: T.soft };
  const sevBg = { high: T.redSoft, medium: T.amberSoft, low: "rgba(11,29,51,0.05)" };
  return (
    <div>
      <Card>
        <Label>SUMMARY</Label>
        <p style={{ fontFamily: T.serif, fontSize: 24, lineHeight: 1.4, marginTop: 10 }}>{r.summary}</p>
      </Card>

      <div style={{ marginTop: 14 }}>
        <Label color={T.red}>WHAT'S WRONG</Label>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
        {r.whats_wrong.map((a, i) => (
          <Card key={i} style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ minWidth: 90 }}>
              <Pill color={sev[a.severity] || T.soft} bg={sevBg[a.severity] || "rgba(11,29,51,0.05)"}>
                {a.severity.toUpperCase()}
              </Pill>
            </div>
            <div style={{ flex: "1 1 320px" }}>
              <div style={{ fontFamily: T.serif, fontSize: 20, lineHeight: 1.25 }}>{a.issue}</div>
              <p style={{ fontSize: 13.5, color: T.body, marginTop: 6, fontWeight: 500, lineHeight: 1.55 }}>{a.evidence}</p>
              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                {a.sources.map((s) => <Cite key={s} src={s} />)}
              </div>
            </div>
            <div style={{ flex: "1 1 220px" }}>
              <Label>ACTION HINT</Label>
              <p style={{ fontSize: 13.5, color: T.ink, marginTop: 5, fontWeight: 600, lineHeight: 1.5 }}>{a.action_hint}</p>
            </div>
          </Card>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14, marginTop: 14 }}>
        <Card>
          <Label color={T.amber}>WHERE IT LAGS</Label>
          <div style={{ marginTop: 8 }}>
            {r.lagging.map((l, i) => (
              <div key={i} style={{ padding: "11px 0", borderBottom: `1px solid ${T.line}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{l.where}</span>
                  <span style={{ display: "flex", gap: 5 }}>{l.sources.map((x) => <Cite key={x} src={x} />)}</span>
                </div>
                <p style={{ fontSize: 12.5, color: T.soft, marginTop: 5, lineHeight: 1.5 }}>{l.reason}</p>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <Label color={T.green}>WHAT'S WORKING</Label>
          <div style={{ marginTop: 8 }}>
            {r.whats_working.map((w, i) => (
              <div key={i} style={{ padding: "11px 0", borderBottom: `1px solid ${T.line}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{w.item}</span>
                  <span style={{ display: "flex", gap: 5 }}>{w.sources.map((x) => <Cite key={x} src={x} />)}</span>
                </div>
                <p style={{ fontSize: 12.5, color: T.soft, marginTop: 5, lineHeight: 1.5 }}>{w.evidence}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card style={{ marginTop: 14, display: "flex", gap: 16, alignItems: "center", background: "rgba(255,255,255,0.75)", flexWrap: "wrap" }}>
        <Pill color={T.green} bg={T.greenSoft}>SCALE RECOMMENDATION</Pill>
        <p style={{ fontFamily: T.serif, fontSize: 22, margin: 0, flex: 1, minWidth: 300, lineHeight: 1.4 }}>
          {r.scale_recommendation}
        </p>
      </Card>
    </div>
  );
}

/* ================= 03 PLAN (Agent 2) ================= */
function Plan({ campaign, decide, runPlan, loading, mode, soloPlan, product, setProduct, objective, setObjective }) {
  if (mode === "solo") {
    const hasResearch = !!campaign?.research;
    return (
      <div>
        <PageTitle
          eyebrow="Solo · Agent 2 · Strategy Planner"
          title="The plan"
          sub={hasResearch
            ? "Standalone run. This session's solo research is picked up as optional context, but no approval gate stands in the way."
            : "Standalone run, no research report required. Agent 2 plans straight from the knowledge base (campaign history, channel metrics, brand guidelines)."}
        />
        <SoloRunCard
          {...{ product, setProduct, objective, setObjective, loading }}
          onRun={soloPlan}
          label="Run Agent 2 →"
          hint={hasResearch ? "Reusing this session's solo research as context. Edit the product/objective to plan from scratch instead." : undefined}
        />
        {campaign?.plan
          ? <PlanBody p={campaign.plan} />
          : <Empty label="Run Agent 2 above to generate a standalone plan." />}
      </div>
    );
  }
  if (!campaign?.research) return <Empty label="Start a campaign first (step 01)." />;
  if (!campaign?.plan) {
    const ready = campaign.status === "research_approved";
    return (
      <div>
        <PageTitle
          eyebrow="Step 03 · Agent 2 · Strategy Planner"
          title="Awaiting the handoff"
          sub={ready ? "Research is approved. Run Agent 2 to build the plan." : "Approve the research at step 02 first; it hands off to Agent 2 automatically."}
        />
        {ready ? (
          <Btn onClick={runPlan} disabled={!!loading}>{loading ? "Planning…" : "Run Agent 2 and build the plan"}</Btn>
        ) : (
          <Empty label="Approve Agent 1's research first (step 02)." />
        )}
      </div>
    );
  }
  const approved = ["plan_approved", "published"].includes(campaign.status);
  return (
    <div>
      <PageTitle
        eyebrow="Step 03 · Agent 2 · Strategy Planner"
        title="The plan"
        sub="Built on the approved research. Approve to hand this plan to Agent 3 as its creative brief, or reject with feedback and Agent 2 re-plans."
      />

      {approved && <Stamp label="APPROVED → AGT-3" good />}
      {campaign.used_feedback && (
        <Banner tone="load">This plan consumed prior feedback: "{campaign.used_feedback}"</Banner>
      )}

      <PlanBody p={campaign.plan} />

      <Gate
        stage="plan"
        campaign={campaign}
        decide={decide}
        rerun={runPlan}
        loading={loading}
        approveLabel="Approve and hand plan to Agent 3 →"
      />
    </div>
  );
}

/* the plan itself - shared by the chained view and the solo view */
function PlanBody({ p }) {
  return (
    <div>
      <Card style={{ padding: 32 }}>
        <Label>CAMPAIGN ANGLE · AGENT 3'S CREATIVE DIRECTION</Label>
        <h2 style={{ fontFamily: T.serif, fontSize: 36, fontWeight: 400, fontStyle: "italic", margin: "12px 0 0", lineHeight: 1.15 }}>
          "{p.campaign_angle}"
        </h2>
        <p style={{ fontSize: 14.5, color: T.body, lineHeight: 1.65, marginTop: 14, fontWeight: 500 }}>{p.plan_summary}</p>
        <div style={{ display: "flex", gap: 20, marginTop: 16, flexWrap: "wrap", alignItems: "center" }}>
          <div>
            <Label>TARGET SEGMENT</Label>
            <div style={{ fontSize: 14, marginTop: 4, fontWeight: 600 }}>{p.target_segment}</div>
          </div>
          <div>
            <Label>CHANNELS</Label>
            <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
              {p.recommended_channels.map((c) => (
                <Pill key={c} color={T.blue} bg={T.blueSoft}>{c}</Pill>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card style={{ marginTop: 14, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "15px 22px", borderBottom: `1px solid ${T.line}` }}>
          <Label>MARKETING CHANGES · GROUNDED IN THE METRICS</Label>
        </div>
        {p.marketing_changes.map((m, i) => (
          <div key={i} style={{ display: "flex", gap: 22, padding: "14px 22px", borderBottom: `1px solid ${T.line}`, alignItems: "baseline", flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, flex: "1 1 260px", fontSize: 14, lineHeight: 1.45 }}>{m.change}</span>
            <span style={{ fontFamily: T.mono, fontSize: 12, color: T.blue, flex: "0 1 200px" }}>{m.basis_metric}</span>
            <span style={{ fontSize: 12.5, color: T.soft, flex: "1 1 220px", fontWeight: 500 }}>{m.expected_impact}</span>
            <span style={{ display: "flex", gap: 5 }}>{m.sources.map((s) => <Cite key={s} src={s} />)}</span>
          </div>
        ))}
      </Card>

      <Card style={{ marginTop: 14 }}>
        <Label>NEXT STEPS</Label>
        <ol style={{ margin: "10px 0 0", paddingLeft: 22 }}>
          {p.next_steps.map((s, i) => (
            <li key={i} style={{ fontSize: 14, color: T.body, lineHeight: 1.7, marginBottom: 7, fontWeight: 500 }}>{s}</li>
          ))}
        </ol>
      </Card>
    </div>
  );
}

/* ================= 04 CREATIVE STUDIO (Agent 3) ================= */
function CreativeStudio({ product, setProduct, objective, setObjective, campaign, creative, placement, published, genCreative, renderImages, plan, doPublish, loading, rendering, placing, publishing, refreshCost, mode }) {
  const [skill, setSkill] = useState("/amazon");
  const [url, setUrl] = useState(DEFAULT_URL[campaign?.product || product] || "");
  const [tweak, setTweak] = useState("");
  const [ref, setRef] = useState(null); // {reference_id, url}
  const [uploading, setUploading] = useState(false);
  const solo = mode === "solo";
  const isMobile = useIsMobile();

  // chain mode is gated on an approved plan; solo mode is always open
  if (!solo) {
    if (!campaign) return <Empty label="Start a campaign first (step 01)." />;
    if (!["plan_approved", "published"].includes(campaign.status) && !creative)
      return <Empty label="Approve Agent 2's plan first (step 03)." />;
  }

  const onRef = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      setRef(await uploadFile("/reference", f));
    } catch (err) {
      alert(String(err.message || err));
    } finally {
      setUploading(false);
    }
  };

  const p = creative?.profile;
  const rendered = !!(creative?.rendered || (creative?.assets || []).length);
  return (
    <div>
      <PageTitle
        eyebrow={solo ? "Solo · Agent 3 · Creative" : "Step 04 · Agent 3 · Creative"}
        title="Creative studio"
        sub={solo
          ? "Standalone run, no approved plan required: your objective is the brief. Pick a skill, point at a product URL, and just generate the ad. Reference images and art direction still work."
          : "The approved plan is the brief. Optionally upload a reference image (faithful product renders) and add art direction. Every image prompt stays editable after generation."}
      />

      {published && <Stamp label="PUBLISHED" good />}

      <Card>
        <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
          {solo ? (
            <>
              <Pill color={T.blue} bg={T.blueSoft}>SOLO MODE · NO PLAN REQUIRED</Pill>
              {campaign?.plan ? (
                <span style={{ fontFamily: T.serif, fontSize: 15, fontStyle: "italic", color: T.body }}>
                  "{campaign.plan.campaign_angle}" · from this session's solo plan
                </span>
              ) : (
                <span style={{ fontSize: 13, color: T.soft, fontWeight: 500 }}>
                  Brief: {objective}
                </span>
              )}
            </>
          ) : (
            <>
              <Pill color={T.green} bg={T.greenSoft}>PLAN APPROVED</Pill>
              {campaign.plan && (
                <span style={{ fontFamily: T.serif, fontSize: 15, fontStyle: "italic", color: T.body }}>
                  "{campaign.plan.campaign_angle}"
                </span>
              )}
            </>
          )}
        </div>
        {solo && (
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 2fr", gap: 12, marginTop: 14 }}>
            <div>
              <Label>PRODUCT</Label>
              <select
                style={{ ...inputStyle, marginTop: 6 }}
                value={product}
                onChange={(e) => {
                  setProduct(e.target.value);
                  setUrl(DEFAULT_URL[e.target.value] || "");
                }}
              >
                {[...PRODUCTS, OTHER].map((pr) => (
                  <option key={pr}>{pr}</option>
                ))}
              </select>
              {product === OTHER && (
                <p style={{ fontSize: 11.5, color: T.blue, fontWeight: 600, margin: "6px 0 0" }}>
                  Paste ANY product URL below - the scraper extracts the product and
                  designs from what the page actually says.
                </p>
              )}
            </div>
            <ObjectiveInput
              {...{ product, objective, setObjective }}
              label="OBJECTIVE / BRIEF (USED AS THE CREATIVE BRIEF)"
            />
          </div>
        )}
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 14, flexWrap: "wrap" }}>
          <span style={{ fontFamily: T.mono, fontSize: 14, color: T.blue, fontWeight: 600 }}>{skill}</span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={product === OTHER
              ? "Paste ANY product URL - it will be scraped and designed from"
              : "Product URL (or manual:<pasted text>)"}
            style={{ flex: "1 1 300px", fontFamily: T.mono, fontSize: 12.5, color: T.soft, background: "rgba(255,255,255,0.8)", border: `1px solid ${T.line}`, borderRadius: 11, padding: "11px 15px" }}
          />
          <Btn onClick={() => genCreative(url, skill, ref?.reference_id, tweak)} disabled={!!loading}>
            {loading ? "Drafting…" : "Draft prompts & copy"}
          </Btn>
          <span style={{ fontSize: 11.5, color: T.faint, fontWeight: 500, flexBasis: "100%" }}>
            Step 1 drafts image prompts and copy on the free tier. The paid image model
            only runs after you approve the prompts below.
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 220px", gap: 12, marginTop: 12 }}>
          <div>
            <Label>ART DIRECTION · OPTIONAL PROMPT TWEAK (APPENDED TO EVERY IMAGE PROMPT)</Label>
            <input
              value={tweak}
              onChange={(e) => setTweak(e.target.value)}
              placeholder='e.g. "golden-hour light, older golden retriever, warm kitchen"'
              style={{ ...inputStyle, marginTop: 6 }}
            />
          </div>
          <div>
            <Label>REFERENCE IMAGE · OPTIONAL</Label>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
              {ref ? (
                <>
                  <img src={ref.url} alt="reference" style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover", border: `1px solid ${T.line}` }} />
                  <button onClick={() => setRef(null)} style={{ border: "none", background: "none", color: T.red, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                    remove
                  </button>
                </>
              ) : (
                <label style={{ ...inputStyle, textAlign: "center", cursor: "pointer", color: T.soft, fontWeight: 600, fontSize: 13 }}>
                  {uploading ? "Uploading…" : (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
                      <Upload01 width={14} height={14} /> Upload product photo
                    </span>
                  )}
                  <input type="file" accept="image/png,image/jpeg" onChange={onRef} style={{ display: "none" }} />
                </label>
              )}
            </div>
          </div>
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 12, marginTop: 14 }}>
        {SKILLS.map((s) => {
          const active = skill === s.cmd;
          return (
            <div
              key={s.cmd}
              onClick={() => setSkill(s.cmd)}
              style={{
                ...glass,
                borderRadius: 14,
                padding: "15px 17px",
                cursor: "pointer",
                border: active ? `1.5px solid ${T.blueBorder}` : glass.border,
                background: active ? "rgba(31,117,254,0.08)" : glass.background,
              }}
            >
              <div style={{ fontFamily: T.mono, fontSize: 13.5, fontWeight: 600, color: active ? T.blue : T.ink }}>
                {s.cmd}
              </div>
              <div style={{ fontSize: 12, color: T.soft, marginTop: 6, lineHeight: 1.5, fontWeight: 500 }}>{s.d}</div>
            </div>
          );
        })}
      </div>

      {creative && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 2.1fr", gap: 14, marginTop: 14 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Card>
                <Label>URL DIAGNOSIS</Label>
                <h3 style={{ fontFamily: T.serif, fontSize: 22, fontWeight: 400, marginTop: 10, lineHeight: 1.25 }}>{p.name}</h3>
                {[
                  ["Category", p.category],
                  ["Price tier", p.price_tier],
                  ["Key claims", p.key_claims.join(" · ")],
                  ["Pack", p.pack_description],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: `1px solid ${T.line}`, gap: 8 }}>
                    <span style={{ fontFamily: T.mono, fontSize: 10.5, color: T.faint, flexShrink: 0 }}>{k.toUpperCase()}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 600, textAlign: "right" }}>{v}</span>
                  </div>
                ))}
                <div style={{ display: "flex", gap: 6, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
                  {p.brand_colors.map((c) => (
                    <span key={c} title={c} style={{ width: 22, height: 22, borderRadius: 6, background: c, border: `1px solid ${T.line}` }} />
                  ))}
                  {creative.reference_used && <Pill color={T.blue} bg={T.blueSoft}>REFERENCE-FAITHFUL</Pill>}
                </div>
                {(p.source_images || []).length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <Label>PRODUCT IMAGES FETCHED FROM THE URL</Label>
                    <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                      {p.source_images.slice(0, 4).map((u) => (
                        <a key={u} href={u} target="_blank" rel="noreferrer">
                          <img
                            src={u}
                            alt="scraped from product page"
                            style={{ width: 56, height: 56, borderRadius: 8, objectFit: "cover", border: `1px solid ${T.line}`, background: "#fff" }}
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
              <Card>
                <Pill color={T.red} bg={T.redSoft}>GUARDRAILS ACTIVE</Pill>
                <p style={{ fontSize: 13, lineHeight: 1.65, marginTop: 10, fontWeight: 600 }}>
                  {guardrailsFor(p?.name || campaign?.product || product).text}
                </p>
                <div style={{ marginTop: 8 }}>
                  <Cite src={guardrailsFor(p?.name || campaign?.product || product).cite} />
                </div>
              </Card>
            </div>

            <div>
              {rendered ? (
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
                  {creative.assets.map((a) => (
                    <AssetTile key={a.id} a={a} onCost={refreshCost} />
                  ))}
                </div>
              ) : (
                <Card style={{ background: T.amberSoft }}>
                  <Pill color={T.amber} bg="rgba(255,255,255,0.7)">DRAFT STAGE · NO IMAGES RENDERED YET</Pill>
                  <p style={{ fontSize: 13.5, color: T.body, lineHeight: 1.6, marginTop: 10, fontWeight: 500 }}>
                    Agent 3 wrote the image prompts below with Gemini (free tier) and is
                    waiting for your approval. Review or edit each prompt, then approve to
                    call the paid image model. Nothing has been spent on images yet.
                  </p>
                </Card>
              )}
              <Card style={{ marginTop: 12 }}>
                <Label>COPY BLOCKS</Label>
                <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginTop: 10 }}>
                  {Object.entries(creative.copy_blocks).map(([k, v]) => (
                    <div key={k} style={{ flex: "1 1 200px" }}>
                      <Label>{k.replace(/_/g, " ").toUpperCase()}</Label>
                      <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 6, lineHeight: 1.45 }}>
                        {Array.isArray(v) ? v.join(" · ") : String(v)}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>

          {!rendered && (
            <PromptApproval creative={creative} onRender={renderImages} rendering={rendering} />
          )}

          {rendered && (
          <>
          <Card style={{ marginTop: 14, padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "15px 22px", borderBottom: `1px solid ${T.line}`, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <Label>PLACEMENT PLAN</Label>
              {placement ? (
                <Label color={T.green}>PROJECTIONS FEED AGENT 1 NEXT CYCLE · LOOP CLOSED</Label>
              ) : (
                <Btn small onClick={plan} disabled={!!placing}>
                  {placing ? "Planning…" : "Run placement + expected metrics"}
                </Btn>
              )}
            </div>
            {placement ? (
              placement.placements.map((pl, i) => (
                <div key={i} style={{ display: "flex", gap: 22, padding: "14px 22px", borderBottom: `1px solid ${T.line}`, fontSize: 14, alignItems: "baseline", flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 700, minWidth: 150 }}>{pl.asset}</span>
                  <span style={{ color: T.body, minWidth: 180, fontWeight: 500 }}>{pl.platform} · {pl.format}</span>
                  <span style={{ fontFamily: T.serif, fontSize: 21, color: T.blue, minWidth: 56 }}>{pl.budget_pct}%</span>
                  <span style={{ marginLeft: "auto", fontSize: 12.5, color: T.soft, fontWeight: 500, textAlign: "right", flex: "1 1 220px" }}>
                    {pl.projected_metric} · {pl.rationale}
                  </span>
                </div>
              ))
            ) : (
              <div style={{ padding: "22px", fontSize: 13.5, color: T.soft }}>
                Run the placement pass to map each asset → platform → budget %, plus expected metrics with probabilities.
              </div>
            )}
          </Card>

          {placement?.expected_metrics?.length > 0 && (
            <Card style={{ marginTop: 14 }}>
              <Label>WHAT TO EXPECT · AGENT 3'S CALIBRATED PROBABILITIES (FIRST 4 WEEKS)</Label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14, marginTop: 14 }}>
                {placement.expected_metrics.map((m, i) => {
                  const pct = Math.round((m.probability || 0) * 100);
                  const c = pct >= 70 ? T.green : pct >= 45 ? T.amber : T.red;
                  return (
                    <div key={i} style={{ padding: "14px 16px", borderRadius: 14, background: "rgba(255,255,255,0.7)", border: `1px solid ${T.line}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <span style={{ fontFamily: T.mono, fontSize: 11.5, fontWeight: 700, color: T.soft }}>{m.metric}</span>
                        <span style={{ fontFamily: T.serif, fontSize: 22, color: c }}>{pct}%</span>
                      </div>
                      <div style={{ fontFamily: T.serif, fontSize: 19, marginTop: 4 }}>{m.expected}</div>
                      <div style={{ height: 6, background: "rgba(11,29,51,0.08)", borderRadius: 99, marginTop: 10 }}>
                        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 99, background: c }} />
                      </div>
                      <p style={{ fontSize: 11.5, color: T.soft, marginTop: 8, lineHeight: 1.5 }}>{m.rationale}</p>
                      <div style={{ display: "flex", gap: 5, marginTop: 6, flexWrap: "wrap" }}>
                        {(m.sources || []).map((s) => <Cite key={s} src={s} />)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {creative.skill_used === "/bundle" && <VideoPanel creative={creative} />}

          <Card style={{ marginTop: 14, display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap", background: published ? T.greenSoft : "rgba(255,255,255,0.75)" }}>
            {published ? (
              <>
                <Pill color="#fff" bg={T.green}>PUBLISHED</Pill>
                <div style={{ flex: 1, minWidth: 280 }}>
                  <div style={{ fontFamily: T.serif, fontSize: 20 }}>
                    Live{published.channels?.length ? ` on ${published.channels.join(", ")}` : ""}.
                  </div>
                  <p style={{ fontSize: 12.5, color: T.soft, marginTop: 4 }}>
                    {published.note || "Recorded in DB; the ad-platform API call goes here in production."} Results feed Agent 1 next cycle.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div style={{ flex: 1, minWidth: 280 }}>
                  <Label>FINAL GATE</Label>
                  <div style={{ fontFamily: T.serif, fontSize: 22, marginTop: 6 }}>Ship it?</div>
                  <p style={{ fontSize: 12.5, color: T.soft, marginTop: 4 }}>
                    {placement ? "Placements and expected metrics are on the table." : "Tip: run the placement pass first so you publish with expectations set."}
                  </p>
                </div>
                <Btn kind="approve" onClick={doPublish} disabled={!!publishing}>
                  {publishing ? "Publishing…" : "Approve & publish →"}
                </Btn>
              </>
            )}
          </Card>
          </>
          )}
        </>
      )}
    </div>
  );
}

/* the pre-spend human gate: drafted image prompts, editable, approve to render */
function PromptApproval({ creative, onRender, rendering }) {
  const [drafts, setDrafts] = useState(
    (creative.prompts || []).map((d) => ({ n: 1, ...d })));
  const drafting = !!creative.drafting && !creative.creative_id;
  // resync when a new creative lands AND as prompts stream in during drafting
  useEffect(() => {
    setDrafts((prev) => (creative.prompts || []).map((d, i) => ({
      n: 1, ...d, ...(prev[i] && prev[i].kind === d.kind
        ? { prompt: prev[i].prompt === d.prompt ? d.prompt : prev[i].prompt, n: prev[i].n }
        : {}),
    })));
  }, [creative.creative_id, (creative.prompts || []).length]);
  const totalImages = drafts.reduce((a, d) => a + (d.n || 1), 0);
  const total = drafts.reduce((a, d) => a + (d.est_cost_usd || 0) * (d.n || 1), 0);
  const setPrompt = (i, v) =>
    setDrafts((ds) => ds.map((d, j) => (j === i ? { ...d, prompt: v } : d)));
  const setN = (i, n) =>
    setDrafts((ds) => ds.map((d, j) => (j === i ? { ...d, n } : d)));

  if (!drafts.length && !drafting)
    return (
      <Card style={{ marginTop: 14 }}>
        <Label>IMAGE PROMPTS</Label>
        <p style={{ fontSize: 13.5, color: T.soft, marginTop: 8 }}>
          No drafted prompts on this creative. Run "Draft prompts & copy" first.
        </p>
      </Card>
    );

  return (
    <Card style={{ marginTop: 14, background: "rgba(255,255,255,0.78)" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <Label>HUMAN GATE · IMAGE PROMPTS AWAITING YOUR APPROVAL</Label>
        <Pill color={T.green} bg={T.greenSoft}>$0.00 SPENT SO FAR</Pill>
        {drafting && (
          <Pill color={T.amber} bg={T.amberSoft}>DRAFTING · PROMPTS ARRIVING LIVE</Pill>
        )}
      </div>
      <p style={{ fontSize: 13, color: T.soft, lineHeight: 1.6, margin: "10px 0 0", fontWeight: 500 }}>
        Each prompt is compiled by its asset-specific builder (product shoot,
        infographic, 4:5 scroll-stopper…) from the brief and brand guidelines.
        Edit any of them, pick how many variations (1-4) to request per prompt,
        then approve: only that click calls the paid image model. Identical
        single-image prompts are served from cache at $0.00.
      </p>
      {drafts.map((d, i) => (
        <div key={i} style={{ marginTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Label color={T.blue}>
              {i + 1}. {String(d.kind || "").replace(/_/g, " ").toUpperCase()} · {d.aspect}
            </Label>
            <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ fontFamily: T.mono, fontSize: 10.5, color: T.faint }}>IMAGES</span>
              <span style={{ display: "inline-flex", borderRadius: 8, overflow: "hidden", border: `1px solid ${T.line}` }}>
                {[1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    onClick={() => setN(i, n)}
                    style={{
                      border: "none", cursor: "pointer", padding: "4px 10px",
                      fontFamily: T.mono, fontSize: 11.5, fontWeight: 700,
                      background: (d.n || 1) === n ? T.blue : "rgba(255,255,255,0.75)",
                      color: (d.n || 1) === n ? "#fff" : T.soft,
                    }}
                  >
                    {n}
                  </button>
                ))}
              </span>
              <span style={{ fontFamily: T.mono, fontSize: 11, color: T.faint }}>
                est ${(Number(d.est_cost_usd || 0) * (d.n || 1)).toFixed(3)}
              </span>
            </span>
          </div>
          <textarea
            value={d.prompt}
            onChange={(e) => setPrompt(i, e.target.value)}
            style={{ ...inputStyle, fontFamily: T.mono, fontSize: 11.5, height: 116, resize: "vertical", lineHeight: 1.55, marginTop: 6 }}
          />
        </div>
      ))}
      {drafting && (
        <div style={{ marginTop: 14, fontFamily: T.mono, fontSize: 12, color: T.blue, fontWeight: 600 }}>
          Compiling the next prompt…
        </div>
      )}
      <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 18, flexWrap: "wrap" }}>
        <Btn kind="approve" onClick={() => onRender(drafts)} disabled={!!rendering || drafting}>
          {rendering ? "Rendering…" : `Approve prompts & render ${totalImages} image${totalImages === 1 ? "" : "s"} (~$${total.toFixed(2)})`}
        </Btn>
        <span style={{ fontSize: 12, color: T.faint, fontWeight: 500 }}>
          This is the only step that spends image budget. n is passed straight to
          the image API as the requested variation count.
        </span>
      </div>
    </Card>
  );
}

/* asset tile with EDITABLE PROMPT + regenerate */
function AssetTile({ a: initial, onCost }) {
  const [a, setA] = useState(initial);
  const [mode, setMode] = useState("closed"); // closed | view | edit
  const [draft, setDraft] = useState(initial.prompt);
  const [busy, setBusy] = useState(false);

  const regenerate = async () => {
    setBusy(true);
    try {
      const res = await api(`/assets/${a.id}/variant`, {
        method: "POST",
        body: JSON.stringify({ prompt: draft }),
      });
      setA({ ...a, id: res.id, url: `${res.url}?t=${res.id}`, prompt: res.prompt, from_cache: res.from_cache, cache_hit: res.cache_hit, cost_usd: res.cost_usd });
      setMode("view");
      onCost?.();
    } catch (e) {
      alert(String(e.message || e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ ...glass, borderRadius: 14, overflow: "hidden", padding: 0 }}>
      <div style={{ position: "relative", background: "#0B1D33" }}>
        <img
          src={a.url}
          alt={a.kind}
          onClick={() => setMode(mode === "closed" ? "view" : "closed")}
          style={{ width: "100%", display: "block", aspectRatio: "1/1", objectFit: "cover", cursor: "pointer" }}
        />
        {a.cache_hit && (
          <span style={{ position: "absolute", top: 8, left: 8, background: "rgba(23,138,80,0.92)", color: "#fff", fontFamily: "monospace", fontSize: 10, padding: "2px 7px", borderRadius: 6 }}>
            CACHE HIT · $0.00
          </span>
        )}
        {a.from_cache && !a.cache_hit && (
          <span style={{ position: "absolute", top: 8, left: 8, background: "rgba(11,29,51,0.75)", color: "#E9C46A", fontFamily: "monospace", fontSize: 10, padding: "2px 7px", borderRadius: 6 }}>
            CACHED
          </span>
        )}
        <span style={{ position: "absolute", bottom: 8, right: 8, background: "rgba(11,29,51,0.75)", color: "#fff", fontFamily: "monospace", fontSize: 10, padding: "2px 7px", borderRadius: 6 }}>
          {a.aspect}
        </span>
      </div>
      <div style={{ padding: "11px 15px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{a.kind}</span>
          <span style={{ display: "flex", gap: 10 }}>
            <span onClick={() => { setMode(mode === "edit" ? "closed" : "edit"); setDraft(a.prompt); }} style={{ fontFamily: T.mono, fontSize: 10.5, color: T.blue, cursor: "pointer", fontWeight: 700 }}>
              {mode === "edit" ? "cancel" : (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <Edit02 width={11} height={11} /> edit prompt
                </span>
              )}
            </span>
            <span onClick={() => setMode(mode === "view" ? "closed" : "view")} style={{ fontFamily: T.mono, fontSize: 10.5, color: T.soft, cursor: "pointer" }}>
              {mode === "view" ? "hide" : "prompt"}
            </span>
          </span>
        </div>
        {mode === "view" && <div style={{ fontSize: 11, color: T.soft, marginTop: 6, lineHeight: 1.5 }}>{a.prompt}</div>}
        {mode === "edit" && (
          <div style={{ marginTop: 8 }}>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              style={{ ...inputStyle, fontSize: 11.5, fontFamily: T.mono, height: 110, resize: "vertical", lineHeight: 1.5 }}
            />
            <button
              onClick={regenerate}
              disabled={busy}
              style={{ marginTop: 8, width: "100%", padding: "9px 0", borderRadius: 9, border: "none", background: T.blue, color: "#fff", fontWeight: 700, fontSize: 12.5, cursor: busy ? "wait" : "pointer", fontFamily: T.sans }}
            >
              {busy ? "Regenerating…" : "Regenerate with edited prompt"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function VideoPanel({ creative }) {
  const [video, setVideo] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const render = async () => {
    setBusy(true);
    try {
      setVideo(await api("/video", { method: "POST", body: JSON.stringify({ creative_id: creative.creative_id }) }));
    } catch (e) {
      setVideo({ status: "error", error: String(e.message || e) });
    } finally {
      setBusy(false);
    }
  };
  const onUpload = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("creative_id", creative.creative_id);
      fd.append("file", f);
      const r = await fetch("/video/upload", { method: "POST", body: fd });
      if (!r.ok) throw new Error((await r.text()) || r.statusText);
      setVideo(await r.json());
    } catch (e) {
      setVideo({ status: "error", error: String(e.message || e) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card style={{ marginTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div>
          <Label>VIDEO · SEEDANCE T2V (OPTIONAL)</Label>
          <p style={{ fontSize: 13, color: T.soft, marginTop: 6, lineHeight: 1.55, maxWidth: 560 }}>
            The /bundle skill wrote a ready-to-run text-to-video prompt. Rendering is a separate,
            explicit call: one 5s / 720p clip per creative, never triggered automatically.
          </p>
        </div>
        {(!video || video.status === "error") && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Btn small onClick={render} disabled={busy}>
              {busy ? "Working…" : "Render video via Seedance"}
            </Btn>
            <Btn kind="ghost" small onClick={() => fileRef.current?.click()} disabled={busy}>
              Upload a video file
            </Btn>
            <input ref={fileRef} type="file" accept="video/mp4" onChange={onUpload} style={{ display: "none" }} />
          </div>
        )}
      </div>

      {video?.status === "done" && (
        <div style={{ marginTop: 16 }}>
          <video controls src={video.url} style={{ width: "100%", maxWidth: 640, borderRadius: 12, display: "block", background: "#0B1D33" }} />
          <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <Pill color={T.green} bg={T.greenSoft}>
              {video.cached ? "CACHED · $0.00" : `RENDERED · $${(video.cost_usd || 0).toFixed(2)}`}
            </Pill>
            <span style={{ fontFamily: T.mono, fontSize: 11, color: T.faint }}>5s · 720p · seedance-lite</span>
          </div>
        </div>
      )}
      {video?.status === "disabled" && (
        <div style={{ marginTop: 14 }}>
          <Pill color={T.amber} bg={T.amberSoft}>SEEDANCE_API_KEY NOT SET · PROMPT READY</Pill>
          <p style={{ fontFamily: T.mono, fontSize: 12, color: T.body, marginTop: 10, lineHeight: 1.6, background: "rgba(11,29,51,0.04)", padding: "12px 14px", borderRadius: 10 }}>
            {video.prompt}
          </p>
        </div>
      )}
      {video?.status === "error" && (
        <p style={{ marginTop: 12, fontSize: 13, color: T.red, fontFamily: T.mono }}>
          Video failed: {video.error}
        </p>
      )}
    </Card>
  );
}

/* ================= HISTORY (below the divider) ================= */
function History({ onOpen }) {
  const [items, setItems] = useState(null);
  useEffect(() => {
    api("/campaigns").then((r) => setItems(r.campaigns)).catch(() => setItems([]));
  }, []);
  return (
    <div>
      <PageTitle
        eyebrow="Persistent shelf · outside the numbered pipeline"
        title="History"
        sub="Everything you previously generated: every campaign, its stage decisions, creatives and spend. Open one to resume exactly where it left off. Survives every redeploy on the mounted volume."
      />
      {!items ? (
        <Empty label="Loading…" />
      ) : items.length === 0 ? (
        <Empty label="No campaigns yet. Start one at step 01." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {items.map((c) => (
            <Card key={c.id} style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontFamily: T.mono, fontSize: 12, color: T.faint, minWidth: 84 }}>
                CAMP-{String(c.id).padStart(3, "0")}
              </span>
              <div style={{ flex: "1 1 260px" }}>
                <div style={{ fontFamily: T.serif, fontSize: 20, lineHeight: 1.2 }}>{c.product}</div>
                <div style={{ fontSize: 12, color: T.soft, marginTop: 3 }}>
                  {new Date(c.created_at).toLocaleString()} · {c.objective}
                </div>
              </div>
              {statusChip(c.status)}
              <div style={{ display: "flex", gap: 18, fontFamily: T.mono, fontSize: 11.5, color: T.soft }}>
                <span>{c.creatives} creative{c.creatives === 1 ? "" : "s"}</span>
                <span>{c.assets} asset{c.assets === 1 ? "" : "s"}</span>
                <span>${c.image_spend_usd.toFixed(2)} images</span>
              </div>
              {c.skills.map((s) => (
                <span key={s} style={{ fontFamily: T.mono, fontSize: 11, color: T.blue }}>{s}</span>
              ))}
              <Btn kind="ghost" small onClick={() => onOpen(c.id)}>Open →</Btn>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================= ASSET LIBRARY (below the divider) ================= */
function Library({ onCost }) {
  const isMobile = useIsMobile();
  const [stats, setStats] = useState({ assets_stored: 0, image_spend_usd: 0, cache_hits: 0, dollars_saved_usd: 0 });
  const [assets, setAssets] = useState([]);
  const [brand, setBrand] = useState("");
  const [skill, setSkill] = useState("");
  const [cacheOnly, setCacheOnly] = useState(false);
  const [busy, setBusy] = useState(0);

  const load = async () => {
    const qs = new URLSearchParams();
    if (brand) qs.set("brand", brand);
    if (skill) qs.set("skill", skill);
    if (cacheOnly) qs.set("cache_only", "true");
    try {
      const [s, l] = await Promise.all([
        api("/library/stats"),
        api(`/library?${qs.toString()}`),
      ]);
      setStats(s);
      setAssets(l.assets);
    } catch {}
  };

  useEffect(() => {
    load();
  }, [brand, skill, cacheOnly]);

  const act = async (id, kind) => {
    setBusy(id);
    try {
      await api(`/assets/${id}/${kind}`, { method: "POST", body: kind === "variant" ? JSON.stringify({}) : undefined });
      await load();
      onCost?.();
    } catch (e) {
      alert(String(e.message || e));
    } finally {
      setBusy(0);
    }
  };

  const del = async (id) => {
    if (!window.confirm(`Delete asset #${id}? This removes it from the library permanently.`)) return;
    setBusy(id);
    try {
      await api(`/assets/${id}`, { method: "DELETE" });
      await load();
      onCost?.();
    } catch (e) {
      alert(String(e.message || e));
    } finally {
      setBusy(0);
    }
  };

  const statCards = [
    { l: "Assets stored", v: String(stats.assets_stored) },
    { l: "Image spend", v: `$${stats.image_spend_usd.toFixed(2)}` },
    { l: "Cache hits", v: String(stats.cache_hits), c: T.green },
    { l: "Saved by caching", v: `$${stats.dollars_saved_usd.toFixed(2)}`, c: T.green },
  ];
  const chip = (active, onClick, label) => (
    <button
      key={label}
      onClick={onClick}
      style={{
        fontFamily: T.mono,
        fontSize: 12,
        fontWeight: 600,
        padding: "7px 14px",
        borderRadius: 99,
        cursor: "pointer",
        border: `1px solid ${active ? T.blueBorder : T.line}`,
        background: active ? "rgba(31,117,254,0.10)" : "rgba(255,255,255,0.7)",
        color: active ? T.blue : T.soft,
      }}
    >
      {label}
    </button>
  );

  return (
    <div>
      <PageTitle
        eyebrow="Persistent shelf · outside the numbered pipeline"
        title="Asset Library"
        sub="Every generated asset, priced. The system never pays twice for the same prompt; repeats are served from cache at $0.00. This shelf survives every redeploy on a mounted volume."
      />

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 14 }}>
        {statCards.map((s) => (
          <Card key={s.l} style={{ padding: "18px 22px" }}>
            <Label>{s.l.toUpperCase()}</Label>
            <div style={{ fontFamily: T.serif, fontSize: isMobile ? 30 : 40, marginTop: 6, color: s.c || T.ink }}>{s.v}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "18px 0" }}>
        {chip(brand === "", () => setBrand(""), "All brands")}
        {chip(brand === "hills", () => setBrand("hills"), "Hill's")}
        {chip(brand === "palmolive", () => setBrand("palmolive"), "Palmolive")}
        {chip(brand === "skin_health", () => setBrand("skin_health"), "Skin Health")}
        <span style={{ width: 1, background: T.line, margin: "0 4px" }} />
        {["", "/product-shoot", "/amazon", "/meta", "/bundle"].map((sk) =>
          chip(skill === sk, () => setSkill(sk), sk || "All skills")
        )}
        <span style={{ width: 1, background: T.line, margin: "0 4px" }} />
        {chip(cacheOnly, () => setCacheOnly((c) => !c), "Cache hits")}
      </div>

      {assets.length === 0 ? (
        <Empty label="No assets yet. Run the creative agent (step 04) to fill the shelf." />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 14 }}>
          {assets.map((a) => (
            <div key={a.id} style={{ ...glass, borderRadius: 14, overflow: "hidden", padding: 0 }}>
              <div style={{ position: "relative", background: "#0B1D33" }}>
                <img src={a.url} alt={a.kind} style={{ width: "100%", display: "block", aspectRatio: "1/1", objectFit: "cover" }} />
                {a.cache_hit ? (
                  <span style={badge(T.green, "rgba(23,138,80,0.92)")}>CACHE HIT · $0.00</span>
                ) : (
                  <span style={badge("#fff", "rgba(11,29,51,0.75)")}>${a.cost_usd.toFixed(3)}</span>
                )}
                <span style={{ ...badge("#fff", "rgba(11,29,51,0.6)"), top: "auto", bottom: 8, left: "auto", right: 8 }}>
                  {a.quality} · {a.aspect}
                </span>
              </div>
              <div style={{ padding: "12px 15px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700 }}>{a.kind}</span>
                  <span style={{ fontFamily: T.mono, fontSize: 10.5, color: T.faint }}>#{a.id}</span>
                </div>
                <div style={{ fontFamily: T.mono, fontSize: 10.5, color: T.soft, marginTop: 5 }}>
                  {a.campaign_id ? `camp ${String(a.campaign_id).padStart(3, "0")}` : "library"} · {a.skill || "-"} · {a.brand || "-"}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button onClick={() => act(a.id, "reuse")} disabled={busy === a.id} style={miniBtn(false)}>
                    Reuse
                  </button>
                  <button onClick={() => act(a.id, "variant")} disabled={busy === a.id} style={miniBtn(true)}>
                    {busy === a.id ? "…" : "Variant"}
                  </button>
                  <button
                    onClick={() => del(a.id)}
                    disabled={busy === a.id}
                    title="Delete this asset"
                    style={{
                      ...miniBtn(false), flex: "0 0 auto", padding: "8px 10px",
                      color: T.red, border: `1px solid rgba(217,54,54,0.4)`,
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <Trash01 width={14} height={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function badge(color, bg) {
  return {
    position: "absolute",
    top: 8,
    left: 8,
    background: bg,
    color,
    fontFamily: "monospace",
    fontSize: 10,
    fontWeight: 600,
    padding: "3px 8px",
    borderRadius: 6,
  };
}
function miniBtn(primary) {
  return {
    flex: 1,
    fontFamily: T.sans,
    fontSize: 12.5,
    fontWeight: 700,
    padding: "8px 0",
    borderRadius: 9,
    cursor: "pointer",
    border: primary ? "none" : `1px solid ${T.line}`,
    background: primary ? T.blue : "rgba(255,255,255,0.7)",
    color: primary ? "#fff" : T.ink,
  };
}
