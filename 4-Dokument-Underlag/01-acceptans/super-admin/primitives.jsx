/* =====================================================================
   PRIMITIVES — Corevo back-office look (forest/gold), self-contained.
   S-prefix to avoid any global collision. Icon comes from icons.jsx.
   ===================================================================== */
const { useState: useStateP } = React;

function SBtn({ children, variant = "primary", icon, iconRight, onClick, size = "md", style = {}, disabled, title }) {
  const pad = size === "sm" ? "8px 14px" : size === "lg" ? "14px 24px" : "11px 18px";
  const fs = size === "sm" ? 13 : size === "lg" ? 15.5 : 14;
  const base = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "var(--font-ui)", fontWeight: 600, fontSize: fs, padding: pad, borderRadius: 10, cursor: disabled ? "not-allowed" : "pointer", border: "1px solid transparent", transition: "all var(--dur-fast)", whiteSpace: "nowrap", opacity: disabled ? 0.5 : 1, ...style };
  const variants = {
    primary: { background: "var(--c-forest)", color: "#fff" },
    gold: { background: "var(--c-gold)", color: "#3A2A06" },
    ghost: { background: "transparent", color: "var(--c-ink)", border: "1px solid var(--c-line-strong)" },
    subtle: { background: "var(--c-paper-2)", color: "var(--c-ink)" },
    danger: { background: "var(--c-danger-bg)", color: "var(--c-danger)" },
    onforest: { background: "rgba(255,255,255,.1)", color: "#fff", border: "1px solid rgba(255,255,255,.2)" },
  };
  return (
    <button title={title} onClick={disabled ? undefined : onClick} style={{ ...base, ...variants[variant] }}
      onMouseEnter={e => { if (disabled) return; const c = e.currentTarget; if (variant === "primary") c.style.background = "var(--c-forest-700)"; if (variant === "gold") c.style.background = "var(--c-gold-600)"; if (variant === "ghost" || variant === "subtle") c.style.background = "var(--c-paper-2)"; if (variant === "onforest") c.style.background = "rgba(255,255,255,.18)"; }}
      onMouseLeave={e => { if (disabled) return; const c = e.currentTarget; if (variant === "primary") c.style.background = "var(--c-forest)"; if (variant === "gold") c.style.background = "var(--c-gold)"; if (variant === "ghost") c.style.background = "transparent"; if (variant === "subtle") c.style.background = "var(--c-paper-2)"; if (variant === "onforest") c.style.background = "rgba(255,255,255,.1)"; }}>
      {icon && <Icon name={icon} size={size === "sm" ? 15 : 17} />}{children}{iconRight && <Icon name={iconRight} size={size === "sm" ? 15 : 17} />}
    </button>
  );
}

function SCard({ children, style = {}, pad = 22, onClick, hover }) {
  return <div onClick={onClick} style={{ background: "var(--c-paper)", border: "1px solid var(--c-line)", borderRadius: 16, padding: pad, boxShadow: "var(--shadow-sm)", transition: hover ? "all var(--dur-fast)" : "none", ...style }}>{children}</div>;
}

function SBadge({ children, tone = "neutral", dot = true }) {
  const map = {
    neutral: ["#EFEBE3", "#A7AC9E"], success: ["var(--c-success-bg)", "var(--c-success)"],
    warning: ["var(--c-warning-bg)", "var(--c-warning)"], danger: ["var(--c-danger-bg)", "var(--c-danger)"],
    info: ["var(--c-info-bg)", "var(--c-info)"], gold: ["var(--c-gold-100)", "var(--c-gold-600)"],
    warning: ["var(--c-warning-bg)", "var(--c-warning)"], danger: ["var(--c-danger-bg)", "var(--c-danger)"],
  };
  const [bg, accent] = map[tone] || map.neutral;
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: bg, color: "var(--c-ink)", fontSize: 11.5, fontWeight: 600, padding: "4px 10px", borderRadius: 999, fontFamily: "var(--font-ui)", whiteSpace: "nowrap" }}>{dot && <span style={{ width: 6, height: 6, borderRadius: 999, background: accent, flex: "none" }} />}{children}</span>;
}

