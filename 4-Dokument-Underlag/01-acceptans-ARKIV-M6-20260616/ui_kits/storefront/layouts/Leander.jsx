/* Distinct grounded layouts — each a different CSS/structure, modeled on a real
   referenced Swedish salon site, all in the editorial photo-driven family.
   Themed via [data-theme] CSS vars so the booking drawer matches.
   Shared small bits first, then LayoutLeander (centered) + LayoutZigge (split). */
const { useState: useStateL, useEffect: useEffectL } = React;

function MiniNav({ t, onBook, onAccount, variant }) {
  // variant: "center" | "split" | "left"
  const links = ["Tjänster", "Om oss", "Frisörer", "Kontakt"];
  const pill = (
    <button onClick={onBook} style={{ fontFamily: "var(--font-body)", fontSize: 13.5, fontWeight: 600, color: "#fff", background: "var(--color-primary)", border: "none", padding: "11px 22px", borderRadius: 999, cursor: "pointer", letterSpacing: t.theme === "zigge" ? "0.08em" : "0.01em", textTransform: t.theme === "zigge" ? "uppercase" : "none" }}>Boka tid</button>
  );
  const wm = <span style={{ fontFamily: "var(--font-display)", fontWeight: t.logoStyle === "display" ? 400 : 600, fontSize: t.logoStyle === "display" ? 28 : 24, letterSpacing: t.logoStyle === "display" ? "0.12em" : "0.02em", color: "var(--color-fg)" }}>{t.wordmark}</span>;
  if (variant === "center") {
    return (
      <header style={{ borderBottom: "1px solid var(--color-line)", padding: "20px 28px", display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 20 }}>
        <nav style={{ display: "flex", gap: 26, fontFamily: "var(--font-body)", fontSize: 13.5, fontWeight: 500, color: "var(--color-fg-2)" }} className="sf-navlinks">{links.slice(0, 2).map(l => <span key={l}>{l}</span>)}</nav>
        <div style={{ textAlign: "center" }}>{wm}</div>
        <div style={{ display: "flex", gap: 20, alignItems: "center", justifyContent: "flex-end" }}>
          <nav style={{ display: "flex", gap: 26, fontFamily: "var(--font-body)", fontSize: 13.5, fontWeight: 500, color: "var(--color-fg-2)" }} className="sf-navlinks">{links.slice(2).map(l => <span key={l}>{l}</span>)}</nav>
          {pill}
        </div>
      </header>
    );
  }
  // split / left
  return (
    <header style={{ padding: "18px 30px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
      {wm}
      <div style={{ display: "flex", gap: 26, alignItems: "center" }}>
        <nav style={{ display: "flex", gap: 26, fontFamily: "var(--font-body)", fontSize: 13.5, fontWeight: 500, color: "var(--color-fg-2)" }} className="sf-navlinks">{links.map(l => <span key={l}>{l}</span>)}</nav>
        {pill}
        <button onClick={onAccount} aria-label="Konto" style={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 999, border: "1px solid var(--color-line)", background: "transparent", color: "var(--color-fg)", cursor: "pointer" }}><Icon name="user" size={18} /></button>
      </div>
    </header>
  );
}

function MiniFooter({ t }) {
  return (
    <footer style={{ borderTop: "1px solid var(--color-line)", padding: "40px 28px", textAlign: "center", background: "var(--color-surface)" }}>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--color-fg)", letterSpacing: t.logoStyle === "display" ? "0.1em" : "0.03em" }}>{t.wordmark}</div>
      <div style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--color-fg-2)", marginTop: 10 }}>{t.address} · {t.instagram}</div>
      <div style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 14, color: "var(--color-primary)", marginTop: 14 }}>Designad med omsorg</div>
    </footer>
  );
}

/* ── LAYOUT · LEANDER ─ studioleander.se: centered, symmetric, romantic ── */
function LayoutLeander({ t, onBook, onAccount }) {
  const [i, setI] = useStateL(0);
  useEffectL(() => { const id = setInterval(() => setI(p => (p + 1) % t.heroImages.length), 5000); return () => clearInterval(id); }, [t]);
  return (
    <div>
      <MiniNav t={t} onBook={onBook} onAccount={onAccount} variant="center" />
      {/* centered hero over team photo */}
      <section style={{ position: "relative", height: "min(82vh, 720px)", minHeight: 520, overflow: "hidden" }}>
        {t.heroImages.map((src, idx) => (
          <div key={idx} style={{ position: "absolute", inset: 0, backgroundImage: `url(${src})`, backgroundSize: "cover", backgroundPosition: "center", opacity: i === idx ? 1 : 0, transition: "opacity 1400ms ease" }} />
        ))}
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.42)" }} />
        <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 28px" }}>
          <span style={{ fontFamily: "var(--font-body)", fontSize: 12.5, letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(255,255,255,.85)" }}>{t.heroEyebrow}</span>
          <h1 className="sf-hero" style={{ color: "#fff", margin: "20px 0 0", whiteSpace: "pre-line", maxWidth: 820, textShadow: "0 2px 30px rgba(0,0,0,.3)" }}>{t.heroTitle}</h1>
          <p className="sf-lede" style={{ color: "rgba(255,255,255,.92)", maxWidth: 540, marginTop: 22 }}>{t.heroLede}</p>
          <button onClick={onBook} style={{ marginTop: 34, fontFamily: "var(--font-body)", fontSize: 15, fontWeight: 600, color: "#fff", background: "var(--color-primary)", border: "none", padding: "16px 40px", borderRadius: 999, cursor: "pointer", boxShadow: "0 12px 30px rgba(0,0,0,.25)" }}>Boka tid</button>
        </div>
      </section>
      {/* centered two-column price list */}
      <section style={{ maxWidth: 900, margin: "0 auto", padding: "96px 28px", textAlign: "center" }}>
        <span className="sf-eyebrow">— Behandlingar</span>
        <h2 className="sf-h1" style={{ color: "var(--color-fg)", margin: "12px 0 44px" }}>Prislista</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 56px", textAlign: "left" }} className="sf-about-grid">
          {t.services.map(s => (
            <div key={s.n} onClick={onBook} style={{ display: "flex", alignItems: "baseline", gap: 12, padding: "16px 0", borderBottom: "1px solid var(--color-line)", cursor: "pointer" }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "var(--color-fg)" }}>{s.name}</span>
              <span style={{ flex: 1, borderBottom: "1px dotted var(--color-line)", transform: "translateY(-4px)" }} />
              <span style={{ fontFamily: "var(--font-body)", fontWeight: 600, color: "var(--color-primary)" }}>{s.price}</span>
            </div>
          ))}
        </div>
      </section>
      {/* italic + centered stats */}
      <section style={{ background: "var(--color-accent-soft)", padding: "84px 28px", textAlign: "center" }}>
        <p className="sf-italic" style={{ fontSize: "clamp(24px,3vw,38px)", color: "var(--color-fg)", maxWidth: 720, margin: "0 auto", lineHeight: 1.3 }}>"{t.italic}"</p>
        <div style={{ display: "flex", justifyContent: "center", gap: 64, marginTop: 46, flexWrap: "wrap" }}>
          {t.stats.map(([n, l]) => (
            <div key={l}><div style={{ fontFamily: "var(--font-display)", fontSize: 44, color: "var(--color-primary)" }}>{n}</div><div className="sf-body" style={{ fontSize: 13, marginTop: 6 }}>{l}</div></div>
          ))}
        </div>
      </section>
      <MiniFooter t={t} />
    </div>
  );
}

window.LayoutLeander = LayoutLeander;
Object.assign(window, { MiniNav, MiniFooter });
