/* Salong-admin — Varumärke (M6 §3.6).
   Live-förhandsvisning som ändras när de ändrar. Byt bild/färg/font/text
   UTAN deploy (färg/font läses som runtime tenant_settings). Bunden frihet:
   tydligt VILKEN kontroll ändrar VAD + undo/tillbaka. Preview i STOREFRONT-
   världen för att bevisa att editorn driver salongens egen sida.          */
const { useState: useStateBR } = React;

const INIT_BRAND = { name: "Studio Salvia", color: "#5E7361", font: "Cormorant Garamond", hero: "Skarpt klippt. Skönt mottagen.", tagline: "Hårvård med lugn hand" };

function BrandingEditor() {
  const [brand, setBrandRaw] = useStateBR(INIT_BRAND);
  const [published, setPublished] = useStateBR(INIT_BRAND);
  const [history, setHistory] = useStateBR([]);
  const [changed, setChanged] = useStateBR(null);   // which field just changed (for highlight)
  const store = useStore();

  const colors = [["#5E7361", "Salvia-grön"], ["#9A8463", "Mässing"], ["#C77B53", "Terrakotta"], ["#7E6E92", "Lavendel"], ["#0A0A0A", "Svart"], ["#B0693F", "Lera"]];
  const fonts = ["Cormorant Garamond", "DM Serif Display", "Oswald", "Archivo", "Fredoka"];
  const dirty = JSON.stringify(brand) !== JSON.stringify(published);

  const set = (key, val) => { setHistory(h => [...h, brand]); setBrandRaw(b => ({ ...b, [key]: val })); setChanged(key); };
  const undo = () => setHistory(h => { if (!h.length) return h; const prev = h[h.length - 1]; setBrandRaw(prev); setChanged(null); return h.slice(0, -1); });
  const publish = () => { setPublished(brand); setHistory([]); setChanged(null); };

  const Ring = ({ field }) => changed === field ? <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--c-gold-600)", background: "var(--c-gold-100)", padding: "2px 7px", borderRadius: 999, marginLeft: 8 }}>ändrad</span> : null;
  const hl = field => changed === field ? { outline: "2px solid var(--c-gold)", outlineOffset: 3, borderRadius: 4, transition: "outline .2s" } : {};

  return (
    <div>
      <PageHead eyebrow="Studio Salvia" title="Varumärke"
        sub="Ändra bild, färg, typsnitt och text — du ser det direkt och inget kräver ny deploy.">
        <Button variant="ghost" icon="undo" onClick={undo} disabled={!history.length}>Ångra</Button>
        <Button variant="ghost" icon="external">Visa storefront</Button>
        <Button variant="gold" icon="check" onClick={publish} disabled={!dirty}>Publicera</Button>
      </PageHead>

      {/* dirty / published status bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "11px 16px", borderRadius: 12, marginBottom: 18, background: dirty ? "var(--c-warning-bg)" : "var(--c-success-bg)" }}>
        <Icon name={dirty ? "alert" : "check"} size={16} style={{ color: dirty ? "var(--c-warning)" : "var(--c-success)", flex: "none" }} />
        <span style={{ fontSize: 13, color: "var(--c-ink)", flex: 1 }}>{dirty ? "Osparade ändringar — förhandsvisningen uppdateras live. Tryck Publicera för att gå live." : "Allt publicerat. Storefronten visar senaste versionen."}</span>
        {dirty && <button onClick={undo} disabled={!history.length} style={{ border: "none", background: "transparent", color: "var(--c-forest)", fontWeight: 600, fontSize: 12.5, cursor: history.length ? "pointer" : "default", opacity: history.length ? 1 : 0.4, fontFamily: "var(--font-ui)" }}>Ångra senaste</button>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "390px 1fr", gap: 20, alignItems: "start" }} className="bo-brand">
        {/* controls */}
        <Card>
          <label style={{ display: "block" }}>
            <span style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center" }}>Salongsnamn<Ring field="name" /></span>
            <input value={brand.name} onChange={e => set("name", e.target.value)} style={{ width: "100%", marginTop: 6, padding: "11px 13px", borderRadius: 10, border: "1px solid var(--c-line)", background: "var(--c-paper)", fontFamily: "var(--font-ui)", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
          </label>

          <div style={{ marginTop: 18 }}>
            <span style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center" }}>Logga<Ring field="logo" /></span>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8, padding: 14, background: "var(--c-paper-2)", borderRadius: 12 }}>
              <div style={{ width: 48, height: 48, borderRadius: 10, border: "2px dashed var(--c-line-strong)", display: "grid", placeItems: "center", color: "var(--c-ink-3)" }}><Icon name="upload" size={18} /></div>
              <div style={{ fontSize: 12.5, color: "var(--c-ink-3)" }}>Dra hit eller <b style={{ color: "var(--c-forest)" }}>välj fil</b><div style={{ fontSize: 11, marginTop: 2 }}>Byts utan deploy (R2)</div></div>
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <span style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center" }}>Accentfärg<Ring field="color" /></span>
            <div style={{ display: "flex", gap: 9, marginTop: 8, flexWrap: "wrap" }}>
              {colors.map(([c, label]) => (
                <button key={c} title={label} onClick={() => set("color", c)} style={{ width: 38, height: 38, borderRadius: 10, background: c, cursor: "pointer", border: "2px solid var(--c-paper)", boxShadow: brand.color === c ? `0 0 0 2px ${c}` : "0 0 0 1px var(--c-line)" }} />
              ))}
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <span style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center" }}>Rubrik-typsnitt<Ring field="font" /></span>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
              {fonts.map(f => (
                <button key={f} onClick={() => set("font", f)} style={{ textAlign: "left", padding: "11px 14px", borderRadius: 10, border: `1.5px solid ${brand.font === f ? "var(--c-forest)" : "var(--c-line)"}`, background: brand.font === f ? "var(--c-paper-2)" : "var(--c-paper)", cursor: "pointer", fontFamily: `'${f}', serif`, fontSize: 18, color: "var(--c-ink)" }}>{f}</button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            <span style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center" }}>Hero-rubrik<Ring field="hero" /></span>
            <input value={brand.hero} onChange={e => set("hero", e.target.value)} style={{ width: "100%", marginTop: 6, padding: "11px 13px", borderRadius: 10, border: "1px solid var(--c-line)", background: "var(--c-paper)", fontFamily: "var(--font-ui)", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
          </div>
          <div style={{ marginTop: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center" }}>Tagline<Ring field="tagline" /></span>
            <input value={brand.tagline} onChange={e => set("tagline", e.target.value)} style={{ width: "100%", marginTop: 6, padding: "11px 13px", borderRadius: 10, border: "1px solid var(--c-line)", background: "var(--c-paper)", fontFamily: "var(--font-ui)", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
          </div>
        </Card>

        {/* live preview — STOREFRONT */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span className="eyebrow" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Icon name="sun" size={14} style={{ color: "var(--c-gold-600)" }} /> Live-förhandsvisning · storefront</span>
            {changed && <span style={{ fontSize: 12, color: "var(--c-gold-600)", fontWeight: 600 }}>Uppdaterade: {fieldLabel(changed)}</span>}
          </div>
          <div style={{ borderRadius: 18, overflow: "hidden", border: "1px solid var(--c-line)", boxShadow: "var(--shadow-md)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "#EDEAE3", borderBottom: "1px solid var(--c-line)" }}>
              <span style={{ width: 11, height: 11, borderRadius: 999, background: "#E0726A" }} /><span style={{ width: 11, height: 11, borderRadius: 999, background: "#E6B34D" }} /><span style={{ width: 11, height: 11, borderRadius: 999, background: "#7FB47F" }} />
              <div style={{ marginLeft: 10, fontSize: 12, color: "var(--c-ink-3)", fontFamily: "var(--font-ui)", background: "#fff", padding: "4px 12px", borderRadius: 999 }}>{brand.name.toLowerCase().replace(/[^a-z]/g, "")}.corevo.se</div>
            </div>
            <div style={{ position: "relative", height: 430, backgroundImage: `url(${(window.__resources && window.__resources.salonHero) || "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?w=1200&q=80&auto=format&fit=crop"})`, backgroundSize: "cover", backgroundPosition: "center" }}>
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,.28), rgba(0,0,0,.62))" }} />
              <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column", padding: 30 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ ...hl("name"), fontFamily: `'${brand.font}', serif`, fontSize: brand.font === "Oswald" ? 26 : 22, color: "#fff", fontWeight: 600, letterSpacing: brand.font === "Oswald" ? "0.08em" : 0, textTransform: brand.font === "Oswald" ? "uppercase" : "none" }}>{brand.name}</span>
                  <span style={{ ...hl("color"), background: brand.color, color: "#fff", fontFamily: "'Inter',sans-serif", fontSize: 12.5, fontWeight: 600, padding: "9px 18px", borderRadius: 999 }}>Boka tid</span>
                </div>
                <div style={{ marginTop: "auto" }}>
                  <span style={{ ...hl("tagline"), display: "inline-block", fontFamily: "'Inter',sans-serif", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,.85)" }}>— {brand.tagline}</span>
                  <h2 style={{ ...hl("hero"), fontFamily: `'${brand.font}', serif`, fontSize: 46, color: "#fff", margin: "10px 0 0", lineHeight: 1.06, fontWeight: 600, textTransform: brand.font === "Oswald" ? "uppercase" : "none", maxWidth: 460 }}>{brand.hero}</h2>
                  <span style={{ ...hl("color"), display: "inline-block", marginTop: 20, background: brand.color, color: "#fff", fontFamily: "'Inter',sans-serif", fontSize: 13, fontWeight: 600, padding: "12px 26px", borderRadius: 999 }}>Boka tid</span>
                </div>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center", padding: "12px 16px", background: "var(--c-gold-100)", borderRadius: 12 }}>
            <Icon name="info" size={16} style={{ color: "var(--c-gold-600)", flex: "none" }} />
            <span style={{ fontSize: 12.5, color: "var(--c-ink)" }}>Färg och typsnitt läses som runtime-inställningar — därför syns ändringen direkt utan deploy.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function fieldLabel(f) { return { name: "salongsnamn", color: "accentfärg", font: "typsnitt", hero: "hero-rubrik", tagline: "tagline", logo: "logga" }[f] || f; }

window.BrandingEditor = BrandingEditor;
