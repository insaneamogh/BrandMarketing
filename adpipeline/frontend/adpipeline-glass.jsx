import { useState, useEffect } from "react";

// ============================================================
// AdPipeline — frosted glass edition.
// White-first (~70%): translucent blurred white cards on a soft
// light field. Navy #0B1D33 = text + one solid panel. Blue
// #1F75FE = actions and active states only (~30% together).
// Red / green appear ONLY as loss/danger vs profit/health.
// Type: Instrument Serif / Instrument Sans / Geist Mono
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

export default function AdPipeline() {
  const [view, setView] = useState("overview");

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Instrument+Sans:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap";
    document.head.appendChild(link);
  }, []);

  const idx = FLOW.findIndex((f) => f.key === view);
  const next = FLOW[idx + 1];

  return (
    <div style={{ minHeight: "100vh", background: "#F3F5F9", color: T.ink, fontFamily: T.sans, position: "relative", overflow: "hidden" }}>
      {/* soft field the glass blurs against */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        <div style={{ position: "absolute", top: -180, right: -120, width: 640, height: 640, borderRadius: "50%", background: "radial-gradient(circle, rgba(31,117,254,0.16), transparent 65%)" }} />
        <div style={{ position: "absolute", bottom: -220, left: 180, width: 720, height: 720, borderRadius: "50%", background: "radial-gradient(circle, rgba(11,29,51,0.10), transparent 65%)" }} />
        <div style={{ position: "absolute", top: 260, left: -160, width: 420, height: 420, borderRadius: "50%", background: "radial-gradient(circle, rgba(31,117,254,0.08), transparent 60%)" }} />
      </div>

      <div style={{ display: "flex", position: "relative", zIndex: 1, minHeight: "100vh" }}>
        {/* ================= SIDEBAR ================= */}
        <aside style={{ ...glass, width: 258, flexShrink: 0, margin: 16, marginRight: 0, padding: "30px 16px 24px", display: "flex", flexDirection: "column", borderRadius: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 8px" }}>
            <span style={{ width: 30, height: 30, borderRadius: 9, background: T.blue, display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: T.serif, fontSize: 19 }}>A</span>
            <div>
              <div style={{ fontFamily: T.serif, fontSize: 22, letterSpacing: "-0.3px", lineHeight: 1 }}>AdPipeline</div>
              <div style={{ fontFamily: T.mono, fontSize: 9.5, color: T.faint, marginTop: 3, letterSpacing: 0.5 }}>COLGATE-PALMOLIVE · POC</div>
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
                    display: "flex", gap: 12, width: "100%", textAlign: "left", alignItems: "center",
                    padding: "11px 12px", marginBottom: 3, borderRadius: 12, border: "none", cursor: "pointer",
                    fontFamily: T.sans,
                    background: active ? "rgba(255,255,255,0.9)" : "transparent",
                    boxShadow: active ? "0 4px 14px rgba(11,29,51,0.08)" : "none",
                  }}
                >
                  <span style={{
                    fontFamily: T.mono, fontSize: 11, width: 25, height: 25, borderRadius: 8, flexShrink: 0,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    background: active ? T.blue : "transparent",
                    border: active ? "none" : `1.5px solid ${done ? T.faint : T.line}`,
                    color: active ? "#fff" : done ? T.soft : T.faint,
                  }}>
                    {done ? "✓" : n.step}
                  </span>
                  <span>
                    <div style={{ fontSize: 14.5, fontWeight: active ? 700 : 500, color: active ? T.blue : T.ink }}>{n.label}</div>
                    <div style={{ fontSize: 11.5, color: T.faint, marginTop: 1 }}>{n.sub}</div>
                  </span>
                </button>
              );
            })}
          </nav>

          {/* the one solid-navy moment */}
          <div style={{ marginTop: "auto", background: T.ink, borderRadius: 16, padding: "18px 18px", color: "#fff" }}>
            <div style={{ fontFamily: T.mono, fontSize: 10, opacity: 0.65, letterSpacing: 1 }}>RUN-014 · LIVE COST</div>
            <div style={{ fontFamily: T.serif, fontSize: 32, marginTop: 6 }}>$0.41</div>
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>11 model calls · 4 images · 9 docs</div>
          </div>
        </aside>

        {/* ================= MAIN ================= */}
        <main style={{ flex: 1, overflowY: "auto" }}>
          <div style={{ maxWidth: 1140, margin: "0 auto", padding: "40px 44px 72px" }}>
            <TopBar view={view} go={setView} />
            {view === "overview" && <Overview go={setView} />}
            {view === "strategist" && <Strategist />}
            {view === "sales" && <SalesAnalyst />}
            {view === "monitor" && <Monitor />}
            {view === "gate" && <Gate />}
            {view === "creative" && <Creative />}
            {next && (
              <button onClick={() => setView(next.key)} style={{
                marginTop: 40, width: "100%", padding: "20px 28px", borderRadius: 18, border: "none", cursor: "pointer",
                background: T.blue, color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between",
                fontFamily: T.sans, boxShadow: "0 12px 30px rgba(31,117,254,0.30)",
              }}>
                <span style={{ textAlign: "left" }}>
                  <span style={{ fontFamily: T.mono, fontSize: 11, opacity: 0.85, letterSpacing: 1 }}>NEXT · STEP {next.step}</span>
                  <span style={{ display: "block", fontFamily: T.serif, fontSize: 24, marginTop: 3 }}>{next.label} — {next.sub.toLowerCase()}</span>
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

/* ---------- shared ---------- */

function TopBar({ view, go }) {
  const idx = FLOW.findIndex((f) => f.key === view);
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: 32, flexWrap: "wrap", gap: 4 }}>
      {FLOW.map((s, i) => (
        <div key={s.key} style={{ display: "flex", alignItems: "center" }}>
          <button onClick={() => go(s.key)} style={{
            border: "none", background: "none", cursor: "pointer", fontFamily: T.mono, fontSize: 11.5,
            color: i === idx ? T.blue : i < idx ? T.body : T.faint, fontWeight: i === idx ? 600 : 400, padding: "2px 4px",
          }}>
            {s.label}
          </button>
          {i < FLOW.length - 1 && <span style={{ color: T.faint, margin: "0 7px", opacity: 0.5 }}>·</span>}
        </div>
      ))}
      <span style={{ marginLeft: "auto", fontFamily: T.mono, fontSize: 11.5, color: T.soft }}>
        Hill's Youthful Vitality · APAC · Run 014
      </span>
    </div>
  );
}

