import { useEffect, useState } from "react";

// ============================================================
// AdPipeline — frosted glass edition, wired to the FastAPI backend.
// White-first translucent glass on a soft light field. Navy = text +
// one solid panel. Blue = actions/active only. Red/green = danger/health.
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
  { key: "overview", step: "01", label: "Pipeline", sub: "System overview" },
  { key: "strategist", step: "02", label: "Strategist", sub: "Angles & audiences" },
  { key: "sales", step: "03", label: "Sales Analyst", sub: "Distribution truth" },
  { key: "monitor", step: "04", label: "Monitor", sub: "Performance & alerts" },
  { key: "gate", step: "05", label: "Approval", sub: "Your decision" },
  { key: "creative", step: "06", label: "Creative Studio", sub: "Generation & placement" },
];

const PRODUCTS = ["Hill's Youthful Vitality", "Palmolive Luminous Oils"];
const SKILLS = [
  { cmd: "/product-shoot", d: "4 hero images — packshot, macro, lifestyle, flat-lay" },
  { cmd: "/amazon", d: "Listing-compliant set + A+ content blocks" },
  { cmd: "/meta", d: "4:5 feed + 9:16 story with hook overlays" },
  { cmd: "/bundle", d: "All sets + 6-frame video storyboard" },
];
const DEFAULT_URL = {
  "Hill's Youthful Vitality":
    "https://www.hillspet.com/dog-food/sd-canine-youthful-vitality-adult-7-plus-chicken-rice-recipe-dry",
  "Palmolive Luminous Oils": "https://www.palmolive.com/en-us/products/body-wash",
};

async function api(path, opts) {
  const r = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!r.ok) throw new Error((await r.text()) || r.statusText);
  return r.json();
}

function num(s) {
  const m = String(s).match(/[\d.]+/);
  return m ? parseFloat(m[0]) : 0;
}

