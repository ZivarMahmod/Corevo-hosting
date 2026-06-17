/* =====================================================================
   KUND-ADMIN — SKAL: onboarding-simulator + dynamisk nav + router
   Navet byggs av aktiva moduler. Byt preset/moduler högst upp → se
   adminen ändra sig precis som efter en onboarding.
   ===================================================================== */
const { useState: useStateA, useMemo } = React;
const AA = window.ADMIN;
const CORE = window.SURFACES_CORE;
const MORE = window.SURFACES_MORE;

/* map surface-key → component */
const SURFACE_COMP = {
  dashboard: CORE.Dashboard, bokningar: CORE.Bokningar, tjanster: CORE.Tjanster, personal: CORE.Personal, schema: CORE.Schema,
  produkter: MORE.Produkter, ordrar: MORE.Ordrar, offerter: MORE.Offerter, stammis: MORE.Stammis, presentkort: MORE.Presentkort, meny: MORE.Meny, blogg: MORE.Blogg, fordon: MORE.Fordon, orderstatus: MORE.Orderstatus,
  kunder: MORE.Kunder, varumarke: MORE.Varumarke, installningar: MORE.Installningar,
};

function buildCfg(branchKey, modulesOverride) {
  const p = AA.PRESETS[branchKey];
  return {
    branch: branchKey, vertical: branchKey, name: p.name, slug: p.name.toLowerCase().replace(/[^a-z0-9]/g, ""),
    staffWord: p.staffWord, serviceWord: p.serviceWord, serviceLabel: p.serviceLabel, unit: p.unit,
    modules: modulesOverride || { ...p.modules },
  };
}

/* nav = CORE_TOP + (surfaces of each active module, in module order) + CORE_BOTTOM */
function buildNav(cfg) {
  const items = [...AA.CORE_TOP];
  Object.entries(cfg.modules).forEach(([k, state]) => {
    if (state === "off" || !AA.MODULE_DEFS[k]) return;
    AA.MODULE_DEFS[k].surfaces.forEach(s => items.push({ ...s, label: CORE.term(s.label, cfg), module: k, state }));
  });
  return [...items, ...AA.CORE_BOTTOM];
}