function PageTitle({ eyebrow, title, sub, right }) {
  return (
    <header style={{ marginBottom: 32, display: "flex", alignItems: "flex-end", gap: 30 }}>
      <div style={{ flex: 1 }}>
        <span style={{ fontFamily: T.mono, fontSize: 11.5, color: T.blue, letterSpacing: 1.5, fontWeight: 600, textTransform: "uppercase" }}>{eyebrow}</span>
        <h1 style={{ fontFamily: T.serif, fontSize: 54, fontWeight: 400, letterSpacing: "-1px", margin: "10px 0 0", lineHeight: 1.04 }}>{title}</h1>
        {sub && <p style={{ fontSize: 16, color: T.soft, marginTop: 12, maxWidth: 660, lineHeight: 1.6, fontWeight: 500 }}>{sub}</p>}
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
    <span style={{ fontFamily: T.mono, fontSize: 10.5, color: T.blue, background: T.blueSoft, padding: "3px 9px", borderRadius: 7 }}>
      {src}
    </span>
  );
}

function Label({ children, color }) {
  return <div style={{ fontFamily: T.mono, fontSize: 10.5, color: color || T.faint, letterSpacing: 1, fontWeight: 500 }}>{children}</div>;
}

function Pill({ children, color, bg }) {
  return (
    <span style={{ fontFamily: T.mono, fontSize: 11.5, fontWeight: 600, color, background: bg, padding: "4px 10px", borderRadius: 99 }}>
      {children}
    </span>
  );
}

function Btn({ children, kind = "primary", small }) {
  const s = {
    primary: { background: T.blue, color: "#fff", border: "none", boxShadow: "0 6px 18px rgba(31,117,254,0.28)" },
    approve: { background: T.green, color: "#fff", border: "none", boxShadow: "0 6px 18px rgba(23,138,80,0.25)" },
    ghost: { background: "rgba(255,255,255,0.7)", color: T.ink, border: `1px solid ${T.line}` },
    danger: { background: "rgba(255,255,255,0.6)", color: T.red, border: `1.5px solid rgba(217,54,54,0.5)` },
  }[kind];
  return (
    <button style={{ ...s, padding: small ? "10px 18px" : "13px 26px", borderRadius: 12, fontFamily: T.sans, fontWeight: 700, fontSize: small ? 13 : 14.5, cursor: "pointer" }}>
      {children}
    </button>
  );
}