function SField({ label, ph, val, on, type = "text", hint, suffix }) {
  return (
    <label style={{ display: "block" }}>
      {label && <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--c-ink)", fontFamily: "var(--font-ui)" }}>{label}</span>}
      <div style={{ display: "flex", alignItems: "center", marginTop: label ? 6 : 0, border: "1px solid var(--c-line)", borderRadius: 10, overflow: "hidden", background: "var(--c-paper)" }}>
        <input type={type} value={val} onChange={e => on && on(e.target.value)} placeholder={ph}
          style={{ flex: 1, minWidth: 0, padding: "11px 13px", border: "none", outline: "none", fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--c-ink)", background: "transparent" }}
          onFocus={e => e.target.parentElement.style.borderColor = "var(--c-forest)"} onBlur={e => e.target.parentElement.style.borderColor = "var(--c-line)"} />
        {suffix && <span style={{ padding: "0 13px", color: "var(--c-ink-3)", fontSize: 13.5, fontFamily: "var(--font-ui)", borderLeft: "1px solid var(--c-line)", alignSelf: "stretch", display: "grid", placeItems: "center", whiteSpace: "nowrap" }}>{suffix}</span>}
      </div>
      {hint && <span style={{ fontSize: 11.5, color: "var(--c-ink-3)", marginTop: 5, display: "block" }}>{hint}</span>}
    </label>
  );
}

function SToggle({ on, set, title, desc, locked }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
      <div style={{ paddingRight: 8 }}>
        <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--c-ink)" }}>{title}</div>
        {desc && <div style={{ fontSize: 12, color: "var(--c-ink-3)", marginTop: 2, maxWidth: 360, lineHeight: 1.45 }}>{desc}</div>}
      </div>
      <button disabled={locked} onClick={() => !locked && set(!on)} style={{ width: 44, height: 25, borderRadius: 999, border: "none", cursor: locked ? "not-allowed" : "pointer", background: on ? "var(--c-forest)" : "var(--c-line-strong)", position: "relative", transition: "background var(--dur-fast)", flex: "none", opacity: locked ? 0.5 : 1 }}>
        <span style={{ position: "absolute", top: 3, left: on ? 22 : 3, width: 19, height: 19, borderRadius: 999, background: "#fff", transition: "left var(--dur-fast)", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
      </button>
    </div>
  );
}

/* eyebrow / labels */
function SEyebrow({ children, style = {} }) {
  return <span style={{ fontFamily: "var(--font-ui)", fontWeight: 700, fontSize: 10.5, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--c-gold-600)", ...style }}>{children}</span>;
}

/* DB-table chip — the literal backend the control maps to */
function TChip({ children, tone = "info" }) {
  const c = tone === "warn" ? "var(--c-warning)" : tone === "ok" ? "var(--c-success)" : "var(--c-info)";
  const bg = tone === "warn" ? "var(--c-warning-bg)" : tone === "ok" ? "var(--c-success-bg)" : "var(--c-info-bg)";
  return <span className="num" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, color: c, background: bg, border: `1px solid color-mix(in srgb, ${c} 22%, transparent)`, borderRadius: 7, padding: "2px 8px", fontFamily: "var(--font-ui)" }}><Icon name="layers" size={11} />{children}</span>;
}

/* =====================================================================
   SPEC-NOTE — the handoff annotation. Only visible in Spec-läge.
   Renders a numbered marker; expands to purpose · DB · what Code builds.
   ===================================================================== */
function SpecNote({ n, title, body, tables = [], build, on, place = "tr" }) {
  const [open, setOpen] = useStateP(false);
  if (!on) return null;
  const pos = {
    tr: { top: 8, right: 8 }, tl: { top: 8, left: 8 },
    br: { bottom: 8, right: 8 }, bl: { bottom: 8, left: 8 },
  }[place];
  return (
    <div style={{ position: "absolute", zIndex: 30, ...pos }}>
      <button onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        style={{ width: 24, height: 24, borderRadius: 999, border: "2px solid #fff", background: "var(--c-gold)", color: "#3A2A06", fontFamily: "var(--font-ui)", fontWeight: 800, fontSize: 12, cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,.25)", display: "grid", placeItems: "center" }}>{n}</button>
      {open && (
        <div onClick={e => e.stopPropagation()} style={{ position: "absolute", top: 30, [place.includes("r") ? "right" : "left"]: 0, width: 300, background: "#1B2A22", color: "#EAF0EC", borderRadius: 12, padding: 16, boxShadow: "0 18px 48px rgba(0,0,0,.4)", border: "1px solid rgba(245,166,35,.3)", fontFamily: "var(--font-ui)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ width: 20, height: 20, borderRadius: 999, background: "var(--c-gold)", color: "#3A2A06", fontWeight: 800, fontSize: 11, display: "grid", placeItems: "center", flex: "none" }}>{n}</span>
            <span style={{ fontWeight: 700, fontSize: 13.5 }}>{title}</span>
          </div>
          <p style={{ margin: "0 0 10px", fontSize: 12.5, lineHeight: 1.5, color: "#C3D2C9" }}>{body}</p>
          {tables.length > 0 && (
            <div style={{ marginBottom: build ? 10 : 0 }}>
              <div style={{ fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "#7E9A8B", fontWeight: 700, marginBottom: 5 }}>DB / källa</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {tables.map(t => <span key={t} className="num" style={{ fontSize: 11, fontWeight: 600, color: "#F5D9A8", background: "rgba(245,166,35,.12)", border: "1px solid rgba(245,166,35,.25)", borderRadius: 6, padding: "2px 7px" }}>{t}</span>)}
              </div>
            </div>
          )}
          {build && (
            <div>
              <div style={{ fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "#7E9A8B", fontWeight: 700, marginBottom: 5 }}>Code bygger</div>
              <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: "#C3D2C9" }}>{build}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* spec strip — inline labelled note used in the left panel (always-on, calm) */
function SpecStrip({ children, icon = "info" }) {
  return (
    <div style={{ display: "flex", gap: 10, padding: "11px 13px", background: "var(--c-info-bg)", borderRadius: 10, alignItems: "flex-start" }}>
      <Icon name={icon} size={15} style={{ color: "var(--c-info)", flex: "none", marginTop: 1 }} />
      <span style={{ fontSize: 12.5, color: "var(--c-ink)", lineHeight: 1.5 }}>{children}</span>
    </div>
  );
}

Object.assign(window, { SBtn, SCard, SBadge, SField, SToggle, SEyebrow, TChip, SpecNote, SpecStrip });
