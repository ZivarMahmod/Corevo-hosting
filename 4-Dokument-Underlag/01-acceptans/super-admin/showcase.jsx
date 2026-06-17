/* =====================================================================
   MODULKATALOG — en storefront med ALLA moduler inlagda samtidigt.
   Referensvy för Code/Cowork: byt bransch → se branschens anpassningar,
   men VARJE modul renderas live (inga låsningar). Bygger på samma data
   (cfg-data.js) och samma renderers (preview.jsx) som onboarding-studion,
   så det du ser här är exakt vad varje modul blir på den publika sidan.
   ===================================================================== */
const { useState: useStateSc } = React;

/* every functional module live, ordered: branschens rek först, sen resten */
function buildShowcaseCfg(branchKey, themeKey) {
  const C = window.CFG;
  const b = C.BRANCHES[branchKey];
  const allMods = Object.keys(C.MODULES).filter(k => !C.MODULES[k].infra);
  const modules = {}; allMods.forEach(m => (modules[m] = "live"));
  const rank = m => (b.rec.includes(m) ? 0 : (b.opt || []).includes(m) ? 1 : 2);
  const order = (arr) => [...arr].sort((a, c) => rank(a) - rank(c));
  const main = order(allMods.filter(m => C.MODULES[m].defaultPos !== "konto"));
  const konto = order(allMods.filter(m => C.MODULES[m].defaultPos === "konto"));
  return {
    branch: branchKey, name: b.name, slug: branchKey,
    theme: themeKey || b.theme, bookingVariant: b.variant,
    modules, placement: { main, konto },
    branding: { accent: null, metaTagline: "" },
    content: { hero: b.hero, tagline: b.tagline, services: [...b.services] },
    owner: { name: "", email: "" }, _edit: false,
  };
}

function Tag({ tone, children }) {
  const map = {
    rek: ["var(--c-success-bg)", "var(--c-success)"],
    tillval: ["var(--c-paper-2)", "var(--c-ink-3)"],
    std: ["var(--c-info-bg)", "var(--c-info)"],
    konto: ["var(--c-gold-100)", "var(--c-gold-600)"],
    roadmap: ["var(--c-warning-bg)", "var(--c-warning)"],
  }[tone] || ["var(--c-paper-2)", "var(--c-ink-3)"];
  return <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", padding: "2px 7px", borderRadius: 999, background: map[0], color: map[1], flex: "none" }}>{children}</span>;
}