export default function App() {
  const [view, setView] = useState("overview");
  const [product, setProduct] = useState(PRODUCTS[0]);
  const [objective, setObjective] = useState(
    "Grow senior-pet demand efficiently in NA/EU and test scalable channels"
  );
  const [run, setRun] = useState(null);
  const [brief, setBrief] = useState(null);
  const [decision, setDecision] = useState(null);
  const [creative, setCreative] = useState(null);
  const [placement, setPlacement] = useState(null);
  const [cost, setCost] = useState({ total_usd: 0, by_model: [] });
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Instrument+Sans:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap";
    document.head.appendChild(link);
    refreshCost();
  }, []);

  const refreshCost = async () => {
    try {
      setCost(await api("/cost"));
    } catch {}
  };

  const doRun = async () => {
    setError("");
    setLoading("Running 3 analysts + brief…");
    try {
      const res = await api("/runs", {
        method: "POST",
        body: JSON.stringify({ product, objective }),
      });
      setRun(res);
      setBrief(res.brief);
      setDecision(null);
      setCreative(null);
      setPlacement(null);
      setView("strategist");
      refreshCost();
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading("");
    }
  };

  const decide = async (action, feedback) => {
    setError("");
    try {
      await api(`/briefs/${brief.id}/decision`, {
        method: "POST",
        body: JSON.stringify({ action, feedback }),
      });
      setDecision(action);
      if (action === "approve") setView("creative");
    } catch (e) {
      setError(String(e.message || e));
    }
  };

  const genCreative = async (url, skill) => {
    setError("");
    setLoading("Diagnosing URL + generating assets…");
    try {
      const res = await api("/creative", {
        method: "POST",
        body: JSON.stringify({ brief_id: brief.id, url, skill }),
      });
      setCreative(res);
      setPlacement(null);
      refreshCost();
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading("");
    }
  };

  const plan = async () => {
    setError("");
    setLoading("Running placement pass…");
    try {
      const res = await api("/placement", {
        method: "POST",
        body: JSON.stringify({ creative_id: creative.creative_id }),
      });
      setPlacement(res);
      refreshCost();
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading("");
    }
  };

  const idx = FLOW.findIndex((f) => f.key === view);
  const inFlow = idx >= 0;
  const next = inFlow ? FLOW[idx + 1] : null;
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
        <Sidebar view={view} setView={setView} idx={idx} cost={cost} calls={calls} run={run} />
        <main style={{ flex: 1, overflowY: "auto" }}>
          <div style={{ maxWidth: 1140, margin: "0 auto", padding: "40px 44px 72px" }}>
            <TopBar view={view} go={setView} run={run} product={product} />
            {error && <Banner tone="err">{error}</Banner>}
            {loading && <Banner tone="load">{loading}</Banner>}

            {view === "overview" && (
              <Overview
                {...{ product, setProduct, objective, setObjective, run, doRun, loading, cost, go: setView }}
              />
            )}
            {view === "strategist" && <Strategist run={run} onRerun={doRun} loading={loading} />}
            {view === "sales" && <SalesAnalyst run={run} />}
            {view === "monitor" && <Monitor run={run} />}
            {view === "gate" && (
              <Gate {...{ run, brief, decision, decide, doRun, loading }} />
            )}
            {view === "creative" && (
              <Creative
                {...{ product, brief, creative, placement, genCreative, plan, loading }}
              />
            )}
            {view === "library" && <Library onCost={refreshCost} />}

            {next && (
              <button
                onClick={() => setView(next.key)}
                style={{
                  marginTop: 40,
                  width: "100%",
                  padding: "20px 28px",
                  borderRadius: 18,
                  border: "none",
                  cursor: "pointer",
                  background: T.blue,
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontFamily: T.sans,
                  boxShadow: "0 12px 30px rgba(31,117,254,0.30)",
                }}
              >
                <span style={{ textAlign: "left" }}>
                  <span style={{ fontFamily: T.mono, fontSize: 11, opacity: 0.85, letterSpacing: 1 }}>
                    NEXT · STEP {next.step}
                  </span>
                  <span style={{ display: "block", fontFamily: T.serif, fontSize: 24, marginTop: 3 }}>
                    {next.label} — {next.sub.toLowerCase()}
                  </span>
                </span>
                <span style={{ fontSize: 28 }}>→</span>
              </button>
            )}
          </div>
        </main>
      </div>
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
function Sidebar({ view, setView, idx, cost, calls, run }) {
  return (
    <aside
      style={{
        ...glass,
        width: 258,
        flexShrink: 0,
        margin: 16,
        marginRight: 0,
        padding: "30px 16px 24px",
        display: "flex",
        flexDirection: "column",
        borderRadius: 22,
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
          const done = i < idx;
          return (
            <button
              key={n.key}
              onClick={() => setView(n.key)}
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
                {done ? "✓" : n.step}
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
      </nav>

      {/* below the divider: the persistent shelf that outlives every run */}
      <div style={{ height: 1, background: T.line, margin: "16px 8px" }} />
      <button
        onClick={() => setView("library")}
        style={{
          display: "flex",
          gap: 12,
          width: "100%",
          textAlign: "left",
          alignItems: "center",
          padding: "11px 12px",
          borderRadius: 12,
          border: "none",
          cursor: "pointer",
          fontFamily: T.sans,
          background: view === "library" ? "rgba(255,255,255,0.9)" : "transparent",
          boxShadow: view === "library" ? "0 4px 14px rgba(11,29,51,0.08)" : "none",
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
            background: view === "library" ? T.blue : "transparent",
            border: view === "library" ? "none" : `1.5px solid ${T.line}`,
            color: view === "library" ? "#fff" : T.faint,
          }}
        >
          ▤
        </span>
        <span>
          <div style={{ fontSize: 14.5, fontWeight: view === "library" ? 700 : 500, color: view === "library" ? T.blue : T.ink }}>
            Asset Library
          </div>
          <div style={{ fontSize: 11.5, color: T.faint, marginTop: 1 }}>Persistent shelf</div>
        </span>
      </button>

      <div style={{ marginTop: "auto", background: T.ink, borderRadius: 16, padding: "18px 18px", color: "#fff" }}>
        <div style={{ fontFamily: T.mono, fontSize: 10, opacity: 0.65, letterSpacing: 1 }}>
          {run ? `RUN-${String(run.run_id).padStart(3, "0")}` : "RUN-—"} · LIVE COST
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

function TopBar({ view, go, run, product }) {
  const idx = FLOW.findIndex((f) => f.key === view);
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: 32, flexWrap: "wrap", gap: 4 }}>
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
          {i < FLOW.length - 1 && <span style={{ color: T.faint, margin: "0 7px", opacity: 0.5 }}>·</span>}
        </div>
      ))}
      <span style={{ marginLeft: "auto", fontFamily: T.mono, fontSize: 11.5, color: T.soft }}>
        {product}
        {run ? ` · Run ${String(run.run_id).padStart(3, "0")}` : ""}
      </span>
    </div>
  );
}

