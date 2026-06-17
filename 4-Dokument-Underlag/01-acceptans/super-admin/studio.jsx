/* =====================================================================
   ONBOARDING STUDIO — left rail (phases/steps) + per-step control panels.
   The preview (right) stays live the whole time; this drives it.
   ===================================================================== */
const { useState: useStateW } = React;

/* ---- left step rail ---- */
function StepRail({ step, setStep, cfg }) {
  const PHASES = window.CFG.PHASES;
  const done = id => {
    if (id === "branch") return !!cfg.branch;
    if (id === "namn") return !!cfg.slug;
    if (id === "tema") return !!cfg.theme;
    if (id === "modval") return Object.values(cfg.modules).some(s => s && s !== "off");
    if (id === "tjanster") return cfg.content.services.length > 0;
    if (id === "agare") return !!cfg.owner.email;
    return false;
  };
  return (
    <div style={{ width: 248, flex: "none", background: "var(--c-forest)", color: "var(--c-on-forest)", height: "100%", overflowY: "auto", padding: "20px 14px" }}>
      <div style={{ padding: "0 8px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, flex: "none", borderRadius: 8, background: "var(--c-gold)", color: "var(--c-forest-700)", display: "grid", placeItems: "center", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 17 }}>C</div>
          <div style={{ minWidth: 0 }}><div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14.5, color: "#fff", whiteSpace: "nowrap" }}>Onboarding-studio</div><div style={{ fontSize: 9.5, color: "var(--c-on-forest-2)", letterSpacing: ".08em", textTransform: "uppercase", marginTop: 2 }}>Corevo plattform</div></div>
        </div>
      </div>
      {PHASES.map((ph, pi) => (
        <div key={ph.id} style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--c-on-forest-2)", opacity: .7, padding: "14px 10px 7px" }}>{pi + 1}. {ph.name}</div>
          {ph.steps.map(s => {
            const on = step === s.id;
            const ok = done(s.id);
            return (
              <button key={s.id} onClick={() => setStep(s.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 11, padding: "9px 11px", borderRadius: 9, border: "none", cursor: "pointer", textAlign: "left", fontFamily: "var(--font-ui)", background: on ? "var(--c-forest-700)" : "transparent", color: on ? "#fff" : "var(--c-on-forest-2)", borderLeft: on ? "2px solid var(--c-gold)" : "2px solid transparent", transition: "all var(--dur-fast)" }}
                onMouseEnter={e => { if (!on) e.currentTarget.style.background = "rgba(255,255,255,.05)"; }}
                onMouseLeave={e => { if (!on) e.currentTarget.style.background = "transparent"; }}>
                <span style={{ width: 22, height: 22, flex: "none", borderRadius: 999, display: "grid", placeItems: "center", background: ok ? "var(--c-gold)" : on ? "rgba(255,255,255,.12)" : "transparent", color: ok ? "var(--c-forest-700)" : "inherit", border: ok ? "none" : `1px solid ${on ? "rgba(255,255,255,.3)" : "var(--c-forest-300)"}` }}>
                  {ok ? <Icon name="check" size={13} /> : <Icon name={s.icon} size={13} />}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 13.5, fontWeight: on ? 600 : 500, display: "block" }}>{s.label}{s.req && <span style={{ color: "var(--c-gold)", marginLeft: 5 }}>•</span>}</span>
                </span>
              </button>
            );
          })}
        </div>
      ))}
      <div style={{ padding: "12px 10px", marginTop: 8, fontSize: 11, color: "var(--c-on-forest-2)", lineHeight: 1.5, borderTop: "1px solid var(--c-forest-300)" }}>
        <span style={{ color: "var(--c-gold)" }}>•</span> = krävs för att kunna lansera.
      </div>
    </div>
  );
}