/* ================= 01 OVERVIEW ================= */
function Overview({ go }) {
  const agents = [
    { key: "strategist", n: "AGT-1", name: "Marketing Strategist", model: "gpt-4o", does: "Proposes cited campaign angles from market intel and brand guidelines.", status: "3 angles ready", sc: T.soft, kpi: "3", kl: "strategies", kc: T.ink },
    { key: "sales", n: "AGT-2", name: "Sales & Distribution Analyst", model: "gpt-4o", does: "Maps where products sell and lag — CPL, CVR and stock truth per channel.", status: "APAC flag raised", sc: T.red, kpi: "−18%", kl: "APAC vs plan", kc: T.red },
    { key: "monitor", n: "AGT-3", name: "Performance Monitor", model: "gpt-4o-mini · hourly", does: "Watches every live campaign, raises alerts, recommends scale and kill.", status: "1 critical alert", sc: T.red, kpi: "0.3×", kl: "worst ROAS", kc: T.red },
    { key: "creative", n: "AGT-4", name: "Creative Agent", model: "gpt-4o + gpt-image-1", does: "Diagnoses a product URL, generates asset sets, plans placements.", status: "Awaiting approval", sc: T.amber, kpi: "4", kl: "skills loaded", kc: T.ink },
  ];
  const runs = [
    { id: "RUN-014", what: "Hill's Youthful Vitality · APAC screening", state: "At approval gate", c: T.amber },
    { id: "RUN-013", what: "Palmolive Luminous Oils · /meta bundle", state: "Shipped · 6 assets", c: T.green },
    { id: "RUN-012", what: "Hill's Metabolic + j/d · /amazon set", state: "Shipped · 4 assets", c: T.green },
    { id: "RUN-011", what: "Luminous Oils · LatAm screening", state: "Rejected — re-ran with feedback", c: T.red },
  ];
  return (
    <div>
      <PageTitle
        eyebrow="Step 01 · System overview"
        title={<>Four agents. <em style={{ color: T.blue }}>One decision.</em></>}
        sub="Three analysts screen the market from grounded internal data. You approve once at step 05. The creative agent executes, and its results feed the monitor — the loop closes."
      />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {agents.map((a) => (
          <Card key={a.n} style={{ cursor: "pointer" }}>
            <div onClick={() => go(a.key)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Label>{a.n} · {a.model.toUpperCase()}</Label>
                <span style={{ fontFamily: T.mono, fontSize: 11, color: a.sc, fontWeight: 600 }}>● {a.status}</span>
              </div>
              <h3 style={{ fontFamily: T.serif, fontSize: 27, fontWeight: 400, margin: "12px 0 0" }}>{a.name}</h3>
              <p style={{ fontSize: 13.5, color: T.soft, lineHeight: 1.6, marginTop: 8 }}>{a.does}</p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.line}` }}>
                <span style={{ fontFamily: T.serif, fontSize: 32, color: a.kc }}>{a.kpi}</span>
                <span style={{ fontSize: 12.5, color: T.faint }}>{a.kl}</span>
                <span style={{ marginLeft: "auto", fontSize: 13.5, fontWeight: 700, color: T.blue }}>Open →</span>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16, marginTop: 16 }}>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "15px 22px", borderBottom: `1px solid ${T.line}` }}><Label>RECENT RUNS</Label></div>
          {runs.map((r) => (
            <div key={r.id} style={{ display: "flex", gap: 16, padding: "13px 22px", borderBottom: `1px solid ${T.line}`, alignItems: "baseline" }}>
              <span style={{ fontFamily: T.mono, fontSize: 12, color: T.faint, minWidth: 68 }}>{r.id}</span>
              <span style={{ fontSize: 13.5, fontWeight: 600, flex: 1 }}>{r.what}</span>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: r.c }}>{r.state}</span>
            </div>
          ))}
        </Card>
        <Card>
          <Label>KNOWLEDGE BASE</Label>
          <div style={{ fontFamily: T.serif, fontSize: 36, marginTop: 8 }}>9 <span style={{ fontSize: 19, color: T.soft }}>docs</span> · 142 <span style={{ fontSize: 19, color: T.soft }}>chunks</span></div>
          <p style={{ fontSize: 13, color: T.soft, lineHeight: 1.65, marginTop: 10 }}>
            Sales data, channel metrics, distributor notes, brand guidelines. Analysts answer only from here —
            <strong style={{ color: T.ink }}> no citation, no claim.</strong>
          </p>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 12 }}>
            <Cite src="hills_regional_sales.md" /><Cite src="channel_metrics.md" />
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ================= 02 STRATEGIST ================= */
function Strategist() {
  const strategies = [
    { angle: "Seven is a life stage, not a decline", insight: "APAC pet humanization is early-stage; owners respond to vet-science education, not premium lifestyle imagery.", segment: "First-time senior-dog owners, tier-1 cities, 28–45", channel: "Meta India · vet-content video", conf: "High", srcs: ["hills_regional_sales.md", "competitor_snapshot.md"], top: true },
    { angle: "The vet already trusts it", insight: "Vet-referral conversion runs 4× paid social; credibility transfer is the cheapest trust available.", segment: "Owners researching post vet visit", channel: "Search + Amazon PDP", conf: "High", srcs: ["channel_metrics.md"] },
    { angle: "Energy you can see in two weeks", insight: "Before-after UGC is the portfolio's best performer at 5.5× ROAS — lean into visible outcomes.", segment: "Mass-brand buyers ready to trade up", channel: "Reels · UGC creators", conf: "Medium", srcs: ["campaign_history.md"] },
  ];
  return (
    <div>
      <PageTitle
        eyebrow="Step 02 · Agent 1 — Marketing Strategist"
        title="Three angles, all cited"
        sub="Grounded in market intel and brand guidelines. Approve at step 05 and the chosen angle briefs the creative agent."
        right={<Btn kind="ghost" small>Re-run with feedback</Btn>}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {strategies.map((s, i) => (
          <Card key={i} style={{ display: "grid", gridTemplateColumns: "52px 1.5fr 1fr", gap: 24, alignItems: "center" }}>
            <div style={{ fontFamily: T.serif, fontSize: 42, color: s.top ? T.blue : T.faint, opacity: s.top ? 1 : 0.4 }}>{i + 1}</div>
            <div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <h3 style={{ fontFamily: T.serif, fontSize: 28, fontWeight: 400, fontStyle: "italic", margin: 0, lineHeight: 1.15 }}>“{s.angle}”</h3>
                {s.top && <Pill color={T.blue} bg={T.blueSoft}>RECOMMENDED</Pill>}
              </div>
              <p style={{ fontSize: 14, color: T.body, lineHeight: 1.6, marginTop: 8, fontWeight: 500 }}>{s.insight}</p>
              <div style={{ display: "flex", gap: 7, marginTop: 10, flexWrap: "wrap" }}>{s.srcs.map((x) => <Cite key={x} src={x} />)}</div>
            </div>
            <div style={{ borderLeft: `1px solid ${T.line}`, paddingLeft: 24, display: "flex", flexDirection: "column", gap: 12 }}>
              <div><Label>SEGMENT</Label><div style={{ fontSize: 14, marginTop: 4, fontWeight: 600 }}>{s.segment}</div></div>
              <div><Label>CHANNEL</Label><div style={{ fontSize: 14, marginTop: 4, fontWeight: 700, color: T.blue }}>{s.channel}</div></div>
              <div><Label>CONFIDENCE</Label><div style={{ fontSize: 14, marginTop: 4, fontWeight: 700, color: s.conf === "High" ? T.green : T.amber }}>{s.conf}</div></div>
            </div>
          </Card>
        ))}
      </div>
      <Card style={{ marginTop: 14, display: "flex", gap: 16, alignItems: "center", background: "rgba(255,255,255,0.45)" }}>
        <span style={{ fontFamily: T.serif, fontSize: 21, flexShrink: 0 }}>Agent note</span>
        <p style={{ fontSize: 13.5, color: T.body, margin: 0, lineHeight: 1.6, fontWeight: 500 }}>
          Angle 1 recommended: strongest source support and lowest-CPL channel. A "premium lifestyle" angle was considered
          and dropped — contradicted by <span style={{ fontFamily: T.mono, fontSize: 12, color: T.blue }}>hills_regional_sales.md</span> on APAC buyer maturity.
        </p>
      </Card>
    </div>
  );
}

/* ================= 03 SALES ANALYST ================= */
function SalesAnalyst() {
  const regions = [
    { r: "North America", status: "Strong", note: "Vet + specialty anchor · 6–7% organic growth", c: T.green, bg: T.greenSoft },
    { r: "Europe", status: "Strong", note: "Stable specialty distribution", c: T.green, bg: T.greenSoft },
    { r: "APAC", status: "Lagging −18%", note: "Fractured channels · 31% dark-store OOS", c: T.red, bg: T.redSoft },
    { r: "Latin America", status: "Early", note: "Premium pet spend nascent · q-commerce rising", c: T.amber, bg: "rgba(192,138,30,0.10)" },
  ];
  const cpl = [
    { ch: "Meta · India", v: 3.1 }, { ch: "Amazon Sponsored", v: 4.8 }, { ch: "Google Search", v: 6.2 }, { ch: "Meta · NA", v: 8.4 },
  ];
  const cvr = [
    { ch: "Vet referral", v: "5.6%", best: true }, { ch: "Amazon PDP", v: "2.1%" }, { ch: "Meta paid social", v: "1.4%" }, { ch: "Q-commerce listing", v: "1.1%" },
  ];
  const oos = [
    { z: "Bengaluru · Blinkit", v: "34%" }, { z: "Mumbai · Zepto", v: "31%" }, { z: "Delhi NCR · Instamart", v: "27%" },
  ];
  return (
    <div>
      <PageTitle
        eyebrow="Step 03 · Agent 2 — Sales & Distribution Analyst"
        title="Where it sells, where it lags"
        sub="Region and channel truth from internal sales and distributor data — the ground every other agent stands on."
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        {regions.map((x) => (
          <Card key={x.r} style={{ padding: "18px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <h3 style={{ fontFamily: T.serif, fontSize: 21, fontWeight: 400, margin: 0 }}>{x.r}</h3>
            </div>
            <div style={{ marginTop: 10 }}><Pill color={x.c} bg={x.bg}>{x.status}</Pill></div>
            <p style={{ fontSize: 12.5, color: T.soft, marginTop: 10, lineHeight: 1.55 }}>{x.note}</p>
          </Card>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginTop: 14 }}>
        <Card>
          <Label>COST PER LEAD (USD)</Label>
          <div style={{ marginTop: 16 }}>
            {cpl.map((c) => (
              <div key={c.ch} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6, fontWeight: 600 }}>
                  <span>{c.ch}</span>
                  <span style={{ fontFamily: T.mono, color: c.v < 4 ? T.green : T.body }}>${c.v.toFixed(2)}</span>
                </div>
                <div style={{ height: 6, background: "rgba(11,29,51,0.08)", borderRadius: 99 }}>
                  <div style={{ width: `${(c.v / 10) * 100}%`, height: "100%", borderRadius: 99, background: c.v < 4 ? T.green : T.faint }} />
                </div>
              </div>
            ))}
          </div>
          <Cite src="channel_metrics.md" />
        </Card>
        <Card>
          <Label>CONVERSION BY CHANNEL</Label>
          <div style={{ marginTop: 8 }}>
            {cvr.map((c) => (
              <div key={c.ch} style={{ display: "flex", justifyContent: "space-between", padding: "11px 0", borderBottom: `1px solid ${T.line}`, alignItems: "baseline" }}>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>{c.ch}</span>
                <span style={{ fontFamily: T.serif, fontSize: 20, color: c.best ? T.green : T.ink }}>{c.v}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12.5, color: T.soft, marginTop: 10, lineHeight: 1.55 }}>Vet referral converts <strong style={{ color: T.ink }}>4× paid social</strong>.</div>
        </Card>
        <Card>
          <Label color={T.red}>STOCK RISK · Q-COMMERCE OOS</Label>
          <div style={{ marginTop: 8 }}>
            {oos.map((o) => (
              <div key={o.z} style={{ display: "flex", justifyContent: "space-between", padding: "11px 0", borderBottom: `1px solid ${T.line}` }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{o.z}</span>
                <span style={{ fontFamily: T.mono, fontSize: 14.5, color: T.red, fontWeight: 600 }}>{o.v}</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12.5, color: T.body, marginTop: 10, lineHeight: 1.55, fontWeight: 500 }}>
            Ads before availability is money burned — sponsored placements pause automatically in flagged zones.
          </p>
        </Card>
      </div>

      <Card style={{ marginTop: 14, display: "flex", gap: 26, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontFamily: T.serif, fontSize: 52, color: T.green, lineHeight: 1 }}>$3.10</div>
        <p style={{ fontFamily: T.serif, fontSize: 22, lineHeight: 1.4, margin: 0, flex: 1, minWidth: 300 }}>
          India is the portfolio's cheapest qualified reach — <em style={{ color: T.green }}>62% below</em> the North-America CPL.
          Fix the flagged pincodes, then scale spend there first.
        </p>
      </Card>
    </div>
  );
}

/* ================= 04 MONITOR ================= */
function Monitor() {
  const stats = [
    { l: "Active campaigns", v: "6" }, { l: "Blended ROAS", v: "2.8×", c: T.green }, { l: "Spend this week", v: "$24.0k" }, { l: "Open alerts", v: "1", c: T.red },
  ];
  const campaigns = [
    { n: "YV | Before-after energy | UGC", roas: 5.5, ctr: 2.3, trend: [3.9, 4.4, 5.0, 5.5], state: "Scale" },
    { n: "YV | Senior reframe | Video", roas: 3.6, ctr: 1.9, trend: [3.1, 3.3, 3.5, 3.6], state: "Healthy" },
    { n: "YV | Vet trust | Static", roas: 1.7, ctr: 1.2, trend: [2.4, 2.1, 1.9, 1.7], state: "Watch" },
    { n: "LO | Glow testimonial | UGC", roas: 1.6, ctr: 2.0, trend: [1.5, 1.7, 1.6, 1.6], state: "Watch" },
    { n: "LO | Oil science | Static", roas: 0.3, ctr: 1.0, trend: [1.1, 0.8, 0.5, 0.3], state: "Kill" },
  ];
  const stateColor = { Scale: T.green, Healthy: T.soft, Watch: T.amber, Kill: T.red };
  const feed = [
    { t: "09:00", e: "Daily digest sent — Slack #growth-apac" },
    { t: "08:00", e: "ROAS floor breach 14d · LO Oil science → CRITICAL" },
    { t: "07:00", e: "Fatigue watch: YV Vet trust CTR −18% over 7d" },
    { t: "06:00", e: "Metrics pull OK · 6 campaigns · 4 platforms" },
  ];
  return (
    <div>
      <PageTitle
        eyebrow="Step 04 · Agent 3 — Performance Monitor"
        title="Campaign health, hourly"
        sub="Metrics computed in code — never by the model. The agent narrates, flags breaches, and routes alerts to Slack and email."
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        {stats.map((s) => (
          <Card key={s.l} style={{ padding: "18px 22px" }}>
            <Label>{s.l.toUpperCase()}</Label>
            <div style={{ fontFamily: T.serif, fontSize: 40, marginTop: 6, color: s.c || T.ink }}>{s.v}</div>
          </Card>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.9fr 1fr", gap: 14, marginTop: 14 }}>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
            <thead><tr style={{ textAlign: "left" }}>
              {["Campaign", "ROAS", "Trend", "CTR", "Action"].map((h) => (
                <th key={h} style={{ padding: "13px 20px", fontFamily: T.mono, fontSize: 10.5, color: T.faint, fontWeight: 500, borderBottom: `1px solid ${T.line}` }}>{h.toUpperCase()}</th>
              ))}
            </tr></thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.n}>
                  <td style={{ padding: "13px 20px", borderBottom: `1px solid ${T.line}`, fontWeight: 600, fontSize: 13 }}>{c.n}</td>
                  <td style={{ padding: "13px 20px", borderBottom: `1px solid ${T.line}`, fontFamily: T.serif, fontSize: 19, color: c.roas >= 3 ? T.green : c.roas >= 1.5 ? T.ink : T.red }}>{c.roas.toFixed(1)}×</td>
                  <td style={{ padding: "13px 20px", borderBottom: `1px solid ${T.line}` }}>
                    <span style={{ display: "inline-flex", gap: 3, alignItems: "flex-end", height: 20 }}>
                      {c.trend.map((v, i) => (
                        <span key={i} style={{ width: 5, height: `${(v / 6) * 20}px`, borderRadius: 2, background: c.trend[3] >= c.trend[0] ? T.green : T.red, opacity: 0.35 + i * 0.2 }} />
                      ))}
                    </span>
                  </td>
                  <td style={{ padding: "13px 20px", borderBottom: `1px solid ${T.line}`, fontFamily: T.mono, color: T.soft, fontSize: 12.5 }}>{c.ctr.toFixed(1)}%</td>
                  <td style={{ padding: "13px 20px", borderBottom: `1px solid ${T.line}` }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: stateColor[c.state] }}>{c.state.toUpperCase()}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "13px 20px", borderBottom: `1px solid ${T.line}` }}><Label>AGENT ACTIVITY · TODAY</Label></div>
          {feed.map((f) => (
            <div key={f.t} style={{ display: "flex", gap: 13, padding: "12px 20px", borderBottom: `1px solid ${T.line}` }}>
              <span style={{ fontFamily: T.mono, fontSize: 11.5, color: T.faint, flexShrink: 0 }}>{f.t}</span>
              <span style={{ fontSize: 12.5, lineHeight: 1.5, fontWeight: 500, color: T.body }}>{f.e}</span>
            </div>
          ))}
        </Card>
      </div>

      <Card style={{ marginTop: 14, display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap", background: "rgba(255,255,255,0.75)" }}>
        <div style={{ flex: "1 1 420px" }}>
          <Pill color={T.red} bg={T.redSoft}>ALERT · CRITICAL · 08:00</Pill>
          <div style={{ fontFamily: T.serif, fontSize: 25, marginTop: 12, lineHeight: 1.25 }}>
            LO | Oil science | Static — ROAS <span style={{ color: T.red }}>0.3×</span>, fourteen days under floor.
          </div>
          <div style={{ fontSize: 13.5, color: T.body, marginTop: 8, fontWeight: 500 }}>
            Recommendation: kill and reallocate $3.3k to the UGC campaign. <Cite src="campaign_history.md" />
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Btn small>Send to Slack</Btn>
          <Btn small kind="ghost">Email digest</Btn>
        </div>
      </Card>
    </div>
  );
}

/* ================= 05 APPROVAL GATE ================= */
function Gate() {
  const inputs = [
    { a: "Strategist", says: "Lead with vet-science education angle on Meta India." },
    { a: "Sales Analyst", says: "APAC −18%; India CPL $3.10 is the cheapest reach. Fix OOS pincodes first." },
    { a: "Monitor", says: "Kill LO Oil science (0.3×), free $3.3k for reallocation." },
  ];
  return (
    <div>
      <PageTitle
        eyebrow="Step 05 · Human in the loop"
        title={<>The <em style={{ color: T.blue }}>one</em> decision</>}
        sub="Three agents screened the market. Approve to hand this brief to the creative agent. Reject with feedback and the screening re-runs — your feedback goes into their prompts."
      />
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        <Card style={{ padding: 36 }}>
          <Label>BRIEF-014 · COMBINED FINDINGS · AWAITING DECISION</Label>
          <p style={{ fontFamily: T.serif, fontSize: 31, lineHeight: 1.35, marginTop: 16 }}>
            Shift Q3 emphasis to Hill's Youthful Vitality in APAC tier-1: vet-science education angle,
            Meta India and Amazon as primary channels, funded by killing the Palmolive static campaign
            <em style={{ color: T.red }}> (ROAS 0.3×)</em>. Projected blended ROAS <em style={{ color: T.green }}>3.2×</em>.
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 20, flexWrap: "wrap" }}>
            <Cite src="hills_regional_sales.md" /><Cite src="channel_metrics.md" /><Cite src="campaign_history.md" /><Cite src="distributor_notes_apac.md" />
          </div>
          <div style={{ display: "flex", gap: 14, marginTop: 28, alignItems: "center", flexWrap: "wrap" }}>
            <Btn kind="approve">Approve — run creative agent</Btn>
            <Btn kind="danger">Reject with feedback</Btn>
          </div>
        </Card>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {inputs.map((x) => (
            <Card key={x.a} style={{ padding: "16px 20px" }}>
              <Label>{x.a.toUpperCase()} SAYS</Label>
              <p style={{ fontSize: 13.5, lineHeight: 1.6, marginTop: 7, fontWeight: 600, color: T.body }}>{x.says}</p>
            </Card>
          ))}
          <Card style={{ padding: "16px 20px", background: "rgba(255,255,255,0.45)" }}>
            <Label>LAST REJECTION · RUN-011</Label>
            <p style={{ fontSize: 12.5, lineHeight: 1.6, marginTop: 7, color: T.soft, fontWeight: 500 }}>
              "Too NA-centric — redo for APAC tier-1." Feedback was injected; RUN-012 shifted regional weighting.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ================= 06 CREATIVE STUDIO ================= */
function Creative() {
  const skills = [
    { cmd: "/product-shoot", d: "4 hero images — packshot, macro, lifestyle, flat-lay" },
    { cmd: "/amazon", d: "Listing-compliant set + A+ content blocks", active: true },
    { cmd: "/meta", d: "4:5 feed + 9:16 story with hook overlays" },
    { cmd: "/bundle", d: "All sets + 6-frame video storyboard" },
  ];
  const assets = [
    { label: "Main image · white bg", note: "85% frame · no text", grad: ["#F3F0E9", "#D5CFC1"] },
    { label: "Lifestyle · senior dog", note: "Golden hour · kitchen", grad: ["#D9924C", "#9A6323"] },
    { label: "Lifestyle · owner bond", note: "Editorial daylight", grad: ["#9BB3A3", "#5F7C6A"] },
    { label: "Benefits infographic", note: "3 cited claims", grad: ["#7FA8F2", "#3E70D0"] },
  ];
  const copy = [
    { k: "HOOK", v: "\u201cSeven isn't old. It's halftime.\u201d" },
    { k: "HEADLINE", v: "Science-backed vitality for dogs 7+" },
    { k: "PRIMARY TEXT", v: "Visible energy, sharper play, healthier coat — nutrition built by vets for the second half." },
  ];
  const placements = [
    { a: "Main image", w: "Amazon PDP", s: "—", why: "Listing compliance · CVR 2.1%" },
    { a: "Lifestyle set", w: "Meta feed 4:5 · India", s: "40%", why: "CPL $3.10 · cheapest reach" },
    { a: "Infographic", w: "Amazon A+ / Sponsored", s: "35%", why: "Category CVR uplift" },
    { a: "Storyboard → video", w: "Reels 9:16", s: "25%", why: "UGC angle at 5.5× ROAS" },
  ];
  return (
    <div>
      <PageTitle
        eyebrow="Step 06 · Agent 4 — Creative Agent"
        title="Creative studio"
        sub="The approved brief is live context. Paste a product URL, pick a skill — the agent diagnoses the product, generates under brand guardrails, then plans placements."
      />
      <Card style={{ display: "flex", gap: 14, alignItems: "center", padding: "16px 24px", flexWrap: "wrap" }}>
        <Pill color={T.green} bg={T.greenSoft}>BRIEF-014 APPROVED ✓</Pill>
        <span style={{ fontFamily: T.mono, fontSize: 14, color: T.blue, fontWeight: 600 }}>/amazon</span>
        <span style={{ flex: "1 1 300px", fontFamily: T.mono, fontSize: 12.5, color: T.soft, background: "rgba(255,255,255,0.8)", border: `1px solid ${T.line}`, borderRadius: 11, padding: "11px 15px" }}>
          hillspet.com/dog-food/sd-canine-adult-7-plus-youthful-vitality
        </span>
        <Btn>Generate set</Btn>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 14 }}>
        {skills.map((s) => (
          <div key={s.cmd} style={{
            ...glass, borderRadius: 14, padding: "15px 17px",
            border: s.active ? `1.5px solid ${T.blueBorder}` : glass.border,
            background: s.active ? "rgba(31,117,254,0.08)" : glass.background,
          }}>
            <div style={{ fontFamily: T.mono, fontSize: 13.5, fontWeight: 600, color: s.active ? T.blue : T.ink }}>{s.cmd}</div>
            <div style={{ fontSize: 12, color: T.soft, marginTop: 6, lineHeight: 1.5, fontWeight: 500 }}>{s.d}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2.1fr", gap: 14, marginTop: 14 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Card>
            <Label>URL DIAGNOSIS</Label>
            <h3 style={{ fontFamily: T.serif, fontSize: 22, fontWeight: 400, marginTop: 10, lineHeight: 1.25 }}>Science Diet Adult 7+ Youthful Vitality</h3>
            {[["Category", "Senior dog nutrition"], ["Price tier", "Premium"], ["Key claims", "Brain · energy · coat"], ["Brand colors", "Amber · cream · navy"]].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: `1px solid ${T.line}`, gap: 8 }}>
                <span style={{ fontFamily: T.mono, fontSize: 10.5, color: T.faint }}>{k.toUpperCase()}</span>
                <span style={{ fontSize: 13, fontWeight: 600, textAlign: "right" }}>{v}</span>
              </div>
            ))}
          </Card>
          <Card>
            <Pill color={T.red} bg={T.redSoft}>GUARDRAILS ACTIVE</Pill>
            <p style={{ fontSize: 13, lineHeight: 1.65, marginTop: 10, fontWeight: 600 }}>
              No disease-cure claims · no "reverses aging" · no implied vet endorsement without substantiation.
            </p>
            <div style={{ marginTop: 8 }}><Cite src="brand_guidelines_hills.md" /></div>
          </Card>
        </div>

        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {assets.map((a) => (
              <div key={a.label} style={{ ...glass, borderRadius: 14, overflow: "hidden", padding: 0 }}>
                <div style={{ height: 124, background: `linear-gradient(140deg, ${a.grad[0]}, ${a.grad[1]})` }} />
                <div style={{ padding: "11px 15px", display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{a.label}</span>
                  <span style={{ fontFamily: T.mono, fontSize: 10, color: T.faint, textAlign: "right" }}>{a.note}</span>
                </div>
              </div>
            ))}
          </div>
          <Card style={{ marginTop: 12, display: "flex", gap: 24, flexWrap: "wrap" }}>
            {copy.map((c) => (
              <div key={c.k} style={{ flex: "1 1 190px" }}>
                <Label>{c.k}</Label>
                <div style={{ fontFamily: c.k === "HOOK" ? T.serif : T.sans, fontSize: c.k === "HOOK" ? 21 : 13.5, fontStyle: c.k === "HOOK" ? "italic" : "normal", fontWeight: c.k === "HOOK" ? 400 : 600, marginTop: 6, lineHeight: 1.4 }}>{c.v}</div>
              </div>
            ))}
          </Card>
        </div>
      </div>

      <Card style={{ marginTop: 14, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "15px 22px", borderBottom: `1px solid ${T.line}`, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <Label>PLACEMENT PLAN</Label>
          <Label color={T.green}>PROJECTIONS FEED AGENT 3 NEXT CYCLE — LOOP CLOSED</Label>
        </div>
        {placements.map((p) => (
          <div key={p.a} style={{ display: "flex", gap: 22, padding: "14px 22px", borderBottom: `1px solid ${T.line}`, fontSize: 14, alignItems: "baseline", flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, minWidth: 165 }}>{p.a}</span>
            <span style={{ color: T.body, minWidth: 200, fontWeight: 500 }}>{p.w}</span>
            <span style={{ fontFamily: T.serif, fontSize: 21, color: T.blue, minWidth: 56 }}>{p.s}</span>
            <span style={{ marginLeft: "auto", fontSize: 12.5, color: T.soft, fontWeight: 500 }}>{p.why}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}