function App() {
  const [branch, setBranch] = useStateA("frisör");
  const [modules, setModules] = useStateA(null); // null = use preset
  const [view, setView] = useStateA("dashboard");
  const [simOpen, setSimOpen] = useStateA(true);

  const cfg = useMemo(() => buildCfg(branch, modules), [branch, modules]);
  const nav = useMemo(() => buildNav(cfg), [cfg]);

  // if current view no longer in nav, snap to dashboard
  React.useEffect(() => { if (view !== "__site" && !nav.find(n => n.key === view)) setView("dashboard"); }, [nav]);

  const pickBranch = (b) => { setModules(null); setBranch(b); };
  const toggleModule = (k) => {
    const cur = cfg.modules[k] || "off";
    const next = cur === "off" ? "live" : "off";
    setModules({ ...cfg.modules, [k]: next });
  };

  const Comp = SURFACE_COMP[view];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* ---- onboarding simulator strip ---- */}
      <div style={{ background: "#13241C", color: "#EAF0EC", borderBottom: "1px solid rgba(255,255,255,.08)", flex: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 20px", flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--c-gold)" }}><Icon name="sliders" size={14} />Onboarding-simulator</span>
          <span style={{ fontSize: 12.5, color: "#9DB1A6" }}>Detta är en demo-kontroll — visar hur adminen blir av onboarding-valen. Finns inte i den riktiga adminen.</span>
          <button onClick={() => setSimOpen(o => !o)} style={{ marginLeft: "auto", background: "rgba(255,255,255,.1)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-ui)" }}>{simOpen ? "Dölj" : "Visa"}</button>
        </div>
        {simOpen && (
          <div style={{ padding: "0 20px 16px", display: "flex", gap: 26, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "#7E9A8B", marginBottom: 7 }}>Bransch (vertical)</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {Object.keys(AA.PRESETS).map(b => (
                  <button key={b} onClick={() => pickBranch(b)} style={{ textTransform: "capitalize", fontFamily: "var(--font-ui)", fontWeight: 600, fontSize: 12.5, padding: "6px 12px", borderRadius: 8, cursor: "pointer", border: "1px solid " + (branch === b ? "var(--c-gold)" : "rgba(255,255,255,.18)"), background: branch === b ? "var(--c-gold)" : "transparent", color: branch === b ? "#3A2A06" : "#EAF0EC" }}>{b}</button>
                ))}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 280 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "#7E9A8B", marginBottom: 7 }}>Moduler (tenant_modules) — klicka för på/av</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {Object.keys(AA.MODULE_DEFS).map(k => {
                  const state = cfg.modules[k] || "off";
                  const on = state !== "off";
                  return (
                    <button key={k} onClick={() => toggleModule(k)} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--font-ui)", fontWeight: 600, fontSize: 12.5, padding: "6px 11px", borderRadius: 8, cursor: "pointer", border: "1px solid " + (on ? "rgba(245,166,35,.5)" : "rgba(255,255,255,.14)"), background: on ? "rgba(245,166,35,.16)" : "transparent", color: on ? "#F5D9A8" : "#7E9A8B" }}>
                      <span style={{ width: 7, height: 7, borderRadius: 999, background: state === "live" ? "#6FD79B" : state === "draft" ? "var(--c-gold)" : "#54665C" }} />
                      {AA.MODULE_DEFS[k].name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ---- admin body: sidebar + content ---- */}
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {view === "__site" ? <SiteStub cfg={cfg} back={() => setView("dashboard")} /> : (
          <>
            <aside style={{ width: 248, flex: "none", background: "var(--c-forest)", color: "var(--c-on-forest)", display: "flex", flexDirection: "column", overflowY: "auto" }}>
              <div style={{ padding: "20px 18px 14px", borderBottom: "1px solid var(--c-forest-300)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: "var(--c-gold)", color: "#3A2A06", display: "grid", placeItems: "center", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 18 }}>{cfg.name[0]}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cfg.name}</div>
                    <div style={{ fontSize: 9.5, color: "var(--c-on-forest-2)", letterSpacing: ".08em", textTransform: "uppercase" }}>Admin</div>
                  </div>
                </div>
              </div>
              <nav style={{ padding: "10px 10px", flex: 1 }}>
                {nav.map((n, idx) => {
                  const isCore = AA.CORE_TOP.concat(AA.CORE_BOTTOM).find(c => c.key === n.key);
                  const prev = nav[idx - 1];
                  const showDivider = idx > 0 && !!isCore !== !!(AA.CORE_TOP.concat(AA.CORE_BOTTOM).find(c => c.key === prev.key));
                  return (
                    <React.Fragment key={n.key}>
                      {showDivider && <div style={{ height: 1, background: "var(--c-forest-300)", margin: "8px 12px" }} />}
                      <button onClick={() => setView(n.key)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", borderRadius: 9, border: "none", cursor: "pointer", fontFamily: "var(--font-ui)", fontWeight: 600, fontSize: 13.5, textAlign: "left", background: view === n.key ? "rgba(245,166,35,.16)" : "transparent", color: view === n.key ? "#fff" : "var(--c-on-forest)", marginBottom: 1 }}
                        onMouseEnter={e => { if (view !== n.key) e.currentTarget.style.background = "var(--c-forest-700)"; }}
                        onMouseLeave={e => { if (view !== n.key) e.currentTarget.style.background = "transparent"; }}>
                        <Icon name={n.icon} size={17} style={{ color: view === n.key ? "var(--c-gold)" : "var(--c-on-forest-2)" }} />
                        <span style={{ flex: 1 }}>{n.label}</span>
                        {n.state === "draft" && <span style={{ fontSize: 9, fontWeight: 700, color: "var(--c-gold)", background: "rgba(245,166,35,.16)", padding: "1px 6px", borderRadius: 999 }}>utkast</span>}
                      </button>
                    </React.Fragment>
                  );
                })}
              </nav>
              <div style={{ padding: "12px 18px", borderTop: "1px solid var(--c-forest-300)", fontSize: 11.5, color: "var(--c-on-forest-2)", display: "flex", alignItems: "center", gap: 9 }}>
                <span style={{ width: 28, height: 28, borderRadius: 999, background: "var(--c-forest-300)", display: "grid", placeItems: "center", color: "#fff" }}><Icon name="user" size={15} /></span>
                <div><div style={{ color: "#fff", fontWeight: 600 }}>Ägare</div><div>Inloggad · {cfg.slug}.corevo.se</div></div>
              </div>
            </aside>
            <main style={{ flex: 1, overflowY: "auto", padding: "28px 34px 60px" }}>
              <div style={{ maxWidth: 1000, margin: "0 auto" }}>{Comp ? <Comp cfg={cfg} go={setView} /> : null}</div>
            </main>
          </>
        )}
      </div>
    </div>
  );
}

/* "Se din sida" — light storefront stub so the link goes somewhere */
function SiteStub({ cfg, back }) {
  const live = Object.entries(cfg.modules).filter(([k, v]) => v === "live" && AA.MODULE_DEFS[k] && AA.MODULE_DEFS[k].pos === "main");
  return (
    <div style={{ flex: 1, overflowY: "auto", background: "var(--c-paper-2)" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid var(--c-line)", padding: "12px 22px", display: "flex", alignItems: "center", gap: 12 }}>
        <SBtn variant="ghost" size="sm" icon="arrowLeft" onClick={back}>Tillbaka till admin</SBtn>
        <span style={{ fontSize: 12.5, color: "var(--c-ink-3)" }} className="num">{cfg.slug}.corevo.se — besökarens vy</span>
      </div>
      <div style={{ maxWidth: 760, margin: "30px auto", padding: "0 20px" }}>
        <div style={{ borderRadius: 18, overflow: "hidden", boxShadow: "var(--shadow-md)", border: "1px solid var(--c-line)" }}>
          <div style={{ height: 280, background: "linear-gradient(150deg, var(--c-forest), var(--c-forest-700))", display: "grid", placeItems: "center", textAlign: "center", padding: 30 }}>
            <div>
              <div style={{ fontFamily: "var(--font-display)", color: "#fff", fontSize: 36, fontWeight: 700 }}>Välkommen till {cfg.name}</div>
              <div style={{ display: "inline-block", marginTop: 18, background: "var(--c-gold)", color: "#3A2A06", fontWeight: 700, fontSize: 14, padding: "12px 26px", borderRadius: 999 }}>Boka tid</div>
            </div>
          </div>
          <div style={{ background: "#fff", padding: 24 }}>
            <div style={{ fontSize: 12.5, color: "var(--c-ink-3)", marginBottom: 10 }}>Sektioner på din publika sida (av dina aktiva moduler):</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {live.map(([k]) => <span key={k} style={{ padding: "8px 14px", borderRadius: 10, background: "var(--c-paper-2)", fontSize: 13, fontWeight: 600, color: "var(--c-ink)" }}>{AA.MODULE_DEFS[k].name}</span>)}
            </div>
            <p style={{ fontSize: 12.5, color: "var(--c-ink-3)", marginTop: 16, lineHeight: 1.5 }}>Detta är en förenklad vy — den fulla, interaktiva storefronten finns i onboarding-studions live-preview.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