/* ---- panel scaffold ---- */
function Panel({ title, sub, children, foot }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "22px 24px 16px", borderBottom: "1px solid var(--c-line)", flex: "none" }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 21, color: "var(--c-forest)", margin: 0 }}>{title}</h2>
        {sub && <p style={{ fontSize: 13, color: "var(--c-ink-2)", margin: "6px 0 0", lineHeight: 1.5 }}>{sub}</p>}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>{children}</div>
      {foot && <div style={{ flex: "none", padding: "14px 24px", borderTop: "1px solid var(--c-line)", background: "var(--c-paper)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>{foot}</div>}
    </div>
  );
}

/* ========================= STEP PANELS ========================= */
function PanelBranch({ cfg, A }) {
  const B = window.CFG.BRANCHES;
  return (
    <Panel title="Välj startmall" sub="Detta är ett deploy-verktyg: du väljer en mall + de moduler du vill ha. Branschen är bara en FÖRINSTÄLLNING (förifyller moduler, ord och innehåll) — inget låses, du ändrar allt fritt efteråt. Vill du börja rent, välj Generell. Branscher märkta «Roadmap» finns inte i verticals-tabellen än — de aktiveras genom en rad i verticals (sanningsdoc §7.2), inga nya tabeller behövs.">
      <SpecStrip icon="layers">Sätter <b>tenant_settings.settings.vertical</b> (kan vara <b className="num">generell</b>). DB har <b className="num">5 live</b> verticals (frisör, barbershop, nagelstudio, restaurang, generell); resten är roadmap. Driver bara DEFAULTS i <b>tenant_modules</b>, terminologi och bokningsvariant — en kodbas, inga låsningar.</SpecStrip>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10, marginTop: 16 }}>
        {Object.entries(B).map(([key, b]) => {
          const on = cfg.branch === key;
          return (
            <button key={key} onClick={() => A.setBranch(key)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", borderRadius: 12, border: `2px solid ${on ? "var(--c-forest)" : "var(--c-line)"}`, background: on ? "var(--c-paper-2)" : "var(--c-paper)", cursor: "pointer", textAlign: "left", transition: "all var(--dur-fast)" }}>
              <span style={{ width: 38, height: 38, flex: "none", borderRadius: 10, background: on ? "var(--c-forest)" : "var(--c-paper-2)", color: on ? "#fff" : "var(--c-forest)", display: "grid", placeItems: "center" }}><Icon name={b.icon} size={19} /></span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: 13.5, color: "var(--c-ink)" }}>{b.name}</span>
                  {b.live === false && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", padding: "1px 6px", borderRadius: 999, background: "var(--c-warning-bg)", color: "var(--c-warning)" }}>Roadmap</span>}
                </span>
                <span style={{ fontSize: 11.5, color: "var(--c-ink-3)" }}>{b.rec.length} moduler · {b.staffWord}</span>
              </span>
              {on && <Icon name="check" size={16} style={{ color: "var(--c-forest)", marginLeft: "auto" }} />}
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

function PanelNamn({ cfg, A }) {
  const reserved = window.CFG.DOMAIN.reserved.includes(cfg.slug);
  return (
    <Panel title="Namn & subdomän" sub="Kundens företagsnamn och adressen de får just nu. Egen domän är ett parkerat, spärrat spår — subdomän räcker tills du säger KÖR.">
      <div style={{ display: "grid", gap: 18 }}>
        <SField label="Företagsnamn" ph="t.ex. Klippoteket" val={cfg.name} on={v => A.setName(v)} hint="Går att ändra när som helst. Syns i header, footer, mail." />
        <div>
          <SField label="Subdomän" ph="klippoteket" val={cfg.slug} on={v => A.patch({ slug: v.toLowerCase().replace(/[^a-z0-9]/g, "") })} suffix=".corevo.se" />
          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <TChip>tenants.slug</TChip><TChip>tenant_domains</TChip>
          </div>
          {reserved && <div style={{ marginTop: 8, fontSize: 12.5, color: "var(--c-danger)", display: "flex", gap: 6, alignItems: "center" }}><Icon name="alert" size={14} /> "{cfg.slug}" är reserverad — kan inte bli en salongs-slug.</div>}
        </div>
        <SpecStrip icon="globe">Single-level <b className="num">*.corevo.se</b> täcks av gratis Universal SSL → Plattform-Worker host-parsar slug → tenant_id. Subdomänen skrivs i wrangler vid onboarding. Reserverade: {window.CFG.DOMAIN.reserved.join(", ")}.</SpecStrip>
      </div>
    </Panel>
  );
}

function PanelTema({ cfg, A }) {
  const T = window.CFG.ST_THEMES;
  return (
    <Panel title="Temamall" sub="Ett av sex byggda React-teman. Previewen byter direkt. (Nya vendor-mallar importeras som data via sajtbyggaren — kräver ett engångs-onboarding-jobb per mall.)">
      <div style={{ display: "grid", gap: 10 }}>
        {Object.entries(T).map(([key, t]) => {
          const on = cfg.theme === key;
          return (
            <button key={key} onClick={() => A.patch({ theme: key, branding: { ...cfg.branding, accent: null } })} style={{ display: "flex", alignItems: "center", gap: 14, padding: 12, borderRadius: 14, border: `2px solid ${on ? "var(--c-forest)" : "var(--c-line)"}`, background: "var(--c-paper)", cursor: "pointer", textAlign: "left" }}>
              <div style={{ width: 84, height: 56, flex: "none", borderRadius: 9, background: t.bg, border: `1px solid ${t.line}`, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 10px", overflow: "hidden" }}>
                <span style={{ fontFamily: t.display, fontSize: t.caps ? 17 : 16, color: t.fg, fontWeight: 600, textTransform: t.caps ? "uppercase" : "none", lineHeight: 1 }}>Aa</span>
                <span style={{ display: "inline-block", marginTop: 7, width: 34, height: 7, borderRadius: 999, background: t.primary }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14.5, color: "var(--c-ink)" }}>{t.label}</div>
                <div style={{ fontSize: 12, color: "var(--c-ink-3)", marginTop: 2 }}>{t.vibe}</div>
              </div>
              {on && <Icon name="check" size={18} style={{ color: "var(--c-forest)" }} />}
            </button>
          );
        })}
      </div>
      <div style={{ marginTop: 14 }}><TChip>tenant_settings.branding · settings.layout</TChip></div>
    </Panel>
  );
}

function PanelModval({ cfg, A }) {
  const M = window.CFG.MODULES;
  const b = window.CFG.BRANCHES[cfg.branch];
  const rec = b.rec, opt = b.opt || [];
  const others = Object.keys(M).filter(k => !rec.includes(k) && !opt.includes(k) && !M[k].infra);
  const Row = ({ k, tag }) => {
    const mod = M[k]; const state = cfg.modules[k] || "off"; const on = state !== "off";
    const variantNote = mod.variants[cfg.branch];
    return (
      <div style={{ padding: 14, border: `1px solid ${on ? "var(--c-forest)" : "var(--c-line)"}`, borderRadius: 12, background: on ? "color-mix(in srgb, var(--c-forest) 4%, var(--c-paper))" : "var(--c-paper)", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <span style={{ width: 34, height: 34, flex: "none", borderRadius: 9, background: on ? "var(--c-forest)" : "var(--c-paper-2)", color: on ? "#fff" : "var(--c-forest)", display: "grid", placeItems: "center" }}><Icon name={mod.icon} size={17} /></span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 600, fontSize: 14, color: "var(--c-ink)" }}>{mod.name}</span>
              {mod.core && <SBadge tone="gold" dot={false}>Kärna</SBadge>}
              {mod.live === false && <SBadge tone="warning" dot={false}>Roadmap</SBadge>}
              {mod.defaultPos === "konto" && <SBadge tone="info" dot={false}>Mitt konto</SBadge>}
              {tag && <SBadge tone={tag === "Rek" ? "success" : "neutral"} dot={false}>{tag}</SBadge>}
            </div>
            <div style={{ fontSize: 12, color: "var(--c-ink-2)", marginTop: 3, lineHeight: 1.45 }}>{mod.short}</div>
            {variantNote && <div style={{ fontSize: 12, color: "var(--c-forest)", marginTop: 5, lineHeight: 1.45 }}>↳ <b>{b.name}:</b> {variantNote}</div>}
            {mod.live === false && <div style={{ fontSize: 11.5, color: "var(--c-warning)", marginTop: 6, display: "flex", gap: 5, alignItems: "flex-start", lineHeight: 1.4 }}><Icon name="alert" size={12} style={{ marginTop: 1, flex: "none" }} /> Roadmap — ingen rad i <b className="num">modules</b> + ingen tabell än. Seedas innan deploy (sanningsdoc §7).</div>}
            <div style={{ marginTop: 7 }}><TChip>{mod.tables.slice(0, 2).join(" · ")}{mod.tables.length > 2 ? " +" + (mod.tables.length - 2) : ""}</TChip></div>
          </div>
          <SToggle on={on} locked={mod.core} set={v => A.setModule(k, v ? "live" : "off")} title="" />
        </div>
      </div>
    );
  };
  return (
    <Panel title="Välj moduler" sub={`Inget är låst till ${b.name} — du väljer fritt bland alla ${Object.keys(M).filter(k=>!M[k].infra).length} moduler. De rekommenderade är föraktiverade för branschen; resten slår du på precis lika enkelt.`}>
      <SpecStrip icon="layers">Skriver <b>tenant_modules.state</b> (off → live). Varje på-modul vävs in i storefronten via en <b className="num">&lt;corevo-module&gt;</b>-markör vid render (sajtbyggare §6.1). En kodbas — branschen styr bara <i>defaults</i>, inte vad som går att välja.</SpecStrip>
      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--c-gold-600)", marginBottom: 10 }}>Rekommenderat för {b.name}</div>
        {rec.map(k => <Row key={k} k={k} tag="Rek" />)}
        {opt.length > 0 && <><div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--c-ink-3)", margin: "18px 0 10px" }}>Passar ofta {b.name}</div>{opt.map(k => <Row key={k} k={k} tag="Tillval" />)}</>}
        {others.length > 0 && <><div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--c-ink-3)", margin: "18px 0 10px" }}>Övriga moduler — välj fritt</div>{others.map(k => <Row key={k} k={k} />)}</>}
      </div>
    </Panel>
  );
}

function PanelModplace({ cfg, A }) {
  const [drag, setDrag] = useStateW(null);
  const M = window.CFG.MODULES;
  const active = cfg.placement.main.filter(m => cfg.modules[m] && cfg.modules[m] !== "off" && !M[m].infra);
  const kontoActive = (cfg.placement.konto || []).filter(m => cfg.modules[m] && cfg.modules[m] !== "off" && !M[m].infra);
  const onDrop = (target) => {
    if (drag == null || drag === target) return;
    const list = [...cfg.placement.main];
    const from = list.indexOf(drag), to = list.indexOf(target);
    list.splice(to, 0, list.splice(from, 1)[0]);
    A.patch({ placement: { ...cfg.placement, main: list } });
    setDrag(null);
  };
  return (
    <Panel title="Placera & ordna" sub="Dra modulerna i den ordning de ska ligga på sidan. Detta blir ordningen på <corevo-module>-markörerna i tenant-layouten.">
      <SpecStrip icon="grid">Ordningen sparas i <b>tenant_site_pages</b> (layout-JSON). Render-bron läser den och placerar varje modul-markör i rätt sektion. <b>modules.default_section_position</b> ger startläget.</SpecStrip>
      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--c-ink-3)", marginBottom: 10 }}>Huvudyta — i ordning</div>
        {active.length === 0 && <div style={{ padding: 24, textAlign: "center", color: "var(--c-ink-3)", fontSize: 13 }}>Inga aktiva moduler. Slå på dem i föregående steg.</div>}
        {active.map((m, i) => (
          <div key={m} draggable onDragStart={() => setDrag(m)} onDragOver={e => e.preventDefault()} onDrop={() => onDrop(m)}
            style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", border: `1px solid ${drag === m ? "var(--c-forest)" : "var(--c-line)"}`, borderRadius: 11, background: drag === m ? "var(--c-paper-2)" : "var(--c-paper)", marginBottom: 8, cursor: "grab", boxShadow: "var(--shadow-sm)" }}>
            <Icon name="grip" size={18} style={{ color: "var(--c-ink-3)", flex: "none" }} />
            <span style={{ width: 22, height: 22, borderRadius: 6, background: "var(--c-paper-2)", color: "var(--c-forest)", display: "grid", placeItems: "center", fontFamily: "var(--font-ui)", fontWeight: 700, fontSize: 12, flex: "none" }}>{i + 1}</span>
            <span style={{ width: 30, height: 30, flex: "none", borderRadius: 8, background: "var(--c-forest)", color: "#fff", display: "grid", placeItems: "center" }}><Icon name={M[m].icon} size={15} /></span>
            <span style={{ fontWeight: 600, fontSize: 14, color: "var(--c-ink)", flex: 1 }}>{M[m].name}</span>
            <div style={{ display: "flex", gap: 4 }}>
              <button onClick={() => { if (i > 0) onDrop(active[i - 1]); setDrag(m); }} disabled={i === 0} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--c-line)", background: "var(--c-paper)", cursor: i === 0 ? "default" : "pointer", opacity: i === 0 ? 0.4 : 1, display: "grid", placeItems: "center" }}><Icon name="chevronDown" size={14} style={{ transform: "rotate(180deg)" }} /></button>
              <button onClick={() => { if (i < active.length - 1) { setDrag(m); onDrop(active[i + 1]); } }} disabled={i === active.length - 1} style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid var(--c-line)", background: "var(--c-paper)", cursor: i === active.length - 1 ? "default" : "pointer", opacity: i === active.length - 1 ? 0.4 : 1, display: "grid", placeItems: "center" }}><Icon name="chevronDown" size={14} /></button>
            </div>
          </div>
        ))}
        {kontoActive.length > 0 && (
          <div style={{ marginTop: 22 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--c-ink-3)", marginBottom: 4 }}>Mitt konto — kundportal</div>
            <div style={{ fontSize: 12, color: "var(--c-ink-3)", marginBottom: 10, lineHeight: 1.45 }}>Dessa visas i kundens inloggade portal (och i din admin) — inte på den publika sidan. Ingen ordning behövs.</div>
            {kontoActive.map(m => (
              <div key={m} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", border: "1px solid var(--c-line)", borderRadius: 11, background: "color-mix(in srgb, var(--c-forest) 3%, var(--c-paper))", marginBottom: 8 }}>
                <span style={{ width: 30, height: 30, flex: "none", borderRadius: 8, background: "var(--c-forest)", color: "#fff", display: "grid", placeItems: "center" }}><Icon name={M[m].icon} size={15} /></span>
                <span style={{ fontWeight: 600, fontSize: 14, color: "var(--c-ink)", flex: 1 }}>{M[m].name}</span>
                <SBadge tone="info" dot={false}>Mitt konto</SBadge>
              </div>
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}

function PanelModconf({ cfg, A }) {
  const M = window.CFG.MODULES;
  const b = window.CFG.BRANCHES[cfg.branch];
  const active = Object.keys(cfg.modules).filter(m => cfg.modules[m] && cfg.modules[m] !== "off" && !M[m].infra);
  return (
    <Panel title="Modulinställningar" sub="De bransch-specifika reglerna per modul. Det här är exakt vad Code måste bygga in i varje modul för att den ska funka enligt branschens arbetssätt.">
      {active.length === 0 && <div style={{ padding: 24, textAlign: "center", color: "var(--c-ink-3)", fontSize: 13 }}>Inga aktiva moduler.</div>}
      <div style={{ display: "grid", gap: 12 }}>
        {active.map(m => {
          const mod = M[m]; const note = mod.variants[cfg.branch];
          return (
            <SCard key={m} pad={16}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span style={{ width: 30, height: 30, flex: "none", borderRadius: 8, background: "var(--c-forest)", color: "#fff", display: "grid", placeItems: "center" }}><Icon name={mod.icon} size={15} /></span>
                <span style={{ fontWeight: 600, fontSize: 14.5, color: "var(--c-ink)" }}>{mod.name}</span>
                <span style={{ marginLeft: "auto" }}><SBadge tone="success" dot={false}>live</SBadge></span>
              </div>
              {note ? <div style={{ fontSize: 13, color: "var(--c-ink)", lineHeight: 1.5, padding: "10px 12px", background: "var(--c-paper-2)", borderRadius: 9, marginBottom: 10 }}><b>{b.name}:</b> {note}</div>
                : <div style={{ fontSize: 13, color: "var(--c-ink-2)", lineHeight: 1.5, marginBottom: 10 }}>{mod.short}</div>}
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--c-info)", marginBottom: 5 }}>Code bygger</div>
              <div style={{ fontSize: 12.5, color: "var(--c-ink-2)", lineHeight: 1.5, marginBottom: 10 }}>{mod.build}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{mod.tables.map(tb => <TChip key={tb}>{tb}</TChip>)}</div>
            </SCard>
          );
        })}
      </div>
    </Panel>
  );
}

function PanelBrand({ cfg, A }) {
  const t = window.CFG.ST_THEMES[cfg.theme];
  const accents = ["#5E7361", "#7E6E92", "#C8743C", "#B0693F", "#3A3733", "#A8455B", "#3E6B8C"];
  return (
    <Panel title="Branding" sub="Logga, accentfärg och täthet — token-lagret (no-code). Slår igenom på storefronten direkt, ingen deploy. Nivå-3 scoped CSS = kod i säker miljö, aldrig här.">
      <div style={{ display: "grid", gap: 20 }}>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>Logga</div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, padding: 14, background: "var(--c-paper-2)", borderRadius: 12 }}>
            <div style={{ width: 52, height: 52, borderRadius: 11, border: "2px dashed var(--c-line-strong)", display: "grid", placeItems: "center", color: "var(--c-ink-3)" }}><Icon name="upload" size={19} /></div>
            <div><div style={{ fontWeight: 600, fontSize: 13.5 }}>Ladda upp logga</div><div style={{ fontSize: 12, color: "var(--c-ink-3)", marginTop: 2 }}>PNG/SVG → R2 (media_assets) · valfritt</div></div>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>Accentfärg <span style={{ color: "var(--c-ink-3)", fontWeight: 400 }}>— skriver över temats primärfärg live</span></div>
          <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
            <button onClick={() => A.patch({ branding: { ...cfg.branding, accent: null } })} title="Temats standard" style={{ width: 36, height: 36, borderRadius: 9, background: t.primary, cursor: "pointer", border: !cfg.branding.accent ? "2px solid var(--c-forest)" : "2px solid var(--c-paper)", boxShadow: "0 0 0 1px var(--c-line)", display: "grid", placeItems: "center", color: "#fff" }}>{!cfg.branding.accent && <Icon name="check" size={14} />}</button>
            {accents.map(c => <button key={c} onClick={() => A.patch({ branding: { ...cfg.branding, accent: c } })} style={{ width: 36, height: 36, borderRadius: 9, background: c, cursor: "pointer", border: cfg.branding.accent === c ? "2px solid var(--c-forest)" : "2px solid var(--c-paper)", boxShadow: "0 0 0 1px var(--c-line)" }} />)}
          </div>
        </div>
        <SField label="Tagline (footer/meta)" ph={window.CFG.BRANCHES[cfg.branch].tagline} val={cfg.branding.metaTagline || ""} on={v => A.patch({ branding: { ...cfg.branding, metaTagline: v } })} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><TChip>tenant_settings.branding (jsonb)</TChip></div>
        <SpecStrip icon="palette">Färg/font/logo = nivå-1 tokens i <b>tenant_settings.branding</b>. Repaintar storefronten utan deploy. Premium-design (nivå-3) görs med kod, scopad under <b className="num">[data-tenant]</b>.</SpecStrip>
      </div>
    </Panel>
  );
}

function PanelText({ cfg, A, setEdit }) {
  return (
    <Panel title="Text & hjälte" sub="Skriv direkt här — eller klicka texten i previewen till höger och skriv där. Båda uppdaterar samma fält.">
      <div style={{ display: "grid", gap: 16 }}>
        <SBtn variant={cfg._edit ? "gold" : "ghost"} icon="edit" onClick={() => setEdit(!cfg._edit)} style={{ width: "fit-content" }}>{cfg._edit ? "Klicka-redigera är PÅ i previewen" : "Aktivera klicka-redigera i previewen"}</SBtn>
        <SField label="Rubrik (hero)" val={cfg.content.hero} on={v => A.setContent("hero", v)} ph="Din rubrik" />
        <div>
          <label style={{ fontSize: 12.5, fontWeight: 600, color: "var(--c-ink)" }}>Ingress</label>
          <textarea value={cfg.content.tagline} onChange={e => A.setContent("tagline", e.target.value)} rows={3} style={{ width: "100%", marginTop: 6, padding: "11px 13px", borderRadius: 10, border: "1px solid var(--c-line)", background: "var(--c-paper)", fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--c-ink)", outline: "none", boxSizing: "border-box", resize: "vertical" }} />
        </div>
        <SField label="Företagsnamn (header)" val={cfg.name} on={v => A.setName(v)} ph="Ditt företag" />
        <SpecStrip icon="edit">Text lagras i tenantens layout (<b>tenant_site_pages</b>, draft/publicerad), inte hårdkodat. Sajtbyggaren sparar draft → publicering bustar tenant-cachen.</SpecStrip>
      </div>
    </Panel>
  );
}

function PanelTjanster({ cfg, A }) {
  const b = window.CFG.BRANCHES[cfg.branch];
  const add = () => A.setContent("services", [...cfg.content.services, "Ny " + b.serviceWord.toLowerCase()]);
  const edit = (i, v) => { const s = [...cfg.content.services]; s[i] = v; A.setContent("services", s); };
  const del = i => A.setContent("services", cfg.content.services.filter((_, j) => j !== i));
  return (
    <Panel title={`${b.serviceWord}er & innehåll`} sub={`Datat modulerna visar (boknings-tjänster, shop-produkter, meny …). Minst en post med pris krävs för att lansera.`}>
      <SpecStrip icon="layers">Sparas i <b>services</b> + <b>service_prices</b> (öre). Bokningsmodulen läser dessa; shop läser <b>products</b>; meny läser <b>menu_items</b>. Pris i <b className="num">price_cents</b>.</SpecStrip>
      <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
        {cfg.content.services.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 28, height: 28, flex: "none", borderRadius: 7, background: "var(--c-paper-2)", color: "var(--c-forest)", display: "grid", placeItems: "center", fontFamily: "var(--font-ui)", fontWeight: 700, fontSize: 12 }}>{i + 1}</span>
            <div style={{ flex: 1 }}><SField val={s} on={v => edit(i, v)} /></div>
            <button onClick={() => del(i)} style={{ width: 34, height: 34, flex: "none", borderRadius: 8, border: "1px solid var(--c-line)", background: "var(--c-paper)", color: "var(--c-ink-3)", cursor: "pointer", display: "grid", placeItems: "center" }}><Icon name="trash" size={15} /></button>
          </div>
        ))}
        <SBtn variant="ghost" icon="plus" onClick={add} style={{ width: "fit-content" }}>Lägg till</SBtn>
      </div>
    </Panel>
  );
}

function PanelAgare({ cfg, A }) {
  return (
    <Panel title="Ägare & inbjudan" sub="Ägaren får en magic-link, bekräftar och sätter eget lösenord — och är inne i sin egen admin (M6) med rätt roll.">
      <div style={{ display: "grid", gap: 18 }}>
        <SField label="Ägarens namn" ph="Förnamn Efternamn" val={cfg.owner.name} on={v => A.patch({ owner: { ...cfg.owner, name: v } })} />
        <SField label="Ägarens e-post" type="email" ph="agare@foretag.se" val={cfg.owner.email} on={v => A.patch({ owner: { ...cfg.owner, email: v } })} hint="Får en engångs magic-link-invite vid lansering." />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><TChip>users (level 6 · owner)</TChip><TChip>roles</TChip><TChip>auth (magic-link)</TChip></div>
        <SpecStrip icon="shield">Skapar en <b>users</b>-rad med <b>tenant_id</b>-claim i JWT (app_metadata) → RLS låter ägaren bara se sin egen tenant. Roll = nivå 6 (owner). Cookie-domän <b className="num">.corevo.se</b> delar bara session, RLS skyddar datan.</SpecStrip>
      </div>
    </Panel>
  );
}

function PanelGranska({ cfg, A, go }) {
  const check = window.CFG.LAUNCH_CHECK;
  const status = c => {
    if (c.auto) return true;
    if (c.optional) return false;
    if (c.needs === "tema") return !!cfg.theme;
    if (c.needs === "modval") return Object.values(cfg.modules).some(s => s && s !== "off");
    if (c.needs === "tjanster") return cfg.content.services.length > 0;
    if (c.needs === "agare") return !!cfg.owner.email;
    return false;
  };
  return (
    <Panel title="Granska checklista" sub="Onboarding-checklistan (M7). Corevo agerar bara på det som fastnar. Grönt = klart, gult = valfritt/väntar.">
      <div style={{ display: "grid", gap: 10 }}>
        {check.map(c => {
          const ok = status(c);
          return (
            <div key={c.key} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: 14, border: "1px solid var(--c-line)", borderRadius: 12, background: "var(--c-paper)" }}>
              <span style={{ width: 26, height: 26, flex: "none", borderRadius: 999, background: ok ? "var(--c-success)" : c.optional ? "var(--c-warning-bg)" : "var(--c-paper-2)", color: ok ? "#fff" : c.optional ? "var(--c-warning)" : "var(--c-ink-3)", display: "grid", placeItems: "center" }}>{ok ? <Icon name="check" size={15} /> : c.optional ? <Icon name="minus" size={15} /> : <Icon name="clock" size={14} />}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: "var(--c-ink)" }}>{c.label}{c.optional && <span style={{ color: "var(--c-ink-3)", fontWeight: 400 }}> · valfritt</span>}</div>
                <div style={{ fontSize: 12.5, color: "var(--c-ink-3)", marginTop: 3, lineHeight: 1.45 }}>{c.detail}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 18 }}><SBtn variant="primary" icon="arrowRight" iconRight onClick={() => go("live")}>Gå till lansering</SBtn></div>
    </Panel>
  );
}

function PanelLive({ cfg, onLaunch }) {
  const ready = cfg.theme && Object.values(cfg.modules).some(s => s && s !== "off");
  return (
    <Panel title="Lansera" sub="Sista steget. Publicerar storefronten på subdomänen och bjuder in ägaren.">
      <div style={{ display: "grid", gap: 16 }}>
        <SCard pad={18} style={{ background: "var(--c-forest)", color: "#fff", border: "none" }}>
          <SEyebrow style={{ color: "var(--c-gold)" }}>Publiceras på</SEyebrow>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 24, margin: "8px 0 4px" }}>{cfg.slug || "dinsalong"}.corevo.se</div>
          <div style={{ fontSize: 13, color: "var(--c-on-forest-2)" }}>{Object.values(cfg.modules).filter(s => s && s !== "off").length} moduler aktiva · tema {cfg.theme}</div>
        </SCard>
        {!ready && <SpecStrip icon="alert">Kräver minst: tema och en aktiv modul. Komplettera i stegen ovan.</SpecStrip>}
        <div style={{ fontSize: 12.5, color: "var(--c-ink-2)", lineHeight: 1.6 }}>
          Vid lansering körs atomiskt: <b>tenants</b>-rad (status active) · <b>tenant_settings</b> · <b>tenant_modules</b> · ägar-<b>user</b> + magic-link · subdomän-route. Egen domän = parkerat spår (spärrad tills KÖR).
        </div>
        <SBtn variant="gold" size="lg" icon="rocket" disabled={!ready} onClick={onLaunch} style={{ justifyContent: "center" }}>Lansera {cfg.name || "kunden"}</SBtn>
      </div>
    </Panel>
  );
}

