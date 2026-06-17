/* =====================================================================
   APP — orchestrates the journey: Super admin → Onboarding-studio → Live.
   One honest linear journey, not a role-switch. Every surface is badged.
   ===================================================================== */
const { useState: useStateA } = React;

const slugify = v => (v || "").toLowerCase().replace(/[åäáà]/g, "a").replace(/[öó]/g, "o").replace(/é/g, "e").replace(/[^a-z0-9]/g, "");

const INIT = {
  branch: null, name: "", slug: "", _slugTouched: false,
  theme: "Salvia", bookingVariant: "wizard",
  modules: {}, placement: { main: [], konto: [] },
  branding: { accent: null, metaTagline: "" },
  content: { hero: "Välj en bransch för att börja", tagline: "Previewen fylls när du väljer bransch.", services: [] },
  owner: { name: "", email: "" },
  _edit: false,
};

function App() {
  const [cfg, setCfg] = useStateA(INIT);
  const [stage, setStage] = useStateA("super");     // super | studio | result
  const [step, setStep] = useStateA("branch");
  const [spec, setSpec] = useStateA(false);
  const [launching, setLaunching] = useStateA(false);
  const [resultTab, setResultTab] = useStateA("site");
  const [device, setDevice] = useStateA("desktop");

  const C = window.CFG;
  const A = {
    patch: p => setCfg(c => ({ ...c, ...p })),
    setName: v => setCfg(c => ({ ...c, name: v, slug: c._slugTouched ? c.slug : slugify(v) })),
    setSlug: v => setCfg(c => ({ ...c, slug: slugify(v), _slugTouched: true })),
    setContent: (k, v) => setCfg(c => ({ ...c, content: { ...c.content, [k]: v } })),
    setModule: (k, state) => setCfg(c => {
      const modules = { ...c.modules, [k]: state };
      // route to the right surface: konto-modules → customer portal, rest → public main
      const pos = C.MODULES[k].defaultPos === "konto" ? "konto" : "main";
      const list = c.placement[pos] || [];
      const placement = { ...c.placement, [pos]: list.includes(k) ? list : [...list, k] };
      return { ...c, modules, placement };
    }),
    setBranch: key => setCfg(c => {
      const b = C.BRANCHES[key];
      const modules = {}; b.rec.forEach(m => modules[m] = "live");
      const usable = b.rec.filter(m => !C.MODULES[m].infra);
      const main = usable.filter(m => C.MODULES[m].defaultPos !== "konto");
      const konto = usable.filter(m => C.MODULES[m].defaultPos === "konto");
      return {
        ...c, branch: key, theme: b.theme, bookingVariant: b.variant,
        modules, placement: { main, konto },
        content: { hero: b.hero, tagline: b.tagline, services: [...b.services] },
        branding: { accent: null, metaTagline: "" },
      };
    }),
  };
  const setEdit = v => setCfg(c => ({ ...c, _edit: v }));

  const startOnboard = () => { setCfg(INIT); setStep("branch"); setStage("studio"); };
  const doLaunch = () => { setCfg(c => c.slug ? c : { ...c, slug: slugify(c.name) || c.branch || "dinsalong" }); setLaunching(true); };
  const finishLaunch = () => { setLaunching(false); setStage("result"); setResultTab("site"); };

  /* ---- journey bar ---- */
  const stages = [["super", "Kunder", "building"], ["studio", "Onboarding-studio", "sliders"], ["result", "Live", "globe"]];
  const stageIdx = { super: 0, studio: 1, result: 2 }[stage];
  const JourneyBar = (
    <div style={{ flex: "none", height: 54, background: "var(--c-forest-700)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px", color: "#fff", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <div style={{ width: 30, height: 30, flex: "none", borderRadius: 8, background: "var(--c-gold)", color: "var(--c-forest-700)", display: "grid", placeItems: "center", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 17 }}>C</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "var(--font-ui)", fontWeight: 700, fontSize: 12.5, letterSpacing: ".02em", lineHeight: 1 }}>COREVO PLATTFORM</div>
          <div className="num" style={{ fontSize: 11, color: "var(--c-on-forest-2)", marginTop: 2 }}>superbooking@corevo.se</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(0,0,0,.2)", padding: 4, borderRadius: 11 }}>
        {stages.map(([k, label, ic], i) => {
          const on = stage === k;
          const reachable = k === "super" || (k === "studio" && cfg.branch) || (k === "result" && stage === "result");
          return (
            <React.Fragment key={k}>
              {i > 0 && <Icon name="chevronRight" size={14} style={{ color: "var(--c-on-forest-2)", opacity: .6 }} />}
              <button onClick={() => reachable && setStage(k)} disabled={!reachable} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 13px", borderRadius: 8, border: "none", cursor: reachable ? "pointer" : "default", fontFamily: "var(--font-ui)", fontSize: 12.5, fontWeight: 600, background: on ? "var(--c-gold)" : "transparent", color: on ? "#3A2A06" : reachable ? "#fff" : "var(--c-on-forest-2)", opacity: reachable ? 1 : .5 }}>
                <span style={{ width: 18, height: 18, borderRadius: 999, background: on ? "rgba(0,0,0,.12)" : "rgba(255,255,255,.12)", display: "grid", placeItems: "center", fontSize: 10, fontWeight: 800 }}>{i + 1}</span>
                {label}
              </button>
            </React.Fragment>
          );
        })}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={() => setSpec(s => !s)} title="Visa byggspec-anteckningar" style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 13px", borderRadius: 9, border: `1px solid ${spec ? "var(--c-gold)" : "rgba(255,255,255,.2)"}`, background: spec ? "var(--c-gold)" : "transparent", color: spec ? "#3A2A06" : "#fff", cursor: "pointer", fontFamily: "var(--font-ui)", fontSize: 12.5, fontWeight: 600 }}>
          <Icon name="layers" size={15} /> Spec-läge
        </button>
      </div>
    </div>
  );

  /* ---- preview toolbar (studio) ---- */
  const PreviewBar = (
    <div style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <span style={{ width: 7, height: 7, borderRadius: 999, background: "var(--c-success)", boxShadow: "0 0 0 3px var(--c-success-bg)" }} />
        <span style={{ fontFamily: "var(--font-ui)", fontSize: 12.5, fontWeight: 600, color: "var(--c-ink)" }}>Live preview</span>
        <span style={{ fontSize: 12, color: "var(--c-ink-3)" }}>· uppdateras direkt</span>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <SBtn variant={cfg._edit ? "gold" : "ghost"} size="sm" icon="edit" onClick={() => setEdit(!cfg._edit)}>{cfg._edit ? "Redigerar text" : "Klicka-redigera"}</SBtn>
      </div>
    </div>
  );

  const previewUrl = (cfg.slug || "dinsalong") + ".corevo.se";

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
      {JourneyBar}

      {stage === "super" && <div style={{ flex: 1, minHeight: 0 }}><SuperEntry onStart={startOnboard} /></div>}

      {stage === "studio" && (
        <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
          <Studio cfg={cfg} A={A} step={step} setStep={setStep} onLaunch={doLaunch} setEdit={setEdit} />
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", background: "var(--c-paper-2)", minHeight: 0 }}>
            {PreviewBar}
            <div style={{ flex: 1, minHeight: 0, padding: "0 18px 18px" }}>
              <BrowserFrame url={previewUrl} device={device} onDevice={setDevice}>
                <Storefront cfg={cfg} setContent={A.setContent} editMode={cfg._edit} specOn={spec} />
              </BrowserFrame>
            </div>
          </div>
        </div>
      )}

      {stage === "result" && (
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", background: "var(--c-cream)" }}>
          {/* success banner */}
          <div style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "16px 24px", background: "var(--c-forest)", color: "#fff", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ width: 38, height: 38, borderRadius: 999, background: "var(--c-success)", display: "grid", placeItems: "center" }}><Icon name="check" size={20} /></span>
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 19 }}>{cfg.name || "Kunden"} är live</div>
                <div className="num" style={{ fontSize: 13, color: "var(--c-on-forest-2)", display: "flex", alignItems: "center", gap: 7, marginTop: 2 }}><Icon name="globe" size={13} style={{ color: "var(--c-gold)" }} />{previewUrl} · ägaren har fått sitt inlogg</div>
              </div>
            </div>
            <SBtn variant="onforest" icon="plus" onClick={() => setStage("super")}>Onboarda nästa kund</SBtn>
          </div>
          {/* view tabs — labelled by WHO sees it */}
          <div style={{ flex: "none", display: "flex", gap: 4, padding: "12px 24px 0" }}>
            {[["site", "Besökarens vy — publika sidan", "eye"], ["admin", "Kundens egen admin (M6)", "shield"]].map(([k, l, ic]) => {
              const on = resultTab === k;
              return <button key={k} onClick={() => setResultTab(k)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: "10px 10px 0 0", border: "1px solid var(--c-line)", borderBottom: on ? "1px solid var(--c-cream)" : "1px solid var(--c-line)", marginBottom: -1, background: on ? "var(--c-cream)" : "var(--c-paper-2)", color: on ? "var(--c-forest)" : "var(--c-ink-3)", cursor: "pointer", fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600 }}><Icon name={ic} size={15} />{l}</button>;
            })}
            <div style={{ flex: 1, borderBottom: "1px solid var(--c-line)" }} />
          </div>
          <div style={{ flex: 1, minHeight: 0, padding: 24 }}>
            {resultTab === "site" ? (
              <BrowserFrame url={previewUrl} live device={device} onDevice={setDevice}>
                <Storefront cfg={cfg} setContent={A.setContent} editMode={false} specOn={spec} />
              </BrowserFrame>
            ) : (
              <CustomerAdmin cfg={cfg} />
            )}
          </div>
        </div>
      )}

      {launching && <LaunchSequence cfg={cfg} onDone={finishLaunch} />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