function PageTitle({ eyebrow, title, sub, right }) {
  return (
    <header style={{ marginBottom: 32, display: "flex", alignItems: "flex-end", gap: 30 }}>
      <div style={{ flex: 1 }}>
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
            fontSize: 54,
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
};

function Banner({ tone, children }) {
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
        padding: "12px 18px",
        borderRadius: 12,
        marginBottom: 18,
        fontSize: 13.5,
        fontWeight: 600,
        fontFamily: T.mono,
      }}
    >
      {children}
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

/* ================= 01 OVERVIEW ================= */
function Overview({ product, setProduct, objective, setObjective, run, doRun, loading, cost, go }) {
  const agents = [
    { key: "strategist", n: "AGT-1", name: "Marketing Strategist", model: "gpt-4o", does: "Proposes cited campaign angles from market intel and brand guidelines.", ready: run && `${run.strategist.strategies.length} angles ready`, kpi: run ? String(run.strategist.strategies.length) : "—", kl: "strategies" },
    { key: "sales", n: "AGT-2", name: "Sales & Distribution Analyst", model: "gpt-4o", does: "Maps where products sell and lag — CPL, CVR and stock truth per channel.", ready: run && `${run.sales.lagging.length} regions flagged`, kpi: run ? String(run.sales.lagging.length) : "—", kl: "lagging regions", kc: T.red },
    { key: "monitor", n: "AGT-3", name: "Performance Monitor", model: "gpt-4o-mini", does: "Watches campaigns, raises alerts, recommends scale and kill.", ready: run && `${run.monitor.alerts.length} alerts`, kpi: run ? String(run.monitor.alerts.length) : "—", kl: "alerts", kc: T.red },
    { key: "creative", n: "AGT-4", name: "Creative Agent", model: "gpt-4o + gpt-image-1", does: "Diagnoses a product URL, generates asset sets, plans placements.", ready: "4 skills loaded", kpi: "4", kl: "skills" },
  ];
  return (
    <div>
      <PageTitle
        eyebrow="Step 01 · System overview"
        title={<>Four agents. <em style={{ color: T.blue }}>One decision.</em></>}
        sub="Three analysts screen the market from grounded internal data. You approve once at step 05. The creative agent executes, and its results feed the monitor — the loop closes."
      />

      <Card style={{ marginBottom: 16 }}>
        <Label>NEW SCREENING RUN</Label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr auto", gap: 14, marginTop: 12, alignItems: "end" }}>
          <div>
            <Label>PRODUCT</Label>
            <select style={{ ...inputStyle, marginTop: 6 }} value={product} onChange={(e) => setProduct(e.target.value)}>
              {PRODUCTS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>OBJECTIVE</Label>
            <input style={{ ...inputStyle, marginTop: 6 }} value={objective} onChange={(e) => setObjective(e.target.value)} />
          </div>
          <Btn onClick={doRun} disabled={!!loading}>
            {loading ? "Running…" : "Run screening →"}
          </Btn>
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {agents.map((a) => (
          <Card key={a.n} style={{ cursor: run ? "pointer" : "default" }}>
            <div onClick={() => run && go(a.key)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Label>{a.n} · {a.model.toUpperCase()}</Label>
                <span style={{ fontFamily: T.mono, fontSize: 11, color: a.kc || T.soft, fontWeight: 600 }}>
                  ● {a.ready || "idle"}
                </span>
              </div>
              <h3 style={{ fontFamily: T.serif, fontSize: 27, fontWeight: 400, margin: "12px 0 0" }}>{a.name}</h3>
              <p style={{ fontSize: 13.5, color: T.soft, lineHeight: 1.6, marginTop: 8 }}>{a.does}</p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.line}` }}>
                <span style={{ fontFamily: T.serif, fontSize: 32, color: a.kc || T.ink }}>{a.kpi}</span>
                <span style={{ fontSize: 12.5, color: T.faint }}>{a.kl}</span>
                {run && <span style={{ marginLeft: "auto", fontSize: 13.5, fontWeight: 700, color: T.blue }}>Open →</span>}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16, marginTop: 16 }}>
        <Card>
          <Label>{run?.used_feedback ? "FEEDBACK LOOP" : "HOW IT WORKS"}</Label>
          {run?.used_feedback ? (
            <p style={{ fontSize: 14, color: T.body, lineHeight: 1.65, marginTop: 10, fontWeight: 500 }}>
              ♻ This run consumed prior rejection feedback: “{run.used_feedback}”. The analysts
              re-scored with it injected into their prompts — compare against the previous run.
            </p>
          ) : (
            <p style={{ fontSize: 14, color: T.body, lineHeight: 1.65, marginTop: 10, fontWeight: 500 }}>
              Screening runs three analysts concurrently, merges a cited brief, and pauses for your
              approval. Reject with feedback and the next run adapts. Approve and the creative agent
              generates and places assets — whose projections feed the monitor next cycle.
            </p>
          )}
        </Card>
        <Card>
          <Label>KNOWLEDGE BASE</Label>
          <div style={{ fontFamily: T.serif, fontSize: 34, marginTop: 8 }}>
            9 <span style={{ fontSize: 18, color: T.soft }}>docs</span>
          </div>
          <p style={{ fontSize: 13, color: T.soft, lineHeight: 1.65, marginTop: 8 }}>
            Sales data, channel metrics, distributor notes, brand guidelines. Analysts answer only from
            here — <strong style={{ color: T.ink }}>no citation, no claim.</strong>
          </p>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 12 }}>
            <Cite src="hills_regional_sales.md" />
            <Cite src="channel_metrics.md" />
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ================= 02 STRATEGIST ================= */
function Strategist({ run, onRerun, loading }) {
  if (!run) return <Empty label="Run screening first (step 01)." />;
  const strategies = run.strategist.strategies;
  return (
    <div>
      <PageTitle
        eyebrow="Step 02 · Agent 1 — Marketing Strategist"
        title="Angles, all cited"
        sub="Grounded in market intel and brand guidelines. Approve at step 05 and the chosen angle briefs the creative agent."
        right={<Btn kind="ghost" small onClick={onRerun} disabled={!!loading}>Re-run</Btn>}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {strategies.map((s, i) => {
          const top = i === 0;
          return (
            <Card key={i} style={{ display: "grid", gridTemplateColumns: "52px 1.5fr 1fr", gap: 24, alignItems: "center" }}>
              <div style={{ fontFamily: T.serif, fontSize: 42, color: top ? T.blue : T.faint, opacity: top ? 1 : 0.4 }}>
                {i + 1}
              </div>
              <div>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <h3 style={{ fontFamily: T.serif, fontSize: 26, fontWeight: 400, fontStyle: "italic", margin: 0, lineHeight: 1.15 }}>
                    “{s.angle}”
                  </h3>
                  {top && <Pill color={T.blue} bg={T.blueSoft}>RECOMMENDED</Pill>}
                </div>
                <p style={{ fontSize: 14, color: T.body, lineHeight: 1.6, marginTop: 8, fontWeight: 500 }}>{s.insight}</p>
                <div style={{ display: "flex", gap: 7, marginTop: 10, flexWrap: "wrap" }}>
                  {s.sources.map((x) => <Cite key={x} src={x} />)}
                </div>
              </div>
              <div style={{ borderLeft: `1px solid ${T.line}`, paddingLeft: 24, display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <Label>SEGMENT</Label>
                  <div style={{ fontSize: 14, marginTop: 4, fontWeight: 600 }}>{s.target_segment}</div>
                </div>
                <div>
                  <Label>CHANNEL</Label>
                  <div style={{ fontSize: 14, marginTop: 4, fontWeight: 700, color: T.blue }}>{s.recommended_channel}</div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ================= 03 SALES ANALYST ================= */
function SalesAnalyst({ run }) {
  if (!run) return <Empty label="Run screening first (step 01)." />;
  const s = run.sales;
  const laggingRegions = new Set(s.lagging.map((l) => l.region));
  const maxCpl = Math.max(1, ...s.cpl_by_channel.map((c) => num(c.value)));
  return (
    <div>
      <PageTitle
        eyebrow="Step 03 · Agent 2 — Sales & Distribution Analyst"
        title="Where it sells, where it lags"
        sub="Region and channel truth from internal sales and distributor data — the ground every other agent stands on."
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
        {s.where_selling.map((x, i) => {
          const lag = laggingRegions.has(x.region);
          return (
            <Card key={i} style={{ padding: "18px 20px" }}>
              <h3 style={{ fontFamily: T.serif, fontSize: 21, fontWeight: 400, margin: 0 }}>{x.region}</h3>
              <div style={{ marginTop: 10 }}>
                <Pill color={lag ? T.red : T.green} bg={lag ? T.redSoft : T.greenSoft}>{x.status}</Pill>
              </div>
              <p style={{ fontSize: 12.5, color: T.soft, marginTop: 10, lineHeight: 1.55 }}>{x.channel}</p>
            </Card>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
        <Card>
          <Label>COST PER LEAD</Label>
          <div style={{ marginTop: 16 }}>
            {s.cpl_by_channel.map((c, i) => {
              const v = num(c.value);
              const cheap = v > 0 && v < 4;
              return (
                <div key={i} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6, fontWeight: 600 }}>
                    <span>{c.channel} · {c.region}</span>
                    <span style={{ fontFamily: T.mono, color: cheap ? T.green : T.body }}>{c.value}</span>
                  </div>
                  <div style={{ height: 6, background: "rgba(11,29,51,0.08)", borderRadius: 99 }}>
                    <div style={{ width: `${(v / maxCpl) * 100}%`, height: "100%", borderRadius: 99, background: cheap ? T.green : T.faint }} />
                  </div>
                </div>
              );
            })}
          </div>
          {s.cpl_by_channel[0]?.sources?.[0] && <Cite src={s.cpl_by_channel[0].sources[0]} />}
        </Card>
        <Card>
          <Label>CONVERSION BY CHANNEL</Label>
          <div style={{ marginTop: 8 }}>
            {s.cvr_by_channel.map((c, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "11px 0", borderBottom: `1px solid ${T.line}`, alignItems: "baseline" }}>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>{c.channel} · {c.region}</span>
                <span style={{ fontFamily: T.serif, fontSize: 20, color: T.ink }}>{c.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
        <Card>
          <Label color={T.amber}>LAGGING REGIONS</Label>
          <div style={{ marginTop: 8 }}>
            {s.lagging.map((l, i) => (
              <div key={i} style={{ padding: "11px 0", borderBottom: `1px solid ${T.line}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{l.region}</span>
                  <span style={{ display: "flex", gap: 5 }}>{l.sources.map((x) => <Cite key={x} src={x} />)}</span>
                </div>
                <p style={{ fontSize: 12.5, color: T.soft, marginTop: 5, lineHeight: 1.5 }}>{l.reason}</p>
              </div>
            ))}
          </div>
        </Card>
        <Card style={{ background: "rgba(255,255,255,0.5)" }}>
          <Label color={T.red}>KEY RISKS</Label>
          <ul style={{ margin: "10px 0 0", paddingLeft: 18 }}>
            {s.key_risks.map((r, i) => (
              <li key={i} style={{ fontSize: 13.5, color: T.body, lineHeight: 1.6, marginBottom: 7, fontWeight: 500 }}>{r}</li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

/* ================= 04 MONITOR ================= */
function Monitor({ run }) {
  if (!run) return <Empty label="Run screening first (step 01)." />;
  const m = run.monitor;
  const sev = { high: T.red, medium: T.amber, low: T.soft };
  const sevBg = { high: T.redSoft, medium: T.amberSoft, low: "rgba(11,29,51,0.05)" };
  const high = m.alerts.filter((a) => a.severity === "high").length;
  return (
    <div>
      <PageTitle
        eyebrow="Step 04 · Agent 3 — Performance Monitor"
        title="Campaign health"
        sub="Metrics computed in code — never by the model. The agent narrates, flags breaches, and recommends what to scale or kill."
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        {[
          { l: "Alerts", v: String(m.alerts.length) },
          { l: "Critical", v: String(high), c: high ? T.red : T.green },
          { l: "Corpus", v: "campaign_history.md", small: true },
        ].map((s) => (
          <Card key={s.l} style={{ padding: "18px 22px" }}>
            <Label>{s.l.toUpperCase()}</Label>
            <div style={{ fontFamily: s.small ? T.mono : T.serif, fontSize: s.small ? 13 : 40, marginTop: 6, color: s.c || T.ink }}>
              {s.v}
            </div>
          </Card>
        ))}
      </div>

      <Card style={{ marginTop: 14 }}>
        <Label>SUMMARY</Label>
        <p style={{ fontFamily: T.serif, fontSize: 23, lineHeight: 1.4, marginTop: 10 }}>{m.summary}</p>
      </Card>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
        {m.alerts.map((a, i) => (
          <Card key={i} style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ minWidth: 90 }}>
              <Pill color={sev[a.severity] || T.soft} bg={sevBg[a.severity] || "rgba(11,29,51,0.05)"}>
                {a.severity.toUpperCase()}
              </Pill>
            </div>
            <div style={{ flex: "1 1 320px" }}>
              <div style={{ fontFamily: T.serif, fontSize: 20, lineHeight: 1.25 }}>{a.campaign}</div>
              <p style={{ fontSize: 13.5, color: T.body, marginTop: 6, fontWeight: 500, lineHeight: 1.55 }}>{a.reason}</p>
            </div>
            <div style={{ flex: "1 1 220px" }}>
              <Label>ACTION</Label>
              <p style={{ fontSize: 13.5, color: T.ink, marginTop: 5, fontWeight: 600, lineHeight: 1.5 }}>{a.action}</p>
            </div>
          </Card>
        ))}
      </div>

      <Card style={{ marginTop: 14, display: "flex", gap: 16, alignItems: "center", background: "rgba(255,255,255,0.75)", flexWrap: "wrap" }}>
        <Pill color={T.green} bg={T.greenSoft}>SCALE RECOMMENDATION</Pill>
        <p style={{ fontFamily: T.serif, fontSize: 22, margin: 0, flex: 1, minWidth: 300, lineHeight: 1.4 }}>
          {m.scale_recommendation}
        </p>
      </Card>
    </div>
  );
}

/* ================= 05 APPROVAL GATE ================= */
function Gate({ run, brief, decision, decide, doRun, loading }) {
  const [fb, setFb] = useState("");
  if (!brief) return <Empty label="Run screening first (step 01)." />;
  const status = decision || (brief.status !== "pending" ? brief.status.replace("d", "") : null);
  const says = run
    ? [
        { a: "Strategist", says: run.strategist.strategies[0]?.angle },
        { a: "Sales Analyst", says: run.sales.key_risks[0] || run.sales.lagging[0]?.reason },
        { a: "Monitor", says: run.monitor.scale_recommendation },
      ]
    : [];
  return (
    <div>
      <PageTitle
        eyebrow="Step 05 · Human in the loop"
        title={<>The <em style={{ color: T.blue }}>one</em> decision</>}
        sub="Three agents screened the market. Approve to hand this brief to the creative agent. Reject with feedback and the screening re-runs — your feedback goes into their prompts."
      />

      {status && <Stamp approved={decision === "approve" || brief.status === "approved"} />}
      {run?.used_feedback && (
        <Banner tone="load">♻ This run consumed prior feedback: “{run.used_feedback}”</Banner>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginTop: 8 }}>
        <Card style={{ padding: 36 }}>
          <Label>BRIEF-{String(brief.id).padStart(3, "0")} · COMBINED FINDINGS · {brief.status.toUpperCase()}</Label>
          <p style={{ fontFamily: T.serif, fontSize: 29, lineHeight: 1.35, marginTop: 16 }}>
            {brief.executive_summary}
          </p>

          {decision !== "reject" && brief.status === "pending" && (
            <>
              <div style={{ display: "flex", gap: 14, marginTop: 28, alignItems: "center", flexWrap: "wrap" }}>
                <Btn kind="approve" onClick={() => decide("approve")}>Approve — run creative agent</Btn>
                <Btn
                  kind="danger"
                  onClick={() => {
                    if (!fb.trim()) {
                      alert("Reject requires feedback.");
                      return;
                    }
                    decide("reject", fb);
                  }}
                >
                  Reject with feedback
                </Btn>
              </div>
              <textarea
                value={fb}
                onChange={(e) => setFb(e.target.value)}
                placeholder="Rejection feedback (required) — e.g. Too NA-centric; prioritize India quick-commerce, cut vet-referral emphasis."
                style={{ ...inputStyle, marginTop: 16, height: 80, resize: "vertical", fontFamily: T.sans }}
              />
            </>
          )}

          {decision === "reject" && (
            <div style={{ marginTop: 24 }}>
              <p style={{ fontSize: 13.5, color: T.soft, marginBottom: 14 }}>
                Feedback stored. Re-run screening to see the analysts adapt.
              </p>
              <Btn onClick={doRun} disabled={!!loading}>
                {loading ? "Re-running…" : "♻ Re-run screening with feedback"}
              </Btn>
            </div>
          )}
        </Card>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {says.map((x) => (
            <Card key={x.a} style={{ padding: "16px 20px" }}>
              <Label>{x.a.toUpperCase()} SAYS</Label>
              <p style={{ fontSize: 13.5, lineHeight: 1.6, marginTop: 7, fontWeight: 600, color: T.body }}>
                {x.says || "—"}
              </p>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stamp({ approved }) {
  return (
    <div
      style={{
        transform: "rotate(-6deg)",
        display: "inline-block",
        border: `3px solid ${approved ? T.green : T.red}`,
        color: approved ? T.green : T.red,
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
      {approved ? "APPROVED" : "KILLED"}
    </div>
  );
}

/* ================= 06 CREATIVE STUDIO ================= */
function Creative({ product, brief, creative, placement, genCreative, plan, loading }) {
  const [skill, setSkill] = useState("/amazon");
  const [url, setUrl] = useState(DEFAULT_URL[product] || "");
  if (!brief) return <Empty label="Run screening first (step 01)." />;
  if (brief.status !== "approved" && !creative)
    return <Empty label="Approve a brief first (step 05)." />;
  const p = creative?.profile;
  return (
    <div>
      <PageTitle
        eyebrow="Step 06 · Agent 4 — Creative Agent"
        title="Creative studio"
        sub="The approved brief is live context. Paste a product URL, pick a skill — the agent diagnoses the product, generates under brand guardrails, then plans placements."
      />

      <Card style={{ display: "flex", gap: 14, alignItems: "center", padding: "16px 24px", flexWrap: "wrap" }}>
        <Pill color={T.green} bg={T.greenSoft}>BRIEF-{String(brief.id).padStart(3, "0")} APPROVED ✓</Pill>
        <span style={{ fontFamily: T.mono, fontSize: 14, color: T.blue, fontWeight: 600 }}>{skill}</span>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          style={{ flex: "1 1 300px", fontFamily: T.mono, fontSize: 12.5, color: T.soft, background: "rgba(255,255,255,0.8)", border: `1px solid ${T.line}`, borderRadius: 11, padding: "11px 15px" }}
        />
        <Btn onClick={() => genCreative(url, skill)} disabled={!!loading}>
          {loading ? "Generating…" : "Generate set"}
        </Btn>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 14 }}>
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2.1fr", gap: 14, marginTop: 14 }}>
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
                <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                  {p.brand_colors.map((c) => (
                    <span key={c} title={c} style={{ width: 22, height: 22, borderRadius: 6, background: c, border: `1px solid ${T.line}` }} />
                  ))}
                </div>
              </Card>
              <Card>
                <Pill color={T.red} bg={T.redSoft}>GUARDRAILS ACTIVE</Pill>
                <p style={{ fontSize: 13, lineHeight: 1.65, marginTop: 10, fontWeight: 600 }}>
                  No disease-cure claims · no “reverses aging” · no implied vet endorsement without substantiation.
                </p>
                <div style={{ marginTop: 8 }}>
                  <Cite src={product.includes("Palmolive") ? "brand_guidelines_palmolive.md" : "brand_guidelines_hills.md"} />
                </div>
              </Card>
            </div>

            <div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {creative.assets.map((a) => (
                  <AssetTile key={a.id} a={a} />
                ))}
              </div>
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

          <Card style={{ marginTop: 14, padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "15px 22px", borderBottom: `1px solid ${T.line}`, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <Label>PLACEMENT PLAN</Label>
              {placement ? (
                <Label color={T.green}>PROJECTIONS FEED AGENT 3 NEXT CYCLE — LOOP CLOSED</Label>
              ) : (
                <Btn small onClick={plan} disabled={!!loading}>
                  {loading ? "Planning…" : "Run placement pass"}
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
                    {pl.projected_metric} — {pl.rationale}
                  </span>
                </div>
              ))
            ) : (
              <div style={{ padding: "22px", fontSize: 13.5, color: T.soft }}>
                Run the placement pass to map each asset → platform → budget %, grounded in channel metrics.
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function AssetTile({ a }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ ...glass, borderRadius: 14, overflow: "hidden", padding: 0 }}>
      <div style={{ position: "relative", background: "#0B1D33" }}>
        <img
          src={a.url}
          alt={a.kind}
          onClick={() => setShow((s) => !s)}
          style={{ width: "100%", display: "block", aspectRatio: "1/1", objectFit: "cover", cursor: "pointer" }}
        />
        {a.from_cache && (
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
          <span onClick={() => setShow((s) => !s)} style={{ fontFamily: T.mono, fontSize: 10.5, color: T.blue, cursor: "pointer" }}>
            {show ? "hide" : "prompt"}
          </span>
        </div>
        {show && <div style={{ fontSize: 11, color: T.soft, marginTop: 6, lineHeight: 1.5 }}>{a.prompt}</div>}
      </div>
    </div>
  );
}

/* ================= ASSET LIBRARY (below the divider) ================= */
function Library({ onCost }) {
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
      await api(`/assets/${id}/${kind}`, { method: "POST" });
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
        sub="Every generated asset, priced. The system never pays twice for the same prompt — repeats are served from cache at $0.00. This shelf survives every redeploy on a mounted volume."
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        {statCards.map((s) => (
          <Card key={s.l} style={{ padding: "18px 22px" }}>
            <Label>{s.l.toUpperCase()}</Label>
            <div style={{ fontFamily: T.serif, fontSize: 40, marginTop: 6, color: s.c || T.ink }}>{s.v}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "18px 0" }}>
        {chip(brand === "", () => setBrand(""), "All brands")}
        {chip(brand === "hills", () => setBrand("hills"), "Hill's")}
        {chip(brand === "palmolive", () => setBrand("palmolive"), "Palmolive")}
        <span style={{ width: 1, background: T.line, margin: "0 4px" }} />
        {["", "/product-shoot", "/amazon", "/meta", "/bundle"].map((sk) =>
          chip(skill === sk, () => setSkill(sk), sk || "All skills")
        )}
        <span style={{ width: 1, background: T.line, margin: "0 4px" }} />
        {chip(cacheOnly, () => setCacheOnly((c) => !c), "Cache hits")}
      </div>

      {assets.length === 0 ? (
        <Empty label="No assets yet — run the creative agent (step 06) to fill the shelf." />
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
                  {a.run_id ? `run ${String(a.run_id).padStart(3, "0")}` : "library"} · {a.skill || "—"} · {a.brand || "—"}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button onClick={() => act(a.id, "reuse")} disabled={busy === a.id} style={miniBtn(false)}>
                    Reuse
                  </button>
                  <button onClick={() => act(a.id, "variant")} disabled={busy === a.id} style={miniBtn(true)}>
                    {busy === a.id ? "…" : "Variant"}
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