/* ---- studio shell: rail + active panel ---- */
function Studio({ cfg, A, step, setStep, onLaunch, setEdit }) {
  const panels = {
    branch: <PanelBranch cfg={cfg} A={A} />, namn: <PanelNamn cfg={cfg} A={A} />, tema: <PanelTema cfg={cfg} A={A} />,
    modval: <PanelModval cfg={cfg} A={A} />, modplace: <PanelModplace cfg={cfg} A={A} />, modconf: <PanelModconf cfg={cfg} A={A} />,
    brand: <PanelBrand cfg={cfg} A={A} />, text: <PanelText cfg={cfg} A={A} setEdit={setEdit} />, tjanster: <PanelTjanster cfg={cfg} A={A} />,
    agare: <PanelAgare cfg={cfg} A={A} />, granska: <PanelGranska cfg={cfg} A={A} go={setStep} />, live: <PanelLive cfg={cfg} onLaunch={onLaunch} />,
  };
  // flat ordered step list for prev/next
  const flat = window.CFG.PHASES.flatMap(p => p.steps.map(s => s.id));
  const idx = flat.indexOf(step);
  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0 }}>
      <StepRail step={step} setStep={setStep} cfg={cfg} />
      <div style={{ width: 420, flex: "none", borderRight: "1px solid var(--c-line)", background: "var(--c-cream)", display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ flex: 1, minHeight: 0 }}>{panels[step]}</div>
        <div style={{ flex: "none", padding: "12px 24px", borderTop: "1px solid var(--c-line)", background: "var(--c-paper)", display: "flex", justifyContent: "space-between", gap: 10 }}>
          <SBtn variant="ghost" icon="arrowLeft" size="sm" disabled={idx === 0} onClick={() => setStep(flat[idx - 1])}>Föregående</SBtn>
          {idx < flat.length - 1 ? <SBtn variant="primary" iconRight icon="arrowRight" size="sm" onClick={() => setStep(flat[idx + 1])}>Nästa</SBtn> : <span />}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Studio });