/* left legend: every module, its role for this branch, its adaptation */
function Legend({ branchKey, onJump }) {
  const C = window.CFG;
  const b = C.BRANCHES[branchKey];
  const mods = Object.keys(C.MODULES).filter(k => !C.MODULES[k].infra);
  const adapted = mods.filter(m => C.MODULES[m].variants[branchKey]);
  const liveCount = mods.filter(m => C.MODULES[m].live !== false).length;
  const rank = m => (b.rec.includes(m) ? 0 : (b.opt || []).includes(m) ? 1 : 2);
  const ordered = [...mods].sort((a, c) => rank(a) - rank(c));
  return (
    <div style={{ width: 340, flex: "none", background: "var(--c-cream)", borderRight: "1px solid var(--c-line)", height: "100%", overflowY: "auto" }}>
      <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid var(--c-line)" }}>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 19, color: "var(--c-forest)" }}>Alla moduler</div>
        <div style={{ fontSize: 12.5, color: "var(--c-ink-2)", marginTop: 5, lineHeight: 1.5 }}>
          <b className="num" style={{ color: "var(--c-forest)" }}>{liveCount}</b> live i DB · <b className="num" style={{ color: "var(--c-warning)" }}>{mods.length - liveCount}</b> roadmap · <b className="num">{adapted.length}</b> anpassade för {b.name}.
          Varje modul renderas på sidan till höger — klicka för att hoppa dit.
        </div>
      </div>
      <div style={{ padding: 14 }}>
        {ordered.map(m => {
          const mod = C.MODULES[m];
          const note = mod.variants[branchKey];
          const role = b.rec.includes(m) ? "rek" : (b.opt || []).includes(m) ? "tillval" : null;
          return (
            <button key={m} onClick={() => onJump(m)} style={{ width: "100%", textAlign: "left", display: "block", padding: "12px 13px", marginBottom: 8, borderRadius: 11, border: "1px solid var(--c-line)", background: "var(--c-paper)", cursor: "pointer", boxShadow: "var(--shadow-sm)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 30, height: 30, flex: "none", borderRadius: 8, background: "var(--c-forest)", color: "#fff", display: "grid", placeItems: "center" }}><Icon name={mod.icon} size={15} /></span>
                <span style={{ fontWeight: 600, fontSize: 13.5, color: "var(--c-ink)", flex: 1, minWidth: 0 }}>{mod.name}</span>
                {mod.live === false && <Tag tone="roadmap">Roadmap</Tag>}
                {role && <Tag tone={role}>{role === "rek" ? "Rek" : "Tillval"}</Tag>}
                {mod.defaultPos === "konto" && <Tag tone="konto">Konto</Tag>}
              </div>
              <div style={{ fontSize: 12, color: note ? "var(--c-forest)" : "var(--c-ink-3)", marginTop: 7, lineHeight: 1.45 }}>
                {note ? <span>↳ {note}</span> : <span>Standard — ingen branschanpassning.</span>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Showcase() {
  const C = window.CFG;
  const [branch, setBranch] = useStateSc("tatuering");
  const [theme, setTheme] = useStateSc(C.BRANCHES.tatuering.theme);
  const [spec, setSpec] = useStateSc(false);
  const [device, setDevice] = useStateSc("desktop");
  const scrollRef = React.useRef(null);

  const pickBranch = (k) => { setBranch(k); setTheme(C.BRANCHES[k].theme); };
  const cfg = buildShowcaseCfg(branch, theme);

  const jump = (mod) => {
    const root = scrollRef.current;
    const el = root && root.querySelector(`[data-mod="${mod}"]`);
    if (!el) return;
    let sc = el.parentElement;
    while (sc && sc !== root) {
      const oy = getComputedStyle(sc).overflowY;
      if ((oy === "auto" || oy === "scroll") && sc.scrollHeight > sc.clientHeight) break;
      sc = sc.parentElement;
    }
    if (!sc || sc === root) sc = root.querySelector("[data-scrollwrap]");
    if (!sc) return;
    const top = el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - 16;
    sc.scrollTo({ top, behavior: "smooth" });
  };

  const url = branch + ".corevo.se";

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* top chrome */}
      <div style={{ flex: "none", height: 54, background: "var(--c-forest-700)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px", color: "#fff", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
          <div style={{ width: 30, height: 30, flex: "none", borderRadius: 8, background: "var(--c-gold)", color: "var(--c-forest-700)", display: "grid", placeItems: "center", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 17 }}>C</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 12.5, letterSpacing: ".02em", lineHeight: 1 }}>MODULKATALOG</div>
            <div style={{ fontSize: 11, color: "var(--c-on-forest-2)", marginTop: 2 }}>Storefront med alla moduler · referens</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {/* branch picker */}
          <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--c-on-forest-2)" }}>
            Bransch
            <select value={branch} onChange={e => pickBranch(e.target.value)} style={{ fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 600, padding: "7px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,.18)", background: "var(--c-forest)", color: "#fff", cursor: "pointer" }}>
              {Object.entries(C.BRANCHES).map(([k, b]) => <option key={k} value={k} style={{ color: "#222" }}>{b.name}</option>)}
            </select>
          </label>
          {/* theme picker */}
          <div style={{ display: "flex", gap: 4, background: "rgba(0,0,0,.2)", padding: 4, borderRadius: 9 }}>
            {Object.entries(C.ST_THEMES).map(([k, t]) => {
              const on = theme === k;
              return <button key={k} onClick={() => setTheme(k)} title={t.label} style={{ width: 22, height: 22, borderRadius: 6, border: on ? "2px solid #fff" : "2px solid transparent", background: t.primary, cursor: "pointer" }} />;
            })}
          </div>
          <button onClick={() => setSpec(s => !s)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 12px", borderRadius: 9, border: `1px solid ${spec ? "var(--c-gold)" : "rgba(255,255,255,.2)"}`, background: spec ? "var(--c-gold)" : "transparent", color: spec ? "#3A2A06" : "#fff", cursor: "pointer", fontFamily: "var(--font-ui)", fontSize: 12.5, fontWeight: 600 }}>
            <Icon name="layers" size={15} /> Spec-läge
          </button>
        </div>
      </div>

      {/* body: legend + live all-modules storefront */}
      <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
        <Legend branchKey={branch} onJump={jump} />
        <div ref={scrollRef} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", background: "var(--c-paper-2)", minHeight: 0 }}>
          <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 9, padding: "10px 18px" }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: "var(--c-success)", boxShadow: "0 0 0 3px var(--c-success-bg)" }} />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--c-ink)" }}>{C.BRANCHES[branch].name}</span>
            <span style={{ fontSize: 12, color: "var(--c-ink-3)" }}>· alla moduler aktiva · {device === "mobile" ? "mobil" : "desktop"}</span>
            <div style={{ marginLeft: "auto", display: "flex", gap: 2, background: "rgba(0,0,0,.06)", padding: 2, borderRadius: 8 }}>
              {[["desktop", "grid"], ["mobile", "creditCard"]].map(([k, ic]) => (
                <button key={k} onClick={() => setDevice(k)} style={{ width: 30, height: 24, borderRadius: 6, border: "none", cursor: "pointer", background: device === k ? "#fff" : "transparent", color: device === k ? "var(--c-forest)" : "var(--c-ink-3)", display: "grid", placeItems: "center" }}><Icon name={ic} size={13} /></button>
              ))}
            </div>
          </div>
          <div data-scrollwrap style={{ flex: 1, minHeight: 0, padding: "0 18px 18px", overflowY: "auto" }}>
            <BrowserFrame url={url} live device={device}>
              <Storefront cfg={cfg} setContent={() => {}} editMode={false} specOn={spec} />
            </BrowserFrame>
          </div>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<Showcase />);
