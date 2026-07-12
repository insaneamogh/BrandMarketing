import React, { useEffect, useState } from "react";

const INK = "#17181c";
const ULTRA = "#2440ff";
const PAPER = "#f4f5f7";
const CARD = "#ffffff";
const LINE = "#e3e5ea";
const MUTE = "#6b6f7a";

const PRODUCTS = [
  "Hill's Youthful Vitality",
  "Palmolive Luminous Oils",
];
const SKILLS = ["/product-shoot", "/amazon", "/meta", "/bundle"];
const DEFAULT_URL = {
  "Hill's Youthful Vitality": "https://www.hillspet.com/dog-food/sd-canine-youthful-vitality-adult-7-plus-chicken-rice-recipe-dry",
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

const STEPS = ["Screening", "Approval", "Creative", "Placement"];

export default function App() {
  const [step, setStep] = useState(0);
  const [product, setProduct] = useState(PRODUCTS[0]);
  const [objective, setObjective] = useState(
    "Grow senior-pet demand efficiently in NA/EU and test scalable channels"
  );
  const [run, setRun] = useState(null);
  const [brief, setBrief] = useState(null);
  const [decision, setDecision] = useState(null); // 'approve'|'reject'
  const [creative, setCreative] = useState(null);
  const [placement, setPlacement] = useState(null);
  const [cost, setCost] = useState(0);
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");

  const refreshCost = async () => {
    try {
      const c = await api("/cost");
      setCost(c.total_usd);
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
      setStep(1);
      refreshCost();
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading("");
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar step={step} setStep={setStep} cost={cost} run={run} />
      <main style={{ flex: 1, padding: "28px 40px", maxWidth: 1180 }}>
        <Header step={step} run={run} product={product} />
        {error && <Banner tone="err">{error}</Banner>}
        {loading && <Banner tone="load">{loading}</Banner>}

        {step === 0 && (
          <Screening
            product={product}
            setProduct={setProduct}
            objective={objective}
            setObjective={setObjective}
            run={run}
            onRun={doRun}
            loading={!!loading}
          />
        )}
        {step === 1 && (
          <Approval
            brief={brief}
            run={run}
            decision={decision}
            onDecision={async (action, feedback) => {
              setError("");
              try {
                await api(`/briefs/${brief.id}/decision`, {
                  method: "POST",
                  body: JSON.stringify({ action, feedback }),
                });
                setDecision(action);
                if (action === "approve") setStep(2);
              } catch (e) {
                setError(String(e.message || e));
              }
            }}
            onRerun={doRun}
            loading={!!loading}
          />
        )}
        {step === 2 && (
          <CreativeView
            product={product}
            brief={brief}
            creative={creative}
            onGenerate={async (url, skill) => {
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
            }}
            onNext={() => setStep(3)}
            loading={!!loading}
          />
        )}
        {step === 3 && (
          <PlacementView
            creative={creative}
            placement={placement}
            onPlan={async () => {
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
            }}
            loading={!!loading}
          />
        )}
      </main>
    </div>
  );
}

function Sidebar({ step, setStep, cost, run }) {
  return (
    <aside
      style={{
        width: 240,
        background: INK,
        color: "#e9eaee",
        padding: "26px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div style={{ fontWeight: 800, fontSize: 20, letterSpacing: 0.5 }}>
        Ad<span style={{ color: ULTRA }}>Pipeline</span>
      </div>
      <div style={{ fontSize: 12, color: "#9a9ea9", marginBottom: 22 }}>
        4-agent autonomous marketing
      </div>
      {STEPS.map((s, i) => (
        <button
          key={s}
          onClick={() => (i <= (run ? 3 : 0) ? setStep(i) : null)}
          style={{
            textAlign: "left",
            background: i === step ? "#23252c" : "transparent",
            color: i === step ? "#fff" : "#b8bcc6",
            border: "none",
            borderLeft: `3px solid ${i === step ? ULTRA : "transparent"}`,
            padding: "10px 12px",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          <span style={{ color: MUTE, marginRight: 8 }}>0{i + 1}</span>
          {s}
        </button>
      ))}
      <div style={{ flex: 1 }} />
      <div
        style={{
          background: "#101116",
          border: `1px solid #2a2c34`,
          borderRadius: 8,
          padding: "12px 14px",
        }}
      >
        <div style={{ fontSize: 11, color: MUTE, textTransform: "uppercase" }}>
          Run cost
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, color: "#7CFFB2" }}>
          ${cost.toFixed(2)}
        </div>
        <div style={{ fontSize: 11, color: MUTE }}>logged from SQLite</div>
      </div>
    </aside>
  );
}

function Header({ step, run, product }) {
  const ticket = run ? `TCK-${String(run.run_id).padStart(4, "0")}` : "TCK-—";
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        marginBottom: 18,
      }}
    >
      <div>
        <div style={{ fontSize: 12, color: MUTE, letterSpacing: 1 }}>
          {ticket} · {product}
        </div>
        <h1 style={{ margin: "4px 0 0", fontSize: 26 }}>{STEPS[step]}</h1>
      </div>
    </div>
  );
}

function Banner({ tone, children }) {
  const bg = tone === "err" ? "#fde8e8" : "#eef1ff";
  const fg = tone === "err" ? "#b3261e" : ULTRA;
  return (
    <div
      style={{
        background: bg,
        color: fg,
        padding: "10px 14px",
        borderRadius: 8,
        marginBottom: 14,
        fontSize: 14,
      }}
    >
      {children}
    </div>
  );
}

function Chip({ children }) {
  return (
    <span
      style={{
        display: "inline-block",
        background: "#eef1ff",
        color: ULTRA,
        border: `1px solid #d6ddff`,
        borderRadius: 20,
        padding: "2px 9px",
        fontSize: 11,
        margin: "2px 4px 2px 0",
        fontFamily: "ui-monospace, monospace",
      }}
    >
      {children}
    </span>
  );
}

function Card({ title, tag, children }) {
  return (
    <div
      style={{
        background: CARD,
        border: `1px solid ${LINE}`,
        borderRadius: 12,
        padding: 18,
        marginBottom: 16,
      }}
    >
      {title && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 15 }}>{title}</div>
          {tag && (
            <span style={{ fontSize: 11, color: MUTE, fontFamily: "monospace" }}>
              {tag}
            </span>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

// ---------------- View 1: Screening ----------------
function Screening({ product, setProduct, objective, setObjective, run, onRun, loading }) {
  return (
    <>
      <Card title="Brief inputs">
        <label style={lbl}>Product</label>
        <select style={inp} value={product} onChange={(e) => setProduct(e.target.value)}>
          {PRODUCTS.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <label style={lbl}>Objective</label>
        <textarea
          style={{ ...inp, height: 70 }}
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
        />
        <button style={btnPrimary} onClick={onRun} disabled={loading}>
          {loading ? "Running…" : "Run screening ▸"}
        </button>
      </Card>

      {run && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          <AgentCard title="① Strategist" tag="gpt-4o">
            {run.strategist.strategies.map((s, i) => (
              <div key={i} style={agentBlock}>
                <b>{s.angle}</b>
                <div style={sub}>{s.insight}</div>
                <div style={sub}>
                  🎯 {s.target_segment} · 📣 {s.recommended_channel}
                </div>
                <div>{s.sources.map((x) => <Chip key={x}>{x}</Chip>)}</div>
              </div>
            ))}
          </AgentCard>

          <AgentCard title="② Sales & Distribution" tag="gpt-4o">
            <div style={sub}><b>Lagging</b></div>
            {run.sales.lagging.map((l, i) => (
              <div key={i} style={agentBlock}>
                <b>{l.region}</b> — {l.reason}
                <div>{l.sources.map((x) => <Chip key={x}>{x}</Chip>)}</div>
              </div>
            ))}
            <div style={sub}><b>CPL / CVR</b></div>
            {run.sales.cpl_by_channel.slice(0, 3).map((m, i) => (
              <div key={i} style={sub}>
                CPL · {m.channel} ({m.region}): {m.value}
              </div>
            ))}
            {run.sales.cvr_by_channel.slice(0, 3).map((m, i) => (
              <div key={i} style={sub}>
                CVR · {m.channel} ({m.region}): {m.value}
              </div>
            ))}
            <div style={sub}><b>Risks:</b> {run.sales.key_risks.join("; ")}</div>
          </AgentCard>

          <AgentCard title="③ Performance Monitor" tag="gpt-4o-mini">
            <div style={sub}>{run.monitor.summary}</div>
            {run.monitor.alerts.map((a, i) => (
              <div key={i} style={agentBlock}>
                <span style={sevPill(a.severity)}>{a.severity}</span>{" "}
                <b>{a.campaign}</b>
                <div style={sub}>{a.reason}</div>
                <div style={sub}>→ {a.action}</div>
              </div>
            ))}
            <div style={{ ...sub, marginTop: 6 }}>
              <b>Scale:</b> {run.monitor.scale_recommendation}
            </div>
          </AgentCard>
        </div>
      )}
    </>
  );
}

function AgentCard({ title, tag, children }) {
  return (
    <div
      style={{
        background: CARD,
        border: `1px solid ${LINE}`,
        borderRadius: 12,
        padding: 16,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <b style={{ fontSize: 14 }}>{title}</b>
        <span style={{ fontSize: 11, color: MUTE, fontFamily: "monospace" }}>{tag}</span>
      </div>
      {children}
    </div>
  );
}

// ---------------- View 2: Approval ----------------
function Approval({ brief, run, decision, onDecision, onRerun, loading }) {
  const [fb, setFb] = useState("");
  if (!brief) return <Card>Run screening first.</Card>;
  return (
    <>
      {decision && (
        <Stamp approved={decision === "approve"} />
      )}
      {run?.used_feedback && (
        <Banner tone="load">
          ♻ This run consumed prior rejection feedback: “{run.used_feedback}” — compare
          the changed output.
        </Banner>
      )}
      <Card title="Executive summary" tag={`brief #${brief.id}`}>
        <div style={{ fontSize: 15, lineHeight: 1.5 }}>{brief.executive_summary}</div>
      </Card>

      {decision !== "reject" && !decision && (
        <Card title="Decision">
          <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
            <button style={btnApprove} onClick={() => onDecision("approve")}>
              ✓ Approve
            </button>
            <button
              style={btnReject}
              onClick={() => {
                if (!fb.trim()) {
                  alert("Reject requires feedback.");
                  return;
                }
                onDecision("reject", fb);
              }}
            >
              ✕ Reject
            </button>
          </div>
          <label style={lbl}>Rejection feedback (required to reject)</label>
          <textarea
            style={{ ...inp, height: 70 }}
            placeholder="e.g. Too NA-centric — prioritize India quick-commerce and cut vet-referral emphasis."
            value={fb}
            onChange={(e) => setFb(e.target.value)}
          />
        </Card>
      )}

      {decision === "reject" && (
        <Card title="Feedback queued">
          <div style={sub}>
            Feedback stored for the next run. Re-run screening to see the analysts adapt.
          </div>
          <button style={btnPrimary} onClick={onRerun} disabled={loading}>
            {loading ? "Re-running…" : "♻ Re-run screening with feedback"}
          </button>
        </Card>
      )}
    </>
  );
}

function Stamp({ approved }) {
  return (
    <div
      style={{
        position: "relative",
        marginBottom: 8,
        transform: "rotate(-6deg)",
        display: "inline-block",
        border: `3px solid ${approved ? "#1a8f3c" : "#c22"}`,
        color: approved ? "#1a8f3c" : "#c22",
        padding: "4px 16px",
        fontWeight: 900,
        letterSpacing: 3,
        borderRadius: 6,
        fontSize: 20,
        opacity: 0.85,
      }}
    >
      {approved ? "APPROVED" : "KILLED"}
    </div>
  );
}

// ---------------- View 3: Creative ----------------
function CreativeView({ product, brief, creative, onGenerate, onNext, loading }) {
  const [skill, setSkill] = useState("/amazon");
  const [url, setUrl] = useState(DEFAULT_URL[product] || "");
  if (brief?.status !== "approved" && !creative) {
    return <Card>Approve a brief first (step 02).</Card>;
  }
  return (
    <>
      <Card title="Creative agent — skill + product URL">
        <label style={lbl}>Slash-command skill</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          {SKILLS.map((s) => (
            <button
              key={s}
              onClick={() => setSkill(s)}
              style={{
                ...pill,
                background: skill === s ? ULTRA : "#fff",
                color: skill === s ? "#fff" : INK,
                borderColor: skill === s ? ULTRA : LINE,
              }}
            >
              {s}
            </button>
          ))}
        </div>
        <label style={lbl}>Product URL</label>
        <input style={inp} value={url} onChange={(e) => setUrl(e.target.value)} />
        <button style={btnPrimary} onClick={() => onGenerate(url, skill)} disabled={loading}>
          {loading ? "Generating…" : `Run ${skill} ▸`}
        </button>
      </Card>

      {creative && (
        <>
          <Card title="ProductProfile (URL diagnosis)" tag="gpt-4o vision">
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              <div>
                <b>{creative.profile.name}</b>
                <div style={sub}>{creative.profile.category}</div>
                <div style={sub}>Price tier: {creative.profile.price_tier}</div>
                <div style={{ marginTop: 6 }}>
                  {creative.profile.brand_colors.map((c) => (
                    <span
                      key={c}
                      title={c}
                      style={{
                        display: "inline-block",
                        width: 20,
                        height: 20,
                        borderRadius: 4,
                        background: c,
                        border: `1px solid ${LINE}`,
                        marginRight: 4,
                        verticalAlign: "middle",
                      }}
                    />
                  ))}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={sub}><b>Key claims</b></div>
                <ul style={{ margin: "4px 0", paddingLeft: 18 }}>
                  {creative.profile.key_claims.map((k) => (
                    <li key={k} style={sub}>{k}</li>
                  ))}
                </ul>
                <div style={sub}>{creative.profile.pack_description}</div>
              </div>
            </div>
          </Card>

          <Card title="Asset bundle" tag={`${creative.assets.length} assets`}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: 14,
              }}
            >
              {creative.assets.map((a) => (
                <AssetTile key={a.id} a={a} />
              ))}
            </div>
          </Card>

          <Card title="Copy blocks" tag="gpt-4o-mini">
            <pre style={pre}>{JSON.stringify(creative.copy_blocks, null, 2)}</pre>
          </Card>

          <button style={btnPrimary} onClick={onNext}>
            Continue to placement ▸
          </button>
        </>
      )}
    </>
  );
}

function AssetTile({ a }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ border: `1px solid ${LINE}`, borderRadius: 10, overflow: "hidden" }}>
      <div style={{ position: "relative", background: "#000" }}>
        <img
          src={a.url}
          alt={a.kind}
          style={{ width: "100%", display: "block", aspectRatio: "1/1", objectFit: "cover" }}
          onClick={() => setShow((s) => !s)}
        />
        {a.from_cache && (
          <span
            style={{
              position: "absolute",
              top: 6,
              left: 6,
              background: "#000a",
              color: "#ffd166",
              fontSize: 10,
              padding: "2px 6px",
              borderRadius: 4,
            }}
          >
            CACHED
          </span>
        )}
        <span
          style={{
            position: "absolute",
            bottom: 6,
            right: 6,
            background: "#000a",
            color: "#fff",
            fontSize: 10,
            padding: "2px 6px",
            borderRadius: 4,
          }}
        >
          {a.aspect}
        </span>
      </div>
      <div style={{ padding: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700 }}>{a.kind}</div>
        <div
          style={{ fontSize: 11, color: ULTRA, cursor: "pointer" }}
          onClick={() => setShow((s) => !s)}
        >
          {show ? "hide prompt" : "show prompt"}
        </div>
        {show && <div style={{ fontSize: 11, color: MUTE, marginTop: 4 }}>{a.prompt}</div>}
      </div>
    </div>
  );
}

// ---------------- View 4: Placement ----------------
function PlacementView({ creative, placement, onPlan, loading }) {
  if (!creative) return <Card>Generate creative assets first (step 03).</Card>;
  return (
    <>
      <Card title="Placement pass" tag="gpt-4o + channel_metrics">
        <div style={sub}>
          Maps each asset → platform → format → budget% using retrieved CPL/CVR.
        </div>
        <button style={btnPrimary} onClick={onPlan} disabled={loading}>
          {loading ? "Planning…" : "Run placement pass ▸"}
        </button>
      </Card>

      {placement && (
        <Card title="Recommended placement plan">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: MUTE }}>
                <th style={th}>Asset</th>
                <th style={th}>Platform</th>
                <th style={th}>Format</th>
                <th style={th}>Budget %</th>
                <th style={th}>Projected</th>
                <th style={th}>Rationale</th>
              </tr>
            </thead>
            <tbody>
              {placement.placements.map((p, i) => (
                <tr key={i} style={{ borderTop: `1px solid ${LINE}` }}>
                  <td style={td}><b>{p.asset}</b></td>
                  <td style={td}>{p.platform}</td>
                  <td style={td}>{p.format}</td>
                  <td style={td}>
                    <div
                      style={{
                        background: "#eef1ff",
                        borderRadius: 4,
                        overflow: "hidden",
                        width: 80,
                      }}
                    >
                      <div
                        style={{
                          background: ULTRA,
                          color: "#fff",
                          fontSize: 11,
                          padding: "1px 4px",
                          width: `${Math.min(100, p.budget_pct)}%`,
                        }}
                      >
                        {p.budget_pct}%
                      </div>
                    </div>
                  </td>
                  <td style={td}>{p.projected_metric}</td>
                  <td style={{ ...td, color: MUTE }}>{p.rationale}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div
            style={{
              marginTop: 14,
              padding: "10px 14px",
              background: "#f0f4ff",
              borderRadius: 8,
              fontSize: 13,
              color: ULTRA,
            }}
          >
            ↻ These projections feed Agent 3 (Performance Monitor) next cycle — closing
            the loop.
          </div>
        </Card>
      )}
    </>
  );
}

// ---------------- styles ----------------
const lbl = { display: "block", fontSize: 12, color: MUTE, margin: "10px 0 4px" };
const inp = {
  width: "100%",
  padding: "9px 11px",
  border: `1px solid ${LINE}`,
  borderRadius: 8,
  fontSize: 14,
  fontFamily: "inherit",
};
const sub = { fontSize: 12.5, color: MUTE, margin: "3px 0" };
const agentBlock = {
  borderTop: `1px solid ${LINE}`,
  padding: "8px 0",
  fontSize: 13,
};
const btnPrimary = {
  marginTop: 14,
  background: ULTRA,
  color: "#fff",
  border: "none",
  padding: "10px 18px",
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
};
const btnApprove = { ...btnPrimary, marginTop: 0, background: "#1a8f3c" };
const btnReject = { ...btnPrimary, marginTop: 0, background: "#c22" };
const pill = {
  padding: "6px 12px",
  border: `1px solid ${LINE}`,
  borderRadius: 20,
  cursor: "pointer",
  fontFamily: "ui-monospace, monospace",
  fontSize: 13,
};
const pre = {
  background: "#0f1116",
  color: "#d5f5e3",
  padding: 12,
  borderRadius: 8,
  fontSize: 12,
  overflow: "auto",
  maxHeight: 260,
};
const th = { padding: "6px 8px", fontWeight: 600 };
const td = { padding: "8px", verticalAlign: "top" };
function sevPill(sev) {
  const c = sev === "high" ? "#c22" : sev === "medium" ? "#d98a00" : "#6b6f7a";
  return {
    background: c,
    color: "#fff",
    fontSize: 10,
    padding: "1px 6px",
    borderRadius: 10,
    textTransform: "uppercase",
  };
}
